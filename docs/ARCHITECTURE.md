# 架构与产品形态（拟定）

> 2026-11-14 · 方向文档，从 Step 12 起逐步验证和修订。
> 相关文档：[INTEGRATION.md](./INTEGRATION.md)、[DECISIONS.md](./DECISIONS.md)

## 1. 定位

这个平台不是“更好的聊天框”，而是**本地优先的个人 Agent 运行时**：

- 任务有完整生命周期：意图 → 规划 → 审批 → 执行 → 验证 → 审查 → 人工决断 → 记忆沉淀 → 召回/巡检
- 数据在用户本地：SQLite、项目工作区、记忆、密钥
- 平台拥有状态、审批和记忆；外部工具/模型/服务是可替换的能力
- 核心资产是**运行账本 + 记忆链 + 项目治理 + 能力注册表**，不是画布

现有代码已经是内核雏形：`projects / nodes / edges / reviews / decisions`、`runManager`、workspaces、规划/开发/审查 Agent、审批门。

## 2. 生命周期

```
意图
  → 规划（结构化计划）
  → 人工审批（计划门）
  → 执行（逐节点，可中断）
  → 确定性验证（命令/产物/格式）
  → 审查（结构化裁决）
  → 人工验收（任务门）
  → 记忆蒸馏（情节/语义/程序）
  → 下次召回 / 定时巡检
```

每个环节都要可追溯：谁做的、基于什么、产出了什么、为什么打回。

## 3. 五层架构

| 层 | 内容 | 归属 |
|---|---|---|
| 领域层 | Space（工作/学习/生活）→ Team → Project → Run → Artifact/Review/Decision | 自建 |
| 运行时层 | durable run、任务队列、调度器、取消/恢复、事件日志 | 自建 |
| 能力层 | 能力注册表、MCP 工具、Skills、模型 Provider、验证器、产物存储 | 自建 + 组合 |
| 记忆层 | 工作记忆、项目记忆、长期记忆链 | 自建（外部可选） |
| 交互层 | 工作台、收件箱、通知、消息通道、审批门 | 自建 + 组合 |

原则：**内核自建，能力组合，客户端可替换。**

## 4. 内核 / 客户端分离

### 4.1 Agent Host

一个本地服务（未来可做成后台 daemon）拥有：

- SQLite：项目、计划、运行事件、审查、决策、记忆
- 工作区：`workspaces/<projectId>/repo`
- 运行引擎：启动/取消/恢复 Agent 运行
- 调度器：定时巡检、heartbeat
- 能力层：MCP client、Skills、模型配置
- 记忆服务：蒸馏、召回、provenance
- HTTP/WebSocket API：给所有客户端使用

### 4.2 Clients

- Web（Nuxt，当前形态）
- PWA（可安装、可推送）
- 桌面壳（Tauri / Electron，后续）
- 移动端（PWA 优先，原生壳按需）

客户端是薄层：展示状态、发起操作、接收通知。**客户端不持有项目状态。**

### 4.3 单机内核 + 多客户端

第一阶段只支持**一个 Host**，多设备通过浏览器/PWA/桌面壳连接。理由：

- 避免多主同步（SQLite 多写冲突、记忆分叉）
- 记忆链和运行账本只有一个事实源
- 你有公司电脑和家里 Mac，正好用“一台常开的 Host + 另一台远程访问”解决
- 远程访问优先 VPN（Tailscale/WireGuard），不要直接把带 Shell 权限的服务暴露到公网

未来如果确实需要多 Host，再考虑同步/CRDT；不要提前做。

## 5. 产品形态演进

### 5.1 阶段

**P1 · Web-only（当前）**

- Nuxt 响应式页面，localhost 访问
- 优点：迭代最快、无打包/签名/商店审核
- 限制：无原生通知/托盘/开机自启；Host 进程关了就不跑；手机访问需要网络可达

**P2 · Host daemon + PWA**

- Host 作为后台服务：macOS `launchd`、Linux `systemd`、Windows 任务计划程序
- 加 PWA manifest + service worker：可安装、离线壳、Web Push（有平台限制）
- 站内通知中心先做；远程访问用 Tailscale/VPN
- 这一步开始真正支持“持久化运行/定时巡检”

**P3 · 桌面壳（macOS / Windows）**

- Tauri 或 Electron 包一层，复用同一套 Web UI
- 能力：托盘、开机自启、原生通知、文件选择器、自动更新
- 关键决策：如何打包 Node/Nitro/better-sqlite3
  - Tauri：体积小、安全默认好，但 Node sidecar 打包更费事
  - Electron：自带 Node，和当前栈更贴合，但体积大
  - 先做 spike，不要现在定
- macOS 先做；Windows 等 Agent 运行时验证通过再做

**P4 · 移动端**

- 第一选择：PWA（安装到主屏、推送、分享入口）
- 原生壳（Capacitor / Tauri 2）只在需要可靠推送、语音、后台/分享时再做
- 手机上**不运行 Agent**：手机是客户端，Host 在 Mac/Windows/Linux/家庭服务器上

**P5 · 多 Host（暂不做）**

- 单 Host + 备份/导出优先
- 多设备离线写入、多主同步是很晚才需要的能力

### 5.2 平台矩阵

| 平台 | 现在 | 后续 | 关键约束 |
|---|---|---|---|
| macOS | Host + 浏览器 | 桌面壳、launchd、签名/公证 | 休眠会停任务；需要电源/`caffeinate` 策略 |
| Windows | 浏览器客户端 | Host（先 WSL2/Git Bash spike）、桌面壳 | Agent Bash 依赖 POSIX shell；better-sqlite3 原生模块；路径/CRLF/进程信号 |
| Linux | Host | systemd、Docker | 适合家庭服务器/常开机器 |
| iOS | PWA 客户端 | 原生壳（推送/分享/语音） | 后台执行受限；Web Push 需安装 PWA |
| Android | PWA 客户端 | 原生壳 | 前台服务/电池限制；分享入口 |

### 5.3 Windows 的具体风险

Windows 不是“换个平台打包”这么简单，主要是 Agent 运行时：

- Claude Code / Agent SDK 的 Bash 工具在 Windows 上通常依赖 **WSL2 或 Git Bash**；需要尽早做 spike
- `better-sqlite3` 是原生模块，依赖 Node 版本和预编译包；没有预编译时需要构建工具
- 进程管理：Windows 没有 Unix 的 `SIGTERM` 语义，取消/超时需要 `taskkill`/进程树处理
- 路径与换行：统一用 `node:path`；git 仓库加 `.gitattributes` 规范换行
- 数据目录：打包后不要用 `process.cwd()`，改用系统应用数据目录
- 建议：**Windows 先做客户端；Host 端等 WSL2/Git Bash spike 通过后再承诺**。如果本机体验必须原生，优先 WSL2 里跑 Host

### 5.4 移动端的具体风险

- 手机不能可靠地长时间跑 Agent：后台执行、资源、文件系统都受限
- 推送：iOS Web Push 需要“安装到主屏”的 PWA，可靠性不如原生 APNs；Android 相对宽松
- 本地网络权限、HTTPS、配对 token 都要处理
- 结论：移动端是“审批 + 查看 + 通知 + 轻量对话”的客户端，不是执行端

### 5.5 数据目录与认证

- 开发期继续用仓库内 `data/`；打包后切换到系统目录：
  - macOS：`~/Library/Application Support/<app>`
  - Windows：`%APPDATA%/<app>`
  - Linux：`~/.local/share/<app>`
- 密钥：系统钥匙串或本地加密存储；永远不下发给浏览器
- 认证：localhost 默认免登录；非 localhost 必须 token + TLS；移动端可用二维码配对
- API：从 `/api` 演进到 `/api/v1`，为多客户端做准备

## 6. 运行内核（Step 12）

最小要求：

- `runs` / `run_events` 表：运行状态、事件、产物、成本
- 状态机：queued → running → done/failed/cancelled
- 取消：AbortController 贯穿 Agent SDK 调用；节点状态收敛
- 恢复：服务重启后识别孤儿运行，标记 interrupted，可继续
- 回放：SSE 从持久化事件读取，断线重连不丢历史
- 预算：token/时间/最大轮数；超限停止并记录
- 幂等：节点重试不重复提交/重复写文件

第一版仍用单进程 + SQLite；Temporal/Inngest 是规模变大后的选项，不是现在。

## 7. 记忆链

> 实现状态（2026-11-14）：v1 已落地 `memories` / `plan_recalls`、审查/决策/项目完成自动蒸馏、关键词+标签召回、工作台编辑/置顶/删除；向量检索、LLM Curator、全局记忆页后置。

三层：

- **情节记忆**：这个项目发生了什么（计划、失败、审查、决策）
- **语义记忆**：事实、偏好、约束
- **程序记忆**：可复用的做法/踩坑（可落成 Skills）

规则：

- 事件日志是事实源；记忆是它的投影
- 每条记忆带 provenance（run/node/artifact）
- 用户可编辑、删除、pin；召回前展示“本次参考了哪些记忆”
- scope：global / team / project，避免互相污染
- 先 SQLite + FTS；语义检索/时序图谱后置

## 8. 多 Agent 与团队

- **Agent Profile**：角色、工具、模型、提示词、自主级别、记忆 scope
- **Team Template**：一组 Profile + 默认工作流 + 审批门
- **Project Instance**：绑定 Team + 记忆链 + 调度 + 预算
- **Curator / 管家 Agent**：整理记忆、生成简报、安排巡检、决定何时提醒

## 9. 安全与隐私

- 本地优先；数据默认不出机器
- Agent 的 Bash 是用户权限；无人值守运行必须有：
  - 工作区隔离
  - 命令白名单/网络策略
  - 高风险操作人工确认
  - 审计日志
- 外部消息：先通知，后代发；代发必须确认 + 白名单
- 入站消息/网页内容一律不可信，防 prompt injection
- 许可证：接开源项目前检查（OpenClaw MIT、OpenHuman GPL-3.0、taOS AGPL-3.0 等）

## 10. 路线图

| 步骤 | 内容 | 目的 |
|---|---|---|
| Step 12 | 持久化运行内核 | 可取消/恢复/回放，成为后续一切的地基 |
| Step 13 | 验收契约与确定性验证 | 让“自测自审”可信 |
| Step 14 | 能力注册表 + MCP 最小接入 | 让任意任务有工具可用；审批前显示能力缺口 |
| Step 15 | 记忆链 v1 | 蒸馏、浏览/编辑、规划召回 |
| Step 16 | 团队模板 + 调度 + 站内通知 | 持久化运行与主动跟进 |
| Step 17 | 通道 + 形态 | 官方 Bot、PWA/桌面壳按需 |

形态演进（P2/P3）可以在 Step 12–16 之间并行，但不阻塞内核。

## 11. 不做清单

- 不做多主同步（先单 Host）
- 不先做原生移动端（PWA 优先）
- 不引入 Temporal/Neo4j/Qdrant 作为第一版基础设施
- 不在无人值守时给全权限 Shell
- 不同时接 50 个 IM 渠道
- 不 fork 整个 OpenClaw/Dify/Letta；优先组件级组合

## 12. 待验证假设

- Windows Host 是否必须依赖 WSL2/Git Bash
- Tauri vs Electron 打包 Node/Nitro/better-sqlite3 的成本
- iOS/Android Web Push 的实际可靠性
- MCP 图像/浏览器工具的质量与安全
- SQLite FTS 的记忆召回是否够用，何时需要 embedding/图
- 多 Agent + 定时巡检的真实 token 成本
