import { and, desc, eq, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { nodes, runEvents, runs } from '../db/schema'
import { db } from './db'

export type RunStatus = 'running' | 'done' | 'failed' | 'cancelled'
export type RunKind = 'develop' | 'review'

export type RunEventType =
  | 'run_start'
  | 'node_start'
  | 'text'
  | 'tool_use'
  | 'tool_result'
  | 'verify_start'
  | 'verify_result'
  | 'node_done'
  | 'node_failed'
  | 'run_done'
  | 'error'

export interface RunEvent {
  seq: number
  ts: string
  type: RunEventType
  runId: string
  projectId: number
  nodeKey?: string
  title?: string
  text?: string
  name?: string
  input?: string
  output?: string
  ok?: boolean
  commit?: string
  error?: string
  status?: RunStatus
  verdict?: 'pass' | 'fail'
}

export interface RunState {
  id: string
  projectId: number
  kind: RunKind
  status: RunStatus
  events: RunEvent[]
  subscribers: Set<(event: RunEvent) => void>
  startedAt: string
  finishedAt?: string
  error?: string
  nextSeq: number
  abortController: AbortController
}

export interface RunSummary {
  id: string
  projectId: number
  kind: RunKind
  status: RunStatus
  startedAt: string
  finishedAt: string | null
  error: string | null
  eventCount: number
}

const globalForRuns = globalThis as typeof globalThis & {
  __personalAgentRuns?: Map<number, RunState>
  __personalAgentRunInit?: boolean
}

const runsMap = (globalForRuns.__personalAgentRuns ??= new Map<number, RunState>())

export function createRun(projectId: number, kind: RunKind): RunState {
  const run: RunState = {
    id: randomUUID(),
    projectId,
    kind,
    status: 'running',
    events: [],
    subscribers: new Set(),
    startedAt: new Date().toISOString(),
    nextSeq: 1,
    abortController: new AbortController(),
  }

  db.insert(runs)
    .values({
      id: run.id,
      projectId,
      kind,
      status: 'running',
      startedAt: run.startedAt,
    })
    .run()

  runsMap.set(projectId, run)
  return run
}

export function getRun(projectId: number): RunState | undefined {
  return runsMap.get(projectId)
}

function parsePayload(raw: string): Partial<RunEvent> {
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Partial<RunEvent>) : {}
  } catch {
    return {}
  }
}

export function emitRunEvent(
  run: RunState,
  event: Omit<RunEvent, 'seq' | 'ts' | 'runId' | 'projectId'>,
): RunEvent {
  // Agent SDK 在 abort 后可能仍吐出一小段缓冲消息；运行结束后只保留 run_done。
  if (run.status !== 'running' && event.type !== 'run_done') {
    return {
      seq: run.nextSeq,
      ts: new Date().toISOString(),
      runId: run.id,
      projectId: run.projectId,
      ...event,
    }
  }

  const full: RunEvent = {
    seq: run.nextSeq,
    ts: new Date().toISOString(),
    runId: run.id,
    projectId: run.projectId,
    ...event,
  }
  run.nextSeq += 1
  run.events.push(full)

  const { seq, ts, runId, projectId, type, ...payload } = full
  db.insert(runEvents)
    .values({
      runId,
      projectId,
      seq,
      ts,
      type,
      payload: JSON.stringify(payload),
    })
    .run()

  for (const listener of [...run.subscribers]) {
    try {
      listener(full)
    } catch {
      // 单个订阅者失败不影响其他订阅者与运行本身
    }
  }

  return full
}

export function subscribeRun(run: RunState, listener: (event: RunEvent) => void): () => void {
  run.subscribers.add(listener)
  return () => {
    run.subscribers.delete(listener)
  }
}

export function finishRun(
  run: RunState,
  status: Exclude<RunStatus, 'running'>,
  message?: string,
): void {
  if (run.status !== 'running') {
    return
  }
  run.status = status
  run.finishedAt = new Date().toISOString()
  run.error = status === 'failed' ? message : undefined

  db.update(runs)
    .set({
      status,
      finishedAt: run.finishedAt,
      error: run.error ?? null,
    })
    .where(eq(runs.id, run.id))
    .run()

  emitRunEvent(run, {
    type: 'run_done',
    status,
    text:
      status === 'done'
        ? message
        : status === 'cancelled'
          ? message || '运行已取消'
          : undefined,
    error: status === 'failed' ? message : undefined,
  })
}

export function cancelRun(run: RunState): boolean {
  if (run.status !== 'running') {
    return false
  }

  // 先把当前节点退回 pending，保证 run_done 触发的前端刷新能看到可继续状态。
  db.update(nodes)
    .set({ status: 'pending' })
    .where(and(eq(nodes.projectId, run.projectId), eq(nodes.status, 'running')))
    .run()

  finishRun(run, 'cancelled', '运行已取消，可继续执行未完成节点')
  run.abortController.abort()
  return true
}

export function loadRunEvents(runId: string): RunEvent[] {
  return db
    .select()
    .from(runEvents)
    .where(eq(runEvents.runId, runId))
    .orderBy(runEvents.seq)
    .all()
    .map(row => ({
      seq: row.seq,
      ts: row.ts,
      runId: row.runId,
      projectId: row.projectId,
      type: row.type as RunEventType,
      ...parsePayload(row.payload),
    }))
}

export function getLatestRun(projectId: number): RunSummary | null {
  const row = db
    .select()
    .from(runs)
    .where(eq(runs.projectId, projectId))
    .orderBy(desc(runs.startedAt))
    .limit(1)
    .get()

  if (!row) {
    return null
  }

  const countRow = db
    .select({ value: sql<number>`count(*)` })
    .from(runEvents)
    .where(eq(runEvents.runId, row.id))
    .get()

  return {
    id: row.id,
    projectId: row.projectId,
    kind: row.kind as RunKind,
    status: row.status as RunStatus,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt ?? null,
    error: row.error ?? null,
    eventCount: countRow?.value ?? 0,
  }
}

function reconcileInterruptedRuns(): void {
  const orphaned = db.select().from(runs).where(eq(runs.status, 'running')).all()

  for (const row of orphaned) {
    const finishedAt = new Date().toISOString()
    const error = '服务重启，运行中断；未完成节点可继续执行'

    db.update(runs)
      .set({ status: 'failed', finishedAt, error })
      .where(eq(runs.id, row.id))
      .run()

    db.update(nodes)
      .set({ status: 'pending' })
      .where(and(eq(nodes.projectId, row.projectId), eq(nodes.status, 'running')))
      .run()

    const last = db
      .select({ seq: runEvents.seq })
      .from(runEvents)
      .where(eq(runEvents.runId, row.id))
      .orderBy(desc(runEvents.seq))
      .limit(1)
      .get()

    db.insert(runEvents)
      .values({
        runId: row.id,
        projectId: row.projectId,
        seq: (last?.seq ?? 0) + 1,
        ts: finishedAt,
        type: 'run_done',
        payload: JSON.stringify({ status: 'failed', error }),
      })
      .run()
  }
}

function initializePersistence(): void {
  if (globalForRuns.__personalAgentRunInit) {
    return
  }
  globalForRuns.__personalAgentRunInit = true

  try {
    reconcileInterruptedRuns()
  } catch (error) {
    console.error('[runManager] 无法恢复中断的运行记录：', error)
  }
}

initializePersistence()
