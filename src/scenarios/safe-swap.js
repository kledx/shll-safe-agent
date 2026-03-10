// Demo Scenario 1: Safe Swap (Success Path)
// Agent checks balance → verifies policies → swaps 0.01 BNB to USDT
import { runAgent } from '../orchestrator.js'
import { DEMO_SAFE_SWAP_PROMPT } from '../prompts.js'

console.log('═══ DEMO: Safe Swap (Success Path) ═══\n')
console.log('Scenario: Agent autonomously swaps 0.01 BNB to USDT')
console.log('Expected: Policy check passes → Swap executes → Balance verified\n')

runAgent(DEMO_SAFE_SWAP_PROMPT, { maxSteps: 8 }).catch((error) => {
  console.error('Demo failed:', error.message)
  process.exit(1)
})
