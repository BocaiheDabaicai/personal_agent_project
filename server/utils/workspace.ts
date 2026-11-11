import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const WORKSPACE_GITIGNORE = [
  '.agent/',
  'node_modules/',
  '.env',
  '.env.*',
  '!.env.example',
  '',
].join('\n')

export function workspaceRoot(): string {
  return resolve(process.cwd(), 'workspaces')
}

export function repoPathFor(projectId: number): string {
  return join(workspaceRoot(), String(projectId), 'repo')
}

export function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

export function ensureWorkspace(projectId: number): string {
  const repoPath = repoPathFor(projectId)
  mkdirSync(repoPath, { recursive: true })

  writeFileSync(join(repoPath, '.gitignore'), WORKSPACE_GITIGNORE, 'utf-8')

  if (!existsSync(join(repoPath, '.git'))) {
    git(repoPath, ['init', '-b', 'main'])
    git(repoPath, ['config', 'user.name', 'Personal Agent Platform'])
    git(repoPath, ['config', 'user.email', 'agent@local'])
    git(repoPath, ['add', '.gitignore'])
    git(repoPath, ['commit', '-m', 'chore: initialize workspace'])
  }

  return repoPath
}
