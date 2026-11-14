import { deleteMemory } from '../../memory/service'

export default defineEventHandler((event) => {
  const memoryId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(memoryId)) {
    throw createError({ statusCode: 400, statusMessage: '无效的记忆 ID' })
  }

  if (!deleteMemory(memoryId)) {
    throw createError({ statusCode: 404, statusMessage: '记忆不存在' })
  }

  return { ok: true }
})
