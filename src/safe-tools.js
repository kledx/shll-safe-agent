// SafeAgent Safe Tools - high-level write actions routed through AgentNFA / PolicyGuard
// Execution path:
//   WDK wallet (sign + gas) -> AgentNFA.execute / executeBatch -> PolicyGuard -> AgentAccount -> target protocol / recipient

import { Interface, isAddress, parseUnits } from 'ethers'
import {
  AGENT_NFA_ABI,
  config,
  CONTRACTS,
  PANCAKE_V2_ABI,
  TOKEN_META,
  VBNB_MINT_ABI,
  VENUS_VTOKENS,
  VTOKEN_ABI,
} from './config.js'

const routerInterface = new Interface(PANCAKE_V2_ABI)
const agentNfaInterface = new Interface(AGENT_NFA_ABI)
const erc20Interface = new Interface([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address recipient, uint256 amount) returns (bool)',
])
const vTokenInterface = new Interface(VTOKEN_ABI)
const vBnbMintInterface = new Interface(VBNB_MINT_ABI)

function normalizeSymbol (symbol) {
  return symbol?.trim().toUpperCase()
}

function buildExecuteCalldata (tokenId, actions) {
  return actions.length === 1
    ? agentNfaInterface.encodeFunctionData('execute', [BigInt(tokenId), actions[0]])
    : agentNfaInterface.encodeFunctionData('executeBatch', [BigInt(tokenId), actions])
}

function buildWdkCall (tokenId, actions) {
  return {
    chain: 'bnb',
    to: CONTRACTS.AgentNFA,
    data: buildExecuteCalldata(tokenId, actions),
    value: '0',
  }
}

function ensurePositiveAmount (amountWei, label) {
  if (amountWei <= 0n) {
    throw new Error(`${label} must be greater than 0`)
  }
}

export function resolveToken (symbol) {
  return TOKEN_META[normalizeSymbol(symbol)] || null
}

export function getQuoteSymbol (symbol) {
  const token = resolveToken(symbol)
  return token?.quoteSymbol || null
}

export function extractToolText (result) {
  return result?.content?.map(item => item.text || JSON.stringify(item)).join('\n') || ''
}

export function parseMcpJson (result) {
  if (result?.structuredContent) return result.structuredContent

  const text = extractToolText(result).trim()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1))
    }
    throw new Error(`Expected JSON payload, got: ${text.slice(0, 160)}`)
  }
}

function quoteAmountOutMin (quotedOutAmount, decimals, slippagePercent) {
  const quotedOutWei = parseUnits(quotedOutAmount, decimals)
  const slippageBps = BigInt(Math.round(Number(slippagePercent) * 100))
  const safeBps = slippageBps > 5000n ? 5000n : slippageBps
  return (quotedOutWei * (10000n - safeBps)) / 10000n
}

function encodeApprove (tokenAddress, spender, amountInWei) {
  return {
    target: tokenAddress,
    value: 0n,
    data: erc20Interface.encodeFunctionData('approve', [spender, amountInWei]),
  }
}

function encodeSwapAction ({ tokenIn, tokenOut, amountInWei, amountOutMinWei, vault, deadline }) {
  const isBnbIn = normalizeSymbol(tokenIn) === 'BNB'
  const isBnbOut = normalizeSymbol(tokenOut) === 'BNB'
  const tokenInMeta = resolveToken(tokenIn)
  const tokenOutMeta = resolveToken(tokenOut)

  if (!tokenInMeta || !tokenOutMeta) {
    throw new Error(`Unsupported pair: ${tokenIn} -> ${tokenOut}`)
  }

  if (isBnbIn) {
    return {
      target: CONTRACTS.PancakeRouterV2,
      value: amountInWei,
      data: routerInterface.encodeFunctionData('swapExactETHForTokens', [
        amountOutMinWei,
        [CONTRACTS.WBNB, tokenOutMeta.address],
        vault,
        deadline,
      ]),
    }
  }

  if (isBnbOut) {
    return {
      target: CONTRACTS.PancakeRouterV2,
      value: 0n,
      data: routerInterface.encodeFunctionData('swapExactTokensForETH', [
        amountInWei,
        amountOutMinWei,
        [tokenInMeta.address, CONTRACTS.WBNB],
        vault,
        deadline,
      ]),
    }
  }

  return {
    target: CONTRACTS.PancakeRouterV2,
    value: 0n,
    data: routerInterface.encodeFunctionData('swapExactTokensForTokens', [
      amountInWei,
      amountOutMinWei,
      [tokenInMeta.address, tokenOutMeta.address],
      vault,
      deadline,
    ]),
  }
}

export function buildSafeSwapPlan ({ tokenId, vault, tokenIn, tokenOut, amount, quote, slippage = 1 }) {
  if (normalizeSymbol(tokenIn) === normalizeSymbol(tokenOut)) {
    throw new Error('tokenIn and tokenOut must be different')
  }

  if (Number(slippage) < 0 || Number(slippage) > 50) {
    throw new Error('slippage must be between 0 and 50 percent')
  }

  const tokenInMeta = resolveToken(tokenIn)
  const tokenOutMeta = resolveToken(tokenOut)

  if (!tokenInMeta || !tokenOutMeta) {
    throw new Error(`Unsupported token pair: ${tokenIn} -> ${tokenOut}`)
  }

  const amountInWei = parseUnits(amount, tokenInMeta.decimals)
  ensurePositiveAmount(amountInWei, 'amount')

  const amountOutMinWei = quoteAmountOutMin(quote.tokenOutAmount, tokenOutMeta.decimals, slippage)
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300)
  const isBnbIn = normalizeSymbol(tokenIn) === 'BNB'

  const actions = []

  if (!isBnbIn) {
    actions.push(encodeApprove(tokenInMeta.address, CONTRACTS.PancakeRouterV2, amountInWei))
  }

  actions.push(encodeSwapAction({ tokenIn, tokenOut, amountInWei, amountOutMinWei, vault, deadline }))

  return {
    amountInWei,
    amountOutMinWei,
    actions,
    wdkCall: buildWdkCall(tokenId, actions),
  }
}

export function buildSafeTransferPlan ({ tokenId, token, to, amount }) {
  const tokenMeta = resolveToken(token)

  if (!tokenMeta) {
    throw new Error(`Unsupported token for transfer: ${token}`)
  }

  if (!isAddress(to)) {
    throw new Error(`Invalid recipient address: ${to}`)
  }

  const amountWei = parseUnits(amount, tokenMeta.decimals)
  ensurePositiveAmount(amountWei, 'amount')

  const action = normalizeSymbol(token) === 'BNB'
    ? {
        target: to,
        value: amountWei,
        data: '0x',
      }
    : {
        target: tokenMeta.address,
        value: 0n,
        data: erc20Interface.encodeFunctionData('transfer', [to, amountWei]),
      }

  return {
    amountWei,
    actions: [action],
    wdkCall: buildWdkCall(tokenId, [action]),
  }
}

export function buildSafeLendPlan ({ tokenId, token, amount }) {
  const upper = normalizeSymbol(token)
  const tokenMeta = resolveToken(upper)
  const vTokenAddress = VENUS_VTOKENS[upper]

  if (!tokenMeta || !vTokenAddress) {
    throw new Error(`Venus lending not supported for ${upper}`)
  }

  const amountWei = parseUnits(amount, tokenMeta.decimals)
  ensurePositiveAmount(amountWei, 'amount')

  const actions = upper === 'BNB'
    ? [{
        target: vTokenAddress,
        value: amountWei,
        data: vBnbMintInterface.encodeFunctionData('mint', []),
      }]
    : [
        encodeApprove(tokenMeta.address, vTokenAddress, amountWei),
        {
          target: vTokenAddress,
          value: 0n,
          data: vTokenInterface.encodeFunctionData('mint', [amountWei]),
        },
      ]

  return {
    amountWei,
    vTokenAddress,
    actions,
    wdkCall: buildWdkCall(tokenId, actions),
  }
}
export function buildSafeRedeemPlan ({ tokenId, token, amount }) {
  const upper = normalizeSymbol(token)
  const tokenMeta = resolveToken(upper)
  const vTokenAddress = VENUS_VTOKENS[upper]

  if (!tokenMeta || !vTokenAddress) {
    throw new Error(`Venus redemption not supported for ${upper}`)
  }

  const amountWei = parseUnits(amount, tokenMeta.decimals)
  ensurePositiveAmount(amountWei, 'amount')

  const action = {
    target: vTokenAddress,
    value: 0n,
    data: vTokenInterface.encodeFunctionData('redeemUnderlying', [amountWei]),
  }

  return {
    amountWei,
    vTokenAddress,
    actions: [action],
    wdkCall: buildWdkCall(tokenId, [action]),
  }
}

async function getVaultStatus (shllClient, callTool, tokenId) {
  const result = await callTool(shllClient, 'status', { token_id: tokenId })
  const payload = parseMcpJson(result)

  if (!payload?.vault?.address) {
    throw new Error('SHLL status did not return a vault address')
  }

  return payload
}

async function getWdkAddress (wdkClient, callTool) {
  const result = await callTool(wdkClient, 'getAddress', { chain: 'bnb' })
  const text = extractToolText(result)
  const match = text.match(/0x[a-fA-F0-9]{40}/)

  if (!match) {
    throw new Error(`Could not determine WDK wallet address from getAddress: ${text.slice(0, 160)}`)
  }

  return match[0]
}

function ensureSignerAlignment (wdkAddress, status) {
  const actual = wdkAddress.toLowerCase()
  const expectedOperator = status?.operator?.onChainOperator?.toLowerCase()
  const sessionWallet = status?.operator?.sessionWallet?.toLowerCase() || null

  if (expectedOperator && expectedOperator !== actual) {
    throw new Error(`WDK wallet ${wdkAddress} is not the authorized on-chain operator ${status.operator.onChainOperator}`)
  }

  if (sessionWallet && sessionWallet !== actual) {
    throw new Error(`SHLL status was evaluated with session wallet ${status.operator.sessionWallet}, but WDK will sign with ${wdkAddress}`)
  }
}

async function getPoliciesSummary (shllClient, callTool, tokenId) {
  const result = await callTool(shllClient, 'policies', { token_id: tokenId })
  return parseMcpJson(result)
}

async function getLendingInfo (shllClient, callTool, tokenId) {
  const result = await callTool(shllClient, 'lending_info', { token_id: tokenId })
  if (result?.isError) return null
  return parseMcpJson(result)
}

async function getSwapQuote (wdkClient, callTool, tokenIn, tokenOut, amount) {
  const result = await callTool(wdkClient, 'quoteSwap', {
    chain: 'bnb',
    tokenIn: getQuoteSymbol(tokenIn),
    tokenOut: getQuoteSymbol(tokenOut),
    amount,
    side: 'sell',
  })

  if (result?.isError) {
    throw new Error(extractToolText(result) || 'WDK quoteSwap failed')
  }

  const payload = parseMcpJson(result)

  if (!payload?.tokenOutAmount) {
    throw new Error('WDK quoteSwap did not return tokenOutAmount')
  }

  return payload
}

async function verifyVaultBalance (shllClient, callTool, tokenId, token) {
  const verifyToken = normalizeSymbol(token) === 'BNB' ? 'BNB' : normalizeSymbol(token)
  const result = await callTool(shllClient, 'balance', {
    token_id: tokenId,
    token: verifyToken,
  })

  if (result?.isError) return null
  return parseMcpJson(result)
}

function formatPolicyContext (policies) {
  if (!policies?.summary) return 'Policy summary unavailable.'
  return `Policy summary: ${policies.summary}`
}

async function getExecutionContext (wdkClient, shllClient, callTool, actionName) {
  const tokenId = config.shllTokenId

  if (!tokenId) {
    throw new Error(`SHLL_TOKEN_ID is required for ${actionName}.`)
  }

  if (!wdkClient || !shllClient) {
    throw new Error(`${actionName} requires both WDK and SHLL MCP connections.`)
  }

  const wdkAddress = await getWdkAddress(wdkClient, callTool)
  const status = await getVaultStatus(shllClient, callTool, tokenId)
  ensureSignerAlignment(wdkAddress, status)

  if (!status.readiness?.canExecuteWrites) {
    throw new Error(`Agent is not ready for writes. ${status.readiness?.summary || ''}`.trim())
  }

  const policies = await getPoliciesSummary(shllClient, callTool, tokenId)
  return { tokenId, wdkAddress, status, policies }
}

function blockedPolicyMessage (policies, txText) {
  return [
    '? **Blocked by on-chain PolicyGuard**',
    '',
    formatPolicyContext(policies),
    `Reason: ${txText || 'Unknown revert'}`,
    `PolicyGuard: https://bscscan.com/address/${CONTRACTS.PolicyGuardV4}`,
  ].join('\n')
}

async function sendPolicyGuardTransaction (wdkClient, callTool, plan, policies) {
  const txResult = await callTool(wdkClient, 'callContract', plan.wdkCall)
  const txText = extractToolText(txResult)

  if (txResult?.isError || /revert|reverted/i.test(txText)) {
    return {
      ok: false,
      text: blockedPolicyMessage(policies, txText),
    }
  }

  return {
    ok: true,
    txText,
  }
}

export function registerSafeTools (tools, wdkClient, shllClient, callTool) {
  tools.safe_swap = {
    description: `[SAFE] Execute a swap through SHLL PolicyGuard using AgentNFA.execute().
Routes writes through the on-chain safety boundary instead of direct WDK swap tools.

Flow:
  1. Read SHLL readiness + vault
  2. Quote through WDK
  3. Build AgentNFA.execute / executeBatch calldata
  4. Send via WDK callContract
  5. Verify vault balance through SHLL`,
    parameters: {
      type: 'object',
      properties: {
        tokenIn: { type: 'string', description: 'Token to sell (BNB, USDT, USDC, ETH, BTCB)' },
        tokenOut: { type: 'string', description: 'Token to buy (BNB, USDT, USDC, ETH, BTCB)' },
        amount: { type: 'string', description: 'Sell amount in human-readable units' },
        slippage: { type: 'number', description: 'Slippage tolerance percent', default: 1 },
      },
      required: ['tokenIn', 'tokenOut', 'amount'],
    },
    execute: async ({ tokenIn, tokenOut, amount, slippage = 1 }) => {
      try {
        const tokenInMeta = resolveToken(tokenIn)
        const tokenOutMeta = resolveToken(tokenOut)
        if (!tokenInMeta || !tokenOutMeta) {
          return `Error: Unsupported pair ${tokenIn} -> ${tokenOut}. Supported tokens: ${Object.keys(TOKEN_META).join(', ')}`
        }

        if (normalizeSymbol(tokenIn) === normalizeSymbol(tokenOut)) {
          return 'Error: tokenIn and tokenOut must be different.'
        }

        const context = await getExecutionContext(wdkClient, shllClient, callTool, 'safe_swap')
        const quote = await getSwapQuote(wdkClient, callTool, tokenIn, tokenOut, amount)
        const plan = buildSafeSwapPlan({
          tokenId: context.tokenId,
          vault: context.status.vault.address,
          tokenIn,
          tokenOut,
          amount,
          quote,
          slippage,
        })

        console.log(`\n  [SAFE_SWAP] ${amount} ${tokenIn} -> ${tokenOut}`)
        console.log(`  [SAFE_SWAP] Vault: ${context.status.vault.address}`)
        console.log(`  [SAFE_SWAP] Actions: ${plan.actions.length}`)

        const submission = await sendPolicyGuardTransaction(wdkClient, callTool, plan, context.policies)
        if (!submission.ok) {
          return submission.text
        }

        const verification = await verifyVaultBalance(shllClient, callTool, context.tokenId, tokenOut)

        return [
          '? **Safe swap executed through SHLL PolicyGuard**',
          '',
          'Route: WDK -> AgentNFA -> PolicyGuard -> PancakeSwap',
          `Signer: ${context.wdkAddress}`,
          `Quoted output: ~${quote.tokenOutAmount} ${normalizeSymbol(tokenOut) === 'BNB' ? 'BNB' : normalizeSymbol(tokenOut)}`,
          `Minimum output: ${plan.amountOutMinWei.toString()} base units`,
          `Transaction: ${submission.txText}`,
          verification ? `Vault verification: ${JSON.stringify(verification)}` : 'Vault verification: unavailable',
        ].join('\n')
      } catch (error) {
        return `Error in safe_swap: ${error.message}`
      }
    },
  }

  tools.safe_transfer = {
    description: `[SAFE] Transfer vault funds through SHLL PolicyGuard using AgentNFA.execute().
Routes transfers through the same on-chain safety boundary used by safe_swap.

Flow:
  1. Read SHLL readiness + operator alignment
  2. Build AgentNFA.execute calldata for native or ERC20 transfer
  3. Send via WDK callContract
  4. Verify updated vault balance through SHLL`,
    parameters: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'Token to transfer (BNB, USDT, USDC, ETH, BTCB)' },
        to: { type: 'string', description: 'Recipient address' },
        amount: { type: 'string', description: 'Transfer amount in human-readable units' },
      },
      required: ['token', 'to', 'amount'],
    },
    execute: async ({ token, to, amount }) => {
      try {
        const tokenMeta = resolveToken(token)
        if (!tokenMeta) {
          return `Error: Unsupported transfer token ${token}. Supported tokens: ${Object.keys(TOKEN_META).join(', ')}`
        }

        const context = await getExecutionContext(wdkClient, shllClient, callTool, 'safe_transfer')
        const plan = buildSafeTransferPlan({
          tokenId: context.tokenId,
          token,
          to,
          amount,
        })

        console.log(`\n  [SAFE_TRANSFER] ${amount} ${token} -> ${to}`)
        console.log(`  [SAFE_TRANSFER] Vault: ${context.status.vault.address}`)

        const submission = await sendPolicyGuardTransaction(wdkClient, callTool, plan, context.policies)
        if (!submission.ok) {
          return submission.text
        }

        const verification = await verifyVaultBalance(shllClient, callTool, context.tokenId, token)

        return [
          '? **Safe transfer executed through SHLL PolicyGuard**',
          '',
          'Route: WDK -> AgentNFA -> PolicyGuard -> AgentAccount transfer',
          `Signer: ${context.wdkAddress}`,
          `Recipient: ${to}`,
          `Amount: ${amount} ${normalizeSymbol(token)}`,
          `Transaction: ${submission.txText}`,
          verification ? `Vault verification: ${JSON.stringify(verification)}` : 'Vault verification: unavailable',
        ].join('\n')
      } catch (error) {
        return `Error in safe_transfer: ${error.message}`
      }
    },
  }

  tools.safe_lend = {
    description: `[SAFE] Supply vault funds to Venus through SHLL PolicyGuard using AgentNFA.execute().
Routes lending through the on-chain safety boundary instead of exposing raw SHLL lend tools.

Flow:
  1. Read SHLL readiness + operator alignment
  2. Build approve + mint actions for Venus vToken (or payable mint for vBNB)
  3. Send via WDK callContract
  4. Verify updated vault balance through SHLL`,
    parameters: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'Token to lend on Venus (BNB, USDT, USDC)' },
        amount: { type: 'string', description: 'Supply amount in human-readable units' },
      },
      required: ['token', 'amount'],
    },
    execute: async ({ token, amount }) => {
      try {
        const upper = normalizeSymbol(token)
        if (!VENUS_VTOKENS[upper]) {
          return `Error: safe_lend currently supports ${Object.keys(VENUS_VTOKENS).join(', ')}.`
        }

        const context = await getExecutionContext(wdkClient, shllClient, callTool, 'safe_lend')
        const lendingInfo = await getLendingInfo(shllClient, callTool, context.tokenId)
        const plan = buildSafeLendPlan({
          tokenId: context.tokenId,
          token: upper,
          amount,
        })

        console.log(`\n  [SAFE_LEND] ${amount} ${upper} -> Venus`)
        console.log(`  [SAFE_LEND] Vault: ${context.status.vault.address}`)
        console.log(`  [SAFE_LEND] vToken: ${plan.vTokenAddress}`)
        console.log(`  [SAFE_LEND] Actions: ${plan.actions.length}`)

        const submission = await sendPolicyGuardTransaction(wdkClient, callTool, plan, context.policies)
        if (!submission.ok) {
          return submission.text
        }

        const verification = await verifyVaultBalance(shllClient, callTool, context.tokenId, upper)
        const lendingSummary = lendingInfo?.[upper] || lendingInfo?.positions?.find?.(item => normalizeSymbol(item?.token) === upper) || null

        return [
          '? **Safe lend executed through SHLL PolicyGuard**',
          '',
          'Route: WDK -> AgentNFA -> PolicyGuard -> Venus',
          `Signer: ${context.wdkAddress}`,
          `Supplied: ${amount} ${upper}`,
          `vToken: ${plan.vTokenAddress}`,
          lendingSummary ? `Lending info: ${JSON.stringify(lendingSummary)}` : 'Lending info: unavailable',
          `Transaction: ${submission.txText}`,
          verification ? `Vault verification: ${JSON.stringify(verification)}` : 'Vault verification: unavailable',
        ].join('\n')
      } catch (error) {
        return `Error in safe_lend: ${error.message}`
      }
    },
  }

  tools.safe_redeem = {
    description: `[SAFE] Redeem supplied assets from Venus through SHLL PolicyGuard using AgentNFA.execute().
Routes redemption through the on-chain safety boundary instead of exposing raw SHLL redeem tools.

Flow:
  1. Read SHLL readiness + operator alignment
  2. Build redeemUnderlying action for the Venus vToken
  3. Send via WDK callContract
  4. Verify updated vault balance through SHLL`,
    parameters: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'Underlying token to redeem from Venus (BNB, USDT, USDC)' },
        amount: { type: 'string', description: 'Redeem amount in human-readable units' },
      },
      required: ['token', 'amount'],
    },
    execute: async ({ token, amount }) => {
      try {
        const upper = normalizeSymbol(token)
        if (!VENUS_VTOKENS[upper]) {
          return `Error: safe_redeem currently supports ${Object.keys(VENUS_VTOKENS).join(', ')}.`
        }

        const context = await getExecutionContext(wdkClient, shllClient, callTool, 'safe_redeem')
        const lendingInfo = await getLendingInfo(shllClient, callTool, context.tokenId)
        const plan = buildSafeRedeemPlan({
          tokenId: context.tokenId,
          token: upper,
          amount,
        })

        console.log(`\n  [SAFE_REDEEM] ${amount} ${upper} <- Venus`)
        console.log(`  [SAFE_REDEEM] Vault: ${context.status.vault.address}`)
        console.log(`  [SAFE_REDEEM] vToken: ${plan.vTokenAddress}`)

        const submission = await sendPolicyGuardTransaction(wdkClient, callTool, plan, context.policies)
        if (!submission.ok) {
          return submission.text
        }

        const verification = await verifyVaultBalance(shllClient, callTool, context.tokenId, upper)
        const lendingSummary = lendingInfo?.[upper] || lendingInfo?.positions?.find?.(item => normalizeSymbol(item?.token) === upper) || null

        return [
          '? **Safe redeem executed through SHLL PolicyGuard**',
          '',
          'Route: WDK -> AgentNFA -> PolicyGuard -> Venus redeemUnderlying',
          `Signer: ${context.wdkAddress}`,
          `Redeemed: ${amount} ${upper}`,
          `vToken: ${plan.vTokenAddress}`,
          lendingSummary ? `Lending info: ${JSON.stringify(lendingSummary)}` : 'Lending info: unavailable',
          `Transaction: ${submission.txText}`,
          verification ? `Vault verification: ${JSON.stringify(verification)}` : 'Vault verification: unavailable',
        ].join('\n')
      } catch (error) {
        return `Error in safe_redeem: ${error.message}`
      }
    },
  }

  console.log('  SAFE: 4 tools registered (safe_swap, safe_transfer, safe_lend, safe_redeem)')
}



