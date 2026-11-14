import { and, eq, sql } from 'drizzle-orm'
import { edges, nodes, projects, reviews, type Project } from '../db/schema'
import { db } from '../utils/db'
import { distillReviewMemory } from '../memory/service'
import { ensureWorkspace, git } from '../utils/workspace'
import { createRun, emitRunEvent, finishRun, type RunState } from '../utils/runManager'
import { reviewDevelopNode } from './reviewer'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function verificationSummaryFor(node: { verificationResult: string | null }): string {
  if (!node.verificationResult) {
    return '未配置确定性验收'
  }
  try {
    const parsed = JSON.parse(node.verificationResult) as {
      ok?: boolean
      summary?: string
      checks?: unknown[]
    }
    return `${parsed.ok ? '通过' : '未通过'}：${parsed.summary ?? ''}（${
      parsed.checks?.length ?? 0
    } 项检查）`
  } catch {
    return '验收结果无法解析'
  }
}

function findCommitForNode(repoPath: string, nodeKey: string): string | undefined {
  try {
    const output = git(repoPath, [
      'log',
      '--all',
      '--format=%H',
      '--fixed-strings',
      '--grep',
      `node: ${nodeKey}`,
    ]).trim()
    return output.split('\n')[0] || undefined
  } catch {
    return undefined
  }
}

async function executeReviewRun(run: RunState, project: Project): Promise<void> {
  try {
    const repoPath = ensureWorkspace(project.id)
    const planNodes = db
      .select()
      .from(nodes)
      .where(
        and(eq(nodes.projectId, project.id), eq(nodes.planVersion, project.currentPlanVersion)),
      )
      .orderBy(nodes.order)
      .all()
    const planEdges = db
      .select()
      .from(edges)
      .where(
        and(eq(edges.projectId, project.id), eq(edges.planVersion, project.currentPlanVersion)),
      )
      .all()

    const nodeMap = new Map(planNodes.map(node => [node.nodeKey, node]))
    const reviewNodes = planNodes.filter(node => node.kind === 'review')
    const planOutline = planNodes
      .map(node => `${node.order + 1}. [${node.kind}] ${node.title}`)
      .join('\n')

    if (reviewNodes.length === 0) {
      finishRun(run, 'failed', '计划中没有审查节点')
      return
    }

    let allPass = true

    for (const reviewNode of reviewNodes) {
      if (run.status !== 'running') {
        return
      }

      const incoming = planEdges.find(
        edge =>
          edge.targetKey === reviewNode.nodeKey &&
          nodeMap.get(edge.sourceKey)?.kind === 'develop',
      )
      const developNode = incoming ? nodeMap.get(incoming.sourceKey) : undefined

      if (!developNode) {
        db.update(nodes).set({ status: 'failed' }).where(eq(nodes.id, reviewNode.id)).run()
        emitRunEvent(run, {
          type: 'node_failed',
          nodeKey: reviewNode.nodeKey,
          title: reviewNode.title,
          error: '找不到对应的开发节点',
        })
        db.update(projects)
          .set({ status: 'review_failed', updatedAt: sql`(datetime('now'))` })
          .where(eq(projects.id, project.id))
          .run()
        finishRun(run, 'failed', '审查节点缺少对应的开发节点')
        return
      }

      const commitHash = developNode.commitHash || findCommitForNode(repoPath, developNode.nodeKey)
      if (!commitHash) {
        db.update(nodes).set({ status: 'failed' }).where(eq(nodes.id, reviewNode.id)).run()
        const message = `找不到开发节点 ${developNode.nodeKey} 的提交`
        emitRunEvent(run, {
          type: 'node_failed',
          nodeKey: reviewNode.nodeKey,
          title: reviewNode.title,
          error: message,
        })
        db.update(projects)
          .set({ status: 'review_failed', updatedAt: sql`(datetime('now'))` })
          .where(eq(projects.id, project.id))
          .run()
        finishRun(run, 'failed', message)
        return
      }

      db.update(nodes).set({ status: 'running' }).where(eq(nodes.id, reviewNode.id)).run()
      emitRunEvent(run, {
        type: 'node_start',
        nodeKey: reviewNode.nodeKey,
        title: reviewNode.title,
        text: `开始：${reviewNode.title}`,
      })

      try {
        const review = await reviewDevelopNode(
          {
            projectName: project.name,
            goal: project.goal,
            planSummary: planOutline,
            repoPath,
            reviewNode: {
              nodeKey: reviewNode.nodeKey,
              title: reviewNode.title,
              spec: reviewNode.spec,
              order: reviewNode.order,
            },
            developNode: {
              nodeKey: developNode.nodeKey,
              title: developNode.title,
              spec: developNode.spec,
              order: developNode.order,
            },
            commitHash,
            verificationSummary: verificationSummaryFor(developNode),
          },
          {
            onText: (text) => {
              if (text.trim()) {
                emitRunEvent(run, { type: 'text', text })
              }
            },
            onToolUse: (name, input) => {
              emitRunEvent(run, { type: 'tool_use', name, input })
            },
            onToolResult: (name, output, ok) => {
              emitRunEvent(run, { type: 'tool_result', name, output, ok })
            },
          },
          run.abortController,
        )

        if (run.status !== 'running') {
          db.update(nodes).set({ status: 'pending' }).where(eq(nodes.id, reviewNode.id)).run()
          return
        }

        db.insert(reviews)
          .values({
            projectId: project.id,
            planVersion: project.currentPlanVersion,
            reviewNodeKey: reviewNode.nodeKey,
            developNodeKey: developNode.nodeKey,
            commitHash,
            verdict: review.verdict,
            summary: review.summary,
            issues: JSON.stringify(review.issues),
            runId: run.id,
          })
          .run()

        db.update(nodes)
          .set({ status: review.verdict === 'pass' ? 'done' : 'failed' })
          .where(eq(nodes.id, reviewNode.id))
          .run()

        if (review.verdict !== 'pass') {
          allPass = false
        }

        emitRunEvent(run, {
          type: 'node_done',
          nodeKey: reviewNode.nodeKey,
          title: reviewNode.title,
          verdict: review.verdict,
          text: `${review.verdict === 'pass' ? '通过' : '未通过'}：${review.summary}`,
        })
      } catch (error) {
        if (run.status === 'cancelled') {
          db.update(nodes).set({ status: 'pending' }).where(eq(nodes.id, reviewNode.id)).run()
          return
        }
        const message = errorMessage(error)
        db.update(nodes).set({ status: 'failed' }).where(eq(nodes.id, reviewNode.id)).run()
        emitRunEvent(run, {
          type: 'node_failed',
          nodeKey: reviewNode.nodeKey,
          title: reviewNode.title,
          error: message,
        })
        db.update(projects)
          .set({ status: 'review_failed', updatedAt: sql`(datetime('now'))` })
          .where(eq(projects.id, project.id))
          .run()
        finishRun(run, 'failed', message)
        return
      }
    }

    db.update(projects)
      .set({
        status: allPass ? 'reviewed' : 'review_failed',
        updatedAt: sql`(datetime('now'))`,
      })
      .where(eq(projects.id, project.id))
      .run()

    try {
      distillReviewMemory(project.id, run.id)
    } catch (error) {
      console.error('[review] 无法生成审查记忆：', error)
    }

    finishRun(
      run,
      'done',
      allPass
        ? '审查全部通过，等待人工验收（Step 11）'
        : '审查未通过，需修复后迭代（Step 11）',
    )
  } catch (error) {
    if (run.status === 'cancelled') {
      return
    }
    const message = errorMessage(error)
    emitRunEvent(run, { type: 'error', error: message })
    finishRun(run, 'failed', message)
  }
}

export function startReviewRun(project: Project): RunState {
  const run = createRun(project.id, 'review')
  emitRunEvent(run, {
    type: 'run_start',
    text: `开始审查计划 v${project.currentPlanVersion}`,
  })
  void executeReviewRun(run, project)
  return run
}
