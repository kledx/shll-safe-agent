// Demo Scenario 5: Safe Lend (Success Path)
// Agent checks readiness -> supplies to Venus via PolicyGuard -> verifies vault state
import { runAgent } from '../orchestrator.js'
import { DEMO_SAFE_LEND_PROMPT } from '../prompts.js'

console.log('¨T¨T DEMO: Safe Lend via PolicyGuard ¨T¨T\n')
console.log('Scenario: Agent supplies 10 USDT from the SHLL vault into Venus')
console.log('Architecture: WDK signs -> AgentNFA.execute -> PolicyGuard -> Venus vToken mint')
console.log('Expected: Policy check passes -> safe_lend executes -> Vault balance verified\n')

runAgent(DEMO_SAFE_LEND_PROMPT, { maxSteps: 10 }).catch((error) => {
  console.error('Demo failed:', error.message)
  process.exit(1)
})
