# 决策记录

## D-001 技术栈（2026-11-11）

Nuxt 4 + TypeScript + Tailwind 4 + DaisyUI 5 + Vue Flow + SQLite（Drizzle + better-sqlite3）。

理由：用户选定 Nuxt / DaisyUI / SQLite / TypeScript；Vue Flow 是 Vue 生态对应的画布方案；SQLite 本地零配置。

## D-002 Agent 运行时（2026-11-11）

使用 `@anthropic-ai/claude-agent-sdk`（TypeScript）。当前按场景拆分为 `server/agents/planner.ts`（规划）与 `server/agents/developer.ts`（开发）；通用 `AgentRunner` 抽象暂未提取，待 Step 10 审查 Agent 落地后视重复程度决定。

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

## D-012 调试页作为彩蛋（2026-11-12）

`/workflow` 与 `/design-preview` 不再出现在导航中，保留为彩蛋：点击导航栏 logo 小方块 5 次触发隐藏协议，答对后解锁「彩蛋」入口；解锁状态存 localStorage。

原因：保留开发过程的纪念页面，同时不让调试入口干扰正式产品流程。

## D-011 迭代策略：带反馈重新规划（2026-11-12）

审查失败或人工打回后，把审查问题/人工意见作为反馈交给规划 Agent；规划 Agent 读取现有代码和上一版计划，生成新的计划版本，再走审批 → 开发 → 审查。暂不实现「直接修复」分支，后续按需扩展。

原因：保留统一的人工审批点和完整历史，避免未经审批直接改代码。

## D-010 审查与人工决策边界（2026-11-12）

审查 Agent 以 review 节点为单位，审查对应 develop 节点的 git 提交；结构化结论写入 `reviews` 表。项目状态 `reviewed` / `review_failed` 只表示自动审查结果，人工验收与迭代决策在 Step 11 实现。

原因：自动审查负责发现规格偏差，人工负责最终拍板；按提交审查便于定位问题并支持后续重试。

## D-009 开发运行与日志（2026-11-12）

开发者 Agent 按 develop 节点逐个执行，节点状态写入数据库；每个节点成功后由平台自动 git commit。运行事件通过 SSE 实时推送，暂存在内存中，服务重启后丢失。运行分为 develop / review 两类，共用同一套事件流。

原因：逐节点执行便于状态跟踪、失败重试和后续按节点审查；自动提交为审查 Agent 提供清晰 diff；日志持久化暂不必要，留待需要时再做。

## D-003 跨设备续作（2026-11-11）

开发进度与决策写入仓库文档（CLAUDE.md + docs/），随 git 同步；平台运行数据（`data/`、`workspaces/`）与 `.env` 不入库。

理由：用户在公司和家里两台电脑之间开发，需要拉下代码即可接着做；运行数据是本机的，不跨机器。

## D-013 组件级组合与唯一内核（2026-11-14）

默认通过 MCP / HTTP / CLI 组合外部能力；库级复用正常；只有“没有稳定接口 + 是核心缺口 + 愿意长期维护”时才 fork 代码。项目状态、运行账本、审批与记忆链只存在本平台 SQLite，外部组件不得持有项目状态。

理由：避免多个 Agent 平台各自维护状态与记忆导致分叉；用生态能力补齐工具/渠道/沙箱，把精力留给项目治理与记忆链。

## D-014 单机内核 + 多客户端，Web-first（2026-11-14）

产品形态采用“一个 Agent Host + 多个薄客户端”：Host 拥有 SQLite、工作区、运行引擎、调度与能力层；客户端为 Web/PWA/桌面壳/移动端。第一阶段 Web-only，随后加后台 daemon + PWA；桌面壳（Tauri/Electron）后置；移动端只做客户端，不在手机上运行 Agent。Windows Host 需先验证 WSL2/Git Bash 下的 Agent 运行时。

理由：本地优先与持久化运行要求 Host 常驻；单 Host 避免多主同步；Web-first 迭代最快，原生壳只是分发与系统集成层。

## D-015 记忆链先自建，外部记忆后置（2026-11-14）

记忆链先以 SQLite 事件日志 + 蒸馏条目 + FTS 实现，保留 provenance、可编辑与 scope；Letta / Mem0 / Zep·Graphiti / MemOS 等作为后续可选适配器，不能成为唯一副本。

理由：双记忆系统会带来同步与一致性问题；先验证召回质量与用户价值，再决定是否引入向量/图数据库。

## D-016 运行账本持久化与取消语义（2026-11-14）

`runs` / `run_events` 写入 SQLite，作为运行的事实源；内存只保留活跃运行与实时订阅。取消通过 `AbortController` 贯穿 Agent SDK：先把 running 节点退回 pending，再记录 `run_done(cancelled)`，使运行可继续。服务启动时把遗留 running 运行标记 failed、running 节点回 pending，并补 `run_done`。运行结束后忽略迟到的 Agent 事件。

理由：重启/断线后仍可回放与审计；取消不丢节点状态；避免 SDK abort 缓冲污染日志。已知代价：取消后 Agent 子进程可能短暂继续，事件已被丢弃；运行账本暂未做归档。

## D-017 验收契约与确定性验证（2026-11-14）

规划 Agent 为每个 develop 节点生成 `verification`：命令、期望退出码、输出子串、产物路径。平台在开发者完成后、提交前执行；通过才提交并标记 done，失败则节点 failed，结果写入 `nodes.verification_result` 与 `.agent/verifications/<节点>.json`，审查 Agent 读取摘要并继续判断规格符合度。

理由：让“自测自审”有确定性依据，失败可定位、可重试；审查仍负责规格判断，不被“模型觉得可以”替代。风险：验收命令来自规划 Agent，必须在计划审批时人工检查；命令以用户权限执行，与 Agent Bash 同级。
