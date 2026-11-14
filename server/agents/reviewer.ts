import { query } from '@anthropic-ai/claude-agent-sdk'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  formatReviewError,
  validateReview,
  type Review,
} from '../../shared/schemas/review'
import { consumeAgentStream, type AgentCallbacks } from './agent-stream'

export interface ReviewerNode {
  nodeKey: string
  title: string
  spec: string
  order: number
}

export interface ReviewerContext {
  projectName: string
  goal: string
  planSummary: string
  repoPath: string
  reviewNode: ReviewerNode
  developNode: ReviewerNode
  commitHash: string
}

export type ReviewerCallbacks = AgentCallbacks

function safeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function reviewRelativePath(reviewNodeKey: string): string {
  return `.agent/reviews/${safeKey(reviewNodeKey)}.json`
}

function buildPrompt(context: ReviewerContext, previousError: string): string {
  const reviewPath = reviewRelativePath(context.reviewNode.nodeKey)
  const retryHint = previousError
    ? `\n上一次审查结论未通过校验，请修正以下问题后重新写入：\n${previousError}\n`
    : ''

  const schemaExample = JSON.stringify(
    {
      verdict: 'pass',
      summary: '一句话说明审查结论',
      issues: [
        {
          severity: 'major',
          message: '具体问题',
          file: 'greet.js',
          line: 1,
        },
      ],
    },
    null,
    2,
  )

  return `你是「${context.projectName}」项目的审查 Agent。

项目目标：
${context.goal}

计划摘要：
${context.planSummary}

当前审查节点：
- id: ${context.reviewNode.nodeKey}
- 标题: ${context.reviewNode.title}
- 规格: ${context.reviewNode.spec}

对应的开发节点：
- id: ${context.developNode.nodeKey}
- 标题: ${context.developNode.title}
- 规格: ${context.developNode.spec}

该开发节点的提交：${context.commitHash}

当前工作目录就是项目仓库。请使用 git show / git diff 查看该提交的改动，对照开发节点规格进行审查，并运行必要的验证命令。
只允许写入 ${reviewPath}，不要修改其他文件，不要执行 git commit。
${retryHint}
将结论写入 ${reviewPath}，必须是严格 JSON（不要 Markdown 代码块），格式示例：
${schemaExample}

规则：
1. 只审查当前开发节点的提交，不评判范围外的历史改动
2. verdict 只能是 pass / fail；只有完全满足规格才算 pass
3. fail 时 issues 至少包含一个问题
4. severity 只能是 blocker / major / minor；message 要具体可执行
5. 能定位到文件和行号时填写 file / line，否则省略
6. 完成后停止`
}

async function runReviewer(
  context: ReviewerContext,
  previousError: string,
  callbacks: ReviewerCallbacks,
  abortController?: AbortController,
): Promise<void> {
  const stream = query({
    prompt: buildPrompt(context, previousError),
    options: {
      cwd: context.repoPath,
      tools: ['Read', 'Glob', 'Grep', 'Bash', 'Write'],
      allowedTools: ['Read', 'Glob', 'Grep', 'Bash', 'Write'],
      permissionMode: 'acceptEdits',
      maxTurns: 16,
      abortController,
      env: {
        ...process.env,
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      } as Record<string, string>,
    },
  })

  await consumeAgentStream(stream, callbacks, '审查 Agent')
}

export async function reviewDevelopNode(
  context: ReviewerContext,
  callbacks: ReviewerCallbacks,
  abortController?: AbortController,
): Promise<Review> {
  const reviewPath = join(context.repoPath, reviewRelativePath(context.reviewNode.nodeKey))
  mkdirSync(dirname(reviewPath), { recursive: true })

  let lastError = ''

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    rmSync(reviewPath, { force: true })

    try {
      await runReviewer(context, lastError, callbacks, abortController)
    } catch (error) {
      lastError = formatReviewError(error)
      continue
    }

    if (!existsSync(reviewPath)) {
      lastError = `Agent 没有写入 ${reviewRelativePath(context.reviewNode.nodeKey)}`
      continue
    }

    try {
      const raw = readFileSync(reviewPath, 'utf-8')
      return validateReview(JSON.parse(raw))
    } catch (error) {
      lastError = formatReviewError(error)
    }
  }

  throw new Error(`审查失败（已重试一次）：${lastError}`)
}
