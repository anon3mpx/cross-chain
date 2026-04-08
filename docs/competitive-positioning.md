# EMPX-Cross-Chain vs NEAR Intents — Competitive Positioning
**Date:** 2026-03-26

---

## What NEAR Intents Does Well (and We Must Match)

NEAR Intents (via Defuse Protocol) set the bar for intent-based cross-chain UX:

| Feature | NEAR Intents | EMPX-Cross-Chain (current) | Gap |
|---|---|---|---|
| SDK lines to integrate | ~5 | ~5 (RufloSDK) | **Matched** |
| Real-time status | WebSocket push | WebSocket push | **Matched** |
| Gas abstraction | Yes (NEAR account model) | Paymaster (Pimlico) | **Matched** |
| Pre-confirmation UX | Yes (optimistic) | Yes (WS sends on connect) | **Matched** |
| Native BTC swaps | No (wrapped only) | **Yes (THORChain)** | **We win** |
| Native Solana swaps | Yes (NEAR is SVM-adjacent) | Yes (THORChain + CCTP) | **Matched** |
| EVM coverage | Limited (via bridges) | 16+ chains + 80+ via LZ | **We win** |
| Decentralisation | NEAR validators | Multiple independent rails | **We win** |
| BTC/DOGE/LTC | No | **Yes (THORChain)** | **We win** |

**Our edge in one sentence:** EMPX-Cross-Chain does everything NEAR Intents does on UX/DX, but covers every chain including native Bitcoin — without locking users into the NEAR ecosystem.

---

## The 5-Rail Stack vs NEAR's Solver Model

NEAR Intents uses a **solver competition model** — multiple solvers bid to fill intents, best price wins. This gives good rates but requires solver liquidity and introduces latency from the auction.

EMPX-Cross-Chain uses a **deterministic routing model** — the VPS selects the mathematically optimal rail in <1ms. No auction delay. Scores update in real-time based on `reliabilityScore` history.

```
NEAR Intents flow:
  User intent → broadcast to solvers → auction (200-500ms) → winner executes

EMPX-Cross-Chain flow:
  User intent → RailSelector (<1ms) → best rail executes immediately
```

For most swaps (<$50K), deterministic routing beats solver auctions on speed. For very large swaps ($500K+), a solver model can find better rates. We can add a solver layer later without changing the contract architecture.

---

## Our 5-Rail Coverage Map

```
                    EVM    BTC    SOL    DOGE   COSMOS  DOT
CCTP              ✓(16)    ✗     ✓       ✗       ✗      ✗
Via Labs          ✓(30)    ✗     ✗       ✗       ✗      ✗
Axelar            ✓(60)    ✗     ✗       ✗      ✓       ✗
LayerZero         ✓(80)    ✗     ✓       ✗       ✗      ✗
THORChain         ✓(6)    ✓     ✓      ✓       ✓       ✗
─────────────────────────────────────────────────────────
TOTAL COVERAGE    80+      ✓     ✓      ✓       ✓       ✗
```

No single competitor has this breadth. LI.FI covers EVM broadly but has no native BTC. THORSwap has BTC but limited EVM aggregation. NEAR Intents has Solana but no BTC.

---

## Developer Experience — Competing on Simplicity

### Minimal integration (Mode A)

```typescript
import { RufloSDK, CHAIN_ID } from '@ruflo/sdk';

const ruflo = new RufloSDK({ apiKey: 'rflo_...' });

// EVM → EVM
const swap = await ruflo.swap({
  from: { chainId: CHAIN_ID.ARB, token: '0xARBaddr', amount: '100' },
  to:   { chainId: CHAIN_ID.BASE, token: '0xOPaddr' },
  wallet: '0xUserWallet',
});

swap.on('status', (s) => console.log('Status:', s));
const result = await swap.settle();
console.log('Done:', result.dstTxHash);
```

### EVM → Native Bitcoin

```typescript
const swap = await ruflo.swap({
  from: { chainId: CHAIN_ID.ETH, token: 'NATIVE', amount: '0.5' },
  to:   { chainId: CHAIN_ID.BTC, token: 'BTC', nativeAddress: 'bc1qrecipient...' },
  wallet: '0xUserWallet',
});
const result = await swap.settle(); // ~60s
```

### Wallet provider integration (3 lines)

```typescript
// In your wallet's swap tab:
const { tx } = await ruflo.quote({ from, to, wallet });
await userWallet.sendTransaction(tx);  // pre-built, just sign
```

---

## UX Principles to Match NEAR Intents

### 1. Optimistic pre-confirmation
- As soon as source tx is confirmed, show "Swap in progress" with ETA countdown
- WebSocket sends `IN_TRANSIT` immediately — no polling gap
- Never show a blank loading screen

### 2. Single signing experience
- User signs exactly ONE transaction regardless of source chain
- RouterV1 handles everything: swap + fee + bridge in one call
- No separate "approve" step (forceApprove inside plugin)

### 3. Gas abstraction (Paymaster)
- User pays gas in their input token (ARB, MATIC, etc.)
- Pimlico/Biconomy Paymaster covers native gas
- Quote includes gas cost in the fee breakdown — no surprises

### 4. Chain-agnostic identity
- User's EVM address works as identity across all EVM chains
- For BTC/SOL destinations: user provides native address once (saved by frontend)
- Future: account abstraction wallet that holds cross-chain identity

### 5. Transparent failure handling
- If stuck: auto-retry on fallback rail, user sees "Rerouting..."
- If failed: full refund path (funds never leave if revert on source)
- Always show which rail was used and why

---

## Revised Rail Priority (Final)

```
EVM → EVM (stable):    CCTP > Via Labs > Axelar > LayerZero
EVM → EVM (any token): same (DEX handles token conversion on each end)
EVM → BTC:             THORChain (only option with real BTC)
EVM → SOL (USDC):      CCTP v2 (free, native, Solana domain 5)
EVM → SOL (native):    THORChain
EVM → DOGE/LTC/BCH:    THORChain
EVM → Cosmos:          Axelar (IBC-native) > THORChain
EVM → USDT chains:     Axelar (axlUSDT) > LayerZero > Via Labs
```
