import { desc, eq } from 'drizzle-orm'
import { decisions } from '../../../db/schema'
import { db } from '../../../utils/db'

export default defineEventHandler((event) => {
  const projectId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(projectId)) {
    throw createError({ statusCode: 400, statusMessage: '无效的项目 ID' })
  }

  return db
    .select()
    .from(decisions)
    .where(eq(decisions.projectId, projectId))
    .orderBy(desc(decisions.id))
    .limit(20)
    .all()
})
