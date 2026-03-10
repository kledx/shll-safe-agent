// Demo Scenario 6: Safe Redeem (Success Path)
// Agent checks readiness -> redeems from Venus via PolicyGuard -> verifies vault balance
import { runAgent } from '../orchestrator.js'
import { DEMO_SAFE_REDEEM_PROMPT } from '../prompts.js'

console.log('¨T¨T DEMO: Safe Redeem via PolicyGuard ¨T¨T\n')
console.log('Scenario: Agent redeems 5 USDT from an existing Venus position back to the SHLL vault')
console.log('Architecture: WDK signs -> AgentNFA.execute -> PolicyGuard -> Venus redeemUnderlying')
console.log('Expected: Policy check passes -> safe_redeem executes -> Vault balance verified\n')

runAgent(DEMO_SAFE_REDEEM_PROMPT, { maxSteps: 10 }).catch((error) => {
  console.error('Demo failed:', error.message)
  process.exit(1)
})
