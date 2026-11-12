import { query } from '@anthropic-ai/claude-agent-sdk'
import { consumeAgentStream, type AgentCallbacks } from './agent-stream'

export interface DeveloperNode {
  nodeKey: string
  title: string
  spec: string
  order: number
}

export interface DeveloperContext {
  projectName: string
  goal: string
  planSummary: string
  repoPath: string
  node: DeveloperNode
}

export type DeveloperCallbacks = AgentCallbacks

function buildPrompt(context: DeveloperContext): string {
  const { node } = context

  return `你是「${context.projectName}」项目的开发者 Agent。

项目目标：
${context.goal}

计划摘要：
${context.planSummary}

当前只负责这一个节点：
- id: ${node.nodeKey}
- 标题: ${node.title}
- 规格: ${node.spec}
- 顺序: ${node.order}

当前工作目录就是项目仓库。请使用工具读取现有代码，按规格实现当前节点，并运行必要的命令验证结果。
完整的计划可在 .agent/plan.json 查看。

规则：
1. 只完成当前节点，不要越界处理其他节点
2. 不要修改 .agent/ 目录下的计划文件
3. 不要执行 git commit（平台会在节点完成后统一提交）
4. 保持改动聚焦，不要顺手重写无关文件
5. 完成后用一两句话总结改动和验证结果，然后停止`
}

export async function runDeveloperNode(
  context: DeveloperContext,
  callbacks: DeveloperCallbacks,
): Promise<void> {
  const stream = query({
    prompt: buildPrompt(context),
    options: {
      cwd: context.repoPath,
      tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
      allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
      permissionMode: 'acceptEdits',
      maxTurns: 24,
      env: {
        ...process.env,
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      } as Record<string, string>,
    },
  })

  await consumeAgentStream(stream, callbacks, '开发者 Agent')
}
