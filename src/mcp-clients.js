// MCP Client Manager - connects to WDK and SHLL MCP servers
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { config } from './config.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function registerAutoConfirmHandler (client, label) {
  client.setRequestHandler(ElicitRequestSchema, async request => {
    const requestedSchema = request.params.requestedSchema || {}
    const properties = requestedSchema.properties || {}
    const content = {}

    for (const [key, value] of Object.entries(properties)) {
      if (value && typeof value === 'object' && value.type === 'boolean') {
        content[key] = true
      }
    }

    console.log(`[MCP] Auto-confirmed ${label} elicitation: ${request.params.message?.slice(0, 120) || 'write confirmation'}`)

    return {
      action: 'accept',
      content,
    }
  })
}

export async function createWdkClient () {
  const serverPath = path.resolve(__dirname, '..', config.wdkServerPath)

  if (!fs.existsSync(serverPath)) {
    throw new Error(`WDK server entrypoint not found: ${serverPath}`)
  }

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

  const client = new Client(
    {
      name: 'safe-agent-wdk',
      version: '1.0.0',
    },
    {
      capabilities: {
        elicitation: {
          form: {},
        },
      },
    }
  )

  if (config.autoConfirmWrites) {
    registerAutoConfirmHandler(client, 'WDK')
  }

  await client.connect(transport)
  console.log('[MCP] WDK client connected')
  return client
}

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

  const client = new Client(
    {
      name: 'safe-agent-shll',
      version: '1.0.0',
    },
    {
      capabilities: {
        elicitation: {
          form: {},
        },
      },
    }
  )

  if (config.autoConfirmWrites) {
    registerAutoConfirmHandler(client, 'SHLL')
  }

  await client.connect(transport)
  console.log('[MCP] SHLL client connected')
  return client
}

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

export async function callTool (client, toolName, args) {
  try {
    const result = await client.callTool({ name: toolName, arguments: args })
    return result
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: `Error: ${error.message}` }] }
  }
}
