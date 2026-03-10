// Demo Scenario 7: Safe Transfer Rejection
// Agent attempts transfer to an unapproved recipient to trigger on-chain rejection
import { runAgent } from '../orchestrator.js'
import { DEMO_SAFE_TRANSFER_REJECTION_PROMPT } from '../prompts.js'

console.log('¨T¨T DEMO: Safe Transfer Rejection ¨T¨T\n')
console.log('Scenario: Agent tries to transfer 5 USDT to a likely unapproved recipient')
console.log('Architecture: WDK signs -> AgentNFA.execute -> PolicyGuard / ReceiverGuard rejection')
console.log('Expected: transfer attempt is rejected and the agent explains the on-chain reason\n')

runAgent(DEMO_SAFE_TRANSFER_REJECTION_PROMPT, { maxSteps: 10 }).catch((error) => {
  console.error('Demo failed:', error.message)
  process.exit(1)
})
