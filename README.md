# SafeAgent — Autonomous DeFi Agent with On-Chain Risk Parameters

> **Hackathon Entry** — Tether Hackathon Galactica: WDK Edition 1
> **Track** — Autonomous DeFi Agent
> **Team** — SHLL Protocol

## What is SafeAgent?

SafeAgent is an autonomous DeFi agent on BNB Chain. Unlike typical AI agents that rely on prompt-based safety rules (easily bypassed by prompt injection), SafeAgent reads its risk parameters from **immutable on-chain smart contracts**.

| Component | Technology | Role |
|---|---|---|
| **Wallet + Execution** | [WDK](https://docs.wdk.tether.io/) (Tether) | Non-custodial wallet, swap, transfer, balance |
| **Risk Parameters** | [SHLL](https://shll.run) PolicyGuard | On-chain spending limits, cooldowns (tamper-proof) |
| **Brain** | AI (GPT-4o) via Vercel AI SDK | Autonomous reasoning with MCP tool calling |

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    SafeAgent Orchestrator                      │
│                  (Vercel AI SDK + LLM Brain)                   │
│                                                                │
│  ┌─────────────────────────┐  ┌────────────────────────────┐  │
│  │  WDK MCP Server         │  │  SHLL MCP Server           │  │
│  │  Wallet + Execution     │  │  On-Chain Policy Oracle    │  │
│  │                         │  │                            │  │
│  │  • getAddress            │  │  • policies (read limits)  │  │
│  │  • getBalance            │  │  • status (readiness)      │  │
│  │  • getTokenBalance       │  │  • portfolio (holdings)    │  │
│  │  • quoteSwap             │  │  • price (DexScreener)     │  │
│  │  • swap    ← EXECUTES   │  │  • history (audit trail)   │  │
│  │  • transfer ← EXECUTES  │  │  • config (risk params)    │  │
│  └─────────────────────────┘  └────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
          │                             │
          ▼                             ▼
    WDK Wallet (BIP-39)          SHLL PolicyGuard Contract
    Holds funds, signs tx        Immutable risk parameters
    on BSC mainnet               on BSC mainnet
```

**Flow**: `Read policies (SHLL) → AI decision → Execute (WDK) → Verify (WDK)`

## Why On-Chain Risk Parameters?

Most AI agents hardcode safety rules in system prompts:

```
// Typical AI agent (unsafe)
system_prompt = "Never spend more than 0.1 BNB per trade"
// ↑ Can be overridden by prompt injection
```

SafeAgent reads limits from blockchain contracts:

```
// SafeAgent (tamper-proof)
shll_policies() → { spendingLimit: { maxPerTx: "0.05 BNB" } }
// ↑ Stored on-chain, only NFT owner can modify via BscScan
```

| | Prompt-Based Safety | SafeAgent (On-Chain Policy) |
|---|---|---|
| Storage | System prompt (text) | Smart contract (bytecode) |
| Modifiable by AI? | ✅ Yes (prompt injection) | ❌ No (on-chain, owner-only) |
| Auditable? | ❌ Not publicly | ✅ BscScan verifiable |
| Access control | Single key | NFT Owner + Operator separation |

## Safety Protocol

Every trade follows: **READ → DECIDE → EXECUTE → VERIFY**

1. **READ** — Call `shll_policies` to get on-chain risk parameters
2. **DECIDE** — Compare intended action against limits:
   - SpendingLimit: Does amount exceed per-tx or daily cap?
   - CooldownPolicy: Has enough time passed since last trade?
3. **EXECUTE** — If compliant, execute via WDK (`wdk_swap` / `wdk_transfer`)
4. **VERIFY** — Check updated balances via `wdk_getBalance`

If any check fails → agent refuses and suggests a compliant alternative.

## Quick Start

### Prerequisites

- Node.js ≥ 20
- OpenAI API key
- BNB in WDK wallet (for real trades)

### Setup

```bash
# Clone SafeAgent
git clone https://github.com/kledx/shll-safe-agent.git
cd shll-safe-agent
npm install

# Clone WDK MCP Toolkit (sibling directory)
cd ..
git clone https://github.com/tetherto/wdk-mcp-toolkit.git
cd wdk-mcp-toolkit
npm install
npm install @tetherto/wdk-wallet-evm @tetherto/wdk-protocol-swap-velora-evm

# Configure
cd ../shll-safe-agent
cp .env.example .env
# Edit .env: WDK_SEED, OPENAI_API_KEY, SHLL_TOKEN_ID
```

### Run

```bash
# Smoke test (no API key needed)
npm run test:smoke

# Demo scenarios (needs OPENAI_API_KEY)
npm run demo:safe-swap          # Swap within limits
npm run demo:spending-limit     # Exceeds limit → agent refuses
npm run demo:portfolio          # Portfolio analysis

# Custom prompt
npm start "Check my balance and swap 0.01 BNB to USDT"
```

## Demo Scenarios

### 1. Safe Swap ✅
Agent reads policies → amount within SpendingLimit → executes via WDK Velora → verifies balance.

### 2. Spending Limit Rejection ❌→✅
Agent reads policies → amount exceeds maxPerTx → refuses → suggests compliant amount.

### 3. Portfolio Analysis 📊
Agent checks WDK balances + SHLL portfolio → analyzes holdings → suggests yield strategy.

## OpenClaw Compatibility

SHLL is published as an OpenClaw/ClawHub skill ([shll-skills@6.0.5](https://www.npmjs.com/package/shll-skills)):
- MCP Server compatible with OpenClaw, Claude, Cursor
- 26 DeFi tools for BSC operations

## Tech Stack

- **Runtime**: Node.js ESM
- **AI**: [Vercel AI SDK](https://sdk.vercel.ai/) + OpenAI GPT-4o
- **Wallet**: [WDK MCP Toolkit](https://github.com/tetherto/wdk-mcp-toolkit) v1.0.0-beta.1
- **Safety**: SHLL PolicyGuard smart contracts on BSC
- **Protocol**: MCP (Model Context Protocol)

## On-Chain Contracts

- [PolicyGuard](https://bscscan.com/address/0x25d17eA0e3Bcb8CA08a2BFE917E817AFc05dbBB3)
- [AgentNFA (ERC-8004)](https://bscscan.com/address/0x71cE46099E4b2a2434111C009A7E9CFd69747c8E)
- [SHLL Protocol](https://shll.run)
- [WDK Documentation](https://docs.wdk.tether.io/)

## License

MIT
