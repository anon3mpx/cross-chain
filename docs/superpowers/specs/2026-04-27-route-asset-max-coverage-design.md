# Route Asset Model For Maximum Coverage Design

**Date:** 2026-04-27
**Status:** Draft for review
**Scope:** Redesign route selection so Ruflo can maximize executable coverage across implemented rails by combining swap plugins with rail-specific route assets, while preserving direct-transfer quality when a provider supports it.

---

## Goal

Support the product behavior:

- user asks for `any token on source -> any token on destination`
- Ruflo returns all executable offers across the implemented rails
- direct asset delivery is preferred when a rail supports it
- swap-in / swap-out routes are still suggested when direct delivery is not available

The objective is not "every rail directly supports every asset." The objective is:

`tokenIn -> rail-supported route asset -> tokenOut`

with accurate execution, validation, and ranking.

---

## Decision Summary

### 1. Keep whitelisting, but make it rail-specific

Do not remove settlement-asset whitelisting entirely.

Instead, replace the current tiny global settlement-token model with a dynamic, per-rail route-asset model:

- each rail can expose multiple allowed route assets
- support is evaluated per `rail + srcChain + dstChain + routeAsset + offerType`
- route assets can differ across rails for the same user transfer

This keeps execution safe while allowing maximum practical coverage.

This whitelist should live off-chain in the VPS control plane, not on-chain in every deployed contract.

### 2. Optimize for maximum route coverage, not uniformity

The system should prefer executable coverage even when different rails require different route assets or different execution shapes.

For the same request, offers may differ like:

- direct transfer with no destination swap
- source swap only
- destination swap only
- source swap plus destination swap

Those are all valid offers if they are executable and accurately quoted.

### 3. Direct routes must be first-class

If a rail supports direct transfer of a better route asset, that route must not be flattened into a generic stablecoin-shaped model.

Example:

- `Base WETH -> Arbitrum ETH`
  - `LayerZero direct ETH-style route`
  - `LayerZero USDC + dst swap`
  - `Axelar USDC + dst swap`
  - `CCTP standard USDC + dst swap`
  - `CCTP fast USDC + dst swap`

The direct LayerZero route should be represented and ranked as a better-quality route when its economics are better.

### 4. LayerZero stays one rail family with distinct offer types

LayerZero should remain one top-level rail, but it should emit distinct offer types beneath it:

- `lz_oft`
- `lz_oft_adapter`
- `lz_stargate_pool`
- `lz_stargate_oft`

This allows Ruflo to surface direct LayerZero routes without pretending all LayerZero assets behave the same way.

### 5. Swap plugins remain the mechanism that unlocks "any token transfer"

`EmpsealSwapPlugin.sol` and the other DEX-style swap plugins are not fallback details. They are core to the coverage model.

They enable:

- source-side entry into the chosen route asset
- destination-side exit from the chosen route asset

That is how Ruflo should support "any token transfer" without falsely claiming that every rail directly supports arbitrary assets.

---

## Problem Statement

The current branch has improved multi-offer and dynamic-asset support, but it still frames route construction too much around a narrow settlement-token concept.

That is not sufficient for maximum-coverage routing because:

- multiple rails can support the same chain pair with different route qualities
- a direct bridged asset may be better than a stablecoin intermediate
- some providers support several token standards under one rail family
- swap plugins make indirect routes viable without degrading the best direct route

The system therefore needs to answer:

- what exact asset does this rail move for this chain pair?
- does it deliver directly or require a destination swap?
- can the source side enter that asset?
- can the destination side exit that asset?
- how should this route be ranked against other routes?

---

## Terminology

The term `settlement token` is too narrow for the target model.

Use the term `route asset` for the asset actually carried by the rail.

Examples:

- CCTP route asset: native USDC
- Axelar route asset: rail-supported Axelar token for the pair
- LayerZero route asset: OFT / OFTAdapter / Stargate-supported asset
- THORChain route asset: THOR-supported inbound or outbound asset

The old concept still exists in a narrower sense, but the core quote and execution model should be centered on `route asset`.

---

## Target Product Behavior

For a request such as:

- `Morpho on Arbitrum -> Pancake on Base`

Ruflo should be able to return multiple offers such as:

- `LayerZero direct route asset + dst swap`
- `LayerZero route asset + src swap + dst swap`
- `Axelar route asset + src swap + dst swap`
- `CCTP standard + USDC + src swap + dst swap`
- `CCTP fast + USDC + src swap + dst swap`

For a request such as:

- `Base WETH -> Arbitrum ETH`

Ruflo should be able to return:

- a direct LayerZero ETH-style route if available
- a LayerZero USDC-shaped route if that is also available
- an Axelar USDC-shaped route
- a CCTP standard route
- a CCTP fast route

The user should see the best executable offers, not one normalized route shape.

---

## Core Model

Each offer should be modeled by:

- `rail`
- `offerType`
- `srcChainId`
- `dstChainId`
- `tokenIn`
- `tokenOut`
- `routeAsset`
- `deliveryShape`
- `execution metadata`
- `economics`

### Route asset

The route asset should carry:

- canonical internal asset identity
- provider-specific asset identity
- source token address or native-asset reference
- destination token address or native-asset reference
- decimals
- asset standard or asset class

Examples of route-asset kinds:

- `erc20`
- `native`
- `btc`
- `sol`
- `oft`
- `oft_adapter`
- `stargate_pool`
- `stargate_oft`

### Delivery shape

Each offer should declare one of:

- `direct`
- `src_swap_required`
- `dst_swap_required`
- `src_and_dst_swap_required`

This is important both for ranking and for user presentation.

---

## Routing Model

The route search and ranking model should move from:

- `best rail for chain pair`

to:

- `best executable offers for token pair`

An offer is valid only if all of these are true:

- source-side execution can acquire the route asset
- the rail supports that exact route asset for the chain pair
- destination-side execution can either deliver it directly or swap out of it
- contracts and workers can validate the expected destination asset

This preserves flexibility without making false support claims.

---

## Ranking Model

Offers should be ranked per:

- `rail + offerType + routeAsset + deliveryShape`

The ranking inputs should include:

- provider fee
- protocol fee
- source gas
- destination gas
- outbound fee
- total expected slippage
- source swap required or not
- destination swap required or not
- ETA
- reliability score
- quote freshness / expiry

Direct delivery should generally rank above a route that requires a destination swap if fees, slippage, and ETA are otherwise comparable.

The ranking system must not degrade route quality by treating:

- direct ETH delivery
- USDC delivery followed by a destination swap

as if they were equivalent routes.

---

## Rail-Specific Design

### CCTP

CCTP should remain intentionally narrow.

It should produce distinct offer variants such as:

- `cctp_standard`
- `cctp_fast`

Both can quote the same chain and route asset, but they differ on:

- fee profile
- execution speed
- operational characteristics

CCTP should remain primarily a native-USDC-style rail. It should not be stretched into a universal route-asset rail.

### Axelar

Axelar should support multiple whitelisted route assets per chain pair, not a single implicit asset class.

Axelar offers should be built from:

- provider token identity
- source token mapping
- destination token mapping
- route-specific execution metadata

If Axelar only supports a USDC-shaped route for a pair, that route is valid as long as the swap plugins can handle source entry and destination exit.

If Axelar supports a better direct route asset, that offer should be emitted separately and ranked accordingly.

### LayerZero

LayerZero should not be modeled only as a generic stablecoin settlement rail.

It should support distinct offer types under the LayerZero family:

- `lz_oft`
- `lz_oft_adapter`
- `lz_stargate_pool`
- `lz_stargate_oft`

LayerZero direct routes should be first-class when available.

Stargate-backed assets should be surfaced as distinct LayerZero offer types, not as a separate top-level rail and not collapsed into generic OFT routing.

### THORChain

THORChain should be modeled as an API-driven direct-delivery rail with provider-specific asset identifiers and native-destination support.

It remains different from messaging rails because:

- delivery may be native to non-EVM destinations
- there is no destination ReceiverV1 flow in the normal messaging sense
- slippage and outbound fees are provider-native properties
- quote discovery, inbound-address discovery, and monitoring are primarily off-chain VPS responsibilities

THORChain still fits the same top-level model:

`tokenIn -> THORChain route asset -> tokenOut`

but with liquidity-rail-specific execution and monitoring.

### THORChain deployment model

THORChain should not require Ruflo destination deployments.

For THORChain routes:

- Ruflo does not need destination contracts on BTC, SOL, Cosmos, or other THOR-supported chains
- THORChain itself performs the native delivery to the user's destination address
- Ruflo discovers, ranks, and monitors the route off-chain through THOR APIs

This is the recommended default because it:

- reduces deployment burden on expensive or non-EVM chains
- aligns with THORChain's native direct-delivery model
- expands support for BTC, SOL, Cosmos, and similar destinations without forcing a messaging-style mesh architecture

### THORChain source-side integration

THORChain should not be forced to have dedicated Ruflo contracts everywhere.

The recommended design is:

- no THORChain-specific destination deployments
- no mandatory THORChain-specific source deployments
- optional future source-side integration on selected EVM chains where better UX justifies it

That means THORChain can start as:

- an API-driven direct rail that Ruflo quotes and monitors off-chain

and later evolve, if needed, into:

- a deeper source-integrated rail on chosen source chains

without changing the high-level route-asset model.

---

## Swap Plugin Role

`EmpsealSwapPlugin.sol` and the other DEX-style swap plugins should be treated as core infrastructure for maximum coverage.

They widen support in two directions:

- source side:
  - convert `tokenIn -> routeAsset`
- destination side:
  - convert `routeAsset -> tokenOut`

This means the system can support arbitrary user token pairs even when the rail only supports a smaller route-asset whitelist.

The quote engine should therefore treat source and destination swap viability as part of route validity, not as optional enhancement.

---

## Validation Model

Whitelisting must remain explicit and enforceable.

An offer should be executable only if:

- the route asset is whitelisted for that rail and route shape
- the expected destination asset identity is known
- the destination asset address or native identity matches the offer
- the minimum acceptable delivered amount is known

Validation should happen at multiple layers:

- quote-time asset and route construction
- intent creation
- source-chain plugin execution
- destination receiver or adapter validation
- monitoring and recovery logic

Removing whitelisting entirely would increase false positives and weaken the safety model too much.

The whitelist itself should be enforced off-chain during route discovery and offer construction. On-chain contracts should validate the selected route and trusted peers, not carry a giant global asset whitelist.

---

## Deployment And Mesh Model

The destination chain is not discovered by the contracts. It comes from the user request as `dstChainId`.

The VPS should act as the control plane that decides whether a requested `srcChainId -> dstChainId` transfer is executable for a given rail.

That control-plane decision should use:

- deployed-contract inventory
- provider chain-pair availability
- off-chain route-asset whitelist
- provider asset metadata
- source-side swap viability
- destination-side swap viability

### Off-chain deployment registry

Ruflo should maintain an off-chain deployment registry that answers questions like:

- is Router deployed on this source chain?
- is Receiver or adapter deployed on this destination chain?
- is the rail plugin deployed on the source chain?
- is the rail adapter or trusted receiver deployed on the destination chain?
- is this chain pair enabled for this rail?
- which route assets are valid for this pair?

This is the scalable replacement for a giant on-chain whitelist or global mesh registry.

For THORChain, this registry should allow a different execution shape:

- source-side support may be present or absent depending on the chosen rollout model
- destination contract deployment is not required
- route availability is determined from THOR-supported assets, VPS policy, and monitoring capability rather than destination receiver deployment

### Partial mesh versus full mesh

If Ruflo is deployed on many chains, it does not need a mandatory full mesh on every rail.

Full mesh means:

- every deployed source chain is configured to reach every relevant destination chain

Partial mesh means:

- only some chain pairs are enabled for a given rail

With partial mesh, coverage is partial on that rail. The VPS should only quote routes for the chain pairs that are actually enabled and executable.

This is acceptable because the user already specifies the destination chain. Ruflo only needs to answer:

- can we execute this requested source-to-destination transfer on this rail?

### On-chain minimal trust model

Contracts should not be required to know about all 70 or 80 chains globally.

Instead:

- the local Router only needs local plugin and execution awareness
- the local PluginRegistry only needs local plugin registrations
- a source-side rail plugin only needs outbound configuration for destination chains it can actually send to
- a destination-side receiver or adapter only needs inbound trust for source peers it is willing to accept

This is pairwise route configuration, not global mesh awareness.

### Pairwise route configuration

Support should be treated as:

- not `Axelar supports token X globally`
- but `Axelar supports route asset X on source chain A to destination chain B`

That means a rail-wide whitelist is only the broad permission set. Actual executability is still chain-specific and pair-specific.

---

## LayerZero Direct Transfer Clarification

LayerZero direct routes should not be forced through a generic stablecoin route asset when the provider supports a better direct asset.

For LayerZero, the route asset itself may be:

- the directly bridged OFT
- an OFTAdapter-backed ERC20
- a Stargate-backed asset

Ruflo still needs a route-asset field for:

- quote comparison
- source and destination swap planning
- exact destination validation

So the correct design is not "remove route assets for LayerZero." The correct design is "use the exact LayerZero route asset rather than a fake universal settlement token."

---

## What Is Missing In This Branch

The branch is not yet at the full target model.

The main gaps are:

- `src/contracts/interfaces/IIntentTypes.sol`
  - still too narrow for maximum-coverage route-asset modeling
- `src/vps/services/QuoteEngine.ts`
  - still limited relative to the richer route model
- `src/vps/services/RailSelector.ts`
  - still framed too much around coarse settlement-token support
- `src/vps/services/layerzero/LayerZeroRouteCatalog.ts`
  - currently recognizes a narrower asset model than the target LayerZero family design
- `src/contracts/rails/LayerZeroRailPlugin.sol`
  - not yet explicitly modeling the full distinction among OFT, OFTAdapter, and Stargate-backed offer types
- messaging execution paths
  - still mostly EVM Receiver-shaped

The architecture direction is correct, but the internal abstractions are still too small for the desired maximum-coverage behavior.

---

## Non-Goals

This design does not attempt to claim:

- every rail directly supports every token
- every provider supports every chain pair equally well
- every route asset should be accepted without whitelisting
- route overlap across rails is the main metric

The main metric is executable offer quality across rails, not superficial chain overlap.

---

## Success Criteria

The design is successful when Ruflo can:

- return multiple offers for the same token pair across implemented rails
- surface direct-transfer offers when available
- surface swap-in / swap-out offers when they are the only viable path
- rank direct routes appropriately above lower-quality indirect routes
- support multiple route assets per rail
- represent LayerZero Stargate assets as distinct LayerZero offer types
- keep asset validation strict enough to avoid false support claims

---

## Final Conclusion

The target product behavior should be:

`any token transfer` by combining:

- rail-specific whitelisted route assets
- exact provider-aware offer modeling
- source and destination swap plugins

The system should not aim for:

- `any asset directly on every rail`

It should aim for:

- `any token -> best executable route asset -> any token`

with direct routes preferred whenever available.
