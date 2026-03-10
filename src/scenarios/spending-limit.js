// Demo Scenario 2: Spending Limit Rejection
// Agent tries to swap 1 BNB → policy rejects → agent self-corrects
import { runAgent } from '../orchestrator.js'
import { DEMO_SPENDING_LIMIT_PROMPT } from '../prompts.js'

console.log('═══ DEMO: Spending Limit Rejection ═══\n')
console.log('Scenario: Agent tries to swap 1 BNB (exceeds per-tx limit)')
console.log('Expected: Policy check fails → Agent explains → Suggests lower amount\n')

runAgent(DEMO_SPENDING_LIMIT_PROMPT, { maxSteps: 8 }).catch((error) => {
  console.error('Demo failed:', error.message)
  process.exit(1)
})
