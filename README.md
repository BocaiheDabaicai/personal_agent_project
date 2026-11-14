# Personal Agent Platform

本地运行的个人多 Agent 开发平台。用自然语言描述目标，AI 生成可视化工作流，经你审批后由开发者 Agent 执行、审查 Agent 把关；你可以人工验收、打回并带反馈重新规划，直到项目完成。

## 当前能力

- 创建项目，自动初始化独立 git 工作区
- 规划 Agent 生成结构化计划，Vue Flow 画布展示并人工审批
- 开发者 Agent 按节点实现，SSE 实时日志，节点完成后自动提交；运行记录持久化，刷新/重启可回放
- 可随时停止开发/审查，未完成节点回到待处理，之后可继续
- 审查 Agent 按开发节点的 git 提交审查，输出结构化裁决与问题列表
- 人工验收：批准完成，或打回并填写原因
- 迭代闭环：审查未通过或人工打回后，带反馈重新规划，生成新计划版本继续执行

## 技术栈

- Nuxt 4 + TypeScript
- Tailwind CSS 4 + DaisyUI 5
- Vue Flow（工作流画布）
- SQLite + Drizzle ORM
- Claude Agent SDK（Agent 运行时）

## 快速开始

```bash
pnpm install
pnpm db:push
pnpm dev
```

打开 http://localhost:3000

运行 Agent 需要本机 Claude Code 已登录。规划、开发、审查 Agent 均在服务端通过 Claude Agent SDK 调用，并关闭非必要流量（见 `docs/DECISIONS.md` D-004）。

## 使用流程

1. 在首页新建项目，填写名称和目标
2. 进入工作台，点击「生成计划」
3. 查看画布和节点详情，批准或打回计划
4. 批准后点击「开始开发」，查看实时日志
5. 开发节点完成后点击「开始审查」
6. 审查通过后人工验收：
   - 批准完成 → 项目状态变为已完成
   - 打回并填写原因 → 进入待重新规划
7. 点击重新规划，规划 Agent 会结合反馈和现有代码生成新计划版本，再走审批 → 开发 → 审查
8. 项目完成后，代码与提交记录位于 `workspaces/<项目ID>/repo`

## 数据与目录

- `data/app.db`：平台数据库（项目、计划节点、审查、决策）
- `workspaces/<项目ID>/repo`：每个项目的独立 git 仓库
- `.agent/plan.json`、`.agent/reviews/*.json`：Agent 生成的计划与审查结论
- `data/`、`workspaces/`、`.env` 不入库

## 项目文档

- [开发进度](docs/PROGRESS.md)
- [开发日志](docs/JOURNAL.md)
- [决策记录](docs/DECISIONS.md)
- [架构与产品形态](docs/ARCHITECTURE.md)
- [组件级组合与能力接入](docs/INTEGRATION.md)

> 换电脑继续开发：先读 `CLAUDE.md`，再按 `docs/PROGRESS.md` 的「当前步骤」继续。
