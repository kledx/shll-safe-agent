# SafeAgent — Autonomous DeFi Agent with On-Chain Safety Governance

> **Hackathon Entry** — Tether Hackathon Galactica: WDK Edition 1
> **Track** — Autonomous DeFi Agent
> **Team** — SHLL Protocol

## What is SafeAgent?

SafeAgent is an autonomous DeFi agent that trades on BNB Chain with **on-chain safety governance**. It combines three technologies:

| Component | Technology | Role |
|---|---|---|
| **Wallet** | [WDK](https://docs.wdk.tether.io/) (Tether) | Non-custodial wallet, balance, swap, transfer |
| **Safety** | [SHLL](https://shll.run) Protocol | On-chain PolicyGuard: spending limits, cooldowns, whitelists |
| **Brain** | AI (GPT-4o / Claude) | Autonomous reasoning, decision-making |

## Architecture

```
┌────────────────────────────────────────────────────────┐
│              SafeAgent Orchestrator                     │
│           (Vercel AI SDK + LLM)                         │
│                                                         │
│  ┌──────────────────┐  ┌────────────────────────────┐  │
│  │  WDK MCP Server  │  │  SHLL MCP Server           │  │
│  │  (Wallet Layer)   │  │  (Safety + DeFi Execution) │  │
│  │                   │  │                             │  │
│  │  • getAddress     │  │  • policies (PolicyGuard)   │  │
│  │  • getBalance     │  │  • swap (on-chain validated)│  │
│  │  • quoteSwap      │  │  • lend / redeem (Venus)    │  │
│  │  • swap (Velora)  │  │  • portfolio / status       │  │
│  │  • transfer       │  │  • 27 DeFi tools total      │  │
│  └──────────────────┘  └────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
          │                          │
          ▼                          ▼
    WDK Wallet (BIP-39)        SHLL Smart Contracts
    on BSC mainnet             PolicyGuard + AgentNFA
```

## Safety Protocol

Every transaction follows: **ASSESS → CHECK → EXECUTE → VERIFY**

The agent checks 4 on-chain policies before ANY write operation:

| Policy | What It Does |
|---|---|
| **SpendingLimitV2** | Per-transaction and daily spending caps |
| **CooldownPolicy** | Minimum time between trades |
| **DeFiGuardV2** | Whitelist of approved DeFi protocols |
| **ReceiverGuardV2** | Only approved addresses can receive funds |

**On-chain enforcement means the AI cannot bypass safety rules** — even if the LLM is manipulated via prompt injection.

## Quick Start

### Prerequisites

- Node.js ≥ 20
- [shll-skills](https://www.npmjs.com/package/shll-skills) installed globally (`npm i -g shll-skills`)
- OpenAI API key

### Setup

```bash
# Clone and install
cd repos/shll-safe-agent
npm install

# Configure
cp .env.example .env
# Edit .env with your WDK_SEED, OPENAI_API_KEY, etc.
```

### Run Demo Scenarios

```bash
# Scenario 1: Safe Swap (policy check passes → swap executes)
npm run demo:safe-swap

# Scenario 2: Spending Limit (policy rejects → agent self-corrects)
npm run demo:spending-limit

# Scenario 3: Portfolio Optimization (autonomous yield strategy)
npm run demo:portfolio

# Custom prompt
npm start "Check my balance and tell me my USDT holdings"
```

## Demo Scenarios

### 1. Safe Swap ✅
Agent checks BNB balance → verifies spending policies → swaps 0.01 BNB to USDT → confirms receipt.

### 2. Spending Limit ❌→✅
Agent tries to swap 1 BNB → SpendingLimit policy rejects → agent explains the rejection → suggests compliant alternative.

### 3. Portfolio Optimization 📈
Agent analyzes holdings → identifies idle USDT → deposits to Venus Protocol for yield → reports APY.

## Why On-Chain Safety Matters

Most AI agents use off-chain safety:
- ❌ Off-chain: AI or backend decides → **can be bypassed** by prompt injection
- ✅ On-chain (SHLL): Smart contracts enforce rules → **immutable, verifiable, tamper-proof**

## OpenClaw Compatibility

SHLL is published as an OpenClaw/ClawHub skill ([shll-skills@6.0.5](https://www.npmjs.com/package/shll-skills)):
- MCP Server compatible with OpenClaw, Claude, Cursor, and any MCP client
- 27 DeFi tools for BSC operations
- Full skill definition in [SKILL.md](https://github.com/kledx/shll-skills)

## Tech Stack

- **Runtime**: Node.js ESM
- **AI**: [Vercel AI SDK](https://sdk.vercel.ai/) + OpenAI GPT-4o
- **Wallet**: [WDK MCP Toolkit](https://github.com/tetherto/wdk-mcp-toolkit) v1.0.0-beta.1
- **Safety**: SHLL PolicyGuard smart contracts on BSC
- **Protocol**: MCP (Model Context Protocol) for AI-tool integration

## Links

- [SHLL Protocol](https://shll.run)
- [WDK Documentation](https://docs.wdk.tether.io/)
- [PolicyGuard on BscScan](https://bscscan.com/address/0x25d17eA0e3Bcb8CA08a2BFE917E817AFc05dbBB3)
- [SHLL AgentNFA (BAP-578)](https://bscscan.com/address/0x...)

## License

MIT
