import { query } from '@anthropic-ai/claude-agent-sdk'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { formatPlanError, validatePlan, type Plan } from '../../shared/schemas/plan'

interface PlannerProject {
  id: number
  name: string
  goal: string
  repoPath: string
}

const PLAN_RELATIVE_PATH = '.agent/plan.json'

function buildPrompt(project: PlannerProject, previousError: string): string {
  const schemaExample = JSON.stringify(
    {
      summary: '一句话概括计划',
      nodes: [
        { id: 'build-greeting', kind: 'develop', title: '实现问候脚本', spec: '具体要求与验收标准', order: 0 },
        { id: 'review-greeting', kind: 'review', title: '审查问候脚本', spec: '审查要点', order: 1 },
        { id: 'accept', kind: 'gate', title: '人工验收', spec: '验收标准', order: 2 },
      ],
      edges: [
        { source: 'build-greeting', target: 'review-greeting' },
        { source: 'review-greeting', target: 'accept' },
      ],
    },
    null,
    2,
  )

  const retryHint = previousError
    ? `\n上一次生成未通过校验，请修正以下问题后重新生成：\n${previousError}\n`
    : ''

  return `你是「${project.name}」项目的规划 Agent。

项目目标：
${project.goal}

请在当前工作区创建执行计划，写入 ${PLAN_RELATIVE_PATH}。只允许写这一个文件，不要修改其他文件，不要运行命令。
${retryHint}
输出必须是严格的 JSON（不要 Markdown 代码块），格式示例：
${schemaExample}

规则：
1. id 使用英文 kebab-case，全局唯一
2. kind 只能是 develop / review / gate
3. 每个 develop 节点后必须跟一个 review 节点
4. 最后一个节点必须是 gate（人工验收）
5. order 从 0 开始递增且不重复
6. edges 的 source/target 必须指向已有节点 id
7. spec 写给后续执行者：具体做什么、完成标准是什么
8. 任务拆小，develop 节点 1-4 个
完成后停止。`
}

async function runPlanner(project: PlannerProject, previousError: string): Promise<void> {
  const stream = query({
    prompt: buildPrompt(project, previousError),
    options: {
      cwd: project.repoPath,
      tools: ['Read', 'Write', 'Glob', 'Grep'],
      allowedTools: ['Read', 'Write', 'Glob', 'Grep'],
      permissionMode: 'acceptEdits',
      maxTurns: 6,
      env: {
        ...process.env,
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      } as Record<string, string>,
    },
  })

  let resultError = ''
  for await (const message of stream) {
    if (message.type === 'result' && message.subtype !== 'success') {
      resultError = message.subtype
    }
  }

  if (resultError) {
    throw new Error(`规划 Agent 运行失败：${resultError}`)
  }
}

export async function generatePlan(project: PlannerProject): Promise<Plan> {
  const agentDir = join(project.repoPath, '.agent')
  const planPath = join(project.repoPath, PLAN_RELATIVE_PATH)
  mkdirSync(agentDir, { recursive: true })

  let lastError = ''

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    rmSync(planPath, { force: true })

    try {
      await runPlanner(project, lastError)
    } catch (error) {
      lastError = formatPlanError(error)
      continue
    }

    if (!existsSync(planPath)) {
      lastError = `Agent 没有写入 ${PLAN_RELATIVE_PATH}`
      continue
    }

    try {
      const raw = readFileSync(planPath, 'utf-8')
      return validatePlan(JSON.parse(raw))
    } catch (error) {
      lastError = formatPlanError(error)
    }
  }

  throw new Error(`规划失败（已重试一次）：${lastError}`)
}
