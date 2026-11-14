import { eq } from 'drizzle-orm'
import { projects } from '../../../../db/schema'
import { db } from '../../../../utils/db'
import { getLatestRun, getRun } from '../../../../utils/runManager'

export default defineEventHandler((event) => {
  const projectId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(projectId)) {
    throw createError({ statusCode: 400, statusMessage: '无效的项目 ID' })
  }

  const project = db.select().from(projects).where(eq(projects.id, projectId)).get()
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: '项目不存在' })
  }

  const liveRun = getRun(projectId)
  if (liveRun) {
    return {
      active: liveRun.status === 'running',
      run: {
        id: liveRun.id,
        kind: liveRun.kind,
        status: liveRun.status,
        startedAt: liveRun.startedAt,
        finishedAt: liveRun.finishedAt ?? null,
        error: liveRun.error ?? null,
        eventCount: liveRun.nextSeq - 1,
      },
    }
  }

  const latest = getLatestRun(projectId)
  if (!latest) {
    return { active: false, run: null }
  }

  return {
    active: latest.status === 'running',
    run: {
      id: latest.id,
      kind: latest.kind,
      status: latest.status,
      startedAt: latest.startedAt,
      finishedAt: latest.finishedAt,
      error: latest.error,
      eventCount: latest.eventCount,
    },
  }
})
