// Demo Scenario 9: Safe Redeem Rejection
// Agent attempts to redeem more than the current position to demonstrate failure handling
import { runAgent } from '../orchestrator.js'
import { DEMO_SAFE_REDEEM_REJECTION_PROMPT } from '../prompts.js'

console.log('¨T¨T DEMO: Safe Redeem Rejection ¨T¨T\n')
console.log('Scenario: Agent tries to redeem more than the likely available Venus position')
console.log('Architecture: WDK signs -> AgentNFA.execute -> PolicyGuard / Venus revert')
console.log('Expected: redeem attempt is rejected and the agent explains whether the failure looks policy-side or protocol-side\n')

runAgent(DEMO_SAFE_REDEEM_REJECTION_PROMPT, { maxSteps: 10 }).catch((error) => {
  console.error('Demo failed:', error.message)
  process.exit(1)
})
