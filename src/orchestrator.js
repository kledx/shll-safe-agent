// SafeAgent Orchestrator — AI-driven agent loop using Vercel AI SDK
// Architecture: WDK (wallet + gas) → AgentNFA.execute() → SHLL PolicyGuard → DEX
//
// WDK tools: READ-ONLY (balance, price, quote) + callContract (raw contract calls)
// SHLL tools: Policy reads + status + portfolio
// Safe tools: safe_swap (high-level, routes through PolicyGuard via WDK callContract)
//
// Write tools (wdk_swap, wdk_transfer, wdk_sendTransaction) are FILTERED OUT
// to prevent bypassing SHLL PolicyGuard on-chain enforcement.

import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { jsonSchema } from 'ai'
import { config, validateConfig } from './config.js'
import { createWdkClient, createShllClient, callTool } from './mcp-clients.js'
import { SYSTEM_PROMPT } from './prompts.js'
import { registerSafeTools } from './safe-tools.js'

// WDK write tools that must be FILTERED to prevent PolicyGuard bypass
export const WDK_BLOCKED_TOOLS = new Set([
  'swap',          // direct DEX swap — bypasses PolicyGuard
  'transfer',      // direct ERC20 transfer — bypasses PolicyGuard
  'sendTransaction', // direct native transfer — bypasses PolicyGuard
  'bridge',        // cross-chain bridge — not policy-guarded
  'callContract',  // raw contract calls must stay behind safe_* wrappers
  'sign',          // arbitrary signing is outside SafeAgent's trust boundary
])

export const SHLL_BLOCKED_TOOLS = new Set([
  'swap',
  'lend',
  'redeem',
  'transfer',
  'wrap',
  'unwrap',
  'config',
  'execute_calldata',
  'execute_calldata_batch',
  'four_buy',
  'four_sell',
])

/**
 * Convert MCP tool definitions to Vercel AI SDK tool format.
 * MCP returns JSON Schema objects; Vercel AI SDK requires jsonSchema() wrapper.
 *
 * @param {Array} mcpTools - MCP tool definitions
 * @param {object} mcpClient - MCP client instance
 * @param {string} prefix - Tool name prefix (e.g., 'wdk', 'shll')
 * @param {Set} blockedTools - Tool names to filter out
 */
export function mcpToolsToAiTools (mcpTools, mcpClient, prefix = '', blockedTools = new Set()) {
  const tools = {}

  for (const tool of mcpTools) {
    // Skip blocked tools (dangerous write operations that bypass PolicyGuard)
    if (blockedTools.has(tool.name)) {
      console.log(`  ⛔ ${prefix}_${tool.name} — BLOCKED (bypasses PolicyGuard)`)
      continue
    }

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
 *
 * Execution architecture (B Scheme):
 *   - WDK: wallet (signing, gas) + read-only tools + callContract
 *   - SHLL: on-chain policy reads + status
 *   - safe_swap: orchestrates WDK → AgentNFA.execute() → PolicyGuard → DEX
 */
export async function runAgent (userPrompt, options = {}) {
  validateConfig()

  console.log('\n╔══════════════════════════════════════════════════════╗')
  console.log('║        SafeAgent — Autonomous DeFi Agent              ║')
  console.log('║   WDK Wallet + SHLL On-Chain Safety + AI Reasoning    ║')
  console.log('║                                                        ║')
  console.log('║   Architecture: WDK → AgentNFA → PolicyGuard → DEX    ║')
  console.log('╚══════════════════════════════════════════════════════╝\n')

  // Step 1: Connect to MCP servers
  console.log('[1/4] Connecting to MCP servers...')
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

  // Step 2: Collect tools from both servers (with write-tool filtering)
  console.log('\n[2/4] Registering tools...')
  const tools = {}

  if (wdkClient) {
    try {
      const wdkToolList = await wdkClient.listTools()
      // Filter out dangerous write tools that bypass PolicyGuard
      const wdkTools = mcpToolsToAiTools(wdkToolList.tools, wdkClient, 'wdk', WDK_BLOCKED_TOOLS)
      Object.assign(tools, wdkTools)
      console.log(`  WDK: ${Object.keys(wdkTools).length} tools registered (${WDK_BLOCKED_TOOLS.size} blocked)`)
    } catch (e) {
      console.error('  WDK tool registration failed:', e.message)
    }
  }

  if (shllClient) {
    try {
      const shllToolList = await shllClient.listTools()
      const shllTools = mcpToolsToAiTools(shllToolList.tools, shllClient, 'shll', SHLL_BLOCKED_TOOLS)
      Object.assign(tools, shllTools)
      console.log(`  SHLL: ${Object.keys(shllTools).length} tools registered (${SHLL_BLOCKED_TOOLS.size} blocked)`)
    } catch (e) {
      console.error('  SHLL tool registration failed:', e.message)
    }
  }

  // Step 3: Register safe_* tools (route writes through PolicyGuard)
  console.log('\n[3/4] Registering safe tools (PolicyGuard-enforced)...')
  if (wdkClient) {
    registerSafeTools(tools, wdkClient, shllClient, callTool)
  } else {
    console.log('  ⚠️  WDK not available — safe tools disabled')
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

  // Step 4: Run AI agent loop
  console.log('\n[4/4] Running agent...')
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
