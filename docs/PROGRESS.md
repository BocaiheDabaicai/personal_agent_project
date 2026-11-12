# 开发进度

> 换电脑继续开发时：先看「当前步骤」，再看 `JOURNAL.md` 最后一条。

## 当前

- 当前步骤：全部完成（Step 11 收尾）
- 状态：Step 11 已验收（2026-11-12，人工验收 / 打回 / 重新规划 / 多轮迭代均通过）；项目 1、2 已完成
- 下一步：按需扩展（日志持久化、直接修复迭代、更多 Agent 能力等）
- 已知限制：运行日志仅保存在内存，开发服务器重启或 HMR 后丢失（节点状态、审查记录与 git 提交保留）
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

## 每步完成标准

代码可运行 + 有可观察的验收结果 + 文档已更新。
