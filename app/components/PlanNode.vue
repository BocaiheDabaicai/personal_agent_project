<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

const props = defineProps<{
  data: {
    title: string
    spec: string
    kind: string
    status: string
  }
}>()

const kindLabel: Record<string, string> = {
  develop: '开发',
  review: '审查',
  gate: '验收',
}

const statusMeta: Record<string, { label: string; badge: string }> = {
  pending: { label: '待处理', badge: 'badge-ghost' },
  running: { label: '执行中', badge: 'badge-warning' },
  done: { label: '已完成', badge: 'badge-success' },
  failed: { label: '失败', badge: 'badge-error' },
  awaiting: { label: '待审批', badge: 'badge-info' },
}

const status = computed(
  () => statusMeta[props.data.status] ?? { label: props.data.status, badge: 'badge-ghost' },
)
</script>

<template>
  <div class="w-56 rounded-box border border-base-300 bg-base-100 p-3 shadow-sm wb-hover-lift">
    <div class="flex items-center justify-between gap-2">
      <span class="text-sm font-medium leading-snug">{{ data.title }}</span>
      <span class="badge badge-xs gap-1" :class="status.badge">
        <span
          v-if="data.status === 'running'"
          class="wb-pulse-dot inline-block h-1 w-1 rounded-full bg-current"
        />
        {{ status.label }}
      </span>
    </div>
    <div class="mt-1.5 flex items-center gap-1.5">
      <span class="badge badge-xs badge-outline">{{ kindLabel[data.kind] || data.kind }}</span>
      <span class="truncate text-[11px] opacity-50">{{ data.spec }}</span>
    </div>
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Right" />
  </div>
</template>
