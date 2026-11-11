import { query } from '@anthropic-ai/claude-agent-sdk'

async function main() {
  const stream = query({
    prompt: '请只回复两个字：正常',
    options: {
      cwd: process.cwd(),
      tools: [],
      env: {
        ...process.env,
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      } as Record<string, string>,
    },
  })

  for await (const message of stream) {
    if (message.type === 'assistant') {
      for (const block of message.message.content) {
        if (block.type === 'text') {
          process.stdout.write(block.text)
        }
      }
    }

    if (message.type === 'result') {
      console.log(`\n[result] ${message.subtype}`)
      if (message.subtype !== 'success') {
        process.exitCode = 1
      }
    }
  }
}

main().catch((error) => {
  console.error('agent hello failed:', error)
  process.exit(1)
})
