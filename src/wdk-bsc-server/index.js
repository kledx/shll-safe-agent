'use strict'

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  BRIDGE_TOOLS,
  PRICING_TOOLS,
  SWAP_TOOLS,
  WALLET_TOOLS,
  WdkMcpServer,
} from '@tetherto/wdk-mcp-toolkit'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import VeloraProtocolEvm from '@tetherto/wdk-protocol-swap-velora-evm'
import Usdt0ProtocolEvm from '@tetherto/wdk-protocol-bridge-usdt0-evm'
import { callContract } from './callContract.js'

const BSC_RPC = process.env.BSC_RPC || 'https://bsc-dataseed1.binance.org'

async function main () {
  if (!process.env.WDK_SEED) {
    console.error('Error: WDK_SEED environment variable is required.')
    process.exit(1)
  }

  const server = new WdkMcpServer('safe-agent-wdk-bsc-server', '1.0.0')
    .useWdk({ seed: process.env.WDK_SEED })
    .registerWallet('bnb', WalletManagerEvm, { provider: BSC_RPC })
    .registerProtocol('bnb', 'velora', VeloraProtocolEvm)
    .registerProtocol('bnb', 'usdt0', Usdt0ProtocolEvm)
    .usePricing()

  server
    .registerToken('bnb', 'WBNB', {
      address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      decimals: 18,
    })
    .registerToken('bnb', 'USDC', {
      address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      decimals: 18,
    })
    .registerToken('bnb', 'ETH', {
      address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
      decimals: 18,
    })
    .registerToken('bnb', 'BTCB', {
      address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
      decimals: 18,
    })

  server.registerTools([
    ...WALLET_TOOLS,
    ...PRICING_TOOLS,
    ...SWAP_TOOLS,
    ...BRIDGE_TOOLS,
    callContract,
  ])

  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error('SafeAgent WDK BSC MCP Server running on stdio')
  console.error('Registered chains:', server.getChains())
  console.error('Registered swap protocols:', server.getSwapChains())
  console.error('Registered bridge protocols:', server.getBridgeChains())
  console.error('Registered tokens (bnb):', server.getRegisteredTokens('bnb'))
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
