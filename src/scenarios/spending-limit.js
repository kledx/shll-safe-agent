// Demo Scenario 2: Spending Limit Rejection
// Agent attempts swap that exceeds on-chain SpendingLimitV2 policy
// Architecture: WDK → AgentNFA → PolicyGuard REVERTS → Transaction blocked
import { runAgent } from '../orchestrator.js'
import { DEMO_SPENDING_LIMIT_PROMPT } from '../prompts.js'

console.log('═══ DEMO: PolicyGuard Safety Rejection ═══\n')
console.log('Scenario: Agent attempts swap exceeding SpendingLimitV2 maxPerTx')
console.log('Architecture: WDK signs → AgentNFA.execute → PolicyGuard ❌ REVERT')
console.log('Expected: safe_swap fails → Agent explains on-chain rejection\n')

runAgent(DEMO_SPENDING_LIMIT_PROMPT, { maxSteps: 8 }).catch((error) => {
  console.error('Demo failed:', error.message)
  process.exit(1)
})
