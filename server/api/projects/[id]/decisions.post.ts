import { eq, sql } from 'drizzle-orm'
import { decisions, projects } from '../../../db/schema'
import { db } from '../../../utils/db'

const GATES = new Set(['plan', 'task', 'iteration'])
const ACTIONS = new Set(['approve', 'reject', 'changes'])

export default defineEventHandler(async (event) => {
  const projectId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(projectId)) {
    throw createError({ statusCode: 400, statusMessage: '无效的项目 ID' })
  }

  const project = db.select().from(projects).where(eq(projects.id, projectId)).get()
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: '项目不存在' })
  }

  const body = await readBody<{
    gate?: string
    decision?: string
    comment?: string
    nodeId?: number
  }>(event)

  const gate = body?.gate ?? 'plan'
  const decision = body?.decision ?? ''

  if (!GATES.has(gate)) {
    throw createError({ statusCode: 400, statusMessage: '无效的审批关卡' })
  }
  if (!ACTIONS.has(decision)) {
    throw createError({ statusCode: 400, statusMessage: '无效的决策' })
  }

  const comment = body?.comment?.trim() || null

  const row = db
    .insert(decisions)
    .values({
      projectId,
      nodeId: body?.nodeId ?? null,
      gate,
      decision,
      comment,
    })
    .returning()
    .get()

  if (gate === 'plan') {
    const status = decision === 'approve' ? 'approved' : decision === 'reject' ? 'plan_rejected' : 'planned'
    db.update(projects)
      .set({ status, updatedAt: sql`(datetime('now'))` })
      .where(eq(projects.id, projectId))
      .run()
  }

  return row
})
