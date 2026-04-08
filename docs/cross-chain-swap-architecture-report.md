# Cross-Chain Swap Architecture Report
**Project:** EMPX-Cross-Chain Cross-Chain Aggregator
**Date:** 2026-03-25
**Status:** Initial Design Report

---

## 1. Executive Summary

We are building a **cross-chain swap router** that leverages existing aggregator deployments on 16+ chains and messaging rails (CCTP, Axelar, LayerZero, Via Labs) to move value from any token on Chain A to any token on Chain B — without operating our own liquidity pools or vaults.

**Core principle:** We are a **router and orchestrator**, not a liquidity provider. We compose existing infrastructure.

**Settlement token strategy:** USDC-first (via CCTP preferred), ETH as fallback. On chains where our aggregator is deployed, we do full any-to-any swaps. On chains without our aggregator, we deliver USDC (or ETH) directly to the user.

---

## 2. Rail Provider Analysis

### 2.1 CCTP — Circle Cross-Chain Transfer Protocol

| Property | Detail |
|---|---|
| Mechanism | Native burn/mint — USDC burned on source, natively minted on destination |
| Cost | **Free** (only pay gas) |
| Speed | ~20 seconds (fast finality chains) up to ~13 min (Ethereum mainnet, waits for 65 block confirmations) |
| Coverage | ~16 chains (Ethereum, Arbitrum, Avalanche, Base, Optimism, Polygon, Solana, Sui, Aptos, Linea, etc.) |
| Attestation | Circle's Attestation Service signs burn events off-chain; any relayer can mint |
| Integration | `TokenMessenger.depositForBurn()` → Circle API for attestation → `MessageTransmitter.receiveMessage()` |
| Limitation | USDC only. Requires Circle attestation (centralized bottleneck, though very reliable) |

**Best for:** Primary USDC rail. Zero bridging fee makes it the default choice wherever available.

---

### 2.2 Axelar — General Message Passing (GMP)

| Property | Detail |
|---|---|
| Mechanism | Validator-based consensus network (PoS). Source Gateway → Axelar consensus → Destination Gateway |
| Cost | Variable, prepaid on source chain. Typically $0.30–$1.50 depending on destination gas |
| Speed | 30 seconds – 3 minutes (depends on destination chain finality) |
| Coverage | 60+ chains, including many EVM + Cosmos chains |
| Token Transfer | `callContractWithToken()` — sends tokens + arbitrary message in one call |
| Integration | `AxelarGateway.callContract()` or `callContractWithToken()` + `IAxelarExecutable.execute()` on destination |
| Token Support | axlUSDC (wrapped), ITS (Interchain Token Service) for native tokens |
| Limitation | axlUSDC is a wrapped version, not native USDC. Wider chain coverage than CCTP |

**Best for:** Chains not covered by CCTP. Carrying arbitrary swap instructions alongside value.

---

### 2.3 LayerZero V2 — Omnichain Messaging

| Property | Detail |
|---|---|
| Mechanism | DVN (Decentralized Verifier Networks) + Executor model. Ultra-light nodes on each chain |
| Cost | Configurable. Paid upfront on source. Typically $0.10–$0.80 |
| Speed | Variable by DVN config. Can be near-instant with fast DVNs (Google Cloud, Polyhedra) |
| Coverage | 80+ chains |
| Token Standard | OFT (Omnichain Fungible Token) — burn/mint model similar to CCTP but for any token |
| Integration | `OApp.send()` → DVN verifies → `lzReceive()` on destination |
| Security Config | Configurable quorum of DVNs — can trade off speed vs. security |
| Limitation | No native USDC support (use USDC OFT or bridged variant). More complex config |

**Best for:** Chains only on LayerZero. Carrying complex calldata / swap instructions. Can also bridge USDC via Stargate (built on LZ).

---

### 2.4 Via Labs

| Property | Detail |
|---|---|
| Mechanism | Cross-chain routing protocol, aggregates bridges and liquidity. API-first |
| Cost | **~$0.25 flat fee** per transfer |
| Speed | 1–5 minutes typical |
| Coverage | 30+ chains |
| Token Support | USDC natively, plus other tokens via underlying bridges |
| Integration | REST API + optional smart contract hooks |
| Limitation | Less decentralized than the others; API dependency |

**Best for:** Rapid integration, USDC transfers on chains not covered by CCTP, as a fallback rail.

---

## 3. Rail Comparison Matrix

| Rail | USDC Type | Fee | Speed | Chain Coverage | Decentralization | Best Use |
|---|---|---|---|---|---|---|
| **CCTP** | Native | Free | 20s–13min | ~16 | High (Circle attestation) | Primary USDC rail |
| **Axelar** | axlUSDC (wrapped) | $0.30–$1.50 | 30s–3min | 60+ | High (PoS validators) | Wider coverage + GMP |
| **LayerZero** | OFT/Stargate USDC | $0.10–$0.80 | Variable | 80+ | High (DVN network) | Max chain coverage |
| **Via Labs** | Native USDC | ~$0.25 | 1–5min | 30+ | Medium (API) | Rapid fallback |

**Rail Priority Order (default):**
1. CCTP (free, native USDC, fast)
2. Via Labs (cheap, fast, easy)
3. Axelar (wide coverage, GMP capability)
4. LayerZero (maximum chain coverage)

---

## 4. System Architecture

### 4.1 High-Level Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                           │
│              (Web App / SDK / Direct Contract)                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Intent Submission
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    INTENT ENGINE (VPS)                          │
│  • Quote generation      • Route selection                      │
│  • Rail selection        • Fee estimation                       │
│  • Intent validation     • Status tracking                      │
└──────┬───────────────────┬────────────────────────────┬─────────┘
       │                   │                            │
       ▼                   ▼                            ▼
┌──────────────┐  ┌────────────────┐         ┌────────────────────┐
│ SOURCE CHAIN │  │  RAIL LAYER    │         │  DESTINATION CHAIN │
│              │  │                │         │                    │
│ RouterV1     │  │ • CCTP         │         │ RouterV1 (if avail)│
│ (our contract│  │ • Axelar GMP   │         │ OR                 │
│  + aggregator│  │ • LayerZero    │         │ Direct USDC/ETH    │
│  plugin)     │  │ • Via Labs     │         │ delivery to user   │
└──────────────┘  └────────────────┘         └────────────────────┘
```

### 4.2 Contract Architecture — Plugin Style

```
RouterV1 (main entry point, upgradeable proxy)
├── ISwapPlugin (interface)
│   ├── UniswapV3Plugin
│   ├── CurvePlugin
│   ├── BalancerPlugin
│   └── [ChainSpecificDEXPlugin...]
│
├── IRailPlugin (interface)
│   ├── CCTPRailPlugin
│   ├── AxelarRailPlugin
│   ├── LayerZeroRailPlugin
│   └── ViaLabsRailPlugin
│
├── ISettlementPlugin (interface)
│   └── [future: additional settlement methods]
│
└── PluginRegistry (owner-controlled registry)
    └── Maps pluginId → address, validates plugins
```

Each plugin implements a standard interface:
```solidity
interface IRailPlugin {
    function estimateFee(RailParams calldata p) external view returns (uint256 fee, uint256 eta);
    function bridge(BridgeParams calldata p) external payable returns (bytes32 railTxId);
    function supportsChain(uint256 chainId) external view returns (bool);
    function settlementToken() external view returns (address);
}

interface ISwapPlugin {
    function swap(SwapParams calldata p) external returns (uint256 amountOut);
    function getQuote(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256);
}
```

---

## 5. Intent Flow — Step by Step

### 5.1 Full Any-to-Any (both chains have our aggregator)

```
User on Chain A: TokenA → [wants] → TokenB on Chain B

1. QUOTE PHASE (off-chain, VPS)
   • Fetch swap quote: TokenA → USDC on Chain A (via our aggregator)
   • Select best rail: CCTP > Via Labs > Axelar > LayerZero
   • Fetch swap quote: USDC → TokenB on Chain B (via our aggregator)
   • Compute total: slippage + rail fee + gas estimate
   • Return: quote object with route, fees, ETA, expiry

2. INTENT SUBMISSION (on-chain, Chain A)
   • User calls RouterV1.initSwap(IntentParams)
   • Contract verifies params, locks intent hash on-chain
   • Executes: TokenA → USDC via SwapPlugin (local aggregator)
   • Calls: RailPlugin.bridge(USDC, amount, destinationChain, destinationReceiver, calldata)
   • Emits: IntentInitiated(intentId, user, srcChain, dstChain, ...)

3. TRANSIT PHASE (rail provider)
   • CCTP: burn on source, Circle attestation, mint on destination
   • Axelar: Gateway event → validator consensus → destination execution
   • LayerZero: DVN verification → lzReceive on destination
   • Via Labs: API routes and executes

4. DESTINATION EXECUTION (on-chain, Chain B)
   • RouterV1 (or receiver contract) receives USDC + calldata
   • Decodes intent: swap USDC → TokenB for user
   • Executes swap via SwapPlugin
   • Transfers TokenB to user wallet
   • Emits: IntentSettled(intentId, user, tokenOut, amountOut)

5. CONFIRMATION (VPS)
   • Monitor destination chain for IntentSettled event
   • Update intent status: COMPLETED
   • Notify user (webhook/frontend)
```

### 5.2 Settlement-Only (destination chain has no aggregator)

```
User on Chain A: TokenA → [wants] → USDC on Chain B (no aggregator)

Steps 1-3 same as above.

4. DESTINATION: Direct USDC delivery
   • Rail delivers USDC directly to user wallet
   • No swap needed — USDC is the final token
   • VPS monitors and confirms delivery
```

### 5.3 Edge Case: No USDC path available

```
• Fall back to ETH as settlement token
• Use ETH bridge (Axelar ETH, LayerZero ETH, native bridge)
• Deliver ETH to user on destination chain
• Note: slightly higher cost, slower
```

---

## 6. Router Logic — Rail Selection Algorithm

```
function selectRail(srcChain, dstChain, amount, urgency):

  1. Filter: rails that support BOTH srcChain AND dstChain
  2. Filter: rails that support USDC (prefer native USDC)

  3. Score each candidate rail:
     score = (1/fee) * speedWeight * reliabilityWeight * usdcNativeBonus

     where:
       speedWeight    = urgency ? 2.0 : 1.0
       reliabilityWeight = historical success rate (stored in VPS DB)
       usdcNativeBonus   = CCTP=2.0, ViaLabs=1.5, Axelar=1.2, LZ=1.0

  4. Return top rail. If score delta < 10%, prefer: CCTP > ViaLabs > Axelar > LZ

  5. Fallback chain:
     PRIMARY → SECONDARY → TERTIARY
     (if primary fails after N retries, VPS triggers fallback)
```

---

## 7. VPS Off-Chain Orchestrator

A single, high-capacity VPS handles all off-chain logic. No blockchain required for this layer.

### 7.1 Responsibilities

| Module | Function |
|---|---|
| **Quote Engine** | Fetches DEX quotes (1inch, paraswap APIs or direct), computes optimal route |
| **Rail Selector** | Runs rail selection algorithm, checks chain coverage, estimates fees |
| **Intent Store** | Stores all intents with full state machine lifecycle |
| **Event Monitor** | Listens to source & destination chain events (WebSocket RPC) |
| **Executor** | Submits transactions where needed (e.g. CCTP attestation relay) |
| **Recovery Engine** | Detects stuck intents, triggers retry or fallback |
| **Paymaster Service** | Prepares EIP-4337 UserOps, submits to paymaster-enabled bundlers |
| **Webhook/Status API** | REST API for frontend to poll intent status |

### 7.2 Intent State Machine

```
CREATED → QUOTED → SUBMITTED → IN_TRANSIT → DESTINATION_RECEIVED → SETTLED
                                    ↓                ↓
                                  STUCK           FAILED
                                    ↓
                                RECOVERING → (retry or fallback rail)
```

Every state transition emits an event. Frontend polls `/intent/{id}/status`.

---

## 8. Gas Abstraction — Paymaster Strategy

### 8.1 Universal Gas Model

- Use **EIP-4337 (Account Abstraction)** with a Paymaster contract
- User pays gas in the **input token** (or USDC)
- Paymaster covers native gas on all chains
- Compatible paymasters: **Pimlico, Biconomy, ZeroDev, Stackup**

### 8.2 Gas Flow

```
User approves TokenA (includes gas buffer)
  → RouterV1 takes fee (covers: swap gas + rail fee + destination gas estimate)
  → Paymaster sponsor covers any native gas shortfall
  → Fee is settled in USDC from the swap output
```

### 8.3 Gas Estimation

VPS pre-estimates total gas for full route:
```
totalCost = swapGasSrc + railFee + railGas + swapGasDst + safetyBuffer(15%)
```

This is quoted to user upfront. Buffer absorbs gas spikes.

---

## 9. Contract Security Model

### 9.1 Principles
- **No custody** — contract never holds user funds except atomically during execution
- **Reentrancy guards** on all external calls
- **Input validation** at every boundary (amounts > 0, valid chain IDs, plugin whitelisted)
- **Plugin registry** — only owner-approved plugins can be used
- **Pausable** — emergency pause with timelock for critical functions
- **Slippage protection** — `minAmountOut` enforced on destination

### 9.2 Plugin Trust Model
```
PluginRegistry.addPlugin(address plugin, PluginType type)
  → Only owner (multisig) can add plugins
  → Plugin must implement correct interface (EIP-165 check)
  → Plugin address is immutable once registered (upgrades = new registration)
```

---

## 10. What Each Component Owns

| Component | Responsibility |
|---|---|
| **RouterV1 (source)** | Entry point, swap to USDC, call rail plugin, emit intent events |
| **ReceiverV1 (destination)** | Receive from rail, swap USDC to target token, deliver to user |
| **SwapPlugin** | DEX aggregation on local chain (wraps 1inch/paraswap/native DEX) |
| **RailPlugin** | Abstracts CCTP/Axelar/LZ/ViaLabs into standard bridge interface |
| **PluginRegistry** | On-chain registry of approved plugins, maps IDs to addresses |
| **IntentEngine (VPS)** | Quotes, routes, monitors, recovers, paymasters |
| **EventMonitor (VPS)** | Watches chain events, drives state machine transitions |
| **Status API (VPS)** | Serves intent status to frontend/SDK |

---

## 11. Key Design Decisions

### Why USDC as settlement token?
- CCTP provides **free, native-minted USDC** — no wrapped token risk
- USDC is liquid on every target chain — downstream swap always possible
- Avoids liquidity fragmentation (no proprietary bridge token)

### Why plugin architecture?
- Add new chains: deploy new SwapPlugin, register it
- Add new rails: deploy new RailPlugin, register it
- No core contract upgrades needed for expansions
- Each plugin is independently auditable

### Why no vaults/liquidity pools?
- Eliminates liquidity risk and capital requirements
- No impermanent loss exposure
- Simpler security model — we route, rails settle
- Composable on top of battle-tested infrastructure

### Why a VPS instead of on-chain solver?
- Intent tracking, recovery, and monitoring require stateful off-chain logic
- Lower latency for quote generation
- Easier to update routing logic without contract upgrades
- One well-provisioned VPS (16-core, 32GB RAM) handles thousands of concurrent intents

---

## 12. Phased Rollout

### Phase 1 — Foundation
- [ ] Deploy RouterV1 + ReceiverV1 on top 5 chains (Ethereum, Arbitrum, Base, Optimism, Polygon)
- [ ] CCTP rail plugin
- [ ] Uniswap V3 swap plugin
- [ ] Basic VPS intent engine + status API

### Phase 2 — Coverage Expansion
- [ ] Axelar rail plugin (adds 40+ chains)
- [ ] Via Labs rail plugin
- [ ] Additional DEX swap plugins per chain
- [ ] Paymaster integration

### Phase 3 — Full Scale
- [ ] LayerZero rail plugin
- [ ] Deploy ReceiverV1 to remaining 11+ chains
- [ ] ETH settlement fallback
- [ ] Recovery engine + stuck intent handling
- [ ] Frontend SDK

---

## 13. Open Questions / Design Choices Needed

1. **Rail fallback timeout:** How long to wait before triggering fallback? (Suggested: 5min for CCTP, 10min for others)
2. **Fee model:** Flat fee per swap or % of transfer amount?
3. **Destination executor:** Who submits the destination chain swap tx? (VPS relayer vs. user self-relay)
4. **axlUSDC handling on Axelar chains:** Accept axlUSDC as-is or always swap to native USDC first?
5. **Minimum transfer size:** Below what amount does the rail fee make it uneconomical? (Suggested: $5 minimum)
6. **Multisig for PluginRegistry:** 2-of-3 or 3-of-5?

---

*End of initial architecture report. Next step: contract interface definitions and VPS service design.*
