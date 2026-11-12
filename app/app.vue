<script setup lang="ts">
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'

type Theme = 'dark' | 'light'

const theme = ref<Theme>('light')

const easterEggUnlocked = ref(false)
const showSecret = ref(false)
const secretAnswer = ref('')
const secretError = ref('')
const secretSolved = ref(false)
const secretClicks = ref(0)
const secretPulse = ref(false)
let secretTimer: ReturnType<typeof setTimeout> | undefined

const SECRET_ANSWERS = new Set(['planner', 'plan', '规划', '规划agent', '规划 agent'])

onMounted(() => {
  const saved = localStorage.getItem('theme')
  if (saved === 'light' || saved === 'workbench-light') {
    theme.value = 'light'
  } else if (saved === 'dark' || saved === 'workbench-dark') {
    theme.value = 'dark'
  }

  easterEggUnlocked.value = localStorage.getItem('pap-easter-egg') === '1'
})

onUnmounted(() => {
  if (secretTimer) {
    clearTimeout(secretTimer)
  }
})

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem('theme', theme.value)
}

function handleSecretClick() {
  secretClicks.value += 1

  if (secretTimer) {
    clearTimeout(secretTimer)
  }
  secretTimer = setTimeout(() => {
    secretClicks.value = 0
    secretPulse.value = false
  }, 2500)

  if (secretClicks.value >= 5) {
    secretClicks.value = 0
    secretPulse.value = false
    if (secretTimer) {
      clearTimeout(secretTimer)
      secretTimer = undefined
    }
    showSecret.value = true
    secretAnswer.value = ''
    secretError.value = ''
    secretSolved.value = easterEggUnlocked.value
    return
  }

  secretPulse.value = secretClicks.value >= 3
}

function submitSecret() {
  const answer = secretAnswer.value.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!SECRET_ANSWERS.has(answer)) {
    secretError.value = '暗号不对，再想想。'
    return
  }

  secretSolved.value = true
  easterEggUnlocked.value = true
  secretError.value = ''
  localStorage.setItem('pap-easter-egg', '1')
}

function closeSecret() {
  showSecret.value = false
  secretAnswer.value = ''
  secretError.value = ''
}

useHead({
  htmlAttrs: { 'data-theme': theme },
})
</script>

<template>
  <div class="wb-shell min-h-screen bg-base-200">
    <header class="navbar wb-navbar">
      <div class="flex-1 px-4 flex items-center gap-6">
        <div class="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <button
            type="button"
            class="wb-mark inline-block h-2.5 w-2.5 cursor-pointer rounded-[4px] border-0 p-0"
            :class="{ 'wb-pulse-dot': secretPulse }"
            aria-label="Personal Agent Platform"
            @click="handleSecretClick"
          />
          <NuxtLink to="/">Personal Agent Platform</NuxtLink>
        </div>
        <nav class="flex gap-4 text-sm">
          <NuxtLink to="/" class="wb-nav-link">项目</NuxtLink>
          <NuxtLink v-if="easterEggUnlocked" to="/easter-egg" class="wb-nav-link">
            彩蛋
          </NuxtLink>
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

    <div v-if="showSecret" class="modal modal-open" role="dialog" aria-modal="true">
      <div class="modal-box max-w-md">
        <h3 class="text-lg font-semibold">隐藏协议</h3>
        <p class="mt-2 text-sm opacity-70">
          我不写代码，也不做审查；我在项目开始时拆解目标。输入我的英文代号。
        </p>
        <p class="mt-1 text-xs opacity-50">提示：规划 Agent 的英文名。</p>
        <input
          v-model="secretAnswer"
          class="input input-bordered mt-4 w-full"
          placeholder="暗号"
          @keyup.enter="submitSecret"
        />
        <p v-if="secretError" class="mt-2 text-xs text-error">{{ secretError }}</p>
        <p v-if="secretSolved" class="mt-2 text-xs text-success">
          彩蛋已解锁，导航栏出现「彩蛋」入口。
        </p>
        <div class="modal-action">
          <button class="btn btn-sm btn-ghost" @click="closeSecret">关闭</button>
          <NuxtLink
            v-if="secretSolved"
            to="/easter-egg"
            class="btn btn-sm btn-primary"
            @click="closeSecret"
          >
            进入彩蛋
          </NuxtLink>
          <button v-else class="btn btn-sm btn-primary" @click="submitSecret">提交</button>
        </div>
      </div>
      <div class="modal-backdrop" @click="closeSecret" />
    </div>
  </div>
</template>
