# 决策记录

## D-001 技术栈（2026-11-11）

Nuxt 4 + TypeScript + Tailwind 4 + DaisyUI 5 + Vue Flow + SQLite（Drizzle + better-sqlite3）。

理由：用户选定 Nuxt / DaisyUI / SQLite / TypeScript；Vue Flow 是 Vue 生态对应的画布方案；SQLite 本地零配置。

## D-002 Agent 运行时（2026-11-11）

使用 `@anthropic-ai/claude-agent-sdk`（TypeScript），封装为 `AgentRunner` 接口。

理由：官方稳定、工具权限体系完整、可沿用现有模型链路。Step 5 最早验证；失败则回退 `claude -p` headless，DSH 适配器后置。

## D-004 Agent SDK 非必要流量（2026-11-11）

调用 `@anthropic-ai/claude-agent-sdk` 时，env 中需设置 `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`。

原因：当前模型代理不认识会话标题生成请求（`deepseek-flash` → `unrecognized_model`），SDK 子进程会因此退出；关闭非必要流量后主对话正常完成。

## D-005 结构化输出（2026-11-11）

规划/审查等 Agent 的输出统一写入工作区 `.agent/*.json`，由服务端用 Zod 校验；校验失败将错误回灌给 Agent 并重试一次。

原因：比解析 stdout 可靠、可审计，避免模型闲聊或输出截断导致解析失败。

## D-003 跨设备续作（2026-11-11）

开发进度与决策写入仓库文档（CLAUDE.md + docs/），随 git 同步；平台运行数据（`data/`、`workspaces/`）与 `.env` 不入库。

理由：用户在公司和家里两台电脑之间开发，需要拉下代码即可接着做；运行数据是本机的，不跨机器。
