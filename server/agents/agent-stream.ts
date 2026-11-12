import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'

export interface AgentCallbacks {
  onText: (text: string) => void
  onToolUse: (name: string, input: string) => void
  onToolResult: (name: string, output: string, ok: boolean) => void
}

function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit)}…` : value
}

function preview(value: unknown, limit: number): string {
  try {
    return truncate(typeof value === 'string' ? value : JSON.stringify(value), limit)
  } catch {
    return truncate(String(value), limit)
  }
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item
        }
        if (item && typeof item === 'object' && 'text' in item) {
          const text = (item as { text?: unknown }).text
          if (typeof text === 'string') {
            return text
          }
        }
        return preview(item, 400)
      })
      .filter(Boolean)
      .join('\n')
  }
  if (content == null) {
    return ''
  }
  return preview(content, 400)
}

export async function consumeAgentStream(
  stream: AsyncIterable<SDKMessage>,
  callbacks: AgentCallbacks,
  label = 'Agent',
): Promise<void> {
  const toolNames = new Map<string, string>()

  for await (const message of stream) {
    if (message.type === 'assistant') {
      for (const block of message.message.content) {
        if (block.type === 'text') {
          callbacks.onText(block.text)
        } else if (block.type === 'tool_use') {
          toolNames.set(block.id, block.name)
          callbacks.onToolUse(block.name, preview(block.input, 600))
        }
      }
      continue
    }

    if (message.type === 'user' && Array.isArray(message.message.content)) {
      for (const block of message.message.content) {
        if (block.type !== 'tool_result') {
          continue
        }
        const name = toolNames.get(block.tool_use_id) ?? 'tool'
        callbacks.onToolResult(
          name,
          preview(contentToText(block.content), 1200),
          block.is_error !== true,
        )
      }
      continue
    }

    if (message.type === 'result' && message.subtype !== 'success') {
      const detail = message.errors.length > 0 ? message.errors.join('\n') : message.subtype
      throw new Error(`${label} 运行失败：${detail}`)
    }
  }
}
