<script setup lang="ts">
import { Background } from '@vue-flow/background'
import { VueFlow, type Edge, type Node } from '@vue-flow/core'
import { markRaw, ref, watch } from 'vue'
import PlanNode from './PlanNode.vue'

interface PlanNodeInput {
  nodeKey: string
  kind: string
  title: string
  spec: string
  status: string
  x: number
  y: number
}

interface PlanEdgeInput {
  sourceKey: string
  targetKey: string
}

const props = defineProps<{
  nodes: PlanNodeInput[]
  edges: PlanEdgeInput[]
}>()

const emit = defineEmits<{
  (event: 'select', payload: { nodeKey: string }): void
}>()

const flowNodes = ref<Node[]>([])
const flowEdges = ref<Edge[]>([])
const nodeTypes = { plan: markRaw(PlanNode) }

watch(
  () => [props.nodes, props.edges],
  () => {
    flowNodes.value = props.nodes.map(node => ({
      id: node.nodeKey,
      type: 'plan',
      position: { x: node.x, y: node.y },
      data: {
        title: node.title,
        spec: node.spec,
        kind: node.kind,
        status: node.status,
      },
    }))

    flowEdges.value = props.edges.map(edge => ({
      id: `e-${edge.sourceKey}-${edge.targetKey}`,
      source: edge.sourceKey,
      target: edge.targetKey,
    }))
  },
  { immediate: true },
)

function onNodeClick({ node }: { node: Node }) {
  emit('select', { nodeKey: node.id })
}
</script>

<template>
  <div style="height: 520px" class="rounded-box border border-base-300 overflow-hidden bg-base-100/50">
    <VueFlow
      :nodes="flowNodes"
      :edges="flowEdges"
      :node-types="nodeTypes"
      fit-view-on-init
      @node-click="onNodeClick"
    >
      <Background />
    </VueFlow>
  </div>
</template>
