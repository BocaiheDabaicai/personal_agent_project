import { and, desc, eq, sql } from 'drizzle-orm'
import { decisions, memories, nodes, planRecalls, projects, reviews, type MemoryRow } from '../db/schema'
import { db } from '../utils/db'

export type MemoryKind = 'episodic' | 'semantic' | 'procedural'
export type MemoryScope = 'project' | 'global'

export interface MemoryEntry {
  id: number
  projectId: number | null
  scope: MemoryScope
  kind: MemoryKind
  title: string
  content: string
  tags: string[]
  source: Record<string, unknown>
  sourceKey: string | null
  pinned: boolean
  createdAt: string
  updatedAt: string
}

export interface RecalledMemory extends MemoryEntry {
  score: number
}

export interface CreateMemoryInput {
  projectId?: number | null
  scope?: MemoryScope
  kind: MemoryKind
  title: string
  content: string
  tags?: string[]
  source?: Record<string, unknown>
  sourceKey?: string | null
  pinned?: boolean
}

const KINDS: MemoryKind[] = ['episodic', 'semantic', 'procedural']
const SCOPES: MemoryScope[] = ['project', 'global']

function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit)}…` : value
}

function parseJson<T>(raw: string | null | undefined): T | null {
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function parseTags(raw: string): string[] {
  const parsed = parseJson<unknown>(raw)
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : []
}

function parseSource(raw: string): Record<string, unknown> {
  const parsed = parseJson<unknown>(raw)
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {}
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
}

function normalizeKind(raw: string): MemoryKind {
  return KINDS.includes(raw as MemoryKind) ? (raw as MemoryKind) : 'episodic'
}

function normalizeScope(raw: string): MemoryScope {
  return SCOPES.includes(raw as MemoryScope) ? (raw as MemoryScope) : 'project'
}

export function mapMemoryRow(row: MemoryRow): MemoryEntry {
  return {
    id: row.id,
    projectId: row.projectId ?? null,
    scope: normalizeScope(row.scope),
    kind: normalizeKind(row.kind),
    title: row.title,
    content: row.content,
    tags: parseTags(row.tags),
    source: parseSource(row.source),
    sourceKey: row.sourceKey ?? null,
    pinned: row.pinned === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function createMemory(input: CreateMemoryInput): MemoryEntry {
  if (input.sourceKey) {
    const existing = db
      .select()
      .from(memories)
      .where(eq(memories.sourceKey, input.sourceKey))
      .get()
    if (existing) {
      return mapMemoryRow(existing)
    }
  }

  const row = db
    .insert(memories)
    .values({
      projectId: input.projectId ?? null,
      scope: input.scope ?? (input.projectId ? 'project' : 'global'),
      kind: input.kind,
      title: truncate(input.title, 200),
      content: truncate(input.content, 8000),
      tags: JSON.stringify(uniqueStrings(input.tags ?? []).slice(0, 20)),
      source: JSON.stringify(input.source ?? {}),
      sourceKey: input.sourceKey ?? null,
      pinned: input.pinned ? 1 : 0,
    })
    .returning()
    .get()

  return mapMemoryRow(row)
}

export function listProjectMemories(projectId: number, limit = 100): MemoryEntry[] {
  return db
    .select()
    .from(memories)
    .where(eq(memories.projectId, projectId))
    .orderBy(desc(memories.pinned), desc(memories.createdAt), desc(memories.id))
    .limit(limit)
    .all()
    .map(mapMemoryRow)
}

export function updateMemory(
  id: number,
  patch: {
    title?: string
    content?: string
    tags?: string[]
    pinned?: boolean
    kind?: MemoryKind
    scope?: MemoryScope
  },
): MemoryEntry | null {
  const existing = db.select().from(memories).where(eq(memories.id, id)).get()
  if (!existing) {
    return null
  }

  const values = {
    updatedAt: sql`(datetime('now'))`,
    ...(patch.title !== undefined ? { title: truncate(patch.title, 200) } : {}),
    ...(patch.content !== undefined ? { content: truncate(patch.content, 8000) } : {}),
    ...(patch.tags !== undefined
      ? { tags: JSON.stringify(uniqueStrings(patch.tags).slice(0, 20)) }
      : {}),
    ...(patch.pinned !== undefined ? { pinned: patch.pinned ? 1 : 0 } : {}),
    ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
    ...(patch.scope !== undefined ? { scope: patch.scope } : {}),
  }

  const row = db
    .update(memories)
    .set(values)
    .where(eq(memories.id, id))
    .returning()
    .get()

  return row ? mapMemoryRow(row) : null
}

export function deleteMemory(id: number): boolean {
  const existing = db.select({ id: memories.id }).from(memories).where(eq(memories.id, id)).get()
  if (!existing) {
    return false
  }
  db.delete(memories).where(eq(memories.id, id)).run()
  return true
}

function keywordTokens(text: string): string[] {
  const parts = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(part => part.length >= 2)
  const tokens = new Set<string>()

  for (const part of parts) {
    tokens.add(part)
    if (/[一-鿿]/.test(part)) {
      const chars = [...part]
      for (let index = 0; index < chars.length - 1; index += 1) {
        tokens.add(`${chars[index]}${chars[index + 1]}`)
      }
      for (let index = 0; index < chars.length - 2; index += 1) {
        tokens.add(`${chars[index]}${chars[index + 1]}${chars[index + 2]}`)
      }
    }
  }

  return [...tokens].slice(0, 60)
}

function tagTokens(text: string): string[] {
  return uniqueStrings(
    text
      .split(/[^\p{L}\p{N}.]+/u)
      .map(part => part.trim())
      .filter(part => part.length >= 2 && part.length <= 16),
  ).slice(0, 10)
}

function ageDays(createdAt: string): number {
  const normalized = createdAt.includes('T') ? createdAt : `${createdAt.replace(' ', 'T')}Z`
  const time = Date.parse(normalized)
  return Number.isNaN(time) ? 0 : Math.max(0, (Date.now() - time) / 86_400_000)
}

export function recallMemories(input: {
  projectId: number
  goal: string
  feedback?: string
  limit?: number
}): RecalledMemory[] {
  const limit = input.limit ?? 5
  const rows = db
    .select()
    .from(memories)
    .orderBy(desc(memories.pinned), desc(memories.createdAt))
    .limit(500)
    .all()

  const tokens = keywordTokens(`${input.goal}\n${input.feedback ?? ''}`)

  return rows
    .map(row => {
      const memory = mapMemoryRow(row)
      const title = memory.title.toLowerCase()
      const content = memory.content.toLowerCase()
      const tags = memory.tags.map(tag => tag.toLowerCase())

      let score = 0
      for (const token of tokens) {
        if (title.includes(token)) {
          score += 2
        }
        if (content.includes(token)) {
          score += 1
        }
        if (tags.some(tag => tag.includes(token) || token.includes(tag))) {
          score += 2
        }
      }

      if (memory.pinned) {
        score += 3
      }
      if (memory.scope === 'global') {
        score += 1
      }
      if (memory.projectId === input.projectId) {
        score += 0.5
      }
      score += Math.max(0, 1 - ageDays(memory.createdAt) / 180)

      return { ...memory, score: Number(score.toFixed(2)) }
    })
    .filter(memory => memory.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
}

export function formatMemoriesForPrompt(memories: RecalledMemory[]): string {
  if (memories.length === 0) {
    return '无相关历史记忆。'
  }

  return memories
    .map((memory, index) => {
      const tags = memory.tags.length > 0 ? `\n标签：${memory.tags.join('、')}` : ''
      return `${index + 1}. [${memory.kind}] ${memory.title}\n${truncate(
        memory.content,
        800,
      )}${tags}`
    })
    .join('\n\n')
}

export function recordPlanRecalls(
  projectId: number,
  planVersion: number,
  recalled: RecalledMemory[],
): void {
  for (const memory of recalled) {
    db.insert(planRecalls)
      .values({
        projectId,
        planVersion,
        memoryId: memory.id,
        score: memory.score,
      })
      .onConflictDoNothing()
      .run()
  }
}

export function getPlanRecalls(projectId: number, planVersion: number): RecalledMemory[] {
  const rows = db
    .select({ memory: memories, score: planRecalls.score })
    .from(planRecalls)
    .innerJoin(memories, eq(planRecalls.memoryId, memories.id))
    .where(
      and(
        eq(planRecalls.projectId, projectId),
        eq(planRecalls.planVersion, planVersion),
      ),
    )
    .orderBy(desc(planRecalls.score))
    .all()

  return rows.map(row => ({ ...mapMemoryRow(row.memory), score: row.score }))
}

function parseIssues(raw: string): Array<{ severity?: string; message?: string }> {
  const parsed = parseJson<unknown>(raw)
  return Array.isArray(parsed)
    ? (parsed as Array<{ severity?: string; message?: string }>)
    : []
}

function parseVerification(raw: string | null): {
  ok?: boolean
  summary?: string
  commands?: Array<{ command?: string }>
  artifacts?: string[]
} | null {
  return parseJson(raw)
}

export function distillReviewMemory(projectId: number, runId: string): MemoryEntry | null {
  const project = db.select().from(projects).where(eq(projects.id, projectId)).get()
  if (!project) {
    return null
  }

  const reviewRows = db
    .select()
    .from(reviews)
    .where(and(eq(reviews.projectId, projectId), eq(reviews.runId, runId)))
    .all()
  if (reviewRows.length === 0) {
    return null
  }

  const planNodes = db
    .select()
    .from(nodes)
    .where(
      and(eq(nodes.projectId, projectId), eq(nodes.planVersion, project.currentPlanVersion)),
    )
    .orderBy(nodes.order)
    .all()
  const nodeMap = new Map(planNodes.map(node => [node.nodeKey, node]))
  const allPass = reviewRows.every(review => review.verdict === 'pass')

  const lines = [
    `项目：${project.name}`,
    `目标：${project.goal}`,
    `计划版本：v${project.currentPlanVersion}`,
    `审查结论：${allPass ? '全部通过' : '存在未通过'}`,
  ]

  for (const review of reviewRows) {
    const developNode = nodeMap.get(review.developNodeKey)
    const issues = parseIssues(review.issues)
    lines.push(
      `- ${developNode?.title || review.developNodeKey}：${
        review.verdict === 'pass' ? '通过' : '未通过'
      }（${review.summary}）`,
    )
    if (issues.length > 0) {
      lines.push(
        `  问题：${issues
          .map(issue => `${issue.severity || 'issue'}: ${issue.message || ''}`.trim())
          .join('；')}`,
      )
    }
    if (developNode?.commitHash) {
      lines.push(`  提交：${developNode.commitHash}`)
    }
    const verification = parseVerification(developNode?.verificationResult ?? null)
    if (verification?.summary) {
      lines.push(`  平台验收：${verification.ok ? '通过' : '未通过'}（${verification.summary}）`)
    }
  }

  return createMemory({
    projectId,
    scope: 'project',
    kind: 'episodic',
    title: `审查：${project.name} · v${project.currentPlanVersion} · ${
      allPass ? '通过' : '未通过'
    }`,
    content: lines.join('\n'),
    tags: uniqueStrings([
      project.name,
      ...tagTokens(project.goal),
      ...reviewRows.map(review => review.verdict),
      ...planNodes.map(node => node.title).slice(0, 5),
    ]).slice(0, 20),
    source: {
      type: 'review_run',
      runId,
      planVersion: project.currentPlanVersion,
      reviewIds: reviewRows.map(review => review.id),
    },
    sourceKey: `review_run:${runId}`,
  })
}

export function distillDecisionMemory(
  projectId: number,
  decisionId: number,
): MemoryEntry | null {
  const project = db.select().from(projects).where(eq(projects.id, projectId)).get()
  const decision = db
    .select()
    .from(decisions)
    .where(and(eq(decisions.id, decisionId), eq(decisions.projectId, projectId)))
    .get()
  if (!project || !decision) {
    return null
  }

  const actionLabel =
    decision.decision === 'approve'
      ? '批准'
      : decision.decision === 'reject'
        ? '打回'
        : '要求修改'
  const gateLabel = decision.gate === 'plan' ? '计划审批' : decision.gate === 'task' ? '人工验收' : decision.gate

  const lines = [
    `项目：${project.name}`,
    `目标：${project.goal}`,
    `关卡：${gateLabel}`,
    `决策：${actionLabel}`,
    decision.comment ? `意见：${decision.comment}` : '',
    `项目状态：${project.status}`,
    `计划版本：v${project.currentPlanVersion}`,
  ].filter(Boolean)

  return createMemory({
    projectId,
    scope: 'project',
    kind: 'episodic',
    title: `人工${actionLabel}：${project.name}`,
    content: lines.join('\n'),
    tags: uniqueStrings([
      '人工决策',
      decision.gate,
      decision.decision,
      project.name,
      ...tagTokens(`${project.goal} ${decision.comment ?? ''}`),
    ]).slice(0, 20),
    source: {
      type: 'decision',
      decisionId,
      gate: decision.gate,
      decision: decision.decision,
    },
    sourceKey: `decision:${decisionId}`,
  })
}

export function distillProceduralMemory(projectId: number): MemoryEntry | null {
  const project = db.select().from(projects).where(eq(projects.id, projectId)).get()
  if (!project) {
    return null
  }

  const planNodes = db
    .select()
    .from(nodes)
    .where(
      and(
        eq(nodes.projectId, projectId),
        eq(nodes.planVersion, project.currentPlanVersion),
        eq(nodes.kind, 'develop'),
      ),
    )
    .orderBy(nodes.order)
    .all()
  if (planNodes.length === 0) {
    return null
  }

  const lines = [`项目：${project.name}`, `目标：${project.goal}`]
  for (const node of planNodes) {
    const verification = parseVerification(node.verification)
    const commands = (verification?.commands ?? [])
      .map(command => command.command)
      .filter((command): command is string => Boolean(command))
    const artifacts = verification?.artifacts ?? []
    lines.push(`- ${node.title}（${node.nodeKey}）`)
    if (commands.length > 0) {
      lines.push(`  验收命令：${commands.join('；')}`)
    }
    if (artifacts.length > 0) {
      lines.push(`  产物：${artifacts.join('、')}`)
    }
    if (node.commitHash) {
      lines.push(`  提交：${node.commitHash}`)
    }
  }

  return createMemory({
    projectId,
    scope: 'project',
    kind: 'procedural',
    title: `可复用做法：${project.name}`,
    content: lines.join('\n'),
    tags: uniqueStrings([
      '程序记忆',
      project.name,
      ...tagTokens(project.goal),
      ...planNodes.map(node => node.title),
    ]).slice(0, 20),
    source: {
      type: 'project_done',
      planVersion: project.currentPlanVersion,
      nodeKeys: planNodes.map(node => node.nodeKey),
    },
    sourceKey: `project_done:${projectId}:v${project.currentPlanVersion}`,
  })
}
