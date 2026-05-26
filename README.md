# EMPX-Cross-Chain — Cross-Chain Swap Protocol

> Route any token on any chain to any token on any chain. One click. Zero native gas.

EMPX-Cross-Chain is a modular, intent-based cross-chain swap protocol. It composes five bridge rails (CCTP, Axelar, LayerZero, Via Labs, THORChain), an on-chain plugin registry, and a lightweight VPS orchestrator to deliver seamless cross-chain swaps — including native Bitcoin, Solana, and Cosmos — without operating any liquidity pools or vaults.

---

## Architecture Overview

```
User / Partner App
        │  REST API + WebSocket (registered API key required)
        ▼
   VPS Orchestrator  ──────────────────────────────────────────
   │ QuoteEngine      │ RailSelector     │ IntentEngine        │
   │ EventMonitor     │ RecoveryEngine   │ PaymasterService    │
   │ PartnerAPI       │ WebSocketAPI     │ RufloSDK            │
        │
   ┌────┴──────────────────────────────────────────┐
   │            RAIL LAYER                         │
   │  CCTP · Axelar · LayerZero · Via Labs · THOR  │
   └────┬──────────────────────────────────────────┘
        │
Source Chain                          Destination Chain
RouterV1 + SwapPlugin(s)              ReceiverV1 + SwapPlugin(s)
PluginRegistry                        PluginRegistry
Paymaster (EIP-4337)                  (direct delivery for native chains)
```

---

## Five-Rail Coverage

| Rail | Type | Indicative Rail Cost (internal) | Speed | Chains | Unique Capability |
|---|---|---|---|---|---|
| **CCTP** | Messaging | Free | 25s | 16 EVM + Solana | Native USDC, no wrapped tokens |
| **Via Labs** | Messaging | $0.25 | 3min | 30+ | Fast fallback, API-first |
| **Axelar** | Messaging | $0.50 | 90s | 60+ | GMP, Cosmos, USDT |
| **LayerZero** | Messaging | $0.35 | 2min | 80+ | Widest EVM coverage |
| **THORChain** | Liquidity | Slip% | 60s | EVM+BTC+SOL+DOGE | **Native BTC, SOL, DOGE delivery** |

Rail selection is automatic. Priority: `CCTP → Via Labs → Axelar → LayerZero → THORChain`.

User-facing protocol pricing is fixed at `0.15%` regardless of the selected rail.

---

## Key Features

- **No liquidity pools** — pure routing, zero IL risk, zero capital requirements
- **Plugin architecture** — add new rails or DEXs by deploying one contract
- **USDC-first settlement** — CCTP burns/mints natively; no wrapped token risk
- **Native BTC/SOL** — THORChain delivers real BTC to Bitcoin addresses
- **Account Abstraction** — EIP-4337 Paymaster; users pay gas in any token
- **Intent tracking** — full state machine with auto-recovery on stuck intents
- **Partner API** — tiered access, 15-30% fee rebate, pull-based withdrawals
- **WebSocket push** — real-time status; no polling needed

---

## Project Structure

```
ruflo/
├── src/
│   ├── contracts/
│   │   ├── interfaces/
│   │   │   ├── IIntentTypes.sol      Shared structs (SwapIntent, BridgeParams)
│   │   │   ├── IRailPlugin.sol       Rail plugin interface
│   │   │   └── ISwapPlugin.sol       Swap/DEX plugin interface
│   │   ├── rails/
│   │   │   ├── CCTPRailPlugin.sol         CCTP V2 — free native USDC
│   │   │   ├── AxelarRailPlugin.sol       Axelar ITS rail
│   │   │   ├── LayerZeroRailPlugin.sol    LayerZero OFT rail
│   │   │   ├── AxelarReceiverAdapter.sol  Axelar destination adapter -> ReceiverV1
│   │   │   ├── LayerZeroReceiverAdapter.sol LayerZero destination adapter -> ReceiverV1
│   │   │   └── THORChainRailPlugin.sol    THORChain AMM — native BTC/SOL
│   │   ├── RouterV1.sol              Source chain entry point
│   │   ├── ReceiverV1.sol            Destination chain receiver
│   │   ├── PluginRegistry.sol        On-chain plugin whitelist
│   │   └── Paymaster.sol             EIP-4337 token gas paymaster
│   └── vps/
│       ├── types/index.ts            All shared TypeScript types
│       ├── services/
│       │   ├── RailSelector.ts       Rail + settlement token selection (<1ms)
│       │   ├── QuoteEngine.ts        Quote generation with 30s cache
│       │   ├── IntentEngine.ts       Intent state machine
│       │   ├── EventMonitor.ts       Chain event listeners (ethers.js)
│       │   ├── RecoveryEngine.ts     Stuck intent detection + fallback
│       │   └── PaymasterService.ts   UserOp builder + Pimlico integration
│       ├── api/
│       │   ├── PartnerAPI.ts         Authenticated partner REST endpoints
│       │   ├── StatusAPI.ts          Public health + status endpoints
│       │   └── WebSocketAPI.ts       Real-time intent status streaming
│       └── sdk/
│           └── RufloSDK.ts           Client-facing TypeScript SDK
├── docs/
│   ├── cross-chain-swap-architecture-report.md
│   ├── system-walkthrough.md
│   ├── partner-integration-guide.md
│   ├── native-rails-extension.md    THORChain + Solana strategy
│   └── competitive-positioning.md  vs NEAR Intents
├── config/
├── package.json
└── README.md
```

---

## Quick Start — Partner Integration

```bash
npm install @ruflo/sdk
```

```typescript
import { RufloSDK, CHAIN_ID } from '@ruflo/sdk';

const ruflo = new RufloSDK({ apiKey: 'rflo_your_key_here' });

// EVM → EVM
const swap = await ruflo.swap({
  from: { chainId: CHAIN_ID.ARB,  token: '0xARBaddr', amount: '100' },
  to:   { chainId: CHAIN_ID.BASE, token: '0xTokenAddr' },
  wallet: '0xUserWallet',
});

swap.on('status', (s) => console.log(s)); // real-time WebSocket updates
const result = await swap.settle();       // resolves when settled on destination
```

### EVM → Native Bitcoin
```typescript
const swap = await ruflo.swap({
  from: { chainId: CHAIN_ID.ETH, token: 'NATIVE', amount: '0.1' },
  to:   { chainId: CHAIN_ID.BTC, token: 'BTC', nativeAddress: 'bc1q...' },
  wallet: '0xUserWallet',
});
```

### Get API Key
```bash
curl -X POST https://api.ruflo.io/partner/register \
  -H "content-type: application/json" \
  -d '{ "name": "My App", "contactEmail": "dev@example.com" }'
```

---

## Partner Tiers

| Tier | Quotes/min | Tx/day | Fee Rebate | SLA |
|---|---|---|---|---|
| FREE | 60 | 500 | 0% | — |
| GROWTH | 300 | 5,000 | 15% | — |
| PARTNER | 600 | 10,000 | 20% | 99.5% |
| ENTERPRISE | 6,000 | 500,000 | 30% | 99.9% |

Claim rebates anytime: `POST /partner/withdraw`

---

## Smart Contract Security

| Protection | Mechanism |
|---|---|
| Sandwich attacks | `minSrcSwapOut` enforced + balance delta double-check |
| Plugin injection | `swapPluginId` locked inside signed intent payload |
| Replay attacks | `executedIntents[intentId]` + `settledIntents[intentId]` |
| Fee gouging | `MAX_FEE_BPS = 100` (1%) hard cap on-chain |
| Stale quotes | `MAX_DEADLINE_DELTA = 30min` upper bound enforced |
| Registry hijack | `onlyOwner` (multisig) + EIP-165 interface validation |

---

## Account Abstraction (EIP-4337)

Users pay gas in their input token. Zero native gas required.

```
User signs one UserOp containing:
  1. approve(Paymaster, gasTokenFee)   ← atomic
  2. RouterV1.initiateSwap(intent)     ← atomic
  → Pimlico bundler submits
  → RufloPaymaster sponsors ETH gas
  → Fee deducted from input token
```

Supported paymasters: Pimlico · Biconomy · ZeroDev

---

## VPS Requirements

| Scale | Daily Intents | RAM | CPU | Cost/mo |
|---|---|---|---|---|
| Launch | <5K | 2GB | 2 vCPU | ~$20 |
| Growth | <50K | 8GB | 4 vCPU | ~$80 |
| Scale | <500K | 32GB | 8 vCPU | ~$200 |
| Mature | 500K+ | 64GB + Redis + PG | 16 vCPU | ~$600 |

---

## Build & Run

```bash
npm install
npm run build
npm test
npm run lint
```

## Solidity Build & Test (Foundry)

```bash
npm run sol:build
npm run sol:test
```

---

## Documentation

| Document | Description |
|---|---|
| `docs/system-walkthrough.md` | Full flow, 8 edge cases, revenue model |
| `docs/partner-integration-guide.md` | Integration modes A/B/C, quick start |
| `docs/native-rails-extension.md` | THORChain + Solana/BTC strategy |
| `docs/competitive-positioning.md` | vs NEAR Intents, feature comparison |
| `docs/cross-chain-swap-architecture-report.md` | Initial design report |

---

## License

MIT
