import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { basename, dirname, extname, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { projectCanvases } from '../db/schema'
import { db } from '../utils/db'
import {
  IMAGE_MAX_CALLS_PER_NODE,
  IMAGE_MAX_CREDITS,
  IMAGE_MODEL,
  IMAGE_RESOLUTION,
  checkDreaminaAvailability,
  dreaminaBinary,
} from './registry'

const execFileAsync = promisify(execFile)
const RATIO_VALUES = ['1:1', '3:4', '16:9', '4:3', '9:16', '2:3', '3:2', '21:9'] as const

interface CliErrorPayload {
  code?: number
  message?: string
  diagnostics?: unknown[]
  reason?: string
}

interface CliEnvelope<T> {
  ok?: boolean
  data?: T
  error?: CliErrorPayload
  creditConfirmation?: {
    reason?: string
    minimumCreditCeiling?: number
  }
}

export class DreaminaCliError extends Error {
  code?: number
  reason?: string
  diagnostics?: unknown[]
  minimumCreditCeiling?: number

  constructor(
    message: string,
    error?: CliErrorPayload,
    creditConfirmation?: CliEnvelope<unknown>['creditConfirmation'],
  ) {
    super(message)
    this.name = 'DreaminaCliError'
    this.code = error?.code
    this.reason = error?.reason
    this.diagnostics = error?.diagnostics
    this.minimumCreditCeiling = creditConfirmation?.minimumCreditCeiling
  }
}

function parseEnvelope<T>(stdout: string): T {
  let parsed: CliEnvelope<T>
  try {
    parsed = JSON.parse(stdout) as CliEnvelope<T>
  } catch {
    throw new DreaminaCliError(`无法解析 Dreamina CLI 输出：${stdout.slice(0, 300)}`)
  }

  if (!parsed.ok || parsed.data === undefined) {
    throw new DreaminaCliError(
      parsed.error?.message || 'Dreamina CLI 返回失败',
      parsed.error,
      parsed.creditConfirmation,
    )
  }

  return parsed.data
}

async function runCli<T>(
  args: string[],
  signal?: AbortSignal,
  timeoutMs = 60_000,
): Promise<T> {
  if (signal?.aborted) {
    throw new DreaminaCliError('已取消')
  }

  const bin = dreaminaBinary()
  if (!existsSync(bin)) {
    throw new DreaminaCliError(`未找到 Dreamina CLI：${bin}`)
  }

  try {
    const { stdout } = await execFileAsync(
      bin,
      [...args, '--format', 'json', '--non-interactive'],
      {
        timeout: timeoutMs,
        maxBuffer: 8 * 1024 * 1024,
        signal,
        windowsHide: true,
      },
    )
    return parseEnvelope<T>(stdout)
  } catch (error) {
    const execError = error as {
      name?: string
      message?: string
      stdout?: string
      stderr?: string
    }

    if (execError.stdout?.trim()) {
      return parseEnvelope<T>(execError.stdout)
    }
    if (execError.name === 'AbortError' || signal?.aborted) {
      throw new DreaminaCliError('已取消')
    }
    throw new DreaminaCliError(
      execError.stderr?.trim() || execError.message || 'Dreamina CLI 执行失败',
    )
  }
}

interface CanvasInfo {
  canvasId: string
  webUrl?: string
}

async function ensureCanvas(
  projectId: number,
  projectName: string,
  signal?: AbortSignal,
): Promise<CanvasInfo> {
  const existing = db
    .select()
    .from(projectCanvases)
    .where(
      and(
        eq(projectCanvases.projectId, projectId),
        eq(projectCanvases.provider, 'dreamina'),
      ),
    )
    .get()

  if (existing) {
    return {
      canvasId: existing.canvasId,
      webUrl: existing.webUrl ?? undefined,
    }
  }

  const canvasId = randomUUID()
  const name = `${projectName || `项目 ${projectId}`} · Agent 平台`.slice(0, 120)
  const created = await runCli<{
    project?: { projectId?: string; webUrl?: string }
  }>(['canvas', 'create', name, '--project-id', canvasId], signal, 60_000)

  if (!created.project?.projectId) {
    throw new DreaminaCliError('Dreamina 画布创建失败：没有返回 projectId')
  }

  db.insert(projectCanvases)
    .values({
      projectId,
      provider: 'dreamina',
      canvasId: created.project.projectId,
      webUrl: created.project.webUrl ?? null,
    })
    .run()

  return {
    canvasId: created.project.projectId,
    webUrl: created.project.webUrl,
  }
}

function pickCreditToken(value: Record<string, unknown>): string | undefined {
  for (const key of [
    'creditToken',
    'token',
    'creditConfirmationToken',
    'confirmationToken',
  ]) {
    const candidate = value[key]
    if (typeof candidate === 'string' && candidate) {
      return candidate
    }
  }
  return undefined
}

export interface ImageGenerationResult {
  path: string
  absolutePath: string
  bytes: number
  sha256?: string
  canvasId: string
  canvasUrl?: string
  nodeId: string
  submitId: string
  resourceId: string
  credits: number
  width?: number
  height?: number
  format?: string
}

export async function generateImage(options: {
  projectId: number
  projectName: string
  repoPath: string
  prompt: string
  outputPath: string
  ratio?: string
  title?: string
  signal?: AbortSignal
}): Promise<ImageGenerationResult> {
  const health = await checkDreaminaAvailability()
  if (!health.available) {
    throw new DreaminaCliError(`图片能力不可用：${health.reason || '未知原因'}`)
  }

  const outputAbs = resolve(options.repoPath, options.outputPath)
  if (outputAbs !== options.repoPath && !outputAbs.startsWith(options.repoPath + sep)) {
    throw new DreaminaCliError('输出路径必须位于项目仓库内')
  }
  if (!/\.(png|jpe?g|webp)$/i.test(options.outputPath)) {
    throw new DreaminaCliError('输出路径需要以 .png / .jpg / .jpeg / .webp 结尾')
  }
  mkdirSync(dirname(outputAbs), { recursive: true })

  const canvas = await ensureCanvas(options.projectId, options.projectName, options.signal)
  const title = (options.title || options.prompt).slice(0, 120)

  const created = await runCli<{ node?: { nodeId?: string } }>(
    [
      'node',
      'create',
      'image',
      '--project-id',
      canvas.canvasId,
      '--model',
      IMAGE_MODEL,
      '--mode',
      't2i',
      '--prompt',
      options.prompt,
      '--ratio',
      options.ratio || '1:1',
      '--resolution',
      IMAGE_RESOLUTION,
      '--count',
      '1',
      '--title',
      title,
    ],
    options.signal,
    60_000,
  )

  if (!created.node?.nodeId) {
    throw new DreaminaCliError('图片节点创建失败：没有返回 nodeId')
  }
  const nodeId = created.node.nodeId

  const quote = await runCli<{
    totalMaxCredits?: number
    confirmationRequired?: boolean
  }>(
    ['node', 'quote', '--node-id', nodeId, '--project-id', canvas.canvasId],
    options.signal,
    60_000,
  )
  const credits = quote.totalMaxCredits ?? 0

  if (credits > IMAGE_MAX_CREDITS) {
    throw new DreaminaCliError(
      `图片生成报价 ${credits} 积分，超过单次上限 ${IMAGE_MAX_CREDITS} 积分`,
    )
  }

  let creditToken: string | undefined
  if (quote.confirmationRequired !== false) {
    const confirmed = await runCli<Record<string, unknown>>(
      [
        'node',
        'confirm',
        '--node-id',
        nodeId,
        '--credit-ceiling',
        String(IMAGE_MAX_CREDITS),
        '--project-id',
        canvas.canvasId,
      ],
      options.signal,
      60_000,
    )
    creditToken = pickCreditToken(confirmed)
    if (!creditToken) {
      throw new DreaminaCliError('图片生成需要积分确认，但 CLI 没有返回确认凭证')
    }
  }

  const submitId = randomUUID()
  const runArgs = [
    'node',
    'run',
    '--node-id',
    nodeId,
    '--submit-id',
    submitId,
    '--project-id',
    canvas.canvasId,
  ]
  if (creditToken) {
    runArgs.push('--credit-token', creditToken)
  }

  await runCli<{ items?: Array<{ state?: string; submitId?: string }> }>(
    runArgs,
    options.signal,
    120_000,
  )

  const waited = await runCli<{
    state?: string
    resources?: Array<{
      resourceId?: string
      state?: string
      width?: number
      height?: number
      format?: string
    }>
  }>(
    [
      'operation',
      'wait',
      submitId,
      '--project-id',
      canvas.canvasId,
      '--timeout',
      '10m',
    ],
    options.signal,
    11 * 60_000,
  )

  if (waited.state !== 'succeeded') {
    throw new DreaminaCliError(`图片生成未成功：${waited.state || '未知状态'}`)
  }

  const resource = (waited.resources ?? []).find(
    item => item.state === 'succeeded' && item.resourceId,
  )
  if (!resource?.resourceId) {
    throw new DreaminaCliError('图片生成成功但没有可用资源')
  }

  const extension = extname(outputAbs) || '.png'
  const tempAbs = resolve(
    dirname(outputAbs),
    `.${basename(outputAbs, extension)}.${randomUUID()}${extension}`,
  )

  let downloaded: { path?: string; size?: number; sha256?: string } | undefined
  try {
    downloaded = await runCli<{ path?: string; size?: number; sha256?: string }>(
      [
        'resource',
        'download',
        resource.resourceId,
        '--project-id',
        canvas.canvasId,
        '-o',
        tempAbs,
      ],
      options.signal,
      120_000,
    )

    if (!existsSync(tempAbs)) {
      throw new DreaminaCliError('图片下载失败：文件不存在')
    }
    const tempStat = statSync(tempAbs)
    if (!tempStat.isFile() || tempStat.size === 0) {
      throw new DreaminaCliError('图片下载失败：文件为空')
    }

    // 先下载到临时文件，再替换目标，避免 CLI 因目标已存在而拒绝覆盖。
    rmSync(outputAbs, { force: true })
    renameSync(tempAbs, outputAbs)
  } finally {
    rmSync(tempAbs, { force: true })
  }

  if (!existsSync(outputAbs)) {
    throw new DreaminaCliError('图片下载失败：文件不存在')
  }
  const stat = statSync(outputAbs)
  if (!stat.isFile() || stat.size === 0) {
    throw new DreaminaCliError('图片下载失败：文件为空')
  }

  return {
    path: options.outputPath,
    absolutePath: outputAbs,
    bytes: stat.size,
    sha256: downloaded?.sha256,
    canvasId: canvas.canvasId,
    canvasUrl: canvas.webUrl,
    nodeId,
    submitId,
    resourceId: resource.resourceId,
    credits,
    width: resource.width,
    height: resource.height,
    format: resource.format,
  }
}

const imageInputSchema = {
  prompt: z
    .string()
    .min(1)
    .max(2000)
    .describe('完整的图片生成提示词，描述画面内容、风格、构图和禁止项'),
  output_path: z
    .string()
    .min(1)
    .max(300)
    .describe('相对项目仓库的保存路径，例如 artifacts/doraemon.png'),
  ratio: z
    .enum(RATIO_VALUES)
    .default('1:1')
    .describe('图片宽高比，默认 1:1'),
  title: z.string().max(120).optional().describe('可选的图片标题'),
}

export function createImageCapabilityServer(options: {
  projectId: number
  projectName: string
  repoPath: string
  signal?: AbortSignal
}) {
  let generations = 0
  const maxGenerations = IMAGE_MAX_CALLS_PER_NODE

  return createSdkMcpServer({
    name: 'platform',
    version: '1.0.0',
    instructions:
      '项目图片能力。需要生成图片时调用 generate_image，把图片保存到项目仓库内。',
    alwaysLoad: true,
    timeout: 12 * 60_000,
    tools: [
      tool(
        'generate_image',
        `使用即梦 Dreamina 生成一张图片并保存到项目工作区。同一节点最多调用 ${maxGenerations} 次；先用清楚的 prompt，不要反复试错。不要用占位图或手写 SVG 代替。`,
        imageInputSchema,
        async args => {
          if (generations >= maxGenerations) {
            return {
              isError: true,
              content: [
                {
                  type: 'text' as const,
                  text: `本节点图片生成次数已达上限（${maxGenerations} 次）。请停止生成，检查现有产物并按验收契约收尾。`,
                },
              ],
            }
          }

          generations += 1
          try {
            const result = await generateImage({
              projectId: options.projectId,
              projectName: options.projectName,
              repoPath: options.repoPath,
              prompt: args.prompt,
              outputPath: args.output_path,
              ratio: args.ratio,
              title: args.title,
              signal: options.signal,
            })
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify(
                    {
                      ...result,
                      generationsUsed: generations,
                      generationsLimit: maxGenerations,
                    },
                    null,
                    2,
                  ),
                },
              ],
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            return {
              isError: true,
              content: [
                {
                  type: 'text' as const,
                  text: `图片生成失败：${message}`,
                },
              ],
            }
          }
        },
      ),
    ],
  })
}
