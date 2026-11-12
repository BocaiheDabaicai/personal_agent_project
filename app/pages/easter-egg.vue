<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <div class="card bg-base-100 shadow">
      <div class="card-body">
        <h1 class="card-title">🥚 彩蛋</h1>
        <p class="text-sm opacity-70">
          你找到了隐藏入口。这两个页面是开发过程中的调试页，留作纪念。
        </p>

        <div class="mt-2 grid gap-3 sm:grid-cols-2">
          <NuxtLink
            to="/workflow"
            class="rounded-box border border-base-300 p-4 transition-colors hover:border-primary"
          >
            <div class="font-semibold">工作流画布</div>
            <p class="mt-1 text-xs opacity-60">最早的手工节点与连线演示。</p>
          </NuxtLink>
          <NuxtLink
            to="/design-preview"
            class="rounded-box border border-base-300 p-4 transition-colors hover:border-primary"
          >
            <div class="font-semibold">设计预览</div>
            <p class="mt-1 text-xs opacity-60">UI 风格迭代时的配色与动效样板。</p>
          </NuxtLink>
        </div>

        <div class="card-actions justify-end">
          <NuxtLink to="/" class="btn btn-sm btn-ghost">返回项目</NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
