# Bridge Rail Status and Configuration

> Date: June 17, 2026
> Scope: current VPS bridge rail status, configuration model, intended coverage,
> and remaining gaps after the phase 2-5 bridge work.

## Purpose

This document explains where the current bridge rails stand in `ruflo`, what
each rail is configured for, and what is still missing.

The important distinction is that not every rail is supposed to scale to
hundreds of chains. Some rails are broad messaging networks. Others are
liquidity protocols with a small provider-owned chain set. Native bridges are
usually ecosystem-specific by design.

## Current Configuration Model

The current source of truth is split across:

- `src/vps/rails/registry.ts`
  - rail metadata in `RAIL_PROVIDERS`
  - chain-to-rail advertisement in `CHAIN_RAILS`
- `src/vps/services/QuoteEngine.ts`
  - offer generation and route shaping
- `src/vps/services/<rail>/*`
  - provider-specific quote and monitor workers
- `src/vps/app/runtime.ts`
  - rail enablement flags and worker construction

The main scalability limitation is `CHAIN_RAILS`: it is a code-level
`Record<number, Rail[]>`, not a generated catalog. That is acceptable for small
provider-owned rails, but broad rails should eventually derive availability
from provider metadata, checked-in catalogs, or database-backed capability
records.

## Rail Categories

| Category | Rails | Expected chain-count model |
|---|---|---|
| Broad messaging rails | `CCTP`, `LayerZero`, `Axelar`, `Via Labs`, `Hyperlane Nexus` | Potentially many chains, should be catalog-driven |
| Liquidity rails | `THORChain`, `Chainflip`, `Maya`, `TeleSwap` | Small provider-supported chain set |
| Native bridge rails | `Optimism native bridge`, future ecosystem bridges | Specific ecosystem or bridge family |
| Destination-gas rail | `Gas.zip` | Utility rail, not a bridge coverage rail |

## Chainflip

Status: implemented as a provider-direct liquidity rail.

Configured for:

- broker-backed quote and deposit-channel creation through
  `src/vps/services/chainflip/ChainflipBrokerClient.ts`
- provider-direct offer construction in `QuoteEngine`
- monitor lifecycle through `ChainflipMonitorWorker`
- supported asset identifiers such as `ETH.ETH`, `ETH.USDC`, `ARB.ETH`,
  `ARB.USDC`, `BTC.BTC`, `SOL.SOL`, `SOL.USDC`, and `DOT.DOT`

Why this shape is acceptable:

- Chainflip is not a 100-chain rail. It supports a small set of protocol-owned
  assets and chains, so an explicit allowlist is reasonable.
- Runtime configuration only needs provider-level settings such as
  `CHAINFLIP_BROKER_URL`, commission, timeout, and retry values.

Currently missing:

- asset support is hardcoded in `toChainflipAsset(...)`
- `CHAINFLIP_ACCESSIBLE_CHAIN_IDS` is static
- no provider-discovered asset catalog is cached or validated at startup
- no operational check that configured Chainflip assets still match the broker
  API's live support

Recommended next improvement:

- move Chainflip asset mapping into a small `chainflip-assets.json` or
  provider-discovered catalog with tests that verify quote requests use only
  supported provider asset IDs.

## Maya

Status: implemented as a provider-direct liquidity rail.

Configured for:

- Mayachain/Midgard quote calls through `MayaClient`
- direct deposit/vault style integration through the quote result
- monitor lifecycle through `MayaMonitorWorker`
- assets such as BTC, DOGE, KUJI, DASH, ZEC, ETH, USDC, USDT, BNB, and AVAX

Why this shape is acceptable:

- Maya is THORChain-like. It is a liquidity protocol with its own supported
  chain and asset universe, not a broad chain-to-chain messaging network.
- Defaults exist for `MAYA_MIDGARD_URL` and `MAYA_MAYANODE_URL`, so basic quote
  operation does not require per-chain env entries.

Currently missing:

- asset support is hardcoded in `toMayaAsset(...)`
- `MAYA_ACCESSIBLE_CHAIN_IDS` is static
- inbound address discovery exists in the client, but quote availability is not
  derived from live inbound/assets data
- no startup validation for halted chains or disabled Maya pools

Recommended next improvement:

- derive active Maya chain/asset support from Mayanode inbound addresses and
  Midgard asset data, then cache it behind a small capability catalog.

## TeleSwap

Status: implemented as a provider-direct liquidity rail.

Configured for:

- API-backed quote calls through `SdkTeleSwapQuoteWorker`
- BTC-specialized provider-direct deposit flows
- monitor lifecycle through `TeleSwapMonitorWorker`
- current chain focus: BTC, Polygon, and BSC

Why this shape is acceptable:

- TeleSwap is not intended to be a 100-chain rail in this repo. It is a narrow
  BTC route provider with specific destination ecosystems.
- The API request itself passes `src_chain` and `dst_chain` dynamically, so the
  worker is not locked to one pair internally.

Currently missing:

- `TELESWAP_ACCESSIBLE_CHAIN_IDS` is static
- no live provider capability discovery is used before advertising routes
- no explicit distinction between "provider supports the route" and "we have
  product confidence to surface the route"

Recommended next improvement:

- treat TeleSwap coverage as provider-limited and move supported routes into a
  small route catalog that can be reviewed independently from code changes.

## Optimism Native Bridge

Status: implemented as the first official native-bridge rollout.

Configured for:

- Ethereum `<->` Optimism standard bridge deposits and withdrawals
- supported token pairs: native ETH, USDC, USDT, and WETH
- patient withdrawal behavior for Optimism-to-Ethereum withdrawals
- runtime monitoring through `OptimismNativeBridgeMonitorWorker`

Why this shape is acceptable:

- this rail is intentionally not generic. It represents the Optimism standard
  bridge, so hardcoding Optimism bridge contracts and canonical token pairs is
  expected for this first rollout.
- it should not be treated as broad native-bridge coverage.

Currently missing:

- no generic native-bridge catalog for OP Stack, Arbitrum, Polygon, Base,
  Avalanche, or other ecosystem bridges
- no provider-discovered canonical token pair registry
- withdrawal monitoring is simplified around elapsed challenge period and source
  receipt; it is not a full prove/finalize lifecycle implementation

Recommended next improvement:

- introduce a `nativebridge` family catalog only when a second ecosystem bridge
  is selected. Avoid generalizing before there is another concrete bridge to
  model.

## Via Labs

Status: registered and advertised on selected chains, but not a full standalone
provider-direct rail.

Configured for:

- rail metadata in `RAIL_PROVIDERS`
- selected chain advertisement in `CHAIN_RAILS`
- generic messaging route shaping inside `QuoteEngine`

Currently missing:

- no dedicated Via Labs quote worker
- no dedicated Via Labs integration builder branch
- no dedicated Via Labs monitor worker
- current offer shaping still follows generic messaging semantics rather than a
  Via Labs-specific execution model
- no Via Labs provider capability catalog

Recommended next improvement:

- rebuild Via Labs as a real provider rail before expanding its advertised
  coverage. It should have quote, execute/select integration, watch, settle, and
  capability discovery or a reviewed route catalog.

## LayerZero

Status: implemented in two forms: generic route catalog support and provider API
support for LayerZero Value Transfer API.

Configured for:

- broad route catalog through `LayerZeroRouteCatalog`
- env/metadata-driven OFT address, destination EID, and extra-options lookup
- optional provider-direct LayerZero Value Transfer API quote and monitor flow

Where it stands:

- LayerZero is one of the rails where large chain counts are a real concern.
- It already has a more scalable configuration style than the small liquidity
  rails because it uses route metadata and env-key conventions.

Currently missing:

- `CHAIN_RAILS` still manually advertises chain eligibility
- large coverage still requires operationally complete route metadata per asset
  and chain
- provider API mode depends on `ENABLE_LAYERZERO_TRANSFER_API` and provider API
  credentials/configuration

Recommended next improvement:

- derive LayerZero rail availability from route metadata rather than manually
  maintaining chain membership in `CHAIN_RAILS`.

## Axelar

Status: generic messaging rail with dynamic asset-catalog support.

Configured for:

- `AxelarAssetCatalog`
- metadata/env based destination token ID lookup
- route shaping through generic messaging execution

Where it stands:

- Axelar is also a broad rail where large-chain scalability matters.
- The asset catalog model is closer to what we want for 100-chain style
  expansion than the fixed liquidity-rail maps.

Currently missing:

- `CHAIN_RAILS` still manually advertises chain eligibility
- advertised support can drift from provider-supported assets if route metadata
  is incomplete
- no dedicated live-provider validation pass in startup health checks

Recommended next improvement:

- keep Axelar capability data in route metadata or a generated provider catalog,
  and derive chain advertisement from that data.

## CCTP

Status: core native-USDC messaging rail.

Configured for:

- CCTP standard and fast plugin metadata
- Circle domain mapping
- CCTP fast as a quote variant rather than a separate rail

Where it stands:

- CCTP is broad only across Circle-supported domains, not arbitrary chains.
- It should remain tightly tied to Circle's domain and token support.

Currently missing:

- CCTP chain availability is still surfaced through manual `CHAIN_RAILS`
  membership
- expansion requires updating domain/token metadata and validating Circle support
- Solana/non-EVM source-side flows remain a separate product/runtime concern

Recommended next improvement:

- derive CCTP availability from Circle domain metadata and configured token
  addresses, then keep fast/standard as route variants.

## Hyperlane Nexus

Status: implemented as the Phase 2 provider-direct rail.

Configured for:

- provider-direct quote path
- `transferRemote(...)` integration payload
- monitor worker polling Hyperlane Explorer
- operator-managed warp route configuration

Note:

- Hyperlane has been handled separately and is not the focus of this document's
  scalability concern. Its correctness depends on the configured warp routes and
  the selected Hyperlane operational model.

## Summary

The current provider-limited rails are configured in a reasonable first version:

- `Chainflip`
- `Maya`
- `TeleSwap`
- `Optimism native bridge`

They should not be judged by whether they support hundreds of chains. Their
real requirement is that the configured set matches what the provider actually
supports.

The rails that need stronger scalability work are:

- `LayerZero`
- `Axelar`
- `Via Labs`
- future generic native-bridge families

The main missing system-level piece is a `RailCapabilityCatalog` that can feed
`CHAIN_RAILS`, quote availability, tests, and operational checks from the same
source of truth.

## Suggested Follow-Up Work

1. Create a typed rail capability catalog.
2. Move Chainflip, Maya, and TeleSwap asset maps into small reviewed catalog
   files.
3. Derive `CHAIN_RAILS` from catalog data for broad rails.
4. Add startup health checks that compare configured route support with provider
   availability where provider APIs expose it.
5. Rebuild Via Labs as a real quote/select/watch/settle provider rail before
   widening its advertised coverage.

