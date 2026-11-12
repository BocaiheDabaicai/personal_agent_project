<script setup lang="ts">
interface Project {
  id: number
  name: string
  goal: string
  status: string
  createdAt: string
}

interface WorkspaceInfo {
  repoPath: string
  exists: boolean
  log: string[]
}

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

const { data: projects, refresh } = await useFetch<Project[]>('/api/projects')

const form = reactive({ name: '', goal: '' })
const saving = ref(false)
const error = ref('')

const workspaces = reactive<Record<number, WorkspaceInfo>>({})

async function createProject() {
  error.value = ''
  if (!form.name.trim() || !form.goal.trim()) {
    error.value = '请填写项目名称和目标'
    return
  }

  saving.value = true
  try {
    await $fetch('/api/projects', {
      method: 'POST',
      body: { name: form.name, goal: form.goal },
    })
    form.name = ''
    form.goal = ''
    await refresh()
  } catch (e) {
    const message = (e as { data?: { statusMessage?: string } })?.data?.statusMessage
    error.value = message || '创建失败'
  } finally {
    saving.value = false
  }
}

async function loadWorkspace(id: number) {
  workspaces[id] = await $fetch<WorkspaceInfo>(`/api/projects/${id}/workspace`)
}
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-6">
    <div class="card bg-base-100 shadow">
      <div class="card-body">
        <h2 class="card-title">新建项目</h2>
        <p class="text-sm opacity-70">先手动创建项目，再让规划 Agent 生成执行计划。</p>
        <input
          v-model="form.name"
          class="input input-bordered w-full"
          placeholder="项目名称，例如：问候脚本"
        />
        <textarea
          v-model="form.goal"
          class="textarea textarea-bordered w-full"
          rows="3"
          placeholder="目标描述，例如：写一个 greet.js，运行后打印 Hello, Alice"
        />
        <p v-if="error" class="text-error text-sm">{{ error }}</p>
        <div class="card-actions justify-end">
          <button class="btn btn-primary" :disabled="saving" @click="createProject">
            <span v-if="saving" class="loading loading-spinner loading-sm" />
            {{ saving ? '创建中' : '创建项目' }}
          </button>
        </div>
      </div>
    </div>

    <div class="card bg-base-100 shadow">
      <div class="card-body">
        <h2 class="card-title">
          项目列表
          <span class="badge badge-ghost">{{ projects?.length ?? 0 }}</span>
        </h2>
        <div v-if="!projects?.length" class="text-sm opacity-60">还没有项目，先创建一个。</div>
        <ul v-else class="space-y-3">
          <li
            v-for="p in projects"
            :key="p.id"
            class="border border-base-300 rounded-box p-4"
          >
            <div class="flex items-start justify-between gap-4">
              <div>
                <div class="font-semibold">{{ p.name }}</div>
                <div class="text-sm opacity-70">{{ p.goal }}</div>
              </div>
              <span class="badge" :class="statusBadge[p.status] || 'badge-ghost'">
                {{ statusLabel[p.status] || p.status }}
              </span>
            </div>
            <div class="text-xs opacity-50 mt-2">创建于 {{ p.createdAt }}</div>

            <div class="mt-3 flex flex-wrap items-center gap-2">
              <NuxtLink :to="`/projects/${p.id}`" class="btn btn-xs btn-primary">
                进入工作台
              </NuxtLink>
              <button class="btn btn-xs btn-outline" @click="loadWorkspace(p.id)">
                查看工作区
              </button>
            </div>

            <div
              v-if="workspaces[p.id]"
              class="mt-2 text-xs bg-base-200 rounded-box p-3 space-y-1"
            >
              <div class="break-all">路径：{{ workspaces[p.id]?.repoPath }}</div>
              <template v-if="workspaces[p.id]?.exists">
                <div class="opacity-60">最近提交：</div>
                <ul>
                  <li v-for="line in workspaces[p.id]?.log" :key="line">{{ line }}</li>
                </ul>
              </template>
              <div v-else class="text-warning">工作区尚未初始化</div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
