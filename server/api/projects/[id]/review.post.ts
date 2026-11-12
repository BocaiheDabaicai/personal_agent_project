import { and, eq, sql } from 'drizzle-orm'
import { startReviewRun } from '../../../agents/review-run'
import { nodes, projects } from '../../../db/schema'
import { db } from '../../../utils/db'
import { getRun } from '../../../utils/runManager'

export default defineEventHandler((event) => {
  const projectId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(projectId)) {
    throw createError({ statusCode: 400, statusMessage: '无效的项目 ID' })
  }

  const project = db.select().from(projects).where(eq(projects.id, projectId)).get()
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: '项目不存在' })
  }

  if (project.status !== 'in_progress' && project.status !== 'review_failed') {
    throw createError({ statusCode: 400, statusMessage: '当前状态不能开始审查' })
  }

  const existing = getRun(projectId)
  if (existing?.status === 'running') {
    throw createError({ statusCode: 409, statusMessage: '已有任务在运行' })
  }

  const planNodes = db
    .select()
    .from(nodes)
    .where(
      and(eq(nodes.projectId, projectId), eq(nodes.planVersion, project.currentPlanVersion)),
    )
    .all()

  const developNodes = planNodes.filter(node => node.kind === 'develop')
  if (developNodes.length === 0 || developNodes.some(node => node.status !== 'done')) {
    throw createError({ statusCode: 400, statusMessage: '开发节点尚未全部完成，不能开始审查' })
  }

  const reviewNodes = planNodes.filter(node => node.kind === 'review')
  if (reviewNodes.length === 0) {
    throw createError({ statusCode: 400, statusMessage: '计划中没有审查节点' })
  }

  db.update(projects)
    .set({ status: 'in_progress', updatedAt: sql`(datetime('now'))` })
    .where(eq(projects.id, projectId))
    .run()

  const run = startReviewRun(project)

  return { runId: run.id, status: run.status }
})
