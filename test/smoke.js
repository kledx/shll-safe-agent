// Smoke Test: Verify MCP servers start and tools are registered
// Run: node test/smoke.js
// Requires: WDK_SEED env var (can use test mnemonic)

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEST_SEED = 'test test test test test test test test test test test junk'

let passed = 0
let failed = 0

function ok (label) {
  passed++
  console.log(`  ✅ ${label}`)
}

function fail (label, err) {
  failed++
  console.error(`  ❌ ${label}: ${err}`)
}

// ─── Test 1: WDK MCP Server ───
async function testWdkServer () {
  console.log('\n═══ Test 1: WDK MCP Server ═══')

  const serverPath = path.resolve(__dirname, '..', 'src', 'wdk-bsc-server', 'index.js')
  console.log(`  Server path: ${serverPath}`)

  let client
  try {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [serverPath],
      env: {
        PATH: process.env.PATH,
        WDK_SEED: process.env.WDK_SEED || TEST_SEED,
        BSC_RPC: 'https://bsc-dataseed1.binance.org',
        WDK_TOOLKIT_ROOT: path.resolve(__dirname, '..', '..', 'wdk-mcp-toolkit'),
      },
    })

    client = new Client({ name: 'test-wdk', version: '1.0.0' })
    await client.connect(transport)
    ok('WDK server connected')

    const tools = await client.listTools()
    ok(`WDK tools registered: ${tools.tools.length}`)

    // Show tool names
    const toolNames = tools.tools.map(t => t.name)
    console.log(`  Tools: ${toolNames.join(', ')}`)

    if (toolNames.includes('callContract')) {
      ok("Tool 'callContract' available")
    } else {
      fail("Tool 'callContract' missing", 'safe_swap requires custom WDK contract-call support')
    }

    // Test getAddress
    const addrResult = await client.callTool({ name: 'getAddress', arguments: { chain: 'bnb' } })
    const addrText = addrResult.content?.[0]?.text || ''
    if (addrText.includes('0x')) {
      ok(`getAddress: ${addrText.slice(0, 80)}`)
    } else {
      fail('getAddress', 'No address returned')
    }

    // Test getBalance
    const balResult = await client.callTool({ name: 'getBalance', arguments: { chain: 'bnb' } })
    const balText = balResult.content?.[0]?.text || ''
    ok(`getBalance: ${balText.slice(0, 80)}`)

    await client.close()
    ok('WDK server shutdown clean')
  } catch (e) {
    fail('WDK server', e.message)
    if (client) try { await client.close() } catch (_) {}
  }
}

// ─── Test 2: SHLL MCP Server ───
async function testShllServer () {
  console.log('\n═══ Test 2: SHLL MCP Server ═══')

  if (!process.env.RUNNER_PRIVATE_KEY) {
    console.log('  ⏭️  Skipped (no RUNNER_PRIVATE_KEY)')
    return
  }

  let client
  try {
    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', 'shll-mcp'],
      env: {
        PATH: process.env.PATH,
        NODE_PATH: process.env.NODE_PATH || '',
        RUNNER_PRIVATE_KEY: process.env.RUNNER_PRIVATE_KEY,
      },
    })

    client = new Client({ name: 'test-shll', version: '1.0.0' })
    await client.connect(transport)
    ok('SHLL server connected')

    const tools = await client.listTools()
    ok(`SHLL tools registered: ${tools.tools.length}`)

    const toolNames = tools.tools.map(t => t.name)
    console.log(`  Tools: ${toolNames.join(', ')}`)

    // Verify critical tools exist
    const expected = ['policies', 'status', 'portfolio', 'swap', 'lend']
    for (const name of expected) {
      if (toolNames.includes(name)) {
        ok(`Tool '${name}' available`)
      } else {
        fail(`Tool '${name}' missing`, 'not in tool list')
      }
    }

    await client.close()
    ok('SHLL server shutdown clean')
  } catch (e) {
    fail('SHLL server', e.message)
    if (client) try { await client.close() } catch (_) {}
  }
}

// ─── Run ───
async function main () {
  console.log('╔═══════════════════════════════════╗')
  console.log('║    SafeAgent Smoke Test            ║')
  console.log('╚═══════════════════════════════════╝')

  await testWdkServer()
  await testShllServer()

  console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
