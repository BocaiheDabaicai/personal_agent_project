import { and, eq, sql } from 'drizzle-orm'
import { generatePlan } from '../../../agents/planner'
import { edges, nodes, projects } from '../../../db/schema'
import { db } from '../../../utils/db'
import { getRun } from '../../../utils/runManager'
import { ensureWorkspace } from '../../../utils/workspace'

export default defineEventHandler(async (event) => {
  const projectId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(projectId)) {
    throw createError({ statusCode: 400, statusMessage: '无效的项目 ID' })
  }

  const project = db.select().from(projects).where(eq(projects.id, projectId)).get()
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: '项目不存在' })
  }

  const activeRun = getRun(projectId)
  if (activeRun?.status === 'running') {
    throw createError({ statusCode: 409, statusMessage: '已有任务在运行，不能生成计划' })
  }

  let body: { feedback?: unknown } = {}
  try {
    body = (await readBody<{ feedback?: unknown }>(event)) ?? {}
  } catch {
    body = {}
  }
  const feedback =
    typeof body.feedback === 'string' ? body.feedback.trim().slice(0, 4000) : ''

  const repoPath = ensureWorkspace(projectId)

  let plan
  try {
    plan = await generatePlan(
      {
        id: project.id,
        name: project.name,
        goal: project.goal,
        repoPath,
        planVersion: project.currentPlanVersion,
      },
      feedback,
    )
  } catch (error) {
    throw createError({
      statusCode: 502,
      statusMessage: error instanceof Error ? error.message : '规划失败',
    })
  }

  const planVersion = project.currentPlanVersion + 1
  const orderedNodes = [...plan.nodes].sort((a, b) => a.order - b.order)

  db.transaction((tx) => {
    tx.delete(nodes)
      .where(and(eq(nodes.projectId, projectId), eq(nodes.planVersion, planVersion)))
      .run()
    tx.delete(edges)
      .where(and(eq(edges.projectId, projectId), eq(edges.planVersion, planVersion)))
      .run()

    if (orderedNodes.length > 0) {
      tx.insert(nodes)
        .values(
          orderedNodes.map((node, index) => ({
            projectId,
            planVersion,
            nodeKey: node.id,
            kind: node.kind,
            title: node.title,
            spec: node.spec,
            order: node.order,
            status: 'pending',
            x: 80 + index * 280,
            y: 140,
          })),
        )
        .run()
    }

    if (plan.edges.length > 0) {
      tx.insert(edges)
        .values(
          plan.edges.map(edge => ({
            projectId,
            planVersion,
            sourceKey: edge.source,
            targetKey: edge.target,
          })),
        )
        .run()
    }

    tx.update(projects)
      .set({
        currentPlanVersion: planVersion,
        status: 'planned',
        updatedAt: sql`(datetime('now'))`,
      })
      .where(eq(projects.id, projectId))
      .run()
  })

  return { planVersion, plan }
})
