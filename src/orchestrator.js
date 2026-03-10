// SafeAgent Orchestrator — AI-driven agent loop using Vercel AI SDK
// Connects to both WDK (wallet) and SHLL (safety) MCP servers
// and uses LLM to reason about DeFi actions with safety governance

import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { jsonSchema } from 'ai'
import { config, validateConfig } from './config.js'
import { createWdkClient, createShllClient, callTool } from './mcp-clients.js'
import { SYSTEM_PROMPT } from './prompts.js'

/**
 * Convert MCP tool definitions to Vercel AI SDK tool format.
 * MCP returns JSON Schema objects; Vercel AI SDK requires jsonSchema() wrapper.
 */
function mcpToolsToAiTools (mcpTools, mcpClient, prefix = '') {
  const tools = {}

  for (const tool of mcpTools) {
    const toolName = prefix ? `${prefix}_${tool.name}` : tool.name

    // MCP inputSchema is a JSON Schema object; wrap for AI SDK
    const schema = tool.inputSchema || { type: 'object', properties: {} }

    tools[toolName] = {
      description: `[${prefix.toUpperCase()}] ${tool.description || tool.name}`,
      parameters: jsonSchema(schema),
      execute: async (args) => {
        console.log(`\n  [TOOL] ${toolName}(${JSON.stringify(args)})`)
        const result = await callTool(mcpClient, tool.name, args)

        // Extract text content from MCP result
        const text = result.content
          ?.map(c => c.text || JSON.stringify(c))
          .join('\n') || JSON.stringify(result)

        const preview = text.length > 300 ? text.slice(0, 300) + '...' : text
        console.log(`  [RESULT] ${preview}`)
        return text
      },
    }
  }

  return tools
}

/**
 * Run the SafeAgent with a given user prompt.
 * Connects to both WDK and SHLL MCP servers, registers their tools,
 * and runs the AI agent loop with tool calling.
 */
export async function runAgent (userPrompt, options = {}) {
  validateConfig()

  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║         SafeAgent — Autonomous DeFi Agent         ║')
  console.log('║      WDK Wallet + SHLL Safety + AI Reasoning      ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  // Step 1: Connect to MCP servers
  console.log('[1/3] Connecting to MCP servers...')
  let wdkClient = null
  let shllClient = null

  try {
    wdkClient = await createWdkClient()
  } catch (e) {
    console.error('[ERROR] WDK MCP connection failed:', e.message)
    console.log('[FALLBACK] Continuing without WDK tools')
  }

  try {
    shllClient = await createShllClient()
  } catch (e) {
    console.error('[ERROR] SHLL MCP connection failed:', e.message)
    console.log('[FALLBACK] Continuing without SHLL tools')
  }

  if (!wdkClient && !shllClient) {
    console.error('[FATAL] No MCP servers available. Cannot run agent.')
    process.exit(1)
  }

  // Step 2: Collect tools from both servers
  console.log('\n[2/3] Registering tools...')
  const tools = {}

  if (wdkClient) {
    try {
      const wdkToolList = await wdkClient.listTools()
      const wdkTools = mcpToolsToAiTools(wdkToolList.tools, wdkClient, 'wdk')
      Object.assign(tools, wdkTools)
      console.log(`  WDK: ${Object.keys(wdkTools).length} tools registered`)
    } catch (e) {
      console.error('  WDK tool registration failed:', e.message)
    }
  }

  if (shllClient) {
    try {
      const shllToolList = await shllClient.listTools()
      const shllTools = mcpToolsToAiTools(shllToolList.tools, shllClient, 'shll')
      Object.assign(tools, shllTools)
      console.log(`  SHLL: ${Object.keys(shllTools).length} tools registered`)
    } catch (e) {
      console.error('  SHLL tool registration failed:', e.message)
    }
  }

  const toolCount = Object.keys(tools).length
  console.log(`  Total: ${toolCount} tools available`)

  if (toolCount === 0) {
    console.error('[FATAL] No tools registered. Cannot run agent.')
    process.exit(1)
  }

  // Inject context into the system prompt
  const systemWithContext = SYSTEM_PROMPT
    + (config.shllTokenId
      ? `\n\n## Runtime Context\nSHLL Agent Token ID: ${config.shllTokenId}\nUse this token_id for all SHLL tool calls that require it.`
      : '')

  // Step 3: Run AI agent loop
  console.log('\n[3/3] Running agent...')
  console.log(`\n  User: "${userPrompt.trim()}"\n`)
  console.log('─'.repeat(55))

  try {
    const result = await generateText({
      model: openai(config.model),
      system: systemWithContext,
      prompt: userPrompt,
      tools,
      maxSteps: options.maxSteps || 10,
      onStepFinish: ({ text }) => {
        if (text) {
          console.log(`\n  Agent: ${text}`)
        }
      },
    })

    console.log('\n' + '─'.repeat(55))
    console.log('\n  [FINAL RESPONSE]')
    console.log(`  ${result.text}\n`)

    return result
  } catch (error) {
    console.error('\n[ERROR] Agent execution failed:', error.message)
    throw error
  } finally {
    // Always cleanup MCP connections
    try { if (wdkClient) await wdkClient.close() } catch (_) {}
    try { if (shllClient) await shllClient.close() } catch (_) {}
  }
}
