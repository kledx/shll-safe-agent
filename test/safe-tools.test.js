import test from 'node:test'
import assert from 'node:assert/strict'
import { Interface, parseUnits } from 'ethers'
import { AGENT_NFA_ABI, config, CONTRACTS, VENUS_VTOKENS } from '../src/config.js'
import { mcpToolsToAiTools, SHLL_BLOCKED_TOOLS, WDK_BLOCKED_TOOLS } from '../src/orchestrator.js'
import {
  buildSafeLendPlan,
  buildSafeRedeemPlan,
  buildSafeSwapPlan,
  buildSafeTransferPlan,
  parseMcpJson,
  registerSafeTools,
  resolveToken,
} from '../src/safe-tools.js'

const EXECUTE_IFACE = new Interface(AGENT_NFA_ABI)

test('resolveToken maps supported symbols', () => {
  assert.equal(resolveToken('bnb').address, resolveToken('WBNB').address)
  assert.equal(resolveToken('usdt').decimals, 18)
  assert.equal(resolveToken('unknown'), null)
})

test('parseMcpJson parses structured content first', () => {
  const payload = parseMcpJson({ structuredContent: { ok: true } })
  assert.deepEqual(payload, { ok: true })
})

test('parseMcpJson parses JSON text content', () => {
  const payload = parseMcpJson({
    content: [{ type: 'text', text: '{"vault":{"address":"0x123"}}' }],
  })
  assert.equal(payload.vault.address, '0x123')
})

test('buildSafeSwapPlan encodes BNB->USDT through AgentNFA.execute with zero outer tx value', () => {
  const plan = buildSafeSwapPlan({
    tokenId: '20',
    vault: '0x1111111111111111111111111111111111111111',
    tokenIn: 'BNB',
    tokenOut: 'USDT',
    amount: '0.01',
    quote: { tokenOutAmount: '6.2' },
    slippage: 1,
  })

  assert.equal(plan.actions.length, 1)
  assert.equal(plan.wdkCall.value, '0')
  assert.equal(plan.actions[0].value, parseUnits('0.01', 18))

  const decoded = EXECUTE_IFACE.decodeFunctionData('execute', plan.wdkCall.data)
  assert.equal(decoded[0], 20n)
  assert.equal(decoded[1].value, parseUnits('0.01', 18))
})

test('buildSafeSwapPlan encodes USDT->BNB as approve + executeBatch', () => {
  const plan = buildSafeSwapPlan({
    tokenId: '21',
    vault: '0x1111111111111111111111111111111111111111',
    tokenIn: 'USDT',
    tokenOut: 'BNB',
    amount: '5',
    quote: { tokenOutAmount: '0.008' },
    slippage: 1,
  })

  assert.equal(plan.actions.length, 2)
  assert.equal(plan.wdkCall.value, '0')

  const decoded = EXECUTE_IFACE.decodeFunctionData('executeBatch', plan.wdkCall.data)
  assert.equal(decoded[0], 21n)
  assert.equal(decoded[1].length, 2)
})

test('buildSafeSwapPlan rejects same-token swaps', () => {
  assert.throws(() => buildSafeSwapPlan({
    tokenId: '22',
    vault: '0x1111111111111111111111111111111111111111',
    tokenIn: 'USDT',
    tokenOut: 'USDT',
    amount: '5',
    quote: { tokenOutAmount: '5' },
    slippage: 1,
  }), /must be different/)
})

test('buildSafeSwapPlan rejects invalid slippage', () => {
  assert.throws(() => buildSafeSwapPlan({
    tokenId: '23',
    vault: '0x1111111111111111111111111111111111111111',
    tokenIn: 'USDT',
    tokenOut: 'BNB',
    amount: '5',
    quote: { tokenOutAmount: '0.008' },
    slippage: 60,
  }), /slippage/)
})

test('buildSafeTransferPlan encodes native BNB transfer through AgentNFA.execute', () => {
  const recipient = '0x4444444444444444444444444444444444444444'
  const plan = buildSafeTransferPlan({
    tokenId: '30',
    token: 'BNB',
    to: recipient,
    amount: '0.02',
  })

  assert.equal(plan.actions.length, 1)
  assert.equal(plan.wdkCall.value, '0')

  const decoded = EXECUTE_IFACE.decodeFunctionData('execute', plan.wdkCall.data)
  assert.equal(decoded[0], 30n)
  assert.equal(decoded[1].target, recipient)
  assert.equal(decoded[1].value, parseUnits('0.02', 18))
  assert.equal(decoded[1].data, '0x')
})

test('buildSafeTransferPlan encodes ERC20 transfer through AgentNFA.execute', () => {
  const recipient = '0x5555555555555555555555555555555555555555'
  const plan = buildSafeTransferPlan({
    tokenId: '31',
    token: 'USDT',
    to: recipient,
    amount: '15',
  })

  const decoded = EXECUTE_IFACE.decodeFunctionData('execute', plan.wdkCall.data)
  assert.equal(decoded[0], 31n)
  assert.equal(decoded[1].target, CONTRACTS.USDT)
  assert.equal(decoded[1].value, 0n)
  assert.match(decoded[1].data, /^0xa9059cbb/i)
})

test('buildSafeTransferPlan rejects invalid recipient', () => {
  assert.throws(() => buildSafeTransferPlan({
    tokenId: '32',
    token: 'USDT',
    to: 'not-an-address',
    amount: '1',
  }), /Invalid recipient/)
})

test('buildSafeLendPlan encodes BNB supply through vBNB mint', () => {
  const plan = buildSafeLendPlan({
    tokenId: '40',
    token: 'BNB',
    amount: '0.5',
  })

  assert.equal(plan.actions.length, 1)
  assert.equal(plan.vTokenAddress, VENUS_VTOKENS.BNB)
  assert.equal(plan.actions[0].target, VENUS_VTOKENS.BNB)
  assert.equal(plan.actions[0].value, parseUnits('0.5', 18))
  assert.equal(plan.wdkCall.value, '0')

  const decoded = EXECUTE_IFACE.decodeFunctionData('execute', plan.wdkCall.data)
  assert.equal(decoded[0], 40n)
  assert.equal(decoded[1].target, VENUS_VTOKENS.BNB)
})

test('buildSafeLendPlan encodes USDT approve + mint batch', () => {
  const plan = buildSafeLendPlan({
    tokenId: '41',
    token: 'USDT',
    amount: '50',
  })

  assert.equal(plan.actions.length, 2)
  assert.equal(plan.vTokenAddress, VENUS_VTOKENS.USDT)

  const decoded = EXECUTE_IFACE.decodeFunctionData('executeBatch', plan.wdkCall.data)
  assert.equal(decoded[0], 41n)
  assert.equal(decoded[1].length, 2)
  assert.equal(decoded[1][0].target, CONTRACTS.USDT)
  assert.equal(decoded[1][1].target, VENUS_VTOKENS.USDT)
})

test('buildSafeLendPlan rejects unsupported token', () => {
  assert.throws(() => buildSafeLendPlan({
    tokenId: '42',
    token: 'ETH',
    amount: '1',
  }), /not supported/)
})

test('buildSafeRedeemPlan encodes redeemUnderlying through AgentNFA.execute', () => {
  const plan = buildSafeRedeemPlan({
    tokenId: '43',
    token: 'USDT',
    amount: '25',
  })

  assert.equal(plan.actions.length, 1)
  assert.equal(plan.vTokenAddress, VENUS_VTOKENS.USDT)
  assert.equal(plan.wdkCall.value, '0')

  const decoded = EXECUTE_IFACE.decodeFunctionData('execute', plan.wdkCall.data)
  assert.equal(decoded[0], 43n)
  assert.equal(decoded[1].target, VENUS_VTOKENS.USDT)
  assert.equal(decoded[1].value, 0n)
  assert.match(decoded[1].data, /^0x852a12e3/i)
})

test('buildSafeRedeemPlan rejects unsupported token', () => {
  assert.throws(() => buildSafeRedeemPlan({
    tokenId: '44',
    token: 'ETH',
    amount: '1',
  }), /not supported/)
})

test('mcpToolsToAiTools filters blocked WDK write tools', () => {
  const tools = mcpToolsToAiTools([
    { name: 'getBalance', description: 'balance', inputSchema: { type: 'object', properties: {} } },
    { name: 'callContract', description: 'raw write', inputSchema: { type: 'object', properties: {} } },
    { name: 'swap', description: 'swap', inputSchema: { type: 'object', properties: {} } },
  ], {}, 'wdk', WDK_BLOCKED_TOOLS)

  assert.ok(tools.wdk_getBalance)
  assert.equal(tools.wdk_callContract, undefined)
  assert.equal(tools.wdk_swap, undefined)
})

test('mcpToolsToAiTools filters SHLL write tools while keeping read tools', () => {
  const tools = mcpToolsToAiTools([
    { name: 'policies', description: 'read', inputSchema: { type: 'object', properties: {} } },
    { name: 'status', description: 'read', inputSchema: { type: 'object', properties: {} } },
    { name: 'execute_calldata', description: 'write', inputSchema: { type: 'object', properties: {} } },
    { name: 'swap', description: 'write', inputSchema: { type: 'object', properties: {} } },
  ], {}, 'shll', SHLL_BLOCKED_TOOLS)

  assert.ok(tools.shll_policies)
  assert.ok(tools.shll_status)
  assert.equal(tools.shll_execute_calldata, undefined)
  assert.equal(tools.shll_swap, undefined)
})

test('registerSafeTools exposes safe_redeem alongside other safe tools', () => {
  const tools = {}
  registerSafeTools(tools, { kind: 'wdk' }, { kind: 'shll' }, async () => { throw new Error('unused') })
  assert.ok(tools.safe_swap)
  assert.ok(tools.safe_transfer)
  assert.ok(tools.safe_lend)
  assert.ok(tools.safe_redeem)
})

test('safe_swap rejects signer mismatch before sending a write', async () => {
  const tools = {}

  const wdkClient = { kind: 'wdk' }
  const shllClient = { kind: 'shll' }

  const callTool = async (client, toolName) => {
    if (client.kind === 'wdk' && toolName === 'getAddress') {
      return { content: [{ type: 'text', text: 'Address: 0x1111111111111111111111111111111111111111' }] }
    }

    if (client.kind === 'shll' && toolName === 'status') {
      return {
        structuredContent: {
          vault: { address: '0x2222222222222222222222222222222222222222' },
          readiness: { canExecuteWrites: true },
          operator: {
            onChainOperator: '0x3333333333333333333333333333333333333333',
            sessionWallet: '0x3333333333333333333333333333333333333333',
          },
        },
      }
    }

    throw new Error(`Unexpected tool call: ${client.kind}.${toolName}`)
  }

  const previousTokenId = config.shllTokenId
  config.shllTokenId = '20'

  try {
    registerSafeTools(tools, wdkClient, shllClient, callTool)
    const result = await tools.safe_swap.execute({ tokenIn: 'BNB', tokenOut: 'USDT', amount: '0.01' })
    assert.match(result, /authorized on-chain operator/i)
  } finally {
    config.shllTokenId = previousTokenId
  }
})
