<template>
  <div class="max-w-5xl mx-auto">
    <div class="card bg-base-100 shadow">
      <div class="card-body">
        <h2 class="card-title">工作流画布（静态示例）</h2>
        <p class="text-sm opacity-70">
          这一步用写死的数据画出「生成计划 → 开发任务 → 人工验收」。可以拖拽节点、滚轮缩放；Step 8 起改为读取数据库中的真实计划。
        </p>
        <WorkflowCanvas />
      </div>
    </div>
  </div>
</template>
