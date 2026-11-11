# 项目说明（给 Claude Code）

这是用户的个人多 Agent 开发平台。**每次会话开始时，先读 `docs/PROGRESS.md` 的「当前步骤」和 `docs/JOURNAL.md` 最后一条日志，再继续工作。**

## 协作约定

- 每个步骤从最小可运行版本开始；先说明目的与原理，再实现，最后让用户在浏览器/终端亲手验证
- 用户确认后再进入下一步，不要一次性实现多个步骤
- 每完成一步：更新 `docs/PROGRESS.md`（勾选 + 下一步）、在 `docs/JOURNAL.md` 追加记录，必要时更新 `docs/DECISIONS.md`

## 技术栈

Nuxt 4 + TypeScript · Tailwind 4 + DaisyUI 5 · Vue Flow · SQLite（Drizzle + better-sqlite3）· Claude Agent SDK（TS）

## 常用命令

- `pnpm dev` — 启动开发服务器
- `pnpm build` — 构建
- `pnpm drizzle-kit push` — 同步数据库结构（Step 3 起）
- `pnpm tsx scripts/agent-hello.ts` — Agent SDK 通路验证（Step 5 起）

## 关键约定

- 仅本机单人使用；Agent 的 Bash 以用户权限运行，限制不是沙箱
- 服务端代码放 `server/`，共享 schema 放 `shared/`
- 平台数据 `data/`、Agent 工作区 `workspaces/`、`.env` 均不入库
