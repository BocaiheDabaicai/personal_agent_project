import { and, eq } from 'drizzle-orm'
import { edges, nodes, projects } from '../../../db/schema'
import { db } from '../../../utils/db'

export default defineEventHandler((event) => {
  const projectId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(projectId)) {
    throw createError({ statusCode: 400, statusMessage: '无效的项目 ID' })
  }

  const project = db.select().from(projects).where(eq(projects.id, projectId)).get()
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: '项目不存在' })
  }

  if (project.currentPlanVersion === 0) {
    return { planVersion: 0, nodes: [], edges: [] }
  }

  const nodeRows = db
    .select()
    .from(nodes)
    .where(and(eq(nodes.projectId, projectId), eq(nodes.planVersion, project.currentPlanVersion)))
    .orderBy(nodes.order)
    .all()

  const edgeRows = db
    .select()
    .from(edges)
    .where(and(eq(edges.projectId, projectId), eq(edges.planVersion, project.currentPlanVersion)))
    .all()

  return { planVersion: project.currentPlanVersion, nodes: nodeRows, edges: edgeRows }
})
