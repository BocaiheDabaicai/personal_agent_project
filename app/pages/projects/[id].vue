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
  status: string
  x: number
  y: number
  order: number
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

const route = useRoute()
const projectId = Number(route.params.id)

const { data: project, refresh: refreshProject } = await useFetch<Project>(`/api/projects/${projectId}`)
const { data: plan, refresh: refreshPlan } = await useFetch<PlanResponse>(`/api/projects/${projectId}/plan`)
const { data: decisionList, refresh: refreshDecisions } = await useFetch<Decision[]>(
  `/api/projects/${projectId}/decisions`,
)
const { data: allProjects } = await useFetch<Project[]>('/api/projects')

const planNodes = computed(() => plan.value?.nodes ?? [])
const planEdges = computed(() => plan.value?.edges ?? [])
const hasPlan = computed(() => planNodes.value.length > 0)
const planVersion = computed(() => plan.value?.planVersion ?? 0)
const projectStatus = computed(() => project.value?.status ?? 'draft')

const selectedKey = ref<string | null>(null)
const selectedNode = computed(
  () => planNodes.value.find(node => node.nodeKey === selectedKey.value) ?? null,
)

const actionError = ref('')
const actionMessage = ref('')
const planning = ref(false)
const deciding = ref(false)
const showReject = ref(false)
const rejectComment = ref('')

const statusLabel: Record<string, string> = {
  draft: '草稿',
  planned: '待审批',
  approved: '已批准',
  plan_rejected: '已打回',
  in_progress: '进行中',
  done: '已完成',
}
const statusBadge: Record<string, string> = {
  draft: 'badge-ghost',
  planned: 'badge-info',
  approved: 'badge-success',
  plan_rejected: 'badge-error',
  in_progress: 'badge-warning',
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

function selectNode(payload: { nodeKey: string }) {
  selectedKey.value = payload.nodeKey
}

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

async function generatePlanAction() {
  planning.value = true
  actionError.value = ''
  actionMessage.value = ''
  try {
    await $fetch(`/api/projects/${projectId}/plan`, { method: 'POST' })
    await Promise.all([refreshPlan(), refreshProject()])
    selectedKey.value = null
    actionMessage.value = '新计划已生成，请审批'
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
                </template>
                <div v-else class="text-xs opacity-60">点击画布中的节点查看详情。</div>
              </section>

              <section class="border-t border-base-300 pt-3">
                <div class="mb-2 text-[11px] uppercase tracking-wider opacity-50">计划审批</div>

                <p v-if="actionError" class="mb-2 text-xs text-error">{{ actionError }}</p>
                <p v-if="actionMessage" class="mb-2 text-xs text-success">{{ actionMessage }}</p>

                <template v-if="projectStatus === 'planned'">
                  <p class="mb-2 text-xs opacity-60">确认执行计划后批准；不满意可打回并说明原因。</p>
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
                  <div class="alert alert-success py-2 text-xs">
                    计划已批准。开发执行将在 Step 9 接入。
                  </div>
                </template>

                <template v-else-if="projectStatus === 'plan_rejected'">
                  <div class="space-y-2">
                    <div class="alert alert-warning py-2 text-xs">计划已被打回，可重新生成。</div>
                    <button
                      class="btn btn-sm btn-primary wb-press"
                      :disabled="planning"
                      @click="generatePlanAction"
                    >
                      <span v-if="planning" class="loading loading-spinner loading-xs" />
                      重新生成计划
                    </button>
                  </div>
                </template>

                <template v-else>
                  <button
                    class="btn btn-sm btn-primary wb-press"
                    :disabled="planning"
                    @click="generatePlanAction"
                  >
                    <span v-if="planning" class="loading loading-spinner loading-xs" />
                    生成计划
                  </button>
                </template>
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
