# 决策记录

## D-001 技术栈（2026-11-11）

Nuxt 4 + TypeScript + Tailwind 4 + DaisyUI 5 + Vue Flow + SQLite（Drizzle + better-sqlite3）。

理由：用户选定 Nuxt / DaisyUI / SQLite / TypeScript；Vue Flow 是 Vue 生态对应的画布方案；SQLite 本地零配置。

## D-002 Agent 运行时（2026-11-11）

使用 `@anthropic-ai/claude-agent-sdk`（TypeScript），封装为 `AgentRunner` 接口。

理由：官方稳定、工具权限体系完整、可沿用现有模型链路。Step 5 最早验证；失败则回退 `claude -p` headless，DSH 适配器后置。

## D-003 跨设备续作（2026-11-11）

开发进度与决策写入仓库文档（CLAUDE.md + docs/），随 git 同步；平台运行数据（`data/`、`workspaces/`）与 `.env` 不入库。

理由：用户在公司和家里两台电脑之间开发，需要拉下代码即可接着做；运行数据是本机的，不跨机器。
