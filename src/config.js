// SafeAgent Configuration
import 'dotenv/config'

export const CONTRACTS = {
  AgentNFA: '0x71cE46099E4b2a2434111C009A7E9CFd69747c8E',
  PolicyGuardV4: '0x25d17eA0e3Bcb8CA08a2BFE917E817AFc05dbBB3',

  PancakeRouterV2: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
  PancakeV3SmartRouter: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',

  USDT: '0x55d398326f99059fF775485246999027B3197955',
  USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  ETH: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
  BTCB: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
}

export const TOKEN_META = {
  BNB: { address: CONTRACTS.WBNB, decimals: 18, quoteSymbol: 'WBNB' },
  WBNB: { address: CONTRACTS.WBNB, decimals: 18, quoteSymbol: 'WBNB' },
  USDT: { address: CONTRACTS.USDT, decimals: 18, quoteSymbol: 'USDT' },
  USDC: { address: CONTRACTS.USDC, decimals: 18, quoteSymbol: 'USDC' },
  ETH: { address: CONTRACTS.ETH, decimals: 18, quoteSymbol: 'ETH' },
  BTCB: { address: CONTRACTS.BTCB, decimals: 18, quoteSymbol: 'BTCB' },
}

export const VENUS_VTOKENS = {
  BNB: '0xA07c5b74C9B40447a954e1466938b865b6BBea36',
  USDT: '0xfD5840Cd36d94D7229439859C0112a4185BC0255',
  USDC: '0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8',
}

export const PANCAKE_V2_ABI = [
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)',
]

export const AGENT_NFA_ABI = [
  'function execute(uint256 tokenId, tuple(address target, uint256 value, bytes data) action) returns (bytes memory result)',
  'function executeBatch(uint256 tokenId, tuple(address target, uint256 value, bytes data)[] actions) returns (bytes[] memory results)',
  'function accountOf(uint256 tokenId) view returns (address)',
]

export const VTOKEN_ABI = [
  'function mint(uint256 mintAmount) returns (uint256)',
  'function redeemUnderlying(uint256 redeemAmount) returns (uint256)',
]

export const VBNB_MINT_ABI = [
  'function mint() payable',
]

export const config = {
  wdkSeed: process.env.WDK_SEED || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  runnerPrivateKey: process.env.RUNNER_PRIVATE_KEY || '',
  shllTokenId: process.env.SHLL_TOKEN_ID || '',
  bscRpc: process.env.BSC_RPC || 'https://bsc-dataseed1.binance.org',
  wdkServerPath: process.env.WDK_SERVER_PATH || 'src/wdk-bsc-server/index.js',
  shllMcpCommand: process.env.SHLL_MCP_COMMAND || 'shll-mcp',
  model: process.env.MODEL || 'gpt-4o',
  autoConfirmWrites: process.env.AUTO_CONFIRM_WRITES !== 'false',
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
