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

## D-007 配色策略：中性 + 主色 + 语义色（2026-11-11）

界面使用 DaisyUI 默认主题（light/dark）；UI 层以中性色 + primary 为骨架，保留 info / success / warning / error 四种语义色，用于状态徽章、提示和关键操作（如批准 / 打回）。不使用 secondary / accent 装饰色。

原因：多轮配色后确定以简洁、可读、低干扰为先，同时保留必要的语义反馈。

## D-006 配色回退 DaisyUI 默认（2026-11-11）

经过多轮自定义配色尝试后，决定采用 DaisyUI 官方默认主题（`light` 为默认，`dark` 可切换）。颜色、按钮与徽章样式交由 DaisyUI；自定义仅保留布局、Geist 字体、反馈动效与原生 View Transitions。

原因：减少反复调色的维护成本，保持组件风格一致，把精力放回功能开发。

## D-005 结构化输出（2026-11-11）

规划/审查等 Agent 的输出统一写入工作区 `.agent/*.json`，由服务端用 Zod 校验；校验失败将错误回灌给 Agent 并重试一次。

原因：比解析 stdout 可靠、可审计，避免模型闲聊或输出截断导致解析失败。

## D-008 项目操作收口工作台（2026-11-12）

项目列表只负责浏览、状态展示与进入工作台；计划生成与审批统一在工作台完成。列表上的「生成计划」为 Step 7 调试遗留，已移除。

原因：同一操作保留多个入口会导致流程断裂、误触模型调用，并增加选择负担。

## D-003 跨设备续作（2026-11-11）

开发进度与决策写入仓库文档（CLAUDE.md + docs/），随 git 同步；平台运行数据（`data/`、`workspaces/`）与 `.env` 不入库。

理由：用户在公司和家里两台电脑之间开发，需要拉下代码即可接着做；运行数据是本机的，不跨机器。
