<script setup lang="ts">
import { Background } from '@vue-flow/background'
import { VueFlow, type Edge, type Node } from '@vue-flow/core'
import { markRaw, ref } from 'vue'
import FlowStatusNode from './FlowStatusNode.vue'

const nodes = ref<Node[]>([
  {
    id: 'plan',
    type: 'status',
    position: { x: 60, y: 140 },
    data: { title: '生成计划', detail: '规划 Agent 拆解任务', status: 'done' },
  },
  {
    id: 'develop',
    type: 'status',
    position: { x: 360, y: 140 },
    data: { title: '开发任务', detail: '开发 Agent 在工作区实现', status: 'running' },
  },
  {
    id: 'accept',
    type: 'status',
    position: { x: 660, y: 140 },
    data: { title: '人工验收', detail: '检查产物并拍板', status: 'pending' },
  },
])

const edges = ref<Edge[]>([
  { id: 'plan-develop', source: 'plan', target: 'develop', animated: true },
  { id: 'develop-accept', source: 'develop', target: 'accept' },
])

const nodeTypes = { status: markRaw(FlowStatusNode) }
</script>

<template>
  <div
    style="height: 420px"
    class="rounded-box border border-base-300 overflow-hidden bg-base-100"
  >
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :node-types="nodeTypes"
      fit-view-on-init
    >
      <Background />
    </VueFlow>
  </div>
</template>
