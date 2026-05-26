# EMPX-Cross-Chain Cross-Chain Swap — Complete System Walkthrough
**Version:** 1.0 | **Date:** 2026-03-26

---

## 1. What This System Is

EMPX-Cross-Chain is a **cross-chain swap router** that lets users move any token on any chain to any token on any other chain — in one click. We own no liquidity. We run no vaults. We compose existing infrastructure (CCTP, Axelar, LayerZero, Via Labs) and our own on-chain aggregator deployments.

**We are the routing brain. The rails are the muscle.**

---

## 2. System Components At A Glance

```
┌──────────────────────────────────────────────────────────────────────┐
│  USER / PARTNER FRONTEND                                             │
│  Web app · Wallet (MetaMask, Rabby) · 3rd party (Rubic, Rango)      │
└────────────────────────┬─────────────────────────────────────────────┘
                         │ REST API (x-api-key required)
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  VPS ORCHESTRATOR  (single Node.js process, ~2GB RAM at T1)         │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────┐ ┌──────────────┐ │
│  │ QuoteEngine │ │ RailSelector │ │ IntentEngine│ │ RecoveryEng  │ │
│  └─────────────┘ └──────────────┘ └─────────────┘ └──────────────┘ │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────────────────────┐  │
│  │EventMonitor │ │ ApiKeyManager│ │ PartnerAPI + StatusAPI       │  │
│  └─────────────┘ └──────────────┘ └─────────────────────────────┘  │
└────────────┬──────────────────────────────────┬─────────────────────┘
             │ reads chain events               │ builds + submits txns
             ▼                                  ▼
┌──────────────────────┐            ┌──────────────────────────────────┐
│  SOURCE CHAIN        │            │  DESTINATION CHAIN               │
│  RouterV1            │──rail──────│  ReceiverV1                      │
│  SwapPlugin(s)       │            │  SwapPlugin(s)                   │
│  PluginRegistry      │            │  PluginRegistry                  │
└──────────────────────┘            └──────────────────────────────────┘
         │    │    │    │
    CCTP  Axelar  LZ  Via Labs   (rail plugins — one per bridge)
```

---

## 3. Happy Path Flow — Any Token to Any Token

### Example: User swaps ARB (Arbitrum) → OP (Optimism)

**Step 1 — Quote (off-chain, <100ms)**
- Frontend calls `POST /partner/quote` with `{tokenIn: ARB, tokenOut: OP, srcChain: 42161, dstChain: 10}`
- VPS QuoteEngine fetches DEX quotes: ARB→USDC on Arbitrum, USDC→OP on Optimism
- RailSelector scores all valid rails for Arbitrum↔Optimism: CCTP wins (free, native USDC, 25s)
- VPS returns: `{quote, intentId, calldata for RouterV1, expiresAt}`

**Step 2 — User submits on-chain (source chain)**
- User signs + submits `RouterV1.initiateSwap(intent, swapPluginId, railPluginId)`
- RouterV1 validates: deadline, fee cap, replay guard, zero-address checks
- RouterV1 pulls ARB from user wallet
- RouterV1 takes a fixed `0.15%` protocol fee from the input token
- RouterV1 swaps ARB → USDC via UniswapV3Plugin (enforces `minSrcSwapOut` — no sandwich)
- RouterV1 calls `CCTPRailPlugin.bridge()` with USDC + encoded destination calldata
- CCTP burns USDC on Arbitrum; emits burn event
- `IntentInitiated` event emitted on-chain

**Step 3 — Transit (rail layer, ~25s for CCTP on Arbitrum)**
- Circle's Attestation Service detects the burn, issues a signed attestation
- VPS EventMonitor sees `IntentInitiated`, marks intent `IN_TRANSIT`
- VPS relayer fetches attestation from Circle API
- VPS submits `MessageTransmitter.receiveMessage()` on Optimism (minting USDC)
- This calls `ReceiverV1.execute()` with the minted USDC + encoded intent payload

**Step 4 — Destination execution (destination chain)**
- ReceiverV1 decodes payload: `{intentId, user, tokenOut: OP, minAmountOut, swapData, swapPluginId}`
- swapPluginId comes from payload (not caller) — cannot be tampered by relayer
- ReceiverV1 swaps USDC → OP via UniswapV3Plugin on Optimism
- OP is transferred directly to user wallet
- `IntentSettled` event emitted

**Step 5 — Confirmation**
- VPS EventMonitor sees `IntentSettled`, marks intent `SETTLED`
- If partner has webhook: push notification sent with `dstTxHash`
- Frontend shows: "Swap complete ✓"

**Total time: ~45 seconds. User clicks once.**

---

## 4. Edge Cases & How They're Handled

### 4A — No aggregator on destination chain
**Scenario:** User swaps ETH (Ethereum) → USDC on Scroll (no swap aggregator yet)

- VPS detects `dstChain.hasAggregator = false`
- `tokenOut` is set to USDC (settlement token)
- `dstSwapPluginId = bytes32(0)` in intent
- ReceiverV1 hits Case 1 (direct delivery) — USDC sent straight to user
- User receives USDC instead of their requested token
- **This is clearly communicated to user in the quote:** "You'll receive USDC on Scroll"

---

### 4B — Settlement token hop (USDT backbone chains)
**Scenario:** User swaps AVAX → MATIC, destination is a chain where USDT is the dominant stable (e.g. a Tron-adjacent EVM, Plasma)

- RailSelector checks `dstChain.nativeStable = USDT`
- Via Labs or Axelar rail selected (both support USDT)
- Source swap: AVAX → USDT (not USDC)
- Rail bridges USDT cross-chain
- Destination: USDT → MATIC via local DEX
- **No USDC ever touched.** The settlement token is USDT end-to-end.
- `settlementToken = SettlementToken.USDT` in the intent struct

---

### 4C — CCTP not available, ETH settlement fallback
**Scenario:** Fantom → BSC. No CCTP support on either chain.

- RailSelector filters out CCTP (not on Fantom or BSC)
- Axelar or LayerZero selected
- If tokenOut is not a stable: settlement token = ETH (via axlETH or LZ ETH)
- Destination: axlETH → tokenOut via local DEX
- User fee remains fixed at `0.15%`; internal rail cost is higher on Axelar than CCTP

---

### 4D — Rail timeout / stuck intent
**Scenario:** CCTP attestation takes >3 minutes (Circle API degraded)

- RecoveryEngine runs every 30s; detects intent stuck in `IN_TRANSIT` > 3min threshold
- Marks intent `STUCK`, increments `retryCount`
- Selects fallback rail: CCTP → Via Labs
- Attempts resubmission on fallback rail
- If 3 retries all fail → intent marked `FAILED`, user alerted
- **Funds safety:** The original CCTP burn already happened. Recovery requires:
  - If burn confirmed but not minted: VPS retries the attestation relay (no new funds locked)
  - If the entire tx failed pre-burn: user's funds never left (revert scenario)

---

### 4E — User submits a stale quote
**Scenario:** Quote generated 35 seconds ago (expiry is 30s), user submits tx

- `intent.deadline < block.timestamp` → RouterV1 reverts with `IntentExpired`
- No funds moved. User needs a fresh quote.
- Frontend shows: "Quote expired, refreshing..."

---

### 4F — Sandwich attack attempt on source swap
**Scenario:** MEV bot tries to sandwich the ARB→USDC swap

- `intent.minSrcSwapOut` is set by VPS at quote time (0.5% slippage tolerance)
- RouterV1 checks `settlementAmount >= intent.minSrcSwapOut` after swap
- If MEV bot front-ran, settlement amount will be below minimum → revert
- User's ARB stays in their wallet. No partial execution.

---

### 4G — Third-party calls RouterV1 directly (Mode B integration)
**Scenario:** Rango builds their own route, calls RouterV1 without using our API

- RouterV1 is fully permissionless — no API key check on-chain
- Their intent must still pass: deadline, fee cap, zero-address checks, replay guard
- VPS will not have pre-created this intent → EventMonitor logs "unknown intentId"
- Status API will return 404 for this intentId
- **This is fine and expected.** On-chain settlement is unaffected. Only status tracking is missing.

---

### 4H — Same token, different chain (pure bridge)
**Scenario:** User wants USDC on Arbitrum → USDC on Base

- VPS detects `tokenIn == tokenOut == USDC`
- No source swap needed (`swapPluginId` = no-op)
- CCTP selected (free native USDC, 25s)
- No destination swap needed (`dstSwapPluginId = bytes32(0)`)
- ReceiverV1: direct delivery, USDC → user
- **Cheapest possible path: gas only, no DEX fees, ~25s.**

---

## 5. Security Model Summary

| Attack Vector | Defence |
|---|---|
| Sandwich attack on src swap | `minSrcSwapOut` enforced in RouterV1 + balance delta check |
| Malicious relayer swaps plugin | `swapPluginId` locked inside signed intent payload, not caller param |
| Replay attack (same intentId twice) | `executedIntents[intentId]` mapping on RouterV1 + `settledIntents` on ReceiverV1 |
| Fee gouging | `MAX_FEE_BPS = 100` (1%) enforced on-chain regardless of VPS config |
| Stale/far-future deadline | `MAX_DEADLINE_DELTA = 30min` upper bound + expiry lower bound |
| Drain via dust spam | `MIN_AMOUNT = 1e6` (1 USDC equivalent) minimum transfer |
| Plugin registry hijack | `onlyOwner` (multisig) on all registry writes; EIP-165 interface validation |
| CCTP domain rerouting | `setChainDomain` now `onlyOwner` — was previously unprotected (fixed) |
| DDoS on VPS | Cloudflare WAF + per-key rate limits + 80:1 abuse ratio detector |
| Funds stuck in contracts | `rescueTokens()` owner-only; `Pausable` for emergency stop |

---

## 6. Revenue Model

### 6A — Protocol Fee (primary)
- Charged on every swap as `feeAmount` in the intent
- VPS quotes: fixed `0.15% of transfer value`
- Collected in `tokenIn` by RouterV1, sent to `feeRecipient` multisig
- **Example at $1M daily volume:** ~$1,500/day → ~$547.5K/year

### 6B — Partner Fee Share (distribution cost)
- Partners earn BPS rebate on every intent they refer
- FREE: 0% | GROWTH: 15% | PARTNER: 20% | ENTERPRISE: 30%
- Partners pull their yield via `POST /partner/withdraw` to their payout address
- **Net to protocol at PARTNER tier:** 80% of the `0.15%` fee

### 6C — Volume projections

| Stage | Daily Intents | Avg Size | Daily Vol | Daily Revenue | Monthly |
|---|---|---|---|---|---|
| **T1 — Launch** | 500 | $250 | $125K | $187.5 | $5.625K |
| **T2 — Growth** | 5,000 | $400 | $2M | $3,000 | $90K |
| **T3 — Scale** | 50,000 | $600 | $30M | $45,000 | $1.35M |
| **T4 — Mature** | 200,000 | $800 | $160M | $240,000 | $7.2M |

*T3 comparable to 1inch cross-chain volume in 2024 Q4.*

---

## 7. Third-Party Integration Growth Model

### Why aggregators (Rubic, Rango, LI.FI) want us

1. **More routes** — our 16+ chain aggregator deployments give them routes they can't do alone
2. **Intent-based** — they embed our SDK, user flow is seamless (no UX change for their users)
3. **Revenue share** — they earn passively on every swap routed through our engine
4. **No liquidity risk** — they don't hold any assets; pure software integration

### Partner acquisition funnel

```
FREE tier (self-serve, 5 min setup)
  → Volume hits 500 tx/day → auto-email: "Upgrade to GROWTH for fee share"
  → GROWTH: earning rebates → relationship → PARTNER agreement
  → ENTERPRISE: custom contract, white-label, dedicated support
```

### Revenue multiplier from 3rd parties

| Integration | Expected Daily Intents | Monthly Revenue Contribution |
|---|---|---|
| 1 wallet app (100K users) | +2,000 | +$30K |
| 1 aggregator (Rango-scale) | +8,000 | +$120K |
| 5 mid-tier wallets | +5,000 | +$75K |
| DEX with cross-chain tab | +3,000 | +$45K |

**5 mid-size partners alone can 3× T2 revenue without any organic growth.**

---

## 8. VPS Requirements Per Scale Tier

| Tier | Intents/day | RPC connections | RAM | CPU | Cost/mo |
|---|---|---|---|---|---|
| T1 | <5K | 3 chains × 2 RPCs | 2GB | 2 vCPU | $20 (Hetzner CX21) |
| T2 | <50K | 10 chains × 2 RPCs | 8GB | 4 vCPU | $80 (Hetzner CX41) |
| T3 | <500K | 20 chains × 2 RPCs | 32GB | 8 vCPU | $200 (Hetzner CCX43) |
| T4 | 500K+ | 30+ chains, Redis, PG | 64GB | 16 vCPU | $600 + managed DB |

*T1–T3: single VPS is sufficient. T4: add Redis for quote cache, Postgres for intent store.*

---

## 9. What Gets Built Next

1. **Axelar + LayerZero rail plugins** — unlocks 80+ chains
2. **Chain registry** — typed config for all 16+ deployed chains
3. **DEX adapter layer** — concrete 1inch/paraswap wrappers per chain
4. **CCTP attestation relayer** — VPS component that polls Circle API + submits mint txns
5. **Paymaster integration** — Pimlico/Biconomy so users pay gas in input token
6. **Postgres + Redis** — at T2, move intent store + quote cache off in-memory
7. **Partner dashboard** — self-serve key management, rebate tracking, webhook config
