// Demo Scenario 8: Safe Lend Rejection
// Agent attempts an oversized Venus supply to trigger on-chain rejection
import { runAgent } from '../orchestrator.js'
import { DEMO_SAFE_LEND_REJECTION_PROMPT } from '../prompts.js'

console.log('¨T¨T DEMO: Safe Lend Rejection ¨T¨T\n')
console.log('Scenario: Agent tries to lend an amount that should exceed current policy or vault limits')
console.log('Architecture: WDK signs -> AgentNFA.execute -> PolicyGuard / Venus revert')
console.log('Expected: lend attempt is rejected and the agent explains the on-chain reason\n')

runAgent(DEMO_SAFE_LEND_REJECTION_PROMPT, { maxSteps: 10 }).catch((error) => {
  console.error('Demo failed:', error.message)
  process.exit(1)
})
