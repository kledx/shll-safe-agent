// MCP Client Manager — connects to WDK and SHLL MCP servers
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { config } from './config.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Create a WDK MCP Client connected to BSC WDK server
 */
export async function createWdkClient () {
  const serverPath = path.resolve(__dirname, '..', config.wdkServerPath)
  console.log('[MCP] Starting WDK BSC server:', serverPath)

  const transport = new StdioClientTransport({
    command: 'node',
    args: [serverPath],
    env: {
      PATH: process.env.PATH,
      NODE_PATH: process.env.NODE_PATH || '',
      WDK_SEED: config.wdkSeed,
      BSC_RPC: config.bscRpc,
    },
  })

  const client = new Client({
    name: 'safe-agent-wdk',
    version: '1.0.0',
  })

  await client.connect(transport)
  console.log('[MCP] WDK client connected')
  return client
}

/**
 * Create a SHLL MCP Client connected to shll-mcp server
 */
export async function createShllClient () {
  console.log('[MCP] Starting SHLL MCP server:', config.shllMcpCommand)

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['-y', config.shllMcpCommand],
    env: {
      PATH: process.env.PATH,
      NODE_PATH: process.env.NODE_PATH || '',
      RUNNER_PRIVATE_KEY: config.runnerPrivateKey,
    },
  })

  const client = new Client({
    name: 'safe-agent-shll',
    version: '1.0.0',
  })

  await client.connect(transport)
  console.log('[MCP] SHLL client connected')
  return client
}

/**
 * List all available tools from both MCP servers
 */
export async function listAllTools (wdkClient, shllClient) {
  const wdkTools = await wdkClient.listTools()
  const shllTools = await shllClient.listTools()

  console.log(`[MCP] WDK tools: ${wdkTools.tools.length}`)
  for (const t of wdkTools.tools) {
    console.log(`  - ${t.name}: ${t.description?.slice(0, 60)}...`)
  }

  console.log(`[MCP] SHLL tools: ${shllTools.tools.length}`)
  for (const t of shllTools.tools) {
    console.log(`  - ${t.name}: ${t.description?.slice(0, 60)}...`)
  }

  return { wdkTools: wdkTools.tools, shllTools: shllTools.tools }
}

/**
 * Call a tool on the appropriate MCP client
 */
export async function callTool (client, toolName, args) {
  try {
    const result = await client.callTool({ name: toolName, arguments: args })
    return result
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: `Error: ${error.message}` }] }
  }
}
