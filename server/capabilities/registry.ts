import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const IMAGE_CAPABILITY_ID = 'image.generate'
export const IMAGE_PROVIDER = 'dreamina-cli'
export const IMAGE_MODEL = process.env.DREAMINA_IMAGE_MODEL || 'seedream_4.6'
export const IMAGE_RESOLUTION = process.env.DREAMINA_IMAGE_RESOLUTION || '2K'
export const IMAGE_MAX_CREDITS = Number(process.env.DREAMINA_IMAGE_MAX_CREDITS || 5)
export const IMAGE_MAX_CALLS_PER_NODE = Number(
  process.env.DREAMINA_IMAGE_MAX_PER_NODE || 4,
)
export const IMAGE_MAX_RATIO_OPTIONS = [
  '1:1',
  '3:4',
  '16:9',
  '4:3',
  '9:16',
  '2:3',
  '3:2',
  '21:9',
] as const

export interface CapabilityCost {
  unit: 'credits'
  estimate: number
  maxPerCall: number
  maxCallsPerNode: number
}

export interface CapabilityInfo {
  id: string
  title: string
  description: string
  kind: 'mcp' | 'cli' | 'builtin' | 'http'
  provider: string
  available: boolean
  reason?: string
  cost?: CapabilityCost
  models?: string[]
}

interface HealthResult {
  available: boolean
  reason?: string
}

interface HealthCacheEntry extends HealthResult {
  checkedAt: number
}

const HEALTH_TTL_MS = 30_000

const globalForCapabilities = globalThis as typeof globalThis & {
  __personalAgentCapabilityHealth?: Map<string, HealthCacheEntry>
}

const healthCache = (globalForCapabilities.__personalAgentCapabilityHealth ??= new Map())

function binaryCandidates(): string[] {
  const configured = process.env.DREAMINA_CANVAS_BIN
  const candidates = configured ? [configured] : []
  candidates.push(
    join(homedir(), '.local', 'bin', 'dreamina-canvas'),
    join(homedir(), 'bin', 'dreamina-canvas'),
    join(homedir(), '.local', 'bin', 'dreamina-canvas.exe'),
    join(homedir(), 'bin', 'dreamina-canvas.exe'),
  )
  return candidates
}

export function dreaminaBinary(): string {
  return binaryCandidates().find(candidate => existsSync(candidate)) ?? binaryCandidates()[0]
}

export async function checkDreaminaAvailability(force = false): Promise<HealthResult> {
  const cached = healthCache.get(IMAGE_PROVIDER)
  if (!force && cached && Date.now() - cached.checkedAt < HEALTH_TTL_MS) {
    return { available: cached.available, reason: cached.reason }
  }

  const bin = dreaminaBinary()
  if (!existsSync(bin)) {
    const result: HealthResult = {
      available: false,
      reason: `未找到 Dreamina CLI：${bin}`,
    }
    healthCache.set(IMAGE_PROVIDER, { checkedAt: Date.now(), ...result })
    return result
  }

  try {
    const { stdout } = await execFileAsync(
      bin,
      ['--format', 'json', '--non-interactive', 'auth', 'status'],
      {
        timeout: 8000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      },
    )
    const parsed = JSON.parse(stdout) as {
      ok?: boolean
      data?: { loggedIn?: boolean }
      error?: { message?: string }
    }
    if (parsed.ok && parsed.data?.loggedIn) {
      const result: HealthResult = { available: true }
      healthCache.set(IMAGE_PROVIDER, { checkedAt: Date.now(), ...result })
      return result
    }
    const result: HealthResult = {
      available: false,
      reason: parsed.error?.message || 'Dreamina CLI 未登录',
    }
    healthCache.set(IMAGE_PROVIDER, { checkedAt: Date.now(), ...result })
    return result
  } catch (error) {
    const result: HealthResult = {
      available: false,
      reason: `Dreamina CLI 检查失败：${error instanceof Error ? error.message : String(error)}`,
    }
    healthCache.set(IMAGE_PROVIDER, { checkedAt: Date.now(), ...result })
    return result
  }
}

export async function listCapabilities(force = false): Promise<CapabilityInfo[]> {
  const health = await checkDreaminaAvailability(force)
  return [
    {
      id: IMAGE_CAPABILITY_ID,
      title: '图片生成',
      description: `使用即梦 Dreamina CLI 生成图片，默认 ${IMAGE_MODEL} / ${IMAGE_RESOLUTION} / 单张，单次最多 ${IMAGE_MAX_CREDITS} 积分，单节点最多 ${IMAGE_MAX_CALLS_PER_NODE} 次。`,
      kind: 'mcp',
      provider: IMAGE_PROVIDER,
      available: health.available,
      reason: health.reason,
      cost: {
        unit: 'credits',
        estimate: 1,
        maxPerCall: IMAGE_MAX_CREDITS,
        maxCallsPerNode: IMAGE_MAX_CALLS_PER_NODE,
      },
      models: [IMAGE_MODEL],
    },
  ]
}

export async function getCapability(id: string, force = false): Promise<CapabilityInfo | null> {
  return (await listCapabilities(force)).find(capability => capability.id === id) ?? null
}

export async function capabilityCatalogText(): Promise<string> {
  const capabilities = await listCapabilities()
  return capabilities
    .map(capability => {
      const availability = capability.available
        ? '当前可用'
        : `当前不可用：${capability.reason || '未知原因'}`
      return `- ${capability.id}：${capability.description}（${availability}）`
    })
    .join('\n')
}
