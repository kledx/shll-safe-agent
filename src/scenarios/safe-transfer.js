// Demo Scenario 4: Safe Transfer (Success Path)
// Agent checks readiness -> transfers via PolicyGuard -> verifies vault balance
import { runAgent } from '../orchestrator.js'
import { DEMO_SAFE_TRANSFER_PROMPT } from '../prompts.js'

console.log('¨T¨T DEMO: Safe Transfer via PolicyGuard ¨T¨T\n')
console.log('Scenario: Agent transfers 5 USDT from the SHLL vault to an approved recipient')
console.log('Architecture: WDK signs -> AgentNFA.execute -> PolicyGuard -> Receiver transfer')
console.log('Expected: Policy check passes -> safe_transfer executes -> Vault balance verified\n')

runAgent(DEMO_SAFE_TRANSFER_PROMPT, { maxSteps: 8 }).catch((error) => {
  console.error('Demo failed:', error.message)
  process.exit(1)
})
