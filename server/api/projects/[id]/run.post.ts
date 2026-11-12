import { and, eq, sql } from 'drizzle-orm'
import { startDevelopmentRun } from '../../../agents/developer-run'
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

  if (project.status !== 'approved' && project.status !== 'in_progress') {
    throw createError({ statusCode: 400, statusMessage: '计划尚未批准，不能开始开发' })
  }

  const existing = getRun(projectId)
  if (existing?.status === 'running') {
    throw createError({ statusCode: 409, statusMessage: '已有开发任务在运行' })
  }

  const developNodes = db
    .select()
    .from(nodes)
    .where(
      and(
        eq(nodes.projectId, projectId),
        eq(nodes.planVersion, project.currentPlanVersion),
        eq(nodes.kind, 'develop'),
      ),
    )
    .all()

  if (developNodes.every(node => node.status === 'done')) {
    throw createError({ statusCode: 400, statusMessage: '没有待执行的开发节点' })
  }

  db.update(projects)
    .set({ status: 'in_progress', updatedAt: sql`(datetime('now'))` })
    .where(eq(projects.id, projectId))
    .run()

  const run = startDevelopmentRun(project)

  return { runId: run.id, status: run.status }
})
