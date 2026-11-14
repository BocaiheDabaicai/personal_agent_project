import { exec } from 'node:child_process'
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import type { PlanVerification } from '../../shared/schemas/plan'

const execAsync = promisify(exec)
const OUTPUT_LIMIT = 4000
const DEFAULT_TIMEOUT_MS = 60_000
const MAX_BUFFER = 4 * 1024 * 1024

export interface VerificationCheck {
  kind: 'command' | 'artifact'
  target: string
  ok: boolean
  exitCode?: number
  output?: string
  error?: string
  durationMs: number
}

export interface VerificationResult {
  ok: boolean
  summary: string
  checks: VerificationCheck[]
  output: string
  ranAt: string
  durationMs: number
}

function truncate(value: string, limit = OUTPUT_LIMIT): string {
  return value.length > limit ? `${value.slice(0, limit)}…` : value
}

function safeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_')
}

export function verificationRelativePath(nodeKey: string): string {
  return `.agent/verifications/${safeKey(nodeKey)}.json`
}

async function runCommand(
  repoPath: string,
  command: PlanVerification['commands'][number],
  signal?: AbortSignal,
): Promise<VerificationCheck> {
  const startedAt = Date.now()
  const expectedExitCode = command.expectedExitCode ?? 0
  const expectedOutput = command.expectedOutput

  try {
    const { stdout, stderr } = await execAsync(command.command, {
      cwd: repoPath,
      timeout: command.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
      windowsHide: true,
      signal,
      env: {
        ...process.env,
        CI: '1',
        NO_COLOR: '1',
      },
    })
    const output = truncate(`${stdout}${stderr}`)
    const exitOk = expectedExitCode === 0
    const outputOk = !expectedOutput || output.includes(expectedOutput)
    return {
      kind: 'command',
      target: command.command,
      ok: exitOk && outputOk,
      exitCode: 0,
      output,
      error: !exitOk
        ? `期望退出码 ${expectedExitCode}，实际 0`
        : outputOk
          ? undefined
          : `输出未包含：${expectedOutput}`,
      durationMs: Date.now() - startedAt,
    }
  } catch (error) {
    const execError = error as {
      name?: string
      code?: number | string
      killed?: boolean
      signal?: string
      stdout?: string
      stderr?: string
    }
    const exitCode = typeof execError.code === 'number' ? execError.code : undefined
    const output = truncate(`${execError.stdout ?? ''}${execError.stderr ?? ''}`)
    const timedOut = execError.killed === true
    const aborted = execError.name === 'AbortError'
    const exitOk = exitCode === expectedExitCode
    const outputOk = !expectedOutput || output.includes(expectedOutput)

    let message = '命令执行失败'
    if (aborted) {
      message = '已取消'
    } else if (timedOut) {
      message = '命令超时'
    } else if (!exitOk) {
      message = `期望退出码 ${expectedExitCode}，实际 ${exitCode ?? '未知'}`
    } else if (!outputOk) {
      message = `输出未包含：${expectedOutput}`
    }

    return {
      kind: 'command',
      target: command.command,
      ok: exitOk && outputOk && !timedOut && !aborted,
      exitCode,
      output,
      error: message,
      durationMs: Date.now() - startedAt,
    }
  }
}

function checkArtifact(repoPath: string, artifact: string): VerificationCheck {
  const startedAt = Date.now()
  const fullPath = resolve(repoPath, artifact)
  const inside = fullPath === repoPath || fullPath.startsWith(repoPath + sep)

  let ok = false
  let error: string | undefined

  if (!inside) {
    error = '产物路径超出工作区'
  } else if (!existsSync(fullPath)) {
    error = '产物不存在'
  } else {
    const stat = statSync(fullPath)
    ok = stat.isFile() || stat.isDirectory()
    if (!ok) {
      error = '产物不是文件或目录'
    }
  }

  return {
    kind: 'artifact',
    target: artifact,
    ok,
    error,
    durationMs: Date.now() - startedAt,
  }
}

export async function runNodeVerification(
  repoPath: string,
  nodeKey: string,
  contract: PlanVerification,
  signal?: AbortSignal,
): Promise<VerificationResult> {
  const startedAt = Date.now()
  const checks: VerificationCheck[] = []

  for (const command of contract.commands) {
    checks.push(await runCommand(repoPath, command, signal))
  }

  for (const artifact of contract.artifacts) {
    checks.push(checkArtifact(repoPath, artifact))
  }

  const failed = checks.filter(check => !check.ok)
  const ok = failed.length === 0
  const summary = ok
    ? `验收通过（${checks.length} 项）`
    : `验收未通过（${failed.length}/${checks.length} 项失败）`

  const output = truncate(
    checks
      .map(check => {
        const head = `[${check.ok ? 'OK' : 'FAIL'}] ${
          check.kind === 'command' ? check.target : `产物 ${check.target}`
        }`
        const detail = check.output || check.error || ''
        return detail ? `${head}\n${detail}` : head
      })
      .join('\n\n'),
  )

  const result: VerificationResult = {
    ok,
    summary,
    checks,
    output,
    ranAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
  }

  const dir = join(repoPath, '.agent', 'verifications')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(repoPath, verificationRelativePath(nodeKey)),
    JSON.stringify(result, null, 2),
    'utf-8',
  )

  return result
}
