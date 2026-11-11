import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  experimental: {
    viewTransition: true,
  },
  css: [
    '~/assets/css/main.css',
    '@vue-flow/core/dist/style.css',
    '@vue-flow/core/dist/theme-default.css',
  ],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ['@vue-flow/core', '@vue-flow/background'],
    },
  },
})
