# Native Rails Extension — THORChain, Chainflip & SVM Strategy
**Date:** 2026-03-26 | **Status:** Architecture Design

---

## The Two Rail Categories

```
MESSAGING RAILS                      LIQUIDITY RAILS
(bridge-based)                       (AMM-based)
─────────────────────────────────    ─────────────────────────────────
CCTP        → native USDC            THORChain  → real BTC, SOL, ETH
Axelar      → 60+ EVM chains         Chainflip  → BTC, SOL, DOT, ETH
LayerZero   → 80+ chains             Wormhole   → EVM↔SVM SPL tokens
Via Labs    → 30+ chains

Needs ReceiverV1 on destination      Delivers DIRECTLY to user's
EVM contract.                        native address. No ReceiverV1.
Settlement: USDC/USDT/ETH            Settlement: native asset itself
```

The addition of liquidity rails **unlocks every chain that has never had EVM bridging** — native Bitcoin, native Solana SPL tokens, Cosmos, Polkadot, Dogecoin. No wrapped assets. No bridged representations.

---

## THORChain — What It Actually Is

THORChain is a **decentralized cross-chain AMM** that uses RUNE as the routing intermediary. Every swap is TOKEN_A → RUNE → TOKEN_B, but from the user's perspective it's direct.

**Live inbound addresses (verified from /thorchain/inbound_addresses API):**

| Chain | Router Address | Status |
|---|---|---|
| ETH | 0x... (varies) | Live |
| AVAX | 0x8F66c4AE756BEbC49Ec8B81966DD8bba9f127549 | Live |
| BASE | 0x68208d99746b805a1ae41421950a47b711e35681 | Live |
| BSC | 0xb30ec53f98ff5947ede720d32ac2da7e52a5f56b | Live |
| BTC | bc1q... (rotates) | Live |
| BCH | qpm90... | Live |
| DOGE | D... | Live |

**Memo format (how we tell THORChain what to do):**
```
=:ASSET:DESTADDRESS:LIMIT
```
Examples:
```
=:BTC.BTC:bc1qrecipient:100000000            → deliver 1 BTC to Bitcoin address
=:SOL.SOL:HN7cABqLq46:0                      → deliver SOL to Solana address
=:ETH.USDC-0xA0B....:0xEvmAddr:0             → deliver USDC on ETH
=:AVAX.AVAX:0xEvmAddr:0                      → deliver native AVAX
```

**THORChain fee model:**
- No flat fee — **slip-based** (~0.1-0.3% for typical amounts)
- Outbound fee: covers gas on destination chain (e.g. ~$0.50 for BTC)
- Streaming swaps: break large swaps into smaller chunks to reduce slip → available via memo

**When THORChain wins over CCTP:**
- Destination is BTC, DOGE, LTC, BCH, Cosmos → CCTP can't help at all
- Destination is Solana + token is not USDC → THORChain native delivery
- Large ETH→ETH transfers where user doesn't want USDC as intermediate

**THORChain risks:**
- Has halted trading 3× in history (security incidents)
- Liquidity depth varies — $5M+ pools for BTC/ETH, smaller for others
- `reliabilityScore: 0.975` (lower than CCTP's 0.997) — reflected in RailSelector

---

## Chainflip — What It Actually Is

Chainflip uses a **JIT (Just-In-Time) AMM** where LPs provide liquidity specifically when a swap arrives, eliminating the idle capital problem. The protocol uses threshold signature cryptography (TSS) to manage vaults.

**Supported assets (as of 2026):**
BTC, ETH, USDC, SOL, DOT, FLIP (governance token)

**Integration model — Broker API:**
```
1. Our VPS registers as a Chainflip Broker (one-time)
2. For each swap: call SDK requestDepositAddress(srcAsset, dstAsset, dstAddress)
3. SDK returns a deposit address unique to this swap
4. User sends tokenIn to that deposit address
5. Chainflip handles: receives → swaps → delivers to dstAddress
6. Broker earns fee (configurable, typically 5-15 bps)
```

**Key difference from THORChain:** Chainflip's deposit channel model means the user sends directly to the deposit address, bypassing RouterV1 entirely. This is a **Mode B** integration.

**When Chainflip wins over THORChain:**
- DOT (Polkadot) destination — THORChain doesn't support DOT
- SOL destination — Chainflip's JIT model gives better rates on smaller swaps
- Ultra-fast BTC swaps (Chainflip ~45s vs THORChain ~60s)

---

## Solana (SVM) Full Strategy

| Scenario | Best Rail | Settlement Token | Notes |
|---|---|---|---|
| EVM → USDC on Solana | **CCTP v2** | USDC | Free, native, ~25s. Solana domain = 5. |
| EVM → SOL (native) | **Chainflip** or **THORChain** | SOL | Direct delivery to Solana address |
| EVM → SPL token (non-USDC) | **Wormhole** + Jupiter | USDC | Bridge USDC → Jupiter swap on Solana |
| Solana → EVM | **CCTP v2** | USDC | Circle supports Solana→EVM direction |
| SOL → native BTC | **THORChain** | BTC | SOL.SOL pool → BTC.BTC |

**CCTP v2 Solana domain = 5** — already works with our CCTPRailPlugin, just needs the Solana domain added to `chainToDomain[99] = 5`.

**For SPL tokens (Raydium, Orca tokens etc.):**
- User swaps SPL → USDC on Solana via Jupiter (off-chain coordination)
- CCTP bridges USDC to EVM
- RouterV1 receives and swaps USDC → tokenOut
- This is a **Solana-origin flow** — requires a Solana program (future work)

---

## Architecture Impact Summary

### What changes in the smart contracts
1. `BridgeParams` extended with `nativeDstAddress`, `thorAssetIdentifier`, `minThorOutput`
2. `THORChainRailPlugin.sol` — new liquidity rail, calls THORChain Router
3. `SettlementToken` enum extended: + BTC, SOL
4. No changes needed to RouterV1 or ReceiverV1 — plugin interface absorbs everything

### What changes in the VPS
1. `RailSelector` — THORCHAIN and CHAINFLIP added to RAIL_CONFIGS + CHAIN_RAILS
2. `QuoteEngine` — fetch live THORChain quotes from `/thorchain/quote/swap` API
3. `EventMonitor` — add THORChain outbound tx monitoring (Midgard API)
4. `IntentEngine` — stuck thresholds updated: BTC 15min, SOL 2min
5. New: `THORChainKeeper` — polls `/inbound_addresses` every 5min, updates vault addresses
6. New: Chainflip SDK integration for deposit channel creation

### What the VPS monitors for THORChain intents
```
POST /thorchain/quote/swap  → get fee estimate before quoting
GET  /midgard/v2/actions    → monitor for outbound tx by memo/address
GET  /thorchain/tx/{hash}   → confirm destination receipt
```

---

## Revised Rail Priority Order

```
For EVM → EVM (USDC):     CCTP > Via Labs > Axelar > LayerZero
For EVM → EVM (any):      same as above (src/dst swaps handle the rest)
For EVM → BTC:            THORChain > Chainflip
For EVM → SOL (USDC):     CCTP v2 (free, native)
For EVM → SOL (native):   Chainflip > THORChain
For EVM → DOGE/LTC/BCH:   THORChain only
For EVM → DOT:            Chainflip only
For USDT-backbone chains: Axelar (axlUSDT) > LayerZero > Via Labs
```

---

## Chainflip vs THORChain — Head to Head

| Factor | THORChain | Chainflip |
|---|---|---|
| BTC liquidity | Deep (~$200M TVL) | Shallower (~$30M TVL) |
| SOL support | Yes (added 2024) | Yes |
| DOT support | No | Yes |
| AMM model | CLP (continuous) | JIT |
| Slippage small txs | 0.1-0.3% | 0.05-0.1% (JIT is better) |
| Slippage large txs | Higher | Similar |
| Halting risk | Yes (has halted before) | Lower (newer, TSS-based) |
| Integration complexity | High (memo format, vault rotation) | Medium (broker API) |
| Our recommendation | **Primary** for BTC/DOGE/LTC | **Primary** for SOL/DOT |
