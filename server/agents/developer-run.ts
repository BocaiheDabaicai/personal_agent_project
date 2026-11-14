import { and, eq } from 'drizzle-orm'
import { nodes, type Project } from '../db/schema'
import { db } from '../utils/db'
import { ensureWorkspace, git } from '../utils/workspace'
import { createRun, emitRunEvent, finishRun, type RunState } from '../utils/runManager'
import { runDeveloperNode } from './developer'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function commitNode(repoPath: string, node: { title: string; nodeKey: string }): string | undefined {
  const status = git(repoPath, ['status', '--porcelain']).trim()
  if (!status) {
    return undefined
  }

  git(repoPath, ['add', '-A'])
  git(repoPath, ['commit', '-m', `feat: ${node.title}`, '-m', `node: ${node.nodeKey}`])
  return git(repoPath, ['rev-parse', '--short', 'HEAD']).trim()
}

async function executeRun(run: RunState, project: Project): Promise<void> {
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

    const planOutline = planNodes
      .map(node => `${node.order + 1}. [${node.kind}] ${node.title}`)
      .join('\n')
    const targets = planNodes.filter(node => node.kind === 'develop' && node.status !== 'done')

    if (targets.length === 0) {
      finishRun(run, 'done', '没有待执行的开发节点')
      return
    }

    for (const node of targets) {
      if (run.status !== 'running') {
        return
      }

      db.update(nodes).set({ status: 'running' }).where(eq(nodes.id, node.id)).run()
      emitRunEvent(run, {
        type: 'node_start',
        nodeKey: node.nodeKey,
        title: node.title,
        text: `开始：${node.title}`,
      })

      try {
        await runDeveloperNode(
          {
            projectName: project.name,
            goal: project.goal,
            planSummary: planOutline,
            repoPath,
            node: {
              nodeKey: node.nodeKey,
              title: node.title,
              spec: node.spec,
              order: node.order,
            },
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
          db.update(nodes).set({ status: 'pending' }).where(eq(nodes.id, node.id)).run()
          return
        }

        const commit = commitNode(repoPath, node)
        db.update(nodes)
          .set({ status: 'done', commitHash: commit ?? node.commitHash })
          .where(eq(nodes.id, node.id))
          .run()
        emitRunEvent(run, {
          type: 'node_done',
          nodeKey: node.nodeKey,
          title: node.title,
          commit,
          text: `完成：${node.title}`,
        })
      } catch (error) {
        if (run.status === 'cancelled') {
          db.update(nodes).set({ status: 'pending' }).where(eq(nodes.id, node.id)).run()
          return
        }
        const message = errorMessage(error)
        db.update(nodes).set({ status: 'failed' }).where(eq(nodes.id, node.id)).run()
        emitRunEvent(run, {
          type: 'node_failed',
          nodeKey: node.nodeKey,
          title: node.title,
          error: message,
        })
        finishRun(run, 'failed', message)
        return
      }
    }

    finishRun(run, 'done', '开发节点已完成，等待审查（Step 10）')
  } catch (error) {
    if (run.status === 'cancelled') {
      return
    }
    const message = errorMessage(error)
    emitRunEvent(run, { type: 'error', error: message })
    finishRun(run, 'failed', message)
  }
}

export function startDevelopmentRun(project: Project): RunState {
  const run = createRun(project.id, 'develop')
  emitRunEvent(run, {
    type: 'run_start',
    text: `开始执行计划 v${project.currentPlanVersion}`,
  })
  void executeRun(run, project)
  return run
}
