# 组件级组合与能力接入（拟定）

> 2026-11-14 · 方向文档，从 Step 12/14 起逐步验证。
> 相关文档：[ARCHITECTURE.md](./ARCHITECTURE.md)、[DECISIONS.md](./DECISIONS.md)

## 1. 原则

1. **默认组件级组合**：通过 MCP / HTTP / CLI 调用外部能力，不把外部产品当成第二个内核。
2. **库级复用正常**：npm/PyPI 库直接用，不算风险。
3. **代码级 fork 是最后手段**：只在“没有稳定接口 + 是核心缺口 + 愿意长期维护”时做。
4. **唯一事实源**：项目状态、运行账本、审批、记忆链只存在本平台 SQLite；外部组件可以有临时状态，但不能持有项目状态。
5. **契约先行**：每个能力先定义输入/输出/权限/成本/超时/健康检查，再接。
6. **渐进接入**：一次一个组件，feature flag + 降级 + kill switch。

一句话：**内核自建，能力组合，客户端可替换。**

## 2. 能力模型

### 2.1 Capability

```ts
interface Capability {
  id: string                    // 例如 image.generate、browser.playwright
  kind: 'builtin' | 'mcp' | 'http' | 'cli'
  title: string
  description: string           // 规划 Agent 看到的能力说明
  inputSchema: JSONSchema
  outputSchema?: JSONSchema
  permissions: string[]         // 例如 fs.write、network、shell
  cost?: { unit: string; estimate?: number }
  timeoutMs: number
  retries: number               // 仅幂等调用
  healthCheck?: { kind: 'mcp' | 'http' | 'cli'; target: string }
}
```

能力不是“工具列表里的一个名字”，而是有契约、有权限、有成本的可审计单元。

### 2.2 Skill

Skill 是“怎么做”，不是“能做什么”：

```md
---
name: review-commit
description: 按项目规格审查一个开发节点的提交
version: 1
tools: [fs.read, git.diff, shell.test]
inputs: [commit, spec]
memoryScope: project
approval: none
---

# 审查步骤
1. git show <commit>
2. 对照 spec 检查产物
3. 运行验收命令
4. 输出结构化 verdict
```

- 目录：`skills/<name>/SKILL.md` + 脚本
- 版本化；可被 Agent Profile 引用
- 与记忆链的“程序记忆”对应：成功的做法可以沉淀成 Skill
- 可参考/移植 Claude Code、OpenClaw 的 skill，但保留本地 manifest，不做万能兼容层

### 2.3 Agent Profile

```ts
interface AgentProfile {
  id: string
  role: 'planner' | 'developer' | 'reviewer' | 'curator' | string
  model: string
  prompt: string
  capabilities: string[]        // 允许使用的能力 id
  skills: string[]              // 预加载的 skill
  memoryScopes: string[]        // global / team / project
  autonomy: 'suggest' | 'approve' | 'auto'
}
```

规划 Agent 拿到的不是“无限工具”，而是**当前可用能力目录**；计划引用缺失能力时，审批页直接提示。

## 3. 接入方式

| 方式 | 用途 | 优先级 | 注意 |
|---|---|---|---|
| MCP | 工具/资源/提示词 | 首选 | stdio/HTTP；鉴权；超时；输出清洗 |
| HTTP/OpenAPI | 有稳定 API 的产品 | 高 | 白名单、鉴权、schema 校验 |
| CLI | 本地工具（git、测试、转换） | 高 | cwd、env、退出码、stdout/stderr |
| SDK | 没有 HTTP API 的服务 | 中 | 包成本地服务，不塞进 Agent 进程 |
| Webhook | 入站事件（消息、定时） | 中 | 验签、重放保护、限流 |
| A2A/ACP | Agent 间互操作 | 观察 | 标准未完全稳定，先不押注 |

**MCP 是首选**：2026 年 Claude、OpenAI、Google 生态都支持，是工具层的事实标准。

## 4. 能力注册表

### 4.1 数据模型（建议）

- `capabilities`：id、kind、title、config(JSON)、enabled、health、last_checked
- `agent_capabilities`：agent_profile_id、capability_id、权限
- `skills`：id、version、path、scope、enabled
- `capability_invocations`：run_id、node_id、capability_id、input、output_ref、status、cost、duration

配置放 `data/`（不入库），密钥放系统钥匙串或本地加密存储。

### 4.2 规划与审批

1. 规划 Agent 的 prompt 注入“可用能力目录”（id + 描述 + 输入输出）
2. 计划节点可以声明 `requires: [image.generate]`
3. 审批页检查：
   - 能力缺失 → 显示“需要配置 X”
   - 权限不足 → 显示“需要授权 Y”
   - 成本超预算 → 警告
4. 用户可以在审批前安装/启用能力，或改计划

### 4.3 权限与审计

- 每个 Agent Profile 有 allowlist
- 高风险能力（shell、网络、外发消息）默认需人工确认
- 每次调用写入 run_events：输入摘要、输出摘要、耗时、成本、成功/失败
- 输出做大小限制、密钥脱敏、prompt injection 标记

## 5. MCP Client 设计

- Host 内一个 MCP 管理器：按需连接/启动，健康检查，失败重连（退避）
- 工具命名：`server__tool`，避免冲突
- 每次调用：超时 + AbortSignal；仅幂等调用重试；连续失败熔断
- 输出清洗：最大长度、二进制转 artifact、密钥脱敏
- 审计：调用记录进 run_events；保留输出 hash/引用
- 权限：按 Agent Profile 过滤工具；高风险工具走审批

## 6. Skills

- `skills/<name>/SKILL.md` + `scripts/`
- frontmatter：name、description、version、tools、inputs、memoryScope、approval
- 脚本在工作区 cwd 执行；默认禁网；env 白名单
- 成功/失败经验可以蒸馏成新的 Skill 或修订现有 Skill
- 不做“所有生态 skill 格式兼容”；只保留自己的 manifest，按需移植

## 7. 记忆接入

**先自建**：

- 事件日志 → 蒸馏 → 记忆条目（情节/语义/程序）
- `memory_entries` / `memory_links` / `memory_scopes`
- provenance 指向 run/node/artifact；用户可编辑/pin
- 召回前展示引用，允许取消/追加

**外部记忆后置**：

- Letta（分层记忆、sleep-time、MemFS）
- Mem0（drop-in memory API）
- Zep/Graphiti（时序知识图谱、有效期/审计）
- MemOS（本地 SQLite 插件、L1–L3 + skills）
- 原则：外部记忆只能做补充/索引，不能是唯一副本；避免双写不一致
- 以后可把本平台记忆链暴露成 **Memory MCP Server**，让 Claude Code/OpenClaw 也能读

## 8. 参考产品与借鉴点

| 产品 | 借鉴 | 接入方式 | 注意 |
|---|---|---|---|
| OpenClaw | 渠道、heartbeat/cron、skills、Markdown 记忆 | 参考/可选 IM 网关 | 有独立记忆和 sudo 级权限，别让它成为第二内核；MIT |
| Letta | 分层记忆、sleep-time 整理、MemFS | 可选 memory service | 不要太早引入双记忆；Apache 2.0 |
| Mem0 / Zep / Graphiti / Cognee / MemOS | 记忆组件/时序图/本地记忆 | 可选适配器 | 评估召回质量与运维成本 |
| LangGraph / Temporal | checkpoint、interrupt、durable workflow | 借鉴模式；规模大再引入 | 单用户 SQLite 先自建 |
| Dify / n8n | Human Input/Wait、审批、自托管工作流 | HTTP tool / MCP tool | 不让它们持有项目状态 |
| OpenHands | 沙箱、编码 Agent、事件流 | 可选 coding sandbox | 需要隔离/并行时再上 |
| Claude Code / Cowork | subagent memory、skills、hooks、逐操作审批 | 参考/复用 Agent SDK 能力 | 你已在用 Agent SDK |
| 官方 IM Bot | 飞书/Telegram/Slack 等 | 通道适配器 | 后置；先站内通知 |

## 9. 失败模式与对策

| 风险 | 对策 |
|---|---|
| 工具 schema 变化 | 固定版本 + 契约测试 |
| 认证过期/限流 | 健康检查 + 熔断 + 预算 |
| 网络/服务不可用 | 超时、重试（仅幂等）、降级工具 |
| 工具名冲突 | `server__tool` 命名空间 |
| 工具输出注入 | 清洗、长度限制、高风险操作确认 |
| 数据重复/双写 | 外部组件尽量无状态；记忆只留在内核 |
| 成本失控 | 每次调用记录成本；运行预算；模型路由 |
| 许可证 | 接入前检查；分发前复核 |

## 10. POC（Step 14，已实现）

目标：验证“加一个新能力不需要改内核”。

1. 新增能力注册表 + MCP client
2. 接入 2 个 MCP server：
   - 浏览器（Playwright）
   - 图像生成（ComfyUI / OpenAI Images / Replicate 任选）
3. 规划 Agent 注入能力目录；审批页显示能力缺口
4. 用「画哆啦A梦」跑一遍：审批前看到 image.generate，执行时调用工具，产物落工作区
5. 记录：调用次数、耗时、成本、失败点

验收标准：

- 新能力通过配置接入，不改 Agent 代码
- 工具调用有审计
- 单个工具失败不影响整个运行（可降级/重试/停）
- 计划审批前能看到“需要什么能力、当前是否具备”
- 外部组件不持有项目状态

## 11. 许可证备忘

- OpenClaw：MIT
- OpenHuman：GPL-3.0
- taOS：AGPL-3.0
- Letta：Apache 2.0
- Dify：Apache 2.0（部分企业功能有额外条款）
- n8n：Sustainable Use License（自托管/内部使用通常可以，分发/托管服务需确认）

个人本地使用通常问题不大；如果未来分发或托管，逐项复核。
