import { eq } from 'drizzle-orm'
import { projects } from '../../../../db/schema'
import { db } from '../../../../utils/db'
import { getRun } from '../../../../utils/runManager'

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
  if (!run) {
    return { active: false, run: null }
  }

  return {
    active: run.status === 'running',
    run: {
      id: run.id,
      kind: run.kind,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt ?? null,
      eventCount: run.events.length,
    },
  }
})
