// SafeAgent Configuration
import 'dotenv/config'

export const config = {
  // WDK wallet seed
  wdkSeed: process.env.WDK_SEED || '',

  // OpenAI API key for LLM reasoning
  openaiApiKey: process.env.OPENAI_API_KEY || '',

  // SHLL operator private key
  runnerPrivateKey: process.env.RUNNER_PRIVATE_KEY || '',

  // SHLL Agent token ID
  shllTokenId: process.env.SHLL_TOKEN_ID || '',

  // BSC RPC URL
  bscRpc: process.env.BSC_RPC || 'https://bsc-dataseed1.binance.org',

  // Paths to MCP servers
  wdkServerPath: process.env.WDK_SERVER_PATH || '../wdk-mcp-toolkit/examples/bsc/index.js',
  shllMcpCommand: process.env.SHLL_MCP_COMMAND || 'shll-mcp',

  // LLM model
  model: process.env.MODEL || 'gpt-4o',
}

export function validateConfig () {
  const missing = []
  if (!config.wdkSeed) missing.push('WDK_SEED')
  if (!config.openaiApiKey) missing.push('OPENAI_API_KEY')

  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(', ')}`)
    console.error('Copy .env.example to .env and fill in your values.')
    process.exit(1)
  }
}
