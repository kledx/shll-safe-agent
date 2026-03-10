// SafeAgent Entry Point — Interactive mode or run a specific prompt
import { runAgent } from './orchestrator.js'
import { DEMO_SAFE_SWAP_PROMPT } from './prompts.js'

const userPrompt = process.argv.slice(2).join(' ') || DEMO_SAFE_SWAP_PROMPT

runAgent(userPrompt).catch((error) => {
  console.error('Fatal:', error.message)
  process.exit(1)
})
