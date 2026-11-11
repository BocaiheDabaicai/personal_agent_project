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
      <div class="flex-1 px-4 flex items-center gap-6">
        <NuxtLink to="/" class="text-lg font-bold">Personal Agent Platform</NuxtLink>
        <nav class="flex gap-4 text-sm">
          <NuxtLink to="/" class="link link-hover">项目</NuxtLink>
          <NuxtLink to="/workflow" class="link link-hover">工作流画布</NuxtLink>
        </nav>
      </div>
      <div class="flex-none px-4">
        <button class="btn btn-ghost btn-sm" @click="toggleTheme">
          {{ theme === 'light' ? '切到深色' : '切到浅色' }}
        </button>
      </div>
    </header>

    <main class="p-8">
      <NuxtPage />
    </main>
  </div>
</template>
