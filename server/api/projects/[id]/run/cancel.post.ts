import { eq } from 'drizzle-orm'
import { projects } from '../../../../db/schema'
import { db } from '../../../../utils/db'
import { cancelRun, getRun } from '../../../../utils/runManager'

export default defineEventHandler((event) => {
  const projectId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(projectId)) {
    throw createError({ statusCode: 400, statusMessage: '无效的项目 ID' })
  }

  const project = db.select().from(projects).where(eq(projects.id, projectId)).get()
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: '项目不存在' })
  }

  const run = getRun(projectId)
  if (!run || run.status !== 'running') {
    throw createError({ statusCode: 400, statusMessage: '没有正在运行的任务' })
  }

  cancelRun(run)
  return { runId: run.id, status: run.status }
})
