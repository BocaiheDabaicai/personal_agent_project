import type { RunEvent } from '../../../../utils/runManager'
import {
  getLatestRun,
  getRun,
  loadRunEvents,
  subscribeRun,
} from '../../../../utils/runManager'

export default defineEventHandler(async (event) => {
  const projectId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(projectId)) {
    throw createError({ statusCode: 400, statusMessage: '无效的项目 ID' })
  }

  const liveRun = getRun(projectId)
  const latest = getLatestRun(projectId)
  const runId = liveRun?.id ?? latest?.id
  if (!runId) {
    throw createError({ statusCode: 404, statusMessage: '没有可用的运行记录' })
  }

  const stream = createEventStream(event)
  // send() 必须先启动：它负责设置 SSE 响应头并开始消费可读流。
  const sendPromise = stream.send()
  let lastSeq = 0
  let replaying = true
  const pending: RunEvent[] = []

  const send = async (entry: RunEvent) => {
    if (entry.seq <= lastSeq) {
      return
    }
    lastSeq = entry.seq
    await stream.push(JSON.stringify(entry))
  }

  const unsubscribe =
    liveRun && liveRun.status === 'running'
      ? subscribeRun(liveRun, (entry) => {
          if (replaying) {
            pending.push(entry)
            return
          }
          void send(entry).catch(() => {})
        })
      : () => {}

  try {
    for (const entry of loadRunEvents(runId)) {
      await send(entry)
    }
    replaying = false
    pending.sort((a, b) => a.seq - b.seq)
    for (const entry of pending) {
      await send(entry)
    }
  } catch {
    replaying = false
    unsubscribe()
    await stream.close()
    return sendPromise
  }

  if (!liveRun || liveRun.status !== 'running') {
    unsubscribe()
    await stream.close()
    return sendPromise
  }

  const heartbeat = setInterval(() => {
    void stream
      .push(JSON.stringify({ type: 'ping', ts: new Date().toISOString() }))
      .catch(() => {})
  }, 15000)

  stream.onClosed(() => {
    clearInterval(heartbeat)
    unsubscribe()
  })

  return sendPromise
})
