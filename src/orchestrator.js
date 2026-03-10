// SafeAgent Orchestrator — AI-driven agent loop using Vercel AI SDK
// Connects to both WDK (wallet) and SHLL (safety) MCP servers
// and uses LLM to reason about DeFi actions with safety governance

import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { config, validateConfig } from './config.js'
import { createWdkClient, createShllClient, callTool } from './mcp-clients.js'
import { SYSTEM_PROMPT } from './prompts.js'

/**
 * Convert MCP tool definitions to Vercel AI SDK tool format
 */
function mcpToolsToAiTools (mcpTools, mcpClient, prefix = '') {
  const tools = {}

  for (const tool of mcpTools) {
    const toolName = prefix ? `${prefix}_${tool.name}` : tool.name

    // Build parameters from MCP inputSchema
    const parameters = tool.inputSchema || { type: 'object', properties: {} }

    tools[toolName] = {
      description: `[${prefix || 'tool'}] ${tool.description || tool.name}`,
      parameters,
      execute: async (args) => {
        console.log(`\n  [TOOL] ${toolName}(${JSON.stringify(args)})`)
        const result = await callTool(mcpClient, tool.name, args)

        // Extract text content from MCP result
        const text = result.content
          ?.map(c => c.text || JSON.stringify(c))
          .join('\n') || JSON.stringify(result)

        console.log(`  [RESULT] ${text.slice(0, 200)}${text.length > 200 ? '...' : ''}`)
        return text
      },
    }
  }

  return tools
}

/**
 * Run the SafeAgent with a given user prompt
 */
export async function runAgent (userPrompt, options = {}) {
  validateConfig()

  console.log('\n╔══════════════════════════════════════════════╗')
  console.log('║        SafeAgent — Autonomous DeFi Agent      ║')
  console.log('║    WDK Wallet + SHLL Safety + AI Reasoning     ║')
  console.log('╚══════════════════════════════════════════════╝\n')

  // Step 1: Connect to MCP servers
  console.log('[1/3] Connecting to MCP servers...')
  let wdkClient, shllClient

  try {
    wdkClient = await createWdkClient()
  } catch (e) {
    console.error('[ERROR] WDK MCP connection failed:', e.message)
    console.log('[FALLBACK] Continuing without WDK (demo mode)')
    wdkClient = null
  }

  try {
    shllClient = await createShllClient()
  } catch (e) {
    console.error('[ERROR] SHLL MCP connection failed:', e.message)
    console.log('[FALLBACK] Continuing without SHLL (demo mode)')
    shllClient = null
  }

  // Step 2: Collect tools from both servers
  console.log('\n[2/3] Registering tools...')
  const tools = {}

  if (wdkClient) {
    const wdkToolList = await wdkClient.listTools()
    const wdkTools = mcpToolsToAiTools(wdkToolList.tools, wdkClient, 'wdk')
    Object.assign(tools, wdkTools)
    console.log(`  WDK: ${Object.keys(wdkTools).length} tools`)
  }

  if (shllClient) {
    const shllToolList = await shllClient.listTools()
    const shllTools = mcpToolsToAiTools(shllToolList.tools, shllClient, 'shll')
    Object.assign(tools, shllTools)
    console.log(`  SHLL: ${Object.keys(shllTools).length} tools`)
  }

  console.log(`  Total: ${Object.keys(tools).length} tools available`)

  // Step 3: Run AI agent loop
  console.log('\n[3/3] Running agent...')
  console.log(`\n  User: "${userPrompt}"\n`)
  console.log('─'.repeat(50))

  try {
    const result = await generateText({
      model: openai(config.model),
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      tools,
      maxSteps: options.maxSteps || 10,
      onStepFinish: ({ toolCalls, text }) => {
        if (text) {
          console.log(`\n  Agent: ${text}`)
        }
      },
    })

    console.log('\n' + '─'.repeat(50))
    console.log('\n  [FINAL RESPONSE]')
    console.log(`  ${result.text}\n`)

    // Cleanup
    if (wdkClient) await wdkClient.close()
    if (shllClient) await shllClient.close()

    return result
  } catch (error) {
    console.error('\n[ERROR] Agent execution failed:', error.message)
    if (wdkClient) await wdkClient.close()
    if (shllClient) await shllClient.close()
    throw error
  }
}
