import { desc } from 'drizzle-orm'
import { projects } from '../db/schema'
import { db } from '../utils/db'

export default defineEventHandler(() => {
  return db.select().from(projects).orderBy(desc(projects.id)).all()
})
