# 开发进度

> 换电脑继续开发时：先看「当前步骤」，再看 `JOURNAL.md` 最后一条。

## 当前

- 当前步骤：Step 14 已通过浏览器验收；下一步 Step 15（记忆链 v1）
- 状态：Step 14 已通过浏览器验收（2026-11-14，能力面板、计划 `requires`、图片生成与产物均正常）
- 下一步：Step 15 记忆链 v1（事件日志蒸馏、记忆浏览/编辑、规划召回与透明展示）
- 规划文档：`docs/ARCHITECTURE.md`（定位、五层架构、产品形态）、`docs/INTEGRATION.md`（组件级组合、能力注册表、MCP）
- 已知限制：运行账本会持续增长，暂未做归档/清理；取消后 Agent SDK 可能仍吐出短暂缓冲事件（已丢弃）；SSE 仍为单进程内实时流；验收命令由规划 Agent 生成，需在计划审批时人工检查，执行权限与 Agent Bash 相同；旧计划没有验收契约时会跳过确定性验证；图片能力依赖本机 Dreamina CLI 登录，单次最多 5 积分、单节点最多 4 次，暂无运行级总预算；即梦画布与积分在外部账号
- 说明：调试页 `/workflow`、`/design-preview` 已从导航移除，作为彩蛋保留（导航栏 logo 小方块连点 5 次解锁）
- 本机环境（2026-11-12，Mac）：pnpm 10.34.9、依赖已安装、`data/app.db` 已创建、Agent SDK 通路已验证
- 恢复开发时：先读本文件与 `JOURNAL.md` 最后一条；本机 `data/app.db`、`workspaces/` 不在 git 中，换电脑后需重新创建项目并生成计划

## 路线（11 步）

- [x] Step 1 脚手架 + 你好页面 + 文档体系
- [x] Step 2 DaisyUI 外观
- [x] Step 3 SQLite + 项目 CRUD
- [x] Step 4 静态工作流画布（Vue Flow）
- [x] Step 5 Agent SDK 通路验证
- [x] Step 6 项目工作区 + git
- [x] Step 7 规划 Agent 生成结构化计划
- [x] Step 8 真实画布 + 计划审批
- [x] Step 9 开发者 Agent + SSE 实时日志
- [x] Step 10 审查 Agent + 结构化裁决
- [x] Step 11 迭代闭环 + 收尾

## 扩展路线（2026-11-14 起）

- [x] Step 12 持久化运行内核
- [x] Step 13 验收契约与确定性验证
- [x] Step 14 能力注册表 + MCP 最小接入
- [ ] Step 15 记忆链 v1
- [ ] Step 16 团队模板 + 调度 + 站内通知
- [ ] Step 17 通道 + 形态

## 每步完成标准

代码可运行 + 有可观察的验收结果 + 文档已更新。
