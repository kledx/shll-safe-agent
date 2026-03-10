# SafeAgent - WDK Wallet + SHLL On-Chain Safety

> **Hackathon Entry** - Tether Hackathon Galactica: WDK Edition 1  
> **Track** - Autonomous DeFi Agent  
> **Team** - SHLL Protocol

## What changed

SafeAgent now uses the stronger B-scheme execution path:

`WDK wallet -> AgentNFA.execute() -> SHLL PolicyGuard -> AgentAccount vault -> protocol / receiver`

That means:

- WDK still signs transactions and pays gas
- SHLL still owns the on-chain policy boundary
- direct WDK write tools are blocked from the LLM
- `safe_swap`, `safe_transfer`, `safe_lend`, and `safe_redeem` are the write paths exposed to the model

## Why this matters

The older design relied on the model to read `shll_policies` and then voluntarily avoid unsafe actions.
That is useful, but it is still a soft control.

This version moves the write path behind SHLL's existing on-chain execution boundary:

- `AgentNFA.execute()` validates through `PolicyGuard`
- `AgentAccount` holds the trading funds
- `PolicyGuard.commit()` updates post-trade policy state

If a trade, transfer, lend, or redeem action violates policy, the transaction reverts on-chain.

## Architecture

```text
Read path:
  WDK getBalance / quoteSwap
  SHLL status / policies / portfolio / lending_info

Write path:
  safe_swap
    -> WDK callContract
    -> AgentNFA.execute / executeBatch
    -> PolicyGuard.validate
    -> AgentAccount.executeCall
    -> PancakeSwap
    -> PolicyGuard.commit

  safe_transfer
    -> WDK callContract
    -> AgentNFA.execute
    -> PolicyGuard.validate
    -> AgentAccount.executeCall
    -> recipient / token contract
    -> PolicyGuard.commit

  safe_lend
    -> WDK callContract
    -> AgentNFA.execute / executeBatch
    -> PolicyGuard.validate
    -> AgentAccount.executeCall
    -> Venus vToken mint
    -> PolicyGuard.commit

  safe_redeem
    -> WDK callContract
    -> AgentNFA.execute
    -> PolicyGuard.validate
    -> AgentAccount.executeCall
    -> Venus redeemUnderlying
    -> PolicyGuard.commit
```

## Current write surface

### Allowed
- `safe_swap`
- `safe_transfer`
- `safe_lend`
- `safe_redeem`

### Blocked from the LLM
- `wdk_swap`
- `wdk_transfer`
- `wdk_sendTransaction`
- `wdk_bridge`
- `wdk_callContract`
- `wdk_sign`
- SHLL direct write tools such as `shll_lend`, `shll_redeem`, and `shll_execute_calldata`

## Run

```bash
npm run test:unit
npm run test:smoke
npm run demo:safe-swap
npm run demo:spending-limit
npm run demo:safe-transfer
npm run demo:safe-transfer-rejection
npm run demo:safe-lend
npm run demo:safe-lend-rejection
npm run demo:safe-redeem
npm run demo:safe-redeem-rejection
```

## Demo scenarios

### Success demos
- `demo:safe-swap` - normal swap path through PolicyGuard
- `demo:safe-transfer` - normal vault transfer path through PolicyGuard
- `demo:safe-lend` - normal Venus supply path through PolicyGuard
- `demo:safe-redeem` - normal Venus redeem path through PolicyGuard

### Rejection demos
- `demo:spending-limit` - oversized swap rejected on-chain
- `demo:safe-transfer-rejection` - likely ReceiverGuard-style rejection to an unapproved recipient
- `demo:safe-lend-rejection` - oversized Venus supply intended to trigger policy or execution rejection
- `demo:safe-redeem-rejection` - oversized Venus redeem intended to demonstrate failure classification

## Notes

- For BNB-in swaps, the outer WDK transaction sends **zero** native value to `AgentNFA`
- the swap amount lives inside `Action.value`, which is spent from the SHLL vault
- for ERC20-in swaps, SafeAgent batches `approve + swap` through `executeBatch`
- for BNB transfers, the vault sends native value via `Action.value`
- for ERC20 transfers, the vault calls the token contract's `transfer()` through `execute`
- for Venus lending and redemption, SafeAgent currently supports `BNB`, `USDT`, and `USDC`
- revert handling now distinguishes likely PolicyGuard rejections from generic target-protocol execution failures

## Next step

This repo now implements four B-scheme write paths plus a rejection-demo suite for hackathon recording.
The C-scheme upgrade path (`ERC-4337 / session key / paymaster`) is documented at the Program level and can be layered on top without changing the core SHLL safety boundary.
