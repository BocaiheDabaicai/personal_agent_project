import {
  updateMemory,
  type MemoryKind,
  type MemoryScope,
} from '../../memory/service'

const KINDS: MemoryKind[] = ['episodic', 'semantic', 'procedural']
const SCOPES: MemoryScope[] = ['project', 'global']

function normalizeTags(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined
  }
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
  const memoryId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(memoryId)) {
    throw createError({ statusCode: 400, statusMessage: '无效的记忆 ID' })
  }

  const body = await readBody<{
    title?: string
    content?: string
    tags?: unknown
    pinned?: boolean
    kind?: string
    scope?: string
  }>(event)

  const patch: {
    title?: string
    content?: string
    tags?: string[]
    pinned?: boolean
    kind?: MemoryKind
    scope?: MemoryScope
  } = {}

  if (body?.title !== undefined) {
    if (!body.title.trim()) {
      throw createError({ statusCode: 400, statusMessage: '记忆标题不能为空' })
    }
    patch.title = body.title.trim()
  }
  if (body?.content !== undefined) {
    if (!body.content.trim()) {
      throw createError({ statusCode: 400, statusMessage: '记忆内容不能为空' })
    }
    patch.content = body.content.trim()
  }
  if (body?.tags !== undefined) {
    patch.tags = normalizeTags(body.tags)
  }
  if (body?.pinned !== undefined) {
    patch.pinned = body.pinned === true
  }
  if (body?.kind !== undefined) {
    if (!KINDS.includes(body.kind as MemoryKind)) {
      throw createError({ statusCode: 400, statusMessage: '无效的记忆类型' })
    }
    patch.kind = body.kind as MemoryKind
  }
  if (body?.scope !== undefined) {
    if (!SCOPES.includes(body.scope as MemoryScope)) {
      throw createError({ statusCode: 400, statusMessage: '无效的记忆范围' })
    }
    patch.scope = body.scope as MemoryScope
  }

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: '没有可更新的字段' })
  }

  const memory = updateMemory(memoryId, patch)
  if (!memory) {
    throw createError({ statusCode: 404, statusMessage: '记忆不存在' })
  }
  return memory
})
