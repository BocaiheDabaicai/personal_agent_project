<script setup lang="ts">
definePageMeta({
  key: route => route.fullPath,
})

interface Project {
  id: number
  name: string
  goal: string
  status: string
  currentPlanVersion: number
}

interface PlanNodeRow {
  id: number
  nodeKey: string
  kind: string
  title: string
  spec: string
  verification: string | null
  verificationResult: string | null
  status: string
  x: number
  y: number
  order: number
}

interface VerificationCommand {
  command: string
  expectedExitCode?: number
  expectedOutput?: string
  timeoutMs?: number
}

interface VerificationContract {
  commands: VerificationCommand[]
  artifacts: string[]
}

interface VerificationCheck {
  kind: 'command' | 'artifact'
  target: string
  ok: boolean
  exitCode?: number
  output?: string
  error?: string
  durationMs?: number
}

interface VerificationResult {
  ok: boolean
  summary: string
  checks: VerificationCheck[]
  output?: string
  ranAt?: string
}

interface PlanEdgeRow {
  id: number
  sourceKey: string
  targetKey: string
}

interface PlanResponse {
  planVersion: number
  nodes: PlanNodeRow[]
  edges: PlanEdgeRow[]
}

interface Decision {
  id: number
  gate: string
  decision: string
  comment: string | null
  createdAt: string
}

interface RunEvent {
  seq: number
  ts: string
  type: string
  nodeKey?: string
  title?: string
  text?: string
  name?: string
  input?: string
  output?: string
  ok?: boolean
  commit?: string
  error?: string
  status?: 'running' | 'done' | 'failed' | 'cancelled'
  verdict?: 'pass' | 'fail'
}

interface RunStatusResponse {
  active: boolean
  run: {
    id: string
    kind: 'develop' | 'review'
    status: 'running' | 'done' | 'failed' | 'cancelled'
    startedAt: string
    finishedAt: string | null
    error?: string | null
    eventCount?: number
  } | null
}

interface ReviewIssue {
  severity: 'blocker' | 'major' | 'minor'
  message: string
  file?: string
  line?: number
}

interface Review {
  id: number
  reviewNodeKey: string
  developNodeKey: string
  commitHash: string | null
  verdict: 'pass' | 'fail'
  summary: string
  issues: ReviewIssue[]
  createdAt: string
}

const route = useRoute()
const projectId = Number(route.params.id)

const { data: project, refresh: refreshProject } = await useFetch<Project>(`/api/projects/${projectId}`)
const { data: plan, refresh: refreshPlan } = await useFetch<PlanResponse>(`/api/projects/${projectId}/plan`)
const { data: decisionList, refresh: refreshDecisions } = await useFetch<Decision[]>(
  `/api/projects/${projectId}/decisions`,
)
const { data: reviewList, refresh: refreshReviews } = await useFetch<Review[]>(
  `/api/projects/${projectId}/reviews`,
)
const { data: allProjects } = await useFetch<Project[]>('/api/projects')

const planNodes = computed(() => plan.value?.nodes ?? [])
const planEdges = computed(() => plan.value?.edges ?? [])
const hasPlan = computed(() => planNodes.value.length > 0)
const planVersion = computed(() => plan.value?.planVersion ?? 0)
const projectStatus = computed(() => project.value?.status ?? 'draft')
const developNodes = computed(() => planNodes.value.filter(node => node.kind === 'develop'))
const allDevelopDone = computed(
  () => developNodes.value.length > 0 && developNodes.value.every(node => node.status === 'done'),
)
const latestReviews = computed(() => {
  const seen = new Set<string>()
  return (reviewList.value ?? []).filter(review => {
    if (seen.has(review.reviewNodeKey)) {
      return false
    }
    seen.add(review.reviewNodeKey)
    return true
  })
})

const selectedKey = ref<string | null>(null)
const selectedNode = computed(
  () => planNodes.value.find(node => node.nodeKey === selectedKey.value) ?? null,
)

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

const selectedVerification = computed<VerificationContract | null>(() => {
  const parsed = parseJson<VerificationContract>(selectedNode.value?.verification)
  if (!parsed) {
    return null
  }
  return {
    commands: Array.isArray(parsed.commands) ? parsed.commands : [],
    artifacts: Array.isArray(parsed.artifacts) ? parsed.artifacts : [],
  }
})

const selectedVerificationResult = computed<VerificationResult | null>(() => {
  const parsed = parseJson<VerificationResult>(selectedNode.value?.verificationResult)
  if (!parsed) {
    return null
  }
  return {
    ...parsed,
    checks: Array.isArray(parsed.checks) ? parsed.checks : [],
  }
})

const developNodesWithoutVerification = computed(
  () => developNodes.value.filter(node => !node.verification).length,
)

const actionError = ref('')
const actionMessage = ref('')
const planning = ref(false)
const deciding = ref(false)
const showReject = ref(false)
const rejectComment = ref('')
const showAcceptReject = ref(false)
const acceptRejectComment = ref('')

const startingRun = ref(false)
const cancelling = ref(false)
const runActive = ref(false)
const runKind = ref<'develop' | 'review'>('develop')
const runState = ref<'idle' | 'running' | 'done' | 'failed' | 'cancelled'>('idle')
const logs = ref<RunEvent[]>([])
const logPanel = ref<HTMLElement | null>(null)
const logError = ref('')
let stream: EventSource | null = null

const runStateLabel = computed(() => {
  if (runState.value === 'running') {
    return runKind.value === 'review' ? '审查中' : '开发中'
  }
  return {
    idle: '未开始',
    done: '已完成',
    failed: '失败',
    cancelled: '已取消',
  }[runState.value]
})
const runStateBadge = computed(
  () =>
    ({
      idle: 'badge-ghost',
      running: 'badge-warning',
      done: 'badge-success',
      failed: 'badge-error',
      cancelled: 'badge-ghost',
    })[runState.value],
)

const statusLabel: Record<string, string> = {
  draft: '草稿',
  planned: '待审批',
  approved: '已批准',
  plan_rejected: '已打回',
  in_progress: '进行中',
  reviewed: '待人工验收',
  review_failed: '审查未通过',
  changes_requested: '待重新规划',
  done: '已完成',
}
const statusBadge: Record<string, string> = {
  draft: 'badge-ghost',
  planned: 'badge-info',
  approved: 'badge-success',
  plan_rejected: 'badge-error',
  in_progress: 'badge-warning',
  reviewed: 'badge-success',
  review_failed: 'badge-error',
  changes_requested: 'badge-warning',
  done: 'badge-success',
}
const kindLabel: Record<string, string> = {
  develop: '开发',
  review: '审查',
  gate: '验收',
}
const nodeStatusLabel: Record<string, string> = {
  pending: '待处理',
  running: '执行中',
  done: '已完成',
  failed: '失败',
  awaiting: '待审批',
}
const nodeStatusBadge: Record<string, string> = {
  pending: 'badge-ghost',
  running: 'badge-warning',
  done: 'badge-success',
  failed: 'badge-error',
  awaiting: 'badge-info',
}
const decisionLabel: Record<string, string> = {
  approve: '批准',
  reject: '打回',
  changes: '要求修改',
}
const decisionBadge: Record<string, string> = {
  approve: 'badge-success',
  reject: 'badge-error',
  changes: 'badge-warning',
}
const severityLabel: Record<string, string> = {
  blocker: '阻塞',
  major: '主要',
  minor: '次要',
}

function selectNode(payload: { nodeKey: string }) {
  selectedKey.value = payload.nodeKey
}

function nodeTitle(nodeKey: string): string {
  return planNodes.value.find(node => node.nodeKey === nodeKey)?.title || nodeKey
}

const latestTaskReject = computed(
  () => (decisionList.value ?? []).find(d => d.gate === 'task' && d.decision === 'reject'),
)
const latestPlanReject = computed(
  () => (decisionList.value ?? []).find(d => d.gate === 'plan' && d.decision === 'reject'),
)
const reviewFeedback = computed(() =>
  latestReviews.value
    .filter(review => review.verdict === 'fail')
    .map(review => {
      const issues = review.issues.map(issue => {
        const location = issue.file
          ? `（${issue.file}${issue.line ? `:${issue.line}` : ''}）`
          : ''
        return `- [${severityLabel[issue.severity] || issue.severity}] ${issue.message}${location}`
      })
      return `开发节点「${nodeTitle(review.developNodeKey)}」审查未通过：${review.summary}\n${issues.join('\n')}`
    })
    .join('\n\n'),
)
const taskRejectFeedback = computed(
  () => latestTaskReject.value?.comment || '人工验收未通过，请根据现有实现重新规划改进。',
)
const planRejectFeedback = computed(() => latestPlanReject.value?.comment || '')

function readError(error: unknown): string {
  const err = error as { data?: { statusMessage?: string }; message?: string }
  return err.data?.statusMessage || err.message || '操作失败'
}

async function submitDecision(decision: 'approve' | 'reject', comment?: string) {
  deciding.value = true
  actionError.value = ''
  actionMessage.value = ''
  try {
    await $fetch(`/api/projects/${projectId}/decisions`, {
      method: 'POST',
      body: { gate: 'plan', decision, comment },
    })
    await Promise.all([refreshProject(), refreshDecisions()])
    actionMessage.value = decision === 'approve' ? '计划已批准' : '计划已打回'
    showReject.value = false
    rejectComment.value = ''
  } catch (error) {
    actionError.value = readError(error)
  } finally {
    deciding.value = false
  }
}

function approvePlan() {
  submitDecision('approve')
}

function rejectPlan() {
  if (!rejectComment.value.trim()) {
    actionError.value = '请填写打回原因'
    return
  }
  submitDecision('reject', rejectComment.value.trim())
}

async function submitAcceptance(decision: 'approve' | 'reject', comment?: string) {
  deciding.value = true
  actionError.value = ''
  actionMessage.value = ''
  try {
    await $fetch(`/api/projects/${projectId}/decisions`, {
      method: 'POST',
      body: { gate: 'task', decision, comment },
    })
    await Promise.all([refreshProject(), refreshDecisions(), refreshPlan()])
    actionMessage.value = decision === 'approve' ? '项目已完成' : '已打回，待重新规划'
    showAcceptReject.value = false
    acceptRejectComment.value = ''
  } catch (error) {
    actionError.value = readError(error)
  } finally {
    deciding.value = false
  }
}

function approveProject() {
  submitAcceptance('approve')
}

function rejectProject() {
  if (!acceptRejectComment.value.trim()) {
    actionError.value = '请填写打回原因'
    return
  }
  submitAcceptance('reject', acceptRejectComment.value.trim())
}

function timeLabel(ts: string): string {
  const date = new Date(ts)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString('zh-CN', { hour12: false })
}

function logText(entry: RunEvent): string {
  switch (entry.type) {
    case 'run_start':
      return entry.text || '开始执行计划'
    case 'node_start':
      return `▶ ${entry.title || entry.nodeKey || '节点'}`
    case 'verify_start':
      return `▶ 验收：${entry.title || entry.nodeKey || '节点'}`
    case 'verify_result':
      return `${entry.ok === false ? '✗' : '✓'} ${
        entry.text || (entry.ok === false ? '验收未通过' : '验收通过')
      }`
    case 'text':
      return entry.text || ''
    case 'tool_use':
      return `→ ${entry.name || '工具'}${entry.input ? `：${entry.input}` : ''}`
    case 'tool_result':
      return `← ${entry.name || '工具'}${entry.ok === false ? '（失败）' : ''}${entry.output ? `：${entry.output}` : ''}`
    case 'node_done':
      return `✓ ${entry.title || entry.nodeKey || '节点'}${entry.commit ? ` · 提交 ${entry.commit}` : ' · 无文件变更'}`
    case 'node_failed':
      return `✗ ${entry.title || entry.nodeKey || '节点'}：${entry.error || '执行失败'}`
    case 'run_done':
      if (entry.status === 'failed') {
        return `执行失败：${entry.error || '未知错误'}`
      }
      if (entry.status === 'cancelled') {
        return entry.text || '运行已取消'
      }
      return entry.text || '开发节点已完成，等待审查（Step 10）'
    case 'error':
      return `错误：${entry.error || '未知错误'}`
    default:
      return entry.text || ''
  }
}

function logClass(entry: RunEvent): string {
  if (
    entry.type === 'error' ||
    entry.type === 'node_failed' ||
    (entry.type === 'run_done' && entry.status === 'failed')
  ) {
    return 'text-error'
  }
  if (entry.type === 'node_done' || (entry.type === 'run_done' && entry.status === 'done')) {
    return 'text-success'
  }
  if (entry.type === 'run_done' && entry.status === 'cancelled') {
    return 'text-warning'
  }
  if (entry.type === 'node_start') {
    return 'text-warning'
  }
  if (entry.type === 'verify_start') {
    return 'text-info'
  }
  if (entry.type === 'verify_result') {
    return entry.ok === false ? 'text-error' : 'text-success'
  }
  if (entry.type === 'tool_use') {
    return 'text-info'
  }
  if (entry.type === 'tool_result') {
    return entry.ok === false ? 'text-error' : 'text-success'
  }
  return 'opacity-80'
}

function closeStream() {
  if (stream) {
    stream.close()
    stream = null
  }
}

function handleRunEvent(entry: RunEvent) {
  logs.value.push(entry)
  if (logs.value.length > 1200) {
    logs.value.splice(0, logs.value.length - 1200)
  }

  if (
    entry.type === 'node_start' ||
    entry.type === 'node_done' ||
    entry.type === 'node_failed' ||
    entry.type === 'verify_result'
  ) {
    void refreshPlan()
  }
  if (entry.type === 'node_done' || entry.type === 'node_failed') {
    void refreshProject()
  }
  if (entry.type === 'node_done' && entry.verdict) {
    void refreshReviews()
  }

  if (entry.type === 'run_done') {
    runActive.value = false
    runState.value =
      entry.status === 'failed'
        ? 'failed'
        : entry.status === 'cancelled'
          ? 'cancelled'
          : 'done'
    if (entry.status === 'failed') {
      actionError.value = entry.error || '执行失败'
      actionMessage.value = ''
    } else if (entry.status === 'cancelled') {
      actionError.value = ''
      actionMessage.value = entry.text || '运行已取消'
    } else {
      actionError.value = ''
      actionMessage.value = entry.text || '执行完成'
    }
    closeStream()
    void refreshProject()
    void refreshPlan()
    if (runKind.value === 'review') {
      void refreshReviews()
    }
  }
}

function connectStream() {
  closeStream()
  logError.value = ''
  stream = new EventSource(`/api/projects/${projectId}/run/stream`)
  stream.onopen = () => {
    logs.value = []
    logError.value = ''
  }
  stream.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as { type?: string }
      if (payload.type === 'ping') {
        return
      }
      handleRunEvent(payload as RunEvent)
    } catch {
      // 忽略无法解析的事件
    }
  }
  stream.onerror = () => {
    if (runActive.value) {
      logError.value = '日志连接中断，正在自动重连…'
    }
  }
}

async function launchRun(path: 'run' | 'review', kind: 'develop' | 'review') {
  startingRun.value = true
  actionError.value = ''
  actionMessage.value = ''
  logError.value = ''
  try {
    await $fetch(`/api/projects/${projectId}/${path}`, { method: 'POST' })
    logs.value = []
    runActive.value = true
    runState.value = 'running'
    runKind.value = kind
    await refreshProject()
    connectStream()
  } catch (error) {
    actionError.value = readError(error)
    runActive.value = false
    runState.value = 'idle'
  } finally {
    startingRun.value = false
  }
}

function startRun() {
  return launchRun('run', 'develop')
}

function startReview() {
  return launchRun('review', 'review')
}

async function cancelRun() {
  cancelling.value = true
  actionError.value = ''
  try {
    await $fetch(`/api/projects/${projectId}/run/cancel`, { method: 'POST' })
    if (runState.value !== 'cancelled') {
      actionMessage.value = '已请求停止运行'
    }
    await Promise.all([refreshProject(), refreshPlan()])
  } catch (error) {
    actionError.value = readError(error)
  } finally {
    cancelling.value = false
  }
}

onMounted(async () => {
  try {
    const status = await $fetch<RunStatusResponse>(`/api/projects/${projectId}/run/status`)
    if (!status.run) {
      return
    }
    runState.value = status.run.status
    runActive.value = status.active
    runKind.value = status.run.kind
    connectStream()
  } catch {
    // 运行状态不可用时保持页面其余功能可用
  }
})

onUnmounted(closeStream)

watch(
  () => logs.value.length,
  async () => {
    await nextTick()
    if (logPanel.value) {
      logPanel.value.scrollTop = logPanel.value.scrollHeight
    }
  },
)

async function generatePlanAction(feedback = '') {
  planning.value = true
  actionError.value = ''
  actionMessage.value = ''
  try {
    await $fetch(`/api/projects/${projectId}/plan`, {
      method: 'POST',
      body: { feedback },
    })
    await Promise.all([refreshPlan(), refreshProject(), refreshReviews()])
    selectedKey.value = null
    logs.value = []
    runActive.value = false
    runState.value = 'idle'
    runKind.value = 'develop'
    closeStream()
    actionMessage.value = feedback ? '迭代计划已生成，请审批' : '新计划已生成，请审批'
  } catch (error) {
    actionError.value = readError(error)
  } finally {
    planning.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-[1400px]">
    <div class="wb-glow-card overflow-hidden rounded-box border border-base-300 bg-base-200/70">
      <div class="grid min-h-[680px] lg:grid-cols-[220px_1fr]">
        <aside class="space-y-1 border-b border-base-300 bg-base-100/60 p-3 lg:border-b-0 lg:border-r">
          <NuxtLink
            to="/"
            class="inline-flex items-center gap-1 px-2 py-1 text-xs opacity-60 transition-opacity hover:opacity-100"
          >
            ← 全部项目
          </NuxtLink>
          <div class="px-2 pt-3 pb-1 text-[11px] uppercase tracking-wider opacity-50">项目</div>
          <NuxtLink
            v-for="p in allProjects"
            :key="p.id"
            :to="`/projects/${p.id}`"
            class="block rounded-lg px-3 py-2 text-sm transition-colors"
            :class="
              p.id === projectId
                ? 'bg-primary/10 text-primary font-medium'
                : 'opacity-70 hover:bg-base-200 hover:opacity-100'
            "
          >
            <div class="truncate">{{ p.name }}</div>
            <div class="text-[11px] opacity-60">{{ statusLabel[p.status] || p.status }}</div>
          </NuxtLink>
        </aside>

        <div class="grid grid-rows-[auto_1fr]">
          <header
            class="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 bg-base-100/60 px-5 py-4"
          >
            <div class="min-w-0">
              <h1 class="truncate text-lg font-semibold">{{ project?.name }}</h1>
              <p class="truncate text-xs opacity-60">{{ project?.goal }}</p>
            </div>
            <div class="flex items-center gap-2">
              <span class="badge badge-sm" :class="statusBadge[projectStatus] || 'badge-ghost'">
                {{ statusLabel[projectStatus] || projectStatus }}
              </span>
              <span class="text-xs opacity-50">计划 v{{ planVersion }}</span>
            </div>
          </header>

          <div class="grid xl:grid-cols-[1fr_340px]">
            <div class="min-w-0 p-4">
              <ProjectFlow
                v-if="hasPlan"
                :nodes="planNodes"
                :edges="planEdges"
                @select="selectNode"
              />
              <div
                v-else
                class="flex min-h-[420px] items-center justify-center rounded-box border border-dashed border-base-300 bg-base-100/40 p-6 text-center text-sm opacity-60"
              >
                还没有计划。在右侧点击「生成计划」，让规划 Agent 拆解任务。
              </div>

              <div
                v-if="logs.length || runActive"
                class="mt-3 overflow-hidden rounded-box border border-base-300 bg-neutral text-neutral-content"
              >
                <div
                  class="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2"
                >
                  <div class="flex items-center gap-2 text-xs font-medium">
                    <span
                      v-if="runActive"
                      class="wb-pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-warning"
                    />
                    {{ runKind === 'review' ? '审查日志' : '运行日志' }}
                    <span v-if="logError" class="text-[11px] text-warning">{{ logError }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      v-if="runActive"
                      class="btn btn-xs btn-ghost text-error"
                      :disabled="cancelling"
                      @click="cancelRun"
                    >
                      <span v-if="cancelling" class="loading loading-spinner loading-xs" />
                      停止运行
                    </button>
                    <span class="badge badge-xs" :class="runStateBadge">{{ runStateLabel }}</span>
                  </div>
                </div>
                <div
                  ref="logPanel"
                  class="max-h-56 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed"
                >
                  <div v-if="!logs.length" class="opacity-50">等待事件…</div>
                  <div
                    v-for="entry in logs"
                    :key="entry.seq"
                    class="flex gap-2 py-0.5"
                  >
                    <span class="shrink-0 opacity-40">{{ timeLabel(entry.ts) }}</span>
                    <span
                      class="whitespace-pre-wrap break-words"
                      :class="logClass(entry)"
                    >{{ logText(entry) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <aside class="space-y-4 border-t border-base-300 bg-base-100/60 p-4 xl:border-t-0 xl:border-l">
              <section>
                <div class="mb-2 text-[11px] uppercase tracking-wider opacity-50">节点详情</div>
                <template v-if="selectedNode">
                  <div class="font-medium">{{ selectedNode.title }}</div>
                  <div class="mt-1 flex flex-wrap gap-2">
                    <span class="badge badge-xs badge-outline">
                      {{ kindLabel[selectedNode.kind] || selectedNode.kind }}
                    </span>
                    <span
                      class="badge badge-xs"
                      :class="nodeStatusBadge[selectedNode.status] || 'badge-ghost'"
                    >
                      {{ nodeStatusLabel[selectedNode.status] || selectedNode.status }}
                    </span>
                  </div>
                  <p class="mt-2 whitespace-pre-wrap text-xs opacity-70">{{ selectedNode.spec }}</p>

                  <div
                    v-if="selectedNode.kind === 'develop'"
                    class="mt-3 rounded-box border border-base-300 bg-base-200/50 p-2"
                  >
                    <div class="text-[11px] uppercase tracking-wider opacity-50">验收契约</div>
                    <template v-if="selectedVerification">
                      <ul class="mt-1 space-y-1 text-[11px]">
                        <li
                          v-for="(command, index) in selectedVerification.commands"
                          :key="`command-${index}`"
                          class="break-all"
                        >
                          <span class="badge badge-xs badge-outline">命令</span>
                          <code class="ml-1">{{ command.command }}</code>
                          <span class="opacity-50">
                            · 退出码 {{ command.expectedExitCode ?? 0 }}
                            <template v-if="command.expectedOutput">
                              · 输出含「{{ command.expectedOutput }}」
                            </template>
                          </span>
                        </li>
                        <li
                          v-for="artifact in selectedVerification.artifacts"
                          :key="`artifact-${artifact}`"
                          class="break-all"
                        >
                          <span class="badge badge-xs badge-outline">产物</span>
                          <span class="ml-1">{{ artifact }}</span>
                        </li>
                      </ul>
                    </template>
                    <p v-else class="mt-1 text-[11px] text-warning">
                      未配置验收契约（旧计划），本次会跳过确定性验证。
                    </p>

                    <div
                      v-if="selectedVerificationResult"
                      class="mt-2 border-t border-base-300 pt-2"
                    >
                      <div class="flex flex-wrap items-center gap-2 text-[11px]">
                        <span
                          class="badge badge-xs"
                          :class="
                            selectedVerificationResult.ok ? 'badge-success' : 'badge-error'
                          "
                        >
                          {{ selectedVerificationResult.ok ? '通过' : '未通过' }}
                        </span>
                        <span class="opacity-70">{{ selectedVerificationResult.summary }}</span>
                      </div>
                      <details
                        v-if="selectedVerificationResult.checks.length"
                        class="mt-1"
                      >
                        <summary class="cursor-pointer text-[11px] opacity-60">检查详情</summary>
                        <ul class="mt-1 space-y-1 text-[11px]">
                          <li
                            v-for="(check, index) in selectedVerificationResult.checks"
                            :key="index"
                          >
                            <span
                              class="badge badge-xs"
                              :class="check.ok ? 'badge-success' : 'badge-error'"
                            >
                              {{ check.ok ? 'OK' : 'FAIL' }}
                            </span>
                            <span class="ml-1 break-all">{{ check.target }}</span>
                            <div v-if="check.error" class="text-error opacity-80">
                              {{ check.error }}
                            </div>
                            <pre
                              v-if="check.output"
                              class="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-all rounded bg-base-300/40 p-1 text-[10px] opacity-70"
                            >{{ check.output }}</pre>
                          </li>
                        </ul>
                      </details>
                    </div>
                  </div>
                </template>
                <div v-else class="text-xs opacity-60">点击画布中的节点查看详情。</div>
              </section>

              <section class="border-t border-base-300 pt-3">
                <div class="mb-2 text-[11px] uppercase tracking-wider opacity-50">计划审批</div>

                <p v-if="actionError" class="mb-2 text-xs text-error">{{ actionError }}</p>
                <p v-if="actionMessage" class="mb-2 text-xs text-success">{{ actionMessage }}</p>

                <template v-if="projectStatus === 'planned'">
                  <p class="mb-2 text-xs opacity-60">确认执行计划后批准；不满意可打回并说明原因。</p>
                  <div
                    v-if="developNodesWithoutVerification"
                    class="alert alert-warning mb-2 py-2 text-xs"
                  >
                    有 {{ developNodesWithoutVerification }} 个开发节点没有验收契约，本次会跳过确定性验证。建议打回后重新生成计划。
                  </div>
                  <div class="flex gap-2">
                    <button
                      class="btn btn-sm btn-success wb-press"
                      :disabled="deciding"
                      @click="approvePlan"
                    >
                      <span v-if="deciding" class="loading loading-spinner loading-xs" />
                      批准计划
                    </button>
                    <button
                      class="btn btn-sm btn-outline btn-error wb-press"
                      :disabled="deciding"
                      @click="showReject = !showReject"
                    >
                      打回
                    </button>
                  </div>
                  <div v-if="showReject" class="mt-2 space-y-2">
                    <textarea
                      v-model="rejectComment"
                      class="textarea textarea-bordered textarea-sm w-full"
                      rows="3"
                      placeholder="说明打回原因，例如：任务拆得太粗"
                    />
                    <button
                      class="btn btn-sm btn-error wb-press"
                      :disabled="deciding"
                      @click="rejectPlan"
                    >
                      确认打回
                    </button>
                  </div>
                </template>

                <template v-else-if="projectStatus === 'approved'">
                  <p class="mb-2 text-xs opacity-60">
                    计划已批准。开发者 Agent 会按节点执行，过程可在下方实时查看。
                  </p>
                  <button
                    class="btn btn-sm btn-primary wb-press"
                    :disabled="startingRun"
                    @click="startRun"
                  >
                    <span v-if="startingRun" class="loading loading-spinner loading-xs" />
                    开始开发
                  </button>
                </template>

                <template v-else-if="projectStatus === 'in_progress'">
                  <p v-if="runActive" class="mb-2 text-xs opacity-60">
                    {{
                      runKind === 'review'
                        ? '审查 Agent 正在执行，实时日志见下方。'
                        : '开发者 Agent 正在执行，实时日志见下方。'
                    }}
                  </p>
                  <template v-else-if="allDevelopDone || runState === 'done'">
                    <p class="mb-2 text-xs opacity-60">开发节点已完成，可以开始审查。</p>
                    <button
                      class="btn btn-sm btn-primary wb-press"
                      :disabled="startingRun"
                      @click="startReview"
                    >
                      <span v-if="startingRun" class="loading loading-spinner loading-xs" />
                      开始审查
                    </button>
                  </template>
                  <div v-else class="space-y-2">
                    <p class="text-xs opacity-60">还有开发节点未完成，可继续执行。</p>
                    <button
                      class="btn btn-sm btn-primary wb-press"
                      :disabled="startingRun"
                      @click="startRun"
                    >
                      <span v-if="startingRun" class="loading loading-spinner loading-xs" />
                      继续开发
                    </button>
                  </div>
                </template>

                <template v-else-if="projectStatus === 'reviewed'">
                  <p class="mb-2 text-xs opacity-60">
                    自动审查已通过，请人工验收；批准后项目完成，打回则进入重新规划。
                  </p>
                  <div class="flex gap-2">
                    <button
                      class="btn btn-sm btn-success wb-press"
                      :disabled="deciding"
                      @click="approveProject"
                    >
                      <span v-if="deciding" class="loading loading-spinner loading-xs" />
                      批准完成
                    </button>
                    <button
                      class="btn btn-sm btn-outline btn-error wb-press"
                      :disabled="deciding"
                      @click="showAcceptReject = !showAcceptReject"
                    >
                      打回
                    </button>
                  </div>
                  <div v-if="showAcceptReject" class="mt-2 space-y-2">
                    <textarea
                      v-model="acceptRejectComment"
                      class="textarea textarea-bordered textarea-sm w-full"
                      rows="3"
                      placeholder="说明打回原因，将作为重新规划的依据"
                    />
                    <button
                      class="btn btn-sm btn-error wb-press"
                      :disabled="deciding"
                      @click="rejectProject"
                    >
                      确认打回
                    </button>
                  </div>
                </template>

                <template v-else-if="projectStatus === 'review_failed'">
                  <div class="space-y-2">
                    <div class="alert alert-error py-2 text-xs">
                      审查未通过，请根据下方审查问题重新规划。
                    </div>
                    <button
                      class="btn btn-sm btn-primary wb-press"
                      :disabled="planning"
                      @click="
                        generatePlanAction(
                          reviewFeedback || '自动审查未通过，请根据审查记录重新规划',
                        )
                      "
                    >
                      <span v-if="planning" class="loading loading-spinner loading-xs" />
                      根据审查问题重新规划
                    </button>
                  </div>
                </template>

                <template v-else-if="projectStatus === 'changes_requested'">
                  <div class="space-y-2">
                    <div class="alert alert-warning py-2 text-xs">
                      人工验收未通过，需要重新规划。
                    </div>
                    <p
                      v-if="latestTaskReject?.comment"
                      class="whitespace-pre-wrap text-xs opacity-70"
                    >
                      {{ latestTaskReject.comment }}
                    </p>
                    <button
                      class="btn btn-sm btn-primary wb-press"
                      :disabled="planning"
                      @click="generatePlanAction(taskRejectFeedback)"
                    >
                      <span v-if="planning" class="loading loading-spinner loading-xs" />
                      重新规划
                    </button>
                  </div>
                </template>

                <template v-else-if="projectStatus === 'plan_rejected'">
                  <div class="space-y-2">
                    <div class="alert alert-warning py-2 text-xs">计划已被打回，可重新生成。</div>
                    <p
                      v-if="latestPlanReject?.comment"
                      class="whitespace-pre-wrap text-xs opacity-70"
                    >
                      {{ latestPlanReject.comment }}
                    </p>
                    <button
                      class="btn btn-sm btn-primary wb-press"
                      :disabled="planning"
                      @click="generatePlanAction(planRejectFeedback)"
                    >
                      <span v-if="planning" class="loading loading-spinner loading-xs" />
                      重新生成计划
                    </button>
                  </div>
                </template>

                <template v-else-if="projectStatus === 'done'">
                  <div class="alert alert-success py-2 text-xs">项目已完成，人工验收通过。</div>
                  <p class="mt-2 text-xs opacity-60">最终代码与提交记录保存在项目工作区。</p>
                </template>

                <template v-else>
                  <button
                    class="btn btn-sm btn-primary wb-press"
                    :disabled="planning"
                    @click="generatePlanAction()"
                  >
                    <span v-if="planning" class="loading loading-spinner loading-xs" />
                    生成计划
                  </button>
                </template>
              </section>

              <section v-if="latestReviews.length" class="border-t border-base-300 pt-3">
                <div class="mb-2 text-[11px] uppercase tracking-wider opacity-50">审查结果</div>
                <ul class="space-y-3">
                  <li v-for="review in latestReviews" :key="review.id" class="text-xs">
                    <div class="flex flex-wrap items-center gap-2">
                      <span
                        class="badge badge-xs"
                        :class="review.verdict === 'pass' ? 'badge-success' : 'badge-error'"
                      >
                        {{ review.verdict === 'pass' ? '通过' : '未通过' }}
                      </span>
                      <span class="font-medium">{{ nodeTitle(review.developNodeKey) }}</span>
                      <span class="opacity-50">{{ review.createdAt }}</span>
                    </div>
                    <p class="mt-1 opacity-70">{{ review.summary }}</p>
                    <ul v-if="review.issues.length" class="mt-1 space-y-1">
                      <li
                        v-for="(issue, index) in review.issues"
                        :key="index"
                        class="opacity-70"
                      >
                        <span class="badge badge-xs badge-outline">
                          {{ severityLabel[issue.severity] || issue.severity }}
                        </span>
                        <span class="ml-1">{{ issue.message }}</span>
                        <span v-if="issue.file" class="opacity-50">
                          （{{ issue.file }}<span v-if="issue.line">:{{ issue.line }}</span>）
                        </span>
                      </li>
                    </ul>
                  </li>
                </ul>
              </section>

              <section v-if="decisionList?.length" class="border-t border-base-300 pt-3">
                <div class="mb-2 text-[11px] uppercase tracking-wider opacity-50">决策记录</div>
                <ul class="space-y-2">
                  <li v-for="decision in decisionList.slice(0, 5)" :key="decision.id" class="text-xs">
                    <span
                      class="badge badge-xs"
                      :class="decisionBadge[decision.decision] || 'badge-ghost'"
                    >
                      {{ decisionLabel[decision.decision] || decision.decision }}
                    </span>
                    <span class="ml-1 opacity-50">{{ decision.createdAt }}</span>
                    <div v-if="decision.comment" class="mt-1 opacity-70">{{ decision.comment }}</div>
                  </li>
                </ul>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
