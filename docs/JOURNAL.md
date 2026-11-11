# 开发日志

## 2026-11-11 · Step 1 开始

- 初始化 Nuxt 4 脚手架（package.json / nuxt.config.ts / tsconfig.json / app/app.vue）
- 建立仓库文档体系：CLAUDE.md、docs/PROGRESS.md、docs/JOURNAL.md、docs/DECISIONS.md
- 验收：`pnpm dev` 后访问 http://localhost:3000，页面显示 "Personal Agent Platform"
- 本地启动成功（Nuxt 4.6.4 / Nitro 2.13.6 / Vite 8.3.8），curl 校验页面文案已渲染；等待浏览器确认
- 下一步：Step 2 DaisyUI

## 2026-11-11 · Step 1 完成

- 用户已在浏览器确认 http://localhost:3000 页面正常
- 进入 Step 2：接入 Tailwind CSS 4 + DaisyUI 5

## 2026-11-11 · Step 2 开始

- 安装 tailwindcss 4.3.5、@tailwindcss/vite、daisyui 5.7.50
- 新增 `app/assets/css/main.css`（`@import "tailwindcss"; @plugin "daisyui"`），`nuxt.config.ts` 注册 CSS 与 Vite 插件
- 首页改为 navbar + card + badge + btn，右上角主题切换（localStorage 持久化）
- 验证：页面 HTML 含 DaisyUI 类名；编译 CSS 含 `.btn`/`.navbar`；日志确认 daisyUI 5.7.50 已加载
- 等待浏览器确认；下一步 Step 3 SQLite + 项目 CRUD

## 2026-11-11 · Step 2 完成

- 用户已在浏览器确认 DaisyUI 外观与主题切换
- 远端仓库已配置；提交 Step 1–2 并推送
- 进入 Step 3：SQLite + 项目 CRUD

## 2026-11-11 · Step 3 开始

- 安装 drizzle-orm 0.45.4 / better-sqlite3 13.0.3 / drizzle-kit 0.31.11
- `server/db/schema.ts` 定义 projects 表；`server/utils/db.ts` 单例连接（WAL + 外键）；`drizzle.config.ts`
- `pnpm db:push` 创建 `data/app.db`
- API：`GET/POST /api/projects`；首页改为 `app/pages/index.vue`（创建表单 + 列表），并引入 `app/app.vue` + `<NuxtPage />` 布局
- 验证：创建/读取成功；中文 UTF-8 存储正确；重启服务后数据仍在
- 等待浏览器确认；下一步 Step 4 静态工作流画布

## 2026-11-11 · Step 4 开始

- 安装 @vue-flow/core 1.48.2 + @vue-flow/background 1.3.2
- 新增 `app/components/WorkflowCanvas.client.vue`（写死 3 节点 2 连线）、自定义状态节点 `app/components/FlowStatusNode.vue`、演示页 `/workflow`，导航加入口
- `nuxt.config.ts` 引入 Vue Flow 样式；画布组件用 `.client.vue` 避开 SSR
- 验证：`/workflow` 返回 200，HTML 含页面标题与 Vue Flow 资源，服务端无报错
- 等待浏览器确认；下一步 Step 5 Agent SDK 通路验证

## 2026-11-11 · Step 4 完成

- 用户已在浏览器确认工作流画布
- 约定：每步用户确认后，自动更新文档、提交并推送
- 进入 Step 5：验证 Agent SDK 能驱动模型

## 2026-11-11 · Step 5 开始

- 安装 @anthropic-ai/claude-agent-sdk 0.3.322 + tsx 4.23.15
- `claude -p "reply with exactly: OK"` 验证现有模型通路可用
- 新增 `scripts/agent-hello.ts`：`query()` 单轮、无工具，打印流式文本与 result
- 首次运行失败：SDK 子进程为生成会话标题调用 `deepseek-flash` 被代理拒绝（`unrecognized_model`）；在 env 中设置 `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` 后成功
- 验证：`pnpm tsx scripts/agent-hello.ts` 输出「正常 / [result] success」
- 等待你在终端执行确认；下一步 Step 6 项目工作区 + git

## 2026-11-11 · Step 5 完成

- 用户确认 Agent SDK 通路可用
- 进入 Step 6：为每个项目创建独立 git 工作区
