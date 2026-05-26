# Volume Projections, VPS Requirements & Routing Examples
**Addendum to:** cross-chain-swap-architecture-report.md

---

## 1. Revenue Projections

### Fee Model Assumed
| Transfer Size | Protocol Fee | Rail Cost (internal avg) | User-Facing Total Fee | Margin Note |
|---|---|---|---|---|
| $50 | $0.075 (0.15%) | $0–$0.50 | $0.075 | Negative on expensive rails |
| $500 | $0.75 (0.15%) | $0–$0.50 | $0.75 | Positive on all current rails |
| $5k | $7.50 (0.15%) | $0–$0.50 | $7.50 | Rail cost is negligible |
| $50k | $75 (0.15%) | $0–$0.50 | $75 | Fully volume-driven |

> User-facing pricing is fixed at `0.15%` regardless of rail. Rail costs remain internal execution costs that affect margin, not the quoted fee.

### Scenario Projections (Monthly)

| Daily Volume | Avg Tx Size | Daily Tx Count | Monthly Revenue | VPS Tier |
|---|---|---|---|---|
| $500k | $500 | 1,000 | ~$22,500 | Tier 1 |
| $5M | $750 | 6,667 | ~$225,000 | Tier 2 |
| $50M | $1,000 | 50,000 | ~$2,250,000 | Tier 3 |
| $500M | $2,000 | 250,000 | ~$22,500,000 | Tier 4 |

Revenue assumptions: fixed `0.15%` user fee, CCTP dominant (70% of volume), rail costs absorbed by the protocol.

---

## 2. VPS Performance Requirements

### Sizing per Tier

| Tier | Daily Volume | Intents/day | Peak RPS | CPU | RAM | DB | RPC Calls/day |
|---|---|---|---|---|---|---|---|
| **T1** | <$1M | <2,000 | 2 | 4-core | 8 GB | SQLite / in-memory | ~40k |
| **T2** | $1M–$20M | 2k–26k | 30 | 8-core | 16 GB | Postgres (single node) | ~520k |
| **T3** | $20M–$200M | 26k–260k | 300 | 16-core | 32 GB | Postgres + Redis cache | ~5.2M |
| **T4** | >$200M | >260k | 3,000 | 32-core cluster | 64 GB | Postgres HA + Redis cluster | ~52M |

### What drives RPC call volume
- **EventMonitor**: 1 WebSocket connection per chain (16 chains = 16 persistent connections)
- **Quote engine**: 2–4 RPC reads per quote (price checks, allowance checks)
- **CCTP relay**: 1 attestation API call + 1 submit tx per intent
- **Recovery engine**: 0 RPC at idle; ~3 calls per stuck intent

### Key bottleneck: RPC providers, not CPU
At Tier 3, you'll hit free-tier limits on Alchemy/Infura (~300 RPS shared). Solutions:
1. Self-hosted nodes for your top 5 chains (Erigon — 500 GB SSD per chain)
2. Paid RPC tiers: QuickNode Business (~$500/mo covers T2), Alchemy Growth (~$400/mo)
3. Load-balance across 2–3 providers with automatic failover (already in EventMonitor)

### Memory footprint per intent
- In-memory: ~2 KB per active intent
- At 10k concurrent in-flight intents: ~20 MB — negligible
- Persist to DB on every state transition (async write, non-blocking)

---

## 3. Rail Scoring in Practice

### Why the scorer produces these results

| Route | Amount | Urgency | Winner | Reason |
|---|---|---|---|---|
| Arbitrum → Base | $50 | normal | CCTP | Free, 25s, native USDC — unbeatable |
| Ethereum → Arbitrum | $500 | fast | Axelar | CCTP ETH mainnet = 13min; Axelar = 90s |
| BSC → Polygon | $1,000 | normal | Axelar | No CCTP on BSC; Axelar reliability 99.2% |
| Any → Plasma | $2,000 | normal | Axelar/LZ | Plasma uses USDT; CCTP is USDC-only |
| Ethereum → Base | $50,000 | normal | CCTP | reliability³ bonus massively favours 99.7% at this size |

---

## 4. Multi-Hop Routing Examples

### Example A: Standard Happy Path
**User:** WBTC on Arbitrum → USDC on Base

```
1. [Arbitrum] RouterV1.initiateSwap()
   └─ SwapPlugin: WBTC → USDC (via Uniswap V3 on Arb)
   └─ CCTPRailPlugin: burn 995 USDC (after fee)

2. [Transit] Circle attestation (~25s)

3. [Base] ReceiverV1.execute()
   └─ swapPluginId = bytes32(0) → direct delivery
   └─ User receives 995 USDC
```

---

### Example B: Rail Hop (Ethereum mainnet source)
**User:** ETH on Ethereum → USDC on Optimism

```
1. [Ethereum] RouterV1.initiateSwap()
   └─ SwapPlugin: ETH → USDC (via Uniswap V3)
   └─ RailSelector: CCTP=780s, Axelar=90s → picks Axelar
   └─ AxelarRailPlugin: callContractWithToken(axlUSDC, OP chain)

2. [Transit] Axelar validator consensus (~90s)

3. [Optimism] ReceiverV1.execute()
   └─ axlUSDC arrives
   └─ SwapPlugin: axlUSDC → native USDC (Curve stable swap, ~0.01% slippage)
   └─ User receives native USDC
```

*Note: axlUSDC→USDC swap on destination is automatic, user still gets native USDC.*

---

### Example C: Settlement Token Hop (USDT-backbone chain)
**User:** USDC on Arbitrum → USDT on Plasma (or Tron-EVM / BSC USDT-native chain)

```
1. [Arbitrum] RouterV1.initiateSwap()
   └─ tokenIn already = USDC → no src swap needed
   └─ RailSelector: dstChain.nativeStable = USDT
                    CCTP doesn't support USDT
                    → picks Axelar (supportsUSDT=true)
   └─ SwapPlugin: USDC → USDT (Curve 3pool on Arb, ~0.01% slippage)
   └─ AxelarRailPlugin: bridge USDT to Plasma

2. [Transit] Axelar (~90s)

3. [Plasma] ReceiverV1.execute()
   └─ USDT arrives
   └─ swapPluginId = bytes32(0) → direct USDT delivery to user
```

*Plasma users get USDT natively — which is what they actually hold.*

---

### Example D: No Aggregator on Destination
**User:** MATIC on Polygon → destination chain with no RouterV1

```
1. [Polygon] RouterV1.initiateSwap()
   └─ SwapPlugin: MATIC → USDC (Uniswap V3)
   └─ CCTPRailPlugin: burn USDC

2. [Transit] CCTP (~25s)

3. [Destination] Circle mints USDC directly to user wallet
   └─ No ReceiverV1 needed — CCTP can mint to any address
   └─ User receives USDC (settlement token = final token in this case)
```

*This is how you expand to chains without deploying contracts first.*

---

### Example E: Recovery / Rail Hop on Failure
**User:** DAI on Avalanche → ARB on Arbitrum

```
1. [Avalanche] Initiates via CCTP (primary)
   └─ SwapPlugin: DAI → USDC
   └─ CCTPRailPlugin: burn USDC
   └─ Status: IN_TRANSIT

2. [RecoveryEngine detects] — stuck after 5 min (threshold=3 min)
   └─ markStuck() → intent status = STUCK
   └─ fallbackOrder[CCTP] = [VIA_LABS, AXELAR, LZ]
   └─ Tries Via Labs next → markRecovering(fallback=VIA_LABS)

3. [VPS] Resubmit: bridge same USDC amount via Via Labs
   └─ Via Labs routes in ~3 min

4. [Arbitrum] ReceiverV1.execute()
   └─ SwapPlugin: USDC → ARB
   └─ User receives ARB (~8 min total, transparent to user)
```

*User sees one status: "delayed — recovering". They never need to resubmit.*

---

## 5. Best Practice Summary

### Rail Selection
- **CCTP is the default** — zero fee wins almost all sub-$10k normal-urgency routes
- **Never use CCTP from Ethereum mainnet for fast routes** — 13 min wait kills UX
- **axlUSDC → native USDC swap** should always happen on destination if final token is USDC
- **USDT chains** (Plasma, BSC-native): detect via `dstChain.nativeStable`, swap before bridging

### Security
- **Never store settlement tokens in RouterV1** — atomic in/out per tx, no custody
- **intentId replay protection** — `executedIntents[id]` mapping prevents double-spend
- **`depositForBurnWithCaller`** on CCTP — locks minting to our ReceiverV1 only

### Operations
- **Monitor axlUSDC peg** via Chainlink oracle — if peg > 0.5% deviation, pause Axelar rail
- **CCTP attestation relay** is the only manual step — the VPS should auto-relay
- **Set minimum transfer = $5** — below this, fee exceeds value delivered
- **RPC failover** is critical — use 2 providers per chain from day one

### Scaling
- Start on a single 8-core VPS ($80/mo on Hetzner) — handles Tier 1–2 easily
- Upgrade to Tier 3 when daily volume exceeds $10M — add Postgres + Redis
- Tier 4 requires horizontal VPS scaling — the intent engine is stateless, scales cleanly
