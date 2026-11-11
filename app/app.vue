<script setup lang="ts">
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'

type Theme = 'dark' | 'light'

const theme = ref<Theme>('light')

onMounted(() => {
  const saved = localStorage.getItem('theme')
  if (saved === 'light' || saved === 'workbench-light') {
    theme.value = 'light'
  } else if (saved === 'dark' || saved === 'workbench-dark') {
    theme.value = 'dark'
  }
})

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem('theme', theme.value)
}

useHead({
  htmlAttrs: { 'data-theme': theme },
})
</script>

<template>
  <div class="wb-shell min-h-screen bg-base-200">
    <header class="navbar wb-navbar">
      <div class="flex-1 px-4 flex items-center gap-6">
        <NuxtLink to="/" class="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span class="wb-mark inline-block h-2.5 w-2.5 rounded-[4px]" />
          <span>Personal Agent Platform</span>
        </NuxtLink>
        <nav class="flex gap-4 text-sm">
          <NuxtLink to="/" class="wb-nav-link">项目</NuxtLink>
          <NuxtLink to="/workflow" class="wb-nav-link">工作流画布</NuxtLink>
          <NuxtLink to="/design-preview" class="wb-nav-link">设计预览</NuxtLink>
        </nav>
      </div>
      <div class="flex-none px-4">
        <button class="btn btn-ghost btn-sm wb-press" @click="toggleTheme">
          {{ theme === 'dark' ? '切到浅色' : '切到深色' }}
        </button>
      </div>
    </header>

    <main class="p-8">
      <NuxtPage />
    </main>
  </div>
</template>
