# Volume Projections, VPS Requirements & Routing Examples
**Project:** EMPX-Cross-Chain Cross-Chain Router
**Date:** 2026-03-25

---

## 1. Revenue & Volume Projections

### Fee Model Assumption
- **Base fee:** 0.05% of transfer value (competitive vs. Li.Fi ~0.1%, Socket ~0.08%)
- **Minimum fee:** $0.50 per swap (covers rail costs on small transfers)
- **Rail cost passthrough:** Rail fees (CCTP=free, Via Labs=$0.25, Axelar~$0.50, LZ~$0.30) are baked into the quoted fee

---

### Scale Tier 1 — Bootstrap (Months 1–3)

| Metric | Value |
|---|---|
| Daily swaps | 200 |
| Avg swap size | $500 |
| Daily volume | $100,000 |
| Monthly volume | ~$3M |
| Gross revenue (0.05%) | $1,500/month |
| Rail cost (avg $0.25/swap, ~50% Via/Axelar) | ~$750/month |
| **Net revenue** | **~$750/month** |

---

### Scale Tier 2 — Growth (Months 4–9)

| Metric | Value |
|---|---|
| Daily swaps | 2,000 |
| Avg swap size | $800 |
| Daily volume | $1.6M |
| Monthly volume | ~$48M |
| Gross revenue (0.05%) | $24,000/month |
| Rail cost | ~$6,000/month |
| **Net revenue** | **~$18,000/month** |

---

### Scale Tier 3 — Scale (Months 10–18)

| Metric | Value |
|---|---|
| Daily swaps | 15,000 |
| Avg swap size | $1,200 |
| Daily volume | $18M |
| Monthly volume | ~$540M |
| Gross revenue (0.05%) | $270,000/month |
| Rail cost | ~$45,000/month |
| **Net revenue** | **~$225,000/month** |

---

### Scale Tier 4 — Hyper-Scale (18+ months)

| Metric | Value |
|---|---|
| Daily swaps | 100,000 |
| Avg swap size | $1,500 |
| Daily volume | $150M |
| Monthly volume | ~$4.5B |
| Gross revenue (0.05%) | $2.25M/month |
| Rail cost (CCTP dominant = lower) | ~$200,000/month |
| **Net revenue** | **~$2.05M/month** |

> **Note:** At scale, CCTP route dominance drives rail costs down dramatically (free per transfer). Optimizing toward CCTP chains first is a revenue multiplier.

---

## 2. VPS Performance Requirements Per Scale Tier

### Architecture Philosophy
One VPS per tier — no Kubernetes, no microservices overhead. Single Node.js/Go process with async workers. Scale up before scaling out.

---

### Tier 1 — Bootstrap VPS

```
Hetzner CX31 or similar
  CPU:    4 vCPU
  RAM:    8 GB
  Disk:   80 GB NVMe SSD
  Net:    1 Gbps uplink
  DB:     PostgreSQL (same machine, <1GB)
  Cost:   ~$15–20/month

Capacity:
  Concurrent intents: 50
  Quotes/sec: 10
  RPC connections: 4 (one per major chain)
  Event listeners: 8 chains
  Throughput: 200 swaps/day comfortable
```

---

### Tier 2 — Growth VPS

```
Hetzner CCX33 or Contabo VPS-L
  CPU:    8 vCPU
  RAM:    32 GB
  Disk:   240 GB NVMe SSD
  Net:    1 Gbps
  DB:     PostgreSQL (separate $20/month managed, e.g. Supabase / Neon)
  Cost:   ~$60–80/month total

Capacity:
  Concurrent intents: 500
  Quotes/sec: 80
  RPC connections: 16 (one per chain, premium RPC)
  Event listeners: 20 chains
  Throughput: 2,000+ swaps/day
  Quote cache: 30s TTL, reduces RPC calls ~70%
```

---

### Tier 3 — Scale (2× VPS + load balancer)

```
2× Hetzner CCX53 (or 1× Dedicated AX102)
  CPU:    16 vCPU each (or 32 dedicated)
  RAM:    64 GB each (or 128 GB)
  Disk:   480 GB NVMe
  Net:    10 Gbps
  DB:     Managed PostgreSQL + Redis cache ($100/month)
  Cost:   ~$300–400/month total

Architecture:
  Node 1: Intent Engine + Event Monitor (primary)
  Node 2: Quote Engine + API Server (stateless, scales horizontally)
  Redis:  Shared quote cache, intent state locks, rate limiting

Capacity:
  Concurrent intents: 3,000
  Quotes/sec: 500 (cache-accelerated)
  RPC: Premium providers (Alchemy/QuickNode) ~$200/month
  Throughput: 15,000+ swaps/day
```

---

### Tier 4 — Hyper-Scale (3–5 VPS + managed services)

```
3× Dedicated Hetzner AX162-R
  CPU:    32 cores AMD EPYC
  RAM:    256 GB
  Disk:   2× 1.92TB NVMe RAID
  Net:    10 Gbps
  DB:     PlanetScale / Neon serverless PostgreSQL
  Cache:  Upstash Redis (serverless)
  Cost:   ~$1,200–1,500/month infra

Architecture:
  Node 1+2: Quote Engine cluster (stateless, round-robin)
  Node 3:   Intent Engine + Recovery Engine
  Separate: Status API (Cloudflare Workers, $0 cost)
  Monitoring: Grafana Cloud free tier

Capacity:
  Concurrent intents: 20,000
  Quotes/sec: 5,000+
  Throughput: 100,000+ swaps/day
  P99 quote latency: <200ms
  P99 intent-to-settled: <5min (CCTP) / <12min (others)
```

---

### VPS Cost vs Revenue Summary

| Tier | Swaps/Day | Infra Cost/Month | Net Revenue/Month | Infra as % Rev |
|---|---|---|---|---|
| Bootstrap | 200 | $20 | $750 | 2.7% |
| Growth | 2,000 | $100 | $18,000 | 0.6% |
| Scale | 15,000 | $500 | $225,000 | 0.2% |
| Hyper-Scale | 100,000 | $1,500 | $2,050,000 | 0.07% |

> Infrastructure costs become negligible at scale. The margin story is excellent.

---

## 3. Settlement Token Strategy

### Supported Settlement Tokens Per Rail

| Rail | USDC | USDT | ETH | Notes |
|---|---|---|---|---|
| CCTP | ✅ Native | ❌ | ❌ | USDC only, native mint |
| Axelar | ✅ axlUSDC | ✅ axlUSDT | ✅ axlETH | Wrapped versions |
| LayerZero | ✅ OFT USDC | ✅ OFT USDT | ✅ ETH OFT | Via Stargate V2 |
| Via Labs | ✅ Native | ✅ Native | ✅ | Multi-token API |

### Settlement Token Priority Logic

```
function selectSettlementToken(srcChain, dstChain, railAvailable):

  // Check USDC availability first
  if CCTP.supports(srcChain, dstChain):
    return { token: USDC, rail: CCTP }       // Free, native

  // Destination chain prefers USDT (e.g. Plasma, Tron-adjacent chains)
  if dstChain.nativeStable == USDT:
    if ViaLabs.supportsUSDT(srcChain, dstChain):
      return { token: USDT, rail: ViaLabs }
    if Axelar.supportsUSDT(srcChain, dstChain):
      return { token: USDT, rail: Axelar }

  // Fall back to USDC via other rails
  if ViaLabs.supportsUSDC(srcChain, dstChain):
    return { token: USDC, rail: ViaLabs }    // $0.25

  if Axelar.supports(srcChain, dstChain):
    return { token: USDC, rail: Axelar }     // ~$0.50, wider coverage

  if LayerZero.supports(srcChain, dstChain):
    return { token: USDC, rail: LayerZero }  // Stargate USDC

  // Last resort: ETH
  return { token: ETH, rail: bestAvailableForETH }
```

---

## 4. Routing Examples — Real-World Scenarios

---

### Example A — Simple CCTP Path (Happy Path)
**Route:** USDC on Ethereum → USDC on Arbitrum

```
User:  USDC (Ethereum) → USDC (Arbitrum)

Steps:
1. Router detects both chains on CCTP
2. No swap needed on either side
3. CCTP burn on Ethereum → Circle attestation (~20s) → mint on Arbitrum
4. USDC delivered directly to user wallet

Cost:    ~$0 rail fee + $2 Ethereum gas
Time:    ~25 seconds
Rail:    CCTP only
Hops:    1 rail, 1 settlement token (USDC)
Complexity: ★☆☆☆☆
```

---

### Example B — Any-to-Any (Both Chains Have Aggregator)
**Route:** ARB on Arbitrum → OP on Optimism

```
User:  ARB (Arbitrum) → OP (Optimism)

Steps:
1. Quote: ARB → USDC on Arbitrum via our aggregator (~$0.01 gas)
2. Rail select: CCTP (both chains supported, free)
3. CCTP: burn USDC Arbitrum → mint USDC Optimism (~20s)
4. On Optimism: USDC → OP via our aggregator
5. OP delivered to user

Cost:    ~$0 rail + $0.02 total gas (L2 cheap)
Time:    ~30 seconds
Rails:   CCTP
Hops:    1 rail, 1 settlement token
Complexity: ★★☆☆☆
```

---

### Example C — Rail Hop (No Direct Rail)
**Route:** AVAX on Avalanche → BNB on BSC

```
Problem: CCTP supports Avalanche but NOT BSC
         Via Labs supports both

Steps:
1. Swap AVAX → USDC on Avalanche (our aggregator)
2. Rail select: CCTP not available for BSC → use Via Labs
3. Via Labs: USDC Avalanche → USDC BSC (~$0.25, ~2min)
4. On BSC: USDC → BNB via our aggregator (PancakeSwap plugin)
5. BNB delivered to user

Cost:    $0.25 rail + gas
Time:    ~2.5 minutes
Rails:   Via Labs
Hops:    1 rail, 1 settlement token (USDC)
Complexity: ★★☆☆☆
```

---

### Example D — Settlement Token Hop (USDT Backbone Chain)
**Route:** ETH on Ethereum → USDT on Plasma (USDT-native chain)

```
Problem: Plasma uses USDT as gas + primary token
         CCTP doesn't serve Plasma
         Axelar serves Plasma but with axlUSDT

Steps:
1. Swap ETH → USDC on Ethereum (our aggregator, Uniswap V3)
2. Rail select: Axelar (covers Plasma), settlement token: axlUSDT
   (USDC→USDT swap happens on Ethereum before bridging, via Curve)
3. Axelar: axlUSDT Ethereum → Plasma (~1 min)
4. On Plasma: axlUSDT → native USDT (Plasma DEX, near-zero slippage)
5. USDT delivered to user

Cost:    ~$0.50 Axelar + minimal swap fees
Time:    ~2 minutes
Rails:   Axelar (1 hop)
Settlement: USDC → USDT (hop before bridge)
Hops:    1 rail, 2 settlement tokens
Complexity: ★★★☆☆

NOTE: USDC→USDT swap on source chain is preferred over destination
      because Ethereum has deeper Curve pools (better rate, lower slippage)
```

---

### Example E — Double Rail Hop (Exotic Chain Pair)
**Route:** MATIC on Polygon → Token X on Kava (only on LayerZero)

```
Problem: No direct rail Polygon ↔ Kava
         LayerZero: Polygon ✅, Kava ✅
         But CCTP doesn't cover Kava
         Our aggregator not yet on Kava

Steps:
1. Swap MATIC → USDC on Polygon (our aggregator)
2. Rail select: LayerZero / Stargate V2 (USDC OFT)
3. LayerZero: USDC Polygon → USDC Kava (~1.5 min, DVN verified)
4. No aggregator on Kava: deliver USDC directly to user wallet
5. [Future: when aggregator on Kava] swap USDC → Token X

Cost:    ~$0.40 LZ fee + gas
Time:    ~2 minutes
Rails:   LayerZero
Settlement: USDC (OFT)
Hops:    1 rail, USDC delivered (no destination swap yet)
Complexity: ★★★☆☆
```

---

### Example F — Multi-Rail Failover (Recovery Scenario)
**Route:** USDC on Base → USDC on Celo (primary CCTP fails)

```
Primary attempt:
1. CCTP: Base → Celo
2. Circle attestation service DOWN (rare but happens)
3. VPS recovery engine detects: no attestation after 3 min
4. Triggers fallback to Via Labs

Fallback:
5. Via Labs: USDC Base → USDC Celo ($0.25, ~2 min)
6. Intent completes, user notified of slight delay

VPS behavior:
  - Timeout threshold: 3 min for CCTP (normally 20s)
  - Auto-fallback: yes, no user action needed
  - Status API reflects: IN_TRANSIT → RECOVERING → SETTLED

Cost:    $0.25 (fallback rail, no refund on original attempt gas)
Time:    ~6 minutes total (3 wait + 2 min Via Labs + buffer)
Complexity: ★★★★☆ (handled automatically)
```

---

### Example G — ETH Settlement (USDC/USDT Unavailable Path)
**Route:** SOL on Solana → native token on obscure EVM chain

```
Problem: Target chain only covered by LayerZero
         No USDC OFT on this chain
         Only ETH OFT available

Steps:
1. Swap SOL → USDC on Solana (Jupiter aggregator plugin)
2. USDC → WETH on Solana (Jupiter, 1 step)
3. LayerZero: ETH OFT Solana → ETH on target chain
4. ETH delivered to user (or swapped to target token if aggregator present)

Cost:    ~$0.50 LZ + $0.10 swap fees
Time:    ~3 minutes
Settlement: ETH (fallback token)
Hops:    1 rail, USDC→ETH on source
Complexity: ★★★★☆
```

---

## 5. VPS Throughput Benchmarks (Estimated)

### Single-Instance Node.js Process (8 vCPU, 32GB)

| Operation | Throughput | P99 Latency |
|---|---|---|
| Quote generation (cached) | 5,000/sec | 5ms |
| Quote generation (fresh RPC) | 50/sec | 200ms |
| Intent creation (DB write) | 2,000/sec | 15ms |
| Event processing (chain events) | 10,000/sec | 2ms |
| Settlement token selection | 50,000/sec | <1ms (in-memory) |
| Rail selection algorithm | 50,000/sec | <1ms (in-memory) |
| Concurrent in-flight intents | 3,000 | — |

### Bottleneck: RPC calls
RPC is the only real bottleneck. Solution:
- **Quote cache:** 30s TTL on DEX quotes (covers 80% of requests)
- **Multicall:** Batch on-chain reads into single RPC call
- **Premium RPC tiers:** Alchemy Growth ($199/month) at Scale tier
- **Fallback RPC:** Always have 2 providers per chain

---

## 6. Settlement Token Decision Tree (Simple Reference)

```
START
  ├─ Both chains on CCTP?
  │   └─ YES → Use CCTP + USDC ✅ (cheapest, fastest)
  │
  ├─ Destination chain USDT-native (Plasma, Tron, etc.)?
  │   ├─ Via Labs supports USDT here?
  │   │   └─ YES → Swap to USDT on source → Via Labs
  │   └─ Axelar supports USDT here?
  │       └─ YES → Swap to USDT on source → Axelar axlUSDT
  │
  ├─ Standard USDC path via Via Labs?
  │   └─ YES → Via Labs + USDC ($0.25 flat)
  │
  ├─ Axelar covers the pair?
  │   └─ YES → Axelar + axlUSDC (~$0.50)
  │
  ├─ LayerZero covers the pair?
  │   ├─ USDC OFT available? → YES → LZ Stargate + USDC
  │   └─ ETH OFT only? → YES → Swap to ETH on source → LZ ETH
  │
  └─ No path found → Return "unsupported route" to user
```

---

*Next steps: Contract interface definitions + VPS service skeleton*
