import { projects } from '../db/schema'
import { db } from '../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ name?: string; goal?: string }>(event)
  const name = body?.name?.trim()
  const goal = body?.goal?.trim()

  if (!name || !goal) {
    throw createError({ statusCode: 400, statusMessage: '项目名称和目标不能为空' })
  }

  return db.insert(projects).values({ name, goal }).returning().get()
})
