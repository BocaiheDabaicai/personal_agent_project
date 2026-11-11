<script setup lang="ts">
const theme = ref<'light' | 'dark'>('light')

onMounted(() => {
  const saved = localStorage.getItem('theme')
  if (saved === 'light' || saved === 'dark') {
    theme.value = saved
  }
})

function toggleTheme() {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
  localStorage.setItem('theme', theme.value)
}

useHead({
  htmlAttrs: { 'data-theme': theme },
})
</script>

<template>
  <div class="min-h-screen bg-base-200">
    <header class="navbar bg-base-100 shadow-sm">
      <div class="flex-1 px-4">
        <span class="text-lg font-bold">Personal Agent Platform</span>
      </div>
      <div class="flex-none px-4">
        <button class="btn btn-ghost btn-sm" @click="toggleTheme">
          {{ theme === 'light' ? '切到深色' : '切到浅色' }}
        </button>
      </div>
    </header>

    <main class="p-8">
      <div class="card bg-base-100 shadow-xl max-w-xl mx-auto">
        <div class="card-body">
          <h2 class="card-title">
            第 2 步：DaisyUI 已接入
            <span class="badge badge-success">运行中</span>
          </h2>
          <p class="opacity-70">
            这一步只改外观：导航栏、卡片、按钮、徽章都来自 DaisyUI。右上角可以切换主题。
          </p>
          <div class="card-actions justify-end">
            <button class="btn btn-primary">主要按钮</button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
