<script setup lang="ts">
interface ToastItem {
  id: number
  type: 'success' | 'warning' | 'error' | 'info'
  message: string
}

const toasts = ref<ToastItem[]>([])
let toastSeq = 0

const alertClass: Record<ToastItem['type'], string> = {
  success: 'alert-success',
  warning: 'alert-warning',
  error: 'alert-error',
  info: 'alert-info',
}

function showToast(type: ToastItem['type'], message: string) {
  const id = (toastSeq += 1)
  toasts.value.push({ id, type, message })
  setTimeout(() => {
    toasts.value = toasts.value.filter(item => item.id !== id)
  }, 3200)
}

const demoLoading = ref(false)

async function simulateLoading() {
  demoLoading.value = true
  await new Promise(resolve => setTimeout(resolve, 1200))
  demoLoading.value = false
  showToast('success', '审批已提交，流程继续推进')
}

const surfaces = [
  { name: 'base-100', label: '表面 / 卡片', className: 'bg-base-100 text-base-content border border-base-300' },
  { name: 'base-200', label: '页面背景', className: 'bg-base-200 text-base-content border border-base-300' },
  { name: 'base-300', label: '边框 / 分隔', className: 'bg-base-300 text-base-content' },
]

const palette = [
  { name: 'primary', label: '主色 / 强调', className: 'bg-primary text-primary-content' },
  { name: 'secondary', label: '次要色', className: 'bg-secondary text-secondary-content' },
  { name: 'accent', label: '辅助色', className: 'bg-accent text-accent-content' },
  { name: 'neutral', label: '中性强调', className: 'bg-neutral text-neutral-content' },
  { name: 'info', label: '信息', className: 'bg-info text-info-content' },
  { name: 'success', label: '成功', className: 'bg-success text-success-content' },
  { name: 'warning', label: '进行中 / 警告', className: 'bg-warning text-warning-content' },
  { name: 'error', label: '失败 / 错误', className: 'bg-error text-error-content' },
]

const statuses = [
  { label: '已完成', badge: 'badge-success', desc: '节点完成并通过审查' },
  { label: '执行中', badge: 'badge-warning', pulse: true, desc: 'Agent 正在运行' },
  { label: '待处理', badge: 'badge-ghost', desc: '等待依赖节点完成' },
  { label: '待审批', badge: 'badge-info', desc: '等待你拍板' },
  { label: '失败', badge: 'badge-error', desc: '需要重试或调整方案' },
]
</script>

<template>
  <div class="max-w-5xl mx-auto space-y-10">
    <header class="space-y-2">
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-semibold tracking-tight wb-title-gradient">Workbench 设计预览</h1>
        <span class="badge badge-primary badge-sm">UI 提案 v6 · Warm Paper</span>
      </div>
      <p class="text-sm opacity-70 max-w-2xl">
        借鉴 Claude 的暖纸质感：象牙暖白底、陶土橙主色、鼠尾草绿与暖金辅助；深色主题是暖棕炭色。
        保留 Geist 字体、柔和反馈与原生 View Transitions。
      </p>
    </header>

    <section>
      <h2 class="text-lg font-semibold mb-1">配色</h2>
      <p class="text-sm opacity-60 mb-4">中性灰为基础，靛蓝作为唯一强调色；状态用语义色表达。</p>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div
          v-for="s in surfaces"
          :key="s.name"
          class="rounded-box p-4"
          :class="s.className"
        >
          <div class="text-xs opacity-70">{{ s.label }}</div>
          <div class="font-mono text-xs mt-1">{{ s.name }}</div>
        </div>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
        <div v-for="c in palette" :key="c.name" class="rounded-box p-4" :class="c.className">
          <div class="text-xs opacity-80">{{ c.label }}</div>
          <div class="font-mono text-xs mt-1">{{ c.name }}</div>
        </div>
      </div>
    </section>

    <section>
      <h2 class="text-lg font-semibold mb-1">状态语言</h2>
      <p class="text-sm opacity-60 mb-4">同一套徽章贯穿画布、列表和检查器；运行中的状态带呼吸圆点。</p>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div
          v-for="s in statuses"
          :key="s.label"
          class="rounded-box border border-base-300 bg-base-100 p-4 flex items-center justify-between gap-3"
        >
          <div>
            <div class="text-sm font-medium">{{ s.label }}</div>
            <div class="text-xs opacity-60">{{ s.desc }}</div>
          </div>
          <span class="badge badge-sm gap-1" :class="s.badge">
            <span
              v-if="s.pulse"
              class="wb-pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-current"
            />
            {{ s.label }}
          </span>
        </div>
      </div>
    </section>

    <section>
      <h2 class="text-lg font-semibold mb-1">操作与反馈</h2>
      <p class="text-sm opacity-60 mb-4">按钮有按压反馈和加载态；操作结果用 Toast 提示，不打断流程。</p>
      <div class="flex flex-wrap items-center gap-3">
        <button class="btn btn-primary wb-press" @click="showToast('success', '已批准，进入下一节点')">
          批准
        </button>
        <button class="btn btn-secondary wb-press" @click="showToast('info', '已切换节点')">
          次要操作
        </button>
        <button class="btn btn-outline wb-press" @click="showToast('warning', '有 2 条审查意见待处理')">
          描边按钮
        </button>
        <button class="btn btn-ghost wb-press">幽灵按钮</button>
        <button class="btn btn-primary" :disabled="demoLoading" @click="simulateLoading">
          <span v-if="demoLoading" class="loading loading-spinner loading-sm" />
          {{ demoLoading ? '提交中…' : '模拟加载' }}
        </button>
        <button class="btn" disabled>禁用</button>
      </div>

      <div class="space-y-2 mt-5">
        <div class="alert alert-success">审查通过：greet.js 输出与退出码符合预期</div>
        <div class="alert alert-warning">等待人工审批：计划 v1 已生成，请确认后继续</div>
        <div class="alert alert-error">开发任务失败：测试未通过，已回退到上一提交</div>
      </div>
    </section>

    <section>
      <h2 class="text-lg font-semibold mb-1">过渡与动效</h2>
      <p class="text-sm opacity-60 mb-4">
        统一使用 150–240ms 的 ease-out 曲线；卡片悬停上浮、运行节点呼吸、活动连线流动；尊重系统的「减少动态效果」设置。
      </p>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div class="wb-hover-lift rounded-box border border-base-300 bg-base-100 p-4">
          <div class="text-sm font-medium">悬停上浮</div>
          <div class="text-xs opacity-60 mt-1">把鼠标移到卡片上</div>
        </div>
        <div class="rounded-box border border-base-300 bg-base-100 p-4 space-y-2">
          <div class="text-sm font-medium">加载骨架</div>
          <div class="skeleton h-3 w-3/4" />
          <div class="skeleton h-3 w-1/2" />
          <div class="skeleton h-3 w-2/3" />
        </div>
        <div class="rounded-box border border-base-300 bg-base-100 p-4">
          <div class="text-sm font-medium">运行状态</div>
          <div class="mt-3 flex items-center gap-2 text-sm">
            <span class="wb-pulse-dot inline-block h-2 w-2 rounded-full bg-warning" />
            review-greeting 正在执行
          </div>
        </div>
      </div>

      <div class="mt-4">
        <WorkflowCanvas />
      </div>
    </section>

    <section>
      <h2 class="text-lg font-semibold mb-1">工作台布局示意</h2>
      <p class="text-sm opacity-60 mb-4">
        Step 8 的目标形态：左侧项目栏、中间画布、右侧节点检查器与审批操作。
      </p>

      <div class="wb-glow-card rounded-box border border-base-300 bg-base-200 overflow-hidden">
        <div class="grid grid-cols-1 lg:grid-cols-[200px_1fr] min-h-[420px]">
          <aside class="border-b lg:border-b-0 lg:border-r border-base-300 bg-base-100 p-3 space-y-2">
            <div class="text-[11px] uppercase tracking-wider opacity-50 px-2">项目</div>
            <div class="rounded-lg bg-primary/10 text-primary px-3 py-2 text-sm font-medium">
              问候脚本
            </div>
            <div class="rounded-lg px-3 py-2 text-sm opacity-60 hover:bg-base-200 transition-colors">
              示例项目
            </div>
            <button class="btn btn-sm btn-ghost justify-start w-full">+ 新建项目</button>
          </aside>

          <div class="grid grid-rows-[auto_1fr]">
            <header
              class="border-b border-base-300 bg-base-100 px-4 py-3 flex items-center justify-between gap-3"
            >
              <div>
                <div class="font-semibold">问候脚本</div>
                <div class="text-xs opacity-60">写一个 greet.js，运行后打印 Hello, Alice</div>
              </div>
              <div class="flex items-center gap-2">
                <span class="badge badge-sm badge-info">planned</span>
                <button class="btn btn-xs btn-primary wb-press" @click="showToast('info', '已启动开发节点')">
                  运行
                </button>
              </div>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-[1fr_260px]">
              <div class="p-6">
                <div class="flex items-center gap-3 flex-wrap">
                  <div class="wb-hover-lift w-44 rounded-box border border-base-300 bg-base-100 p-3">
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-sm font-medium">实现问候脚本</span>
                      <span class="badge badge-sm badge-success">已完成</span>
                    </div>
                    <div class="text-xs opacity-60 mt-1">develop</div>
                  </div>
                  <div class="text-primary">→</div>
                  <div
                    class="wb-hover-lift w-44 rounded-box border border-warning/50 bg-base-100 p-3 ring-2 ring-warning/20"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-sm font-medium">审查问候脚本</span>
                      <span class="badge badge-sm badge-warning gap-1">
                        <span class="wb-pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-current" />
                        执行中
                      </span>
                    </div>
                    <div class="text-xs opacity-60 mt-1">review</div>
                  </div>
                  <div class="text-primary">→</div>
                  <div class="wb-hover-lift w-44 rounded-box border border-base-300 bg-base-100 p-3">
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-sm font-medium">人工验收</span>
                      <span class="badge badge-sm badge-ghost">待处理</span>
                    </div>
                    <div class="text-xs opacity-60 mt-1">gate</div>
                  </div>
                </div>
                <p class="text-xs opacity-50 mt-6">
                  真实画布会显示可拖拽节点与流动连线；这里用静态卡片示意。
                </p>
              </div>

              <aside class="border-t md:border-t-0 md:border-l border-base-300 bg-base-100 p-4 space-y-3">
                <div class="text-[11px] uppercase tracking-wider opacity-50">节点详情</div>
                <div class="font-medium">审查问候脚本</div>
                <div class="flex gap-2">
                  <span class="badge badge-warning badge-sm">执行中</span>
                  <span class="badge badge-outline badge-sm">review</span>
                </div>
                <p class="text-xs opacity-70">
                  检查 greet.js 的输出、退出码与测试结果，发现问题时给出具体修改意见。
                </p>
                <div class="flex gap-2">
                  <button
                    class="btn btn-sm btn-primary wb-press"
                    @click="showToast('success', '已批准：进入人工验收')"
                  >
                    批准
                  </button>
                  <button
                    class="btn btn-sm btn-ghost wb-press"
                    @click="showToast('info', '已打回，等待修改意见')"
                  >
                    打回
                  </button>
                </div>
                <div class="text-[11px] uppercase tracking-wider opacity-50 pt-2">实时日志</div>
                <div class="font-mono text-[11px] leading-5 opacity-70 space-y-1">
                  <div>[10:32] developer 启动</div>
                  <div>[10:33] 修改 greet.js</div>
                  <div>[10:34] git commit 9a4de59</div>
                  <div class="text-warning">[10:35] review 运行中…</div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section>
      <h2 class="text-lg font-semibold mb-1">页面切换</h2>
      <p class="text-sm opacity-60 mb-4">
        使用原生 View Transitions：只对内容区做 180ms 淡出 + 260ms 淡入的交叉过渡，导航栏保持稳定，不再有整页闪烁。
      </p>
      <div class="flex flex-wrap gap-3">
        <NuxtLink to="/" class="btn btn-primary wb-press">去项目页体验</NuxtLink>
        <NuxtLink to="/workflow" class="btn btn-outline wb-press">去画布页体验</NuxtLink>
      </div>
    </section>

    <div class="toast toast-end toast-bottom z-50">
      <TransitionGroup name="toast" tag="div" class="flex flex-col gap-2 items-end">
        <div v-for="t in toasts" :key="t.id" class="alert shadow-lg" :class="alertClass[t.type]">
          {{ t.message }}
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>
