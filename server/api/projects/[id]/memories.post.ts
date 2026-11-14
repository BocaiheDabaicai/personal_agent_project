import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { projects } from '../../../db/schema'
import {
  createMemory,
  type MemoryKind,
  type MemoryScope,
} from '../../../memory/service'
import { db } from '../../../utils/db'

const KINDS: MemoryKind[] = ['episodic', 'semantic', 'procedural']
const SCOPES: MemoryScope[] = ['project', 'global']

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
  }
  if (typeof value === 'string') {
    return value
      .split(/[,，]/)
      .map(tag => tag.trim())
      .filter(Boolean)
  }
  return []
}

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
    kind?: string
    title?: string
    content?: string
    tags?: unknown
    scope?: string
    pinned?: boolean
  }>(event)

  const title = body?.title?.trim()
  const content = body?.content?.trim()
  if (!title || !content) {
    throw createError({ statusCode: 400, statusMessage: '记忆标题和内容不能为空' })
  }

  const kind = KINDS.includes(body?.kind as MemoryKind)
    ? (body?.kind as MemoryKind)
    : 'semantic'
  const scope = SCOPES.includes(body?.scope as MemoryScope)
    ? (body?.scope as MemoryScope)
    : kind === 'semantic'
      ? 'global'
      : 'project'

  return createMemory({
    projectId,
    scope,
    kind,
    title,
    content,
    tags: normalizeTags(body?.tags),
    source: { type: 'manual' },
    sourceKey: `manual:${randomUUID()}`,
    pinned: body?.pinned === true,
  })
})
