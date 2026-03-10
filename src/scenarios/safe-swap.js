// Demo Scenario 1: Safe Swap (Success Path)
// Agent checks balance → verifies policies → swaps via PolicyGuard
// Architecture: WDK (wallet + gas) → AgentNFA.execute() → PolicyGuard → PancakeSwap
import { runAgent } from '../orchestrator.js'
import { DEMO_SAFE_SWAP_PROMPT } from '../prompts.js'

console.log('═══ DEMO: Safe Swap via PolicyGuard ═══\n')
console.log('Scenario: Agent autonomously swaps 0.01 BNB to USDT')
console.log('Architecture: WDK signs → AgentNFA.execute → PolicyGuard ✅ → PancakeSwap')
console.log('Expected: Policy check passes → safe_swap executes → Balance verified\n')

runAgent(DEMO_SAFE_SWAP_PROMPT, { maxSteps: 8 }).catch((error) => {
  console.error('Demo failed:', error.message)
  process.exit(1)
})
