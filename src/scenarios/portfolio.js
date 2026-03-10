// Demo Scenario 3: Autonomous Portfolio Optimization
// Agent checks portfolio → decides to lend idle USDT for yield
import { runAgent } from '../orchestrator.js'
import { DEMO_PORTFOLIO_PROMPT } from '../prompts.js'

console.log('═══ DEMO: Portfolio Optimization ═══\n')
console.log('Scenario: Agent analyzes portfolio and optimizes for yield')
console.log('Expected: Check holdings → Identify idle USDT → Lend to Venus → Report APY\n')

runAgent(DEMO_PORTFOLIO_PROMPT, { maxSteps: 12 }).catch((error) => {
  console.error('Demo failed:', error.message)
  process.exit(1)
})
