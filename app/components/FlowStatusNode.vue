<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

const props = defineProps<{
  data: {
    title: string
    detail?: string
    status: 'done' | 'running' | 'pending'
  }
}>()

const statusMeta = {
  done: { label: '已完成', badge: 'badge-success' },
  running: { label: '执行中', badge: 'badge-warning' },
  pending: { label: '待处理', badge: 'badge-ghost' },
} as const

const status = computed(() => statusMeta[props.data.status])
</script>

<template>
  <div class="card bg-base-100 shadow-sm w-60 border border-base-300 wb-hover-lift">
    <div class="card-body p-4">
      <div class="flex items-center justify-between gap-2">
        <span class="font-semibold text-sm">{{ data.title }}</span>
        <span class="badge badge-sm gap-1" :class="status.badge">
          <span
            v-if="data.status === 'running'"
            class="wb-pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-current"
          />
          {{ status.label }}
        </span>
      </div>
      <p v-if="data.detail" class="text-xs opacity-60">{{ data.detail }}</p>
    </div>
    <Handle type="target" :position="Position.Left" />
    <Handle type="source" :position="Position.Right" />
  </div>
</template>
