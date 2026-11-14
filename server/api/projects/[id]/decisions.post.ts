import { and, eq, sql } from 'drizzle-orm'
import { decisions, nodes, projects } from '../../../db/schema'
import { distillDecisionMemory, distillProceduralMemory } from '../../../memory/service'
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

  if (gate === 'task') {
    if (project.status !== 'reviewed') {
      throw createError({ statusCode: 400, statusMessage: '当前状态不能进行人工验收' })
    }
    if (decision !== 'approve' && !comment) {
      throw createError({ statusCode: 400, statusMessage: '打回时请填写原因' })
    }

    const gateNode = db
      .select()
      .from(nodes)
      .where(
        and(
          eq(nodes.projectId, projectId),
          eq(nodes.planVersion, project.currentPlanVersion),
          eq(nodes.kind, 'gate'),
        ),
      )
      .get()

    if (!gateNode) {
      throw createError({ statusCode: 400, statusMessage: '找不到人工验收节点' })
    }

    const row = db.transaction((tx) => {
      const created = tx
        .insert(decisions)
        .values({
          projectId,
          nodeId: gateNode.id,
          gate,
          decision,
          comment,
        })
        .returning()
        .get()

      const approved = decision === 'approve'
      tx.update(nodes)
        .set({ status: approved ? 'done' : 'failed' })
        .where(eq(nodes.id, gateNode.id))
        .run()
      tx.update(projects)
        .set({
          status: approved ? 'done' : 'changes_requested',
          updatedAt: sql`(datetime('now'))`,
        })
        .where(eq(projects.id, projectId))
        .run()

      return created
    })

    try {
      distillDecisionMemory(projectId, row.id)
      if (decision === 'approve') {
        distillProceduralMemory(projectId)
      }
    } catch (error) {
      console.error('[decisions] 无法生成人工验收记忆：', error)
    }

    return row
  }

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
    const status =
      decision === 'approve' ? 'approved' : decision === 'reject' ? 'plan_rejected' : 'planned'
    db.update(projects)
      .set({ status, updatedAt: sql`(datetime('now'))` })
      .where(eq(projects.id, projectId))
      .run()
  }

  try {
    distillDecisionMemory(projectId, row.id)
  } catch (error) {
    console.error('[decisions] 无法生成决策记忆：', error)
  }

  return row
})
