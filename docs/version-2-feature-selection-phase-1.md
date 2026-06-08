# Version 2 Feature Selection: Phase 1

> Date: June 4, 2026
> Scope: selected V2 features from runtime hardening through destination-gas UX

## Purpose

This document defines the first approved feature-selection slice from
`/Users/ganadhish/code/work/version-2-cross-chain` for migration into
`ruflo`.

This is not a wholesale V2 adoption plan. It is a constrained selection for
the current production-oriented, mesh-first architecture.

## Selection Principles

- Keep current `ruflo` as the production source of truth.
- Preserve peer/mesh-first routing as the default architecture.
- Prioritize operational hardening over product-scope expansion.
- Keep same-chain coverage where it improves API and SDK integrations.
- Avoid pulling in hub-first or unfinished solver-network assumptions.

## Selected Features

### 1. Runtime hardening

Decision: `Required`

Adopt:

- `src/vps/core/RpcCache.ts`
- `src/vps/core/RpcPool.ts`
- `src/vps/core/RpcUpstream.ts`
- `src/vps/core/CachingProvider.ts`
- related runtime wiring changes

Why:

- improves RPC resiliency and failover
- gives better cache consistency and in-flight deduplication
- fits current architecture without changing routing philosophy

### 2. Reliability persistence

Decision: `Required`

Adopt:

- `src/vps/db/IdempotencyStore.ts`
- `src/vps/db/RelayerNonceStore.ts`
- `src/vps/db/ReliabilityRepository.ts`
- related DB migrations needed for those stores

Why:

- improves duplicate-request handling
- improves relayer nonce safety across instances
- adds durable reliability tracking for production operations

### 3. API hardening

Decision: `Required`

Adopt:

- `src/vps/api/AdminAPI.ts` hardening
- `src/vps/api/WebSocketAPI.ts` hardening
- selected `src/vps/api/StatusAPI.ts` idempotency / replay-safe improvements
- `src/vps/app/observability.ts`

Why:

- improves admin safety and websocket auth handling
- improves runtime visibility
- is low-to-medium risk compared with larger product-surface changes

### 4. Observability additions

Decision: `Required`

Adopt:

- metrics middleware and `/metrics`
- reliability-oriented admin views
- oracle snapshot/reset support where needed by selected features

Why:

- directly improves production debugging and incident response
- does not force adoption of V2 routing strategy changes

### 5. Same-chain integrator coverage

Decision: `Required`

Adopt:

- selected `PartnerAPI` support for same-chain execution
- especially `/partner/swap-single-chain`
- only the supporting slices needed to make that flow stable

Why:

- this backend is an integration layer consumed through APIs and SDKs
- same-chain coverage is useful even if a dedicated DEX-agg dapp already exists
- keeps one integration surface for partners who do not want to special-case
  same-chain vs cross-chain flows

Constraints:

- do not copy full V2 `PartnerAPI.ts` wholesale
- only port the routes and dependencies needed for same-chain coverage
- normalize overlapping response shapes with current public/status surfaces

### 6. SDK client ergonomics

Decision: `Required`, but in slices

Adopt:

- selected client-facing improvements from `src/vps/sdk/EmpxSDK.ts`
- only the wrappers that map to stable backend routes
- keep current cross-chain SDK behavior intact while expanding the surface

Why:

- improves integrator DX
- supports a unified API/SDK integration story
- avoids an immediate full replacement of `EmpxCrossChainSDK.ts`

Constraints:

- do not flip to V2 `EmpxSDK` as the default package surface yet
- do not adopt features whose backend routes are not migrated
- treat `empx-swap-sdk-beta` as an adapter dependency, not as the owner of the
  full protocol architecture

### 7. Destination-gas UX

Decision: `Optional but approved candidate`

Adopt if product priority justifies it:

- `src/contracts/ReceiverV1AnyTokenGas.sol`
- `src/vps/services/DestinationGasAutoFund.ts`
- `src/vps/services/NativeUsdOracle.ts`
- only the runtime and config wiring required to support this path safely

Why:

- improves destination-chain UX materially
- is useful without requiring hub-based routing
- has a more contained architectural blast radius than multi-hop or solver work

Constraints:

- ship behind a feature flag first
- validate token-slice math and oracle fallback behavior carefully
- keep silent downgrade behavior explicit in API responses where possible

## Explicitly Out of Scope for Phase 1

The following are not part of this selection document:

- basket / multiswap execution
- `EmpsealMulticallRouter`
- multi-hop contracts
- hub-biased route policy
- solver-directory and external-solver strategy
- full ERC-7683 expansion
- wholesale `PartnerAPI` replacement
- wholesale `EmpxSDK` replacement

## Implementation Order

Recommended order for this phase:

1. runtime hardening
2. reliability persistence
3. API hardening
4. observability
5. same-chain integrator coverage
6. SDK slices for the migrated backend routes
7. destination-gas UX behind a flag

## Final Position

Phase 1 should focus on hardening and integration coverage, not on changing
the routing model.

The approved V2-derived selection is:

- runtime/provider hardening
- idempotency and relayer nonce persistence
- admin/websocket/status hardening
- observability additions
- same-chain integrator support
- selected SDK improvements
- destination-gas UX as the only optional feature in this phase

Everything beyond that should be treated as a later decision, not bundled into
this migration slice.
