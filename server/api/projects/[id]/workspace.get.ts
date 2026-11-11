import { existsSync } from 'node:fs'
import { git, repoPathFor } from '../../../utils/workspace'

export default defineEventHandler((event) => {
  const projectId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(projectId)) {
    throw createError({ statusCode: 400, statusMessage: '无效的项目 ID' })
  }

  const repoPath = repoPathFor(projectId)
  if (!existsSync(repoPath)) {
    return { repoPath, exists: false, log: [] }
  }

  const log = git(repoPath, ['log', '--oneline']).trim().split('\n').filter(Boolean)
  return { repoPath, exists: true, log }
})
