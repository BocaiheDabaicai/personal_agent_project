import { and, desc, eq } from 'drizzle-orm'
import { projects, reviews } from '../../../db/schema'
import { db } from '../../../utils/db'

function parseIssues(raw: string): unknown[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export default defineEventHandler((event) => {
  const projectId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(projectId)) {
    throw createError({ statusCode: 400, statusMessage: '无效的项目 ID' })
  }

  const project = db.select().from(projects).where(eq(projects.id, projectId)).get()
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: '项目不存在' })
  }

  return db
    .select()
    .from(reviews)
    .where(
      and(eq(reviews.projectId, projectId), eq(reviews.planVersion, project.currentPlanVersion)),
    )
    .orderBy(desc(reviews.id))
    .limit(100)
    .all()
    .map(row => ({
      ...row,
      issues: parseIssues(row.issues),
    }))
})
