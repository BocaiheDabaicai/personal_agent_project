import { randomUUID } from 'node:crypto'

export type RunStatus = 'running' | 'done' | 'failed'

export type RunEventType =
  | 'run_start'
  | 'node_start'
  | 'text'
  | 'tool_use'
  | 'tool_result'
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
}

export interface RunState {
  id: string
  projectId: number
  status: RunStatus
  events: RunEvent[]
  subscribers: Set<(event: RunEvent) => void>
  startedAt: string
  finishedAt?: string
  nextSeq: number
}

const globalForRuns = globalThis as typeof globalThis & {
  __personalAgentRuns?: Map<number, RunState>
}

const runs = (globalForRuns.__personalAgentRuns ??= new Map<number, RunState>())

export function createRun(projectId: number): RunState {
  const run: RunState = {
    id: randomUUID(),
    projectId,
    status: 'running',
    events: [],
    subscribers: new Set(),
    startedAt: new Date().toISOString(),
    nextSeq: 1,
  }
  runs.set(projectId, run)
  return run
}

export function getRun(projectId: number): RunState | undefined {
  return runs.get(projectId)
}

export function emitRunEvent(
  run: RunState,
  event: Omit<RunEvent, 'seq' | 'ts' | 'runId' | 'projectId'>,
): RunEvent {
  const full: RunEvent = {
    seq: run.nextSeq,
    ts: new Date().toISOString(),
    runId: run.id,
    projectId: run.projectId,
    ...event,
  }
  run.nextSeq += 1
  run.events.push(full)

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

export function finishRun(run: RunState, status: 'done' | 'failed', message?: string): void {
  if (run.status !== 'running') {
    return
  }
  run.status = status
  run.finishedAt = new Date().toISOString()
  emitRunEvent(run, {
    type: 'run_done',
    status,
    text: status === 'done' ? message : undefined,
    error: status === 'failed' ? message : undefined,
  })
}
