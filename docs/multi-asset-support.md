# Multi-Asset + Multi-Rail Support: Current Possibilities and Limits

Last updated: 2026-04-24

## Short Answer

No, this does not mean we can automatically support every chain and every token on every rail.

What we have now is a scalable architecture that can support many more chains and assets, but each expansion still depends on provider support, chain configuration, token metadata, deployed contracts, and monitoring readiness.

## Current Coverage Snapshot (From Registry)

These numbers are derived from `CHAIN_CONFIGS` and `CHAIN_RAILS` in the current codebase.

- Known chains: `39`
- EVM chains: `33`
- Non-EVM chains: `6`
- Chains marked as aggregator-enabled (`hasAggregator=true`): `14`
- Registry-level direct pair coverage (ordered src->dst pairs with at least one shared rail): `1156 / 1482` (`78.0%`)

## Rail Footprint (Registry-Level)

| Rail | Chains listed | Direct ordered pair upper-bound* | Current runtime mode |
|---|---:|---:|---|
| CCTP | 13 | 156 | Worker (optional) |
| Axelar | 31 | 930 | Passive (event-monitor driven) |
| LayerZero | 32 | 992 | Passive (event-monitor driven) |
| Via Labs | 25 | 600 | Passive |
| Wormhole | 1 | 0 | Passive / placeholder |
| THORChain | 12 | 132 | Worker (enabled by flag) |

\* Upper-bound per rail is `n * (n - 1)` using chain count for that rail only; real routable pairs are the union across rails plus quote-time constraints.

## Token Support Model (Important)

The system is multi-asset at the intent/offer level, but rails still bridge specific settlement assets.

- CCTP: USDC settlement only.
- Axelar: USDC/USDT/ETH settlement paths (dynamic per-provider metadata).
- LayerZero: USDC/USDT/ETH settlement paths (dynamic OFT/route metadata).
- Via Labs: USDC/USDT/ETH settlement model.
- THORChain: quote layer supports native delivery targets (ETH/BTC/SOL paths and canary gating).
- Wormhole: currently modeled, but route footprint is not expanded yet in `CHAIN_RAILS`.

Arbitrary `tokenIn -> tokenOut` is only realistically possible on chains with aggregator + swap plugin + liquidity, because non-aggregator chains are settlement-token only.

## What This Architecture Enables

- Multi-offer rail marketplace: user sees all viable rail offers and chooses explicitly.
- Rail-specific economics: provider fee, gas, slippage, settlement time, outbound fees.
- Provider-specific execution metadata: dynamic Axelar/LayerZero/THOR data is encoded into selected offers.
- Safe execution binding: selected rail is sticky (no silent cross-rail fallback after selection).
- THORChain canary controls: allowlist-based rollout and rollback switches.

## Why This Is Not "All Chains + All Tokens"

- Provider limits: each rail has its own supported chain/token matrix.
- Config limits: chain must exist in `CHAIN_CONFIGS` and rail coverage must exist in `CHAIN_RAILS`.
- Metadata limits:
  - Axelar needs destination token-id mapping per asset/chain.
  - LayerZero needs OFT, destination EID, and options per route.
- On-chain deployment limits: source Router/registry and destination Receiver/adapter addresses must exist and be configured.
- Quote realism limits: if real DEX quote adapters are not configured, default mock quote behavior can overstate practical token support.
- Route materialization limit: `QuoteEngine` currently builds offers from direct single-hop routes only (`route.hops.length === 1`), even though hub-hop route logic exists.

## Practical Answer To "Can We Support Everything?"

We can support a large and growing subset of chains/tokens across rails, but not "everything" automatically.

A realistic target with this architecture is:

- Broad EVM coverage on Axelar/LayerZero/Via once per-chain metadata and deployment are complete.
- CCTP where Circle domains and native USDC support exist.
- THORChain for selected native-asset routes, rolled out via canary controls.

Universal coverage is not a single switch. It is an iterative rollout per rail, per chain, per asset class.

## Expansion Checklist

For each new chain:

1. Add chain entry to `CHAIN_CONFIGS`.
2. Add rail membership in `CHAIN_RAILS`.
3. Configure settlement token env vars: `CHAIN_<id>_TOKEN_<RAIL>_<TOKEN>`.
4. Configure Router/Receiver addresses and ABI mode where needed.
5. Add provider metadata:
   - Axelar token IDs.
   - LayerZero OFT + destination EID + extra options.
6. Enable monitor/worker behavior for the rail where applicable.
7. Validate quote -> select -> calldata -> execution -> settlement flow.

For each new settlement asset class beyond current norms:

1. Extend provider catalogs and alias resolution.
2. Extend intent/contract settlement enum and plugin token handling if needed.
3. Add token mappings on all participating chains/rails.
4. Add tests for quote, selection, calldata, and receiver validation paths.
