// Local WDK custom tool — versioned with SafeAgent instead of depending on an unpublished sibling patch.
'use strict'

import { z } from 'zod'

export function callContract (server) {
  const chains = server.getChains()

  if (chains.length === 0) return

  server.registerTool(
    'callContract',
    {
      title: 'Call Smart Contract',
      description: `Send a raw smart contract call with calldata.

This tool is used internally by SafeAgent to route transactions through
SHLL AgentNFA.execute(), which enforces on-chain PolicyGuard validation.

Args:
  - chain (REQUIRED): blockchain name (e.g. "bnb")
  - to (REQUIRED): target contract address
  - data (REQUIRED): encoded calldata
  - value (OPTIONAL): native token amount in wei`,
      inputSchema: z.object({
        chain: z.enum(chains).describe('The blockchain to send on'),
        to: z.string().describe('The target contract address (0x...)'),
        data: z.string().describe('Hex-encoded calldata to send'),
        value: z.string().optional().default('0').describe('Native token amount in wei'),
      }),
      outputSchema: z.object({
        success: z.boolean().describe('Whether the call succeeded'),
        hash: z.string().describe('Transaction hash'),
        fee: z.string().describe('Actual transaction fee paid in wei'),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ chain, to, data, value }) => {
      try {
        const weiValue = BigInt(value || '0')
        const account = await server.wdk.getAccount(chain, 0)
        const tx = { to, data, value: weiValue }
        const quote = await account.quoteSendTransaction(tx)

        const confirmationMessage = `⚠️  CONTRACT CALL CONFIRMATION REQUIRED

Target: ${to}
Data: ${data.slice(0, 20)}...${data.slice(-8)} (${data.length} chars)
Value: ${weiValue.toString()} wei
Estimated Fee: ${quote.fee.toString()} wei

This contract call is irreversible once broadcast. If it targets AgentNFA.execute(),
PolicyGuard will validate the action on-chain before execution.

Do you want to proceed?`

        const result = await server.server.elicitInput({
          mode: 'form',
          message: confirmationMessage,
          requestedSchema: {
            type: 'object',
            properties: {
              confirmed: {
                type: 'boolean',
                title: 'Confirm Contract Call',
                description: 'Check to confirm and send the contract call',
              },
            },
            required: ['confirmed'],
          },
        })

        if (result.action !== 'accept' || !result.content?.confirmed) {
          return {
            content: [{ type: 'text', text: 'Call cancelled by user. No funds were spent.' }],
          }
        }

        const txResult = await account.sendTransaction(tx)

        return {
          content: [{ type: 'text', text: `Contract call executed! Hash: ${txResult.hash} Fee: ${txResult.fee.toString()}` }],
          structuredContent: {
            success: true,
            hash: txResult.hash,
            fee: txResult.fee.toString(),
          },
        }
      } catch (error) {
        const message = error.message || String(error)
        const isRevert = message.includes('revert') || message.includes('CALL_EXCEPTION')

        return {
          isError: true,
          content: [{
            type: 'text',
            text: isRevert
              ? `Contract call REVERTED: ${message}\nThis may be a PolicyGuard rejection — the on-chain safety policy blocked this action.`
              : `Error executing contract call on ${chain}: ${message}`,
          }],
        }
      }
    }
  )
}
