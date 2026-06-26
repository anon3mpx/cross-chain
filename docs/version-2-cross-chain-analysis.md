# Version 2 Cross-Chain Analysis

> Analysis date: June 4, 2026
> Compared repos:
> - Current workspace: `/Users/ganadhish/code/work/ruflo`
> - Candidate update: `/Users/ganadhish/code/work/version-2-cross-chain`

## Executive Summary

`version-2-cross-chain` is a real milestone, not a loose patch dump. It compiles, its TypeScript gate passes, its EIP-712 drift guard passes, and its Foundry build passes. Architecturally, though, it is not a drop-in replacement for the current repo.

The update introduces a new core runtime layer, multi-hop routing contracts, basket/multiswap flows, ERC-7683 entrypoints, destination-gas automation, solver abstractions, new database migrations, and a much larger SDK surface. Those additions improve capability and extensibility, but they also increase coupling between API, runtime, SDK, and persistence layers.

The main conclusion is:

- `AdminAPI` and `WebSocketAPI` updates are structurally aligned and low-to-medium risk.
- `PartnerAPI` and the new SDK are not isolated updates. They depend on new subsystems and should be migrated in slices, not copied as standalone files.
- `version-2` is stronger than current `ruflo` on architecture and product surface, but weaker on operational docs, helper scripts, and breadth of test coverage in the checked-in tree.

## Method

This analysis used:

- Source/tree comparison between both directories
- Import/dependency validation for the incomplete surfaces you called out
- Runtime validation inside `version-2-cross-chain`
- Git history inspection in the `version-2` checkpoint

Validation commands run in `version-2-cross-chain`:

```bash
npx tsc --noEmit
npm run test:typehash-sync
forge build --config-path config/foundry.toml --skip test
forge test --config-path config/foundry.toml --no-match-contract MultiHopE2ETest -vv
npm audit --omit=dev --json
```

## Repo-Level Diff

High-level file inventory across `src`, `tests`, `docs`, `config`, `package.json`, `README.md`, and `openapi.json`:

- Current repo files in scope: `278`
- Version-2 files in scope: `170`
- Shared paths: `111`
- Current-only paths: `167`
- Version-2-only paths: `59`

Breakdown of current-only paths:

- `docs`: `85`
- `tests`: `64`
- `src`: `12`
- `config`: `6`

Breakdown of version-2-only paths:

- `src`: `46`
- `tests`: `6`
- `config`: `4`
- `docs`: `3`

What that means:

- Current `ruflo` carries more operational material, helper scripts, and broader test coverage.
- `version-2` concentrates its changes inside the product/runtime surface, not the ops/documentation surface.
- The update is additive in architecture, but selective in what it carries forward from the current repo.

## What Version 2 Actually Adds

### 1. Contract capability expansion

New contract surfaces in `version-2`:

- `src/contracts/RouterV1MultiHop.sol`
- `src/contracts/ReceiverV1MultiHop.sol`
- `src/contracts/ReceiverV1AnyTokenGas.sol`
- `src/contracts/plugins/EmpsealMulticallRouter.sol`

Functional improvement:

- Multi-hop execution instead of single-hop-only routing
- Any-token destination gas top-up on settlement
- Batched hub-swap execution
- Expanded EIP-712 typed intent model for multi-leg flows

Impact:

- This is a material protocol capability increase, not a refactor-only release.
- These contract changes require aligned TypeScript calldata generation and typehash synchronization.

### 2. New VPS core layer

New core files in `version-2`:

- `src/vps/core/ExecutionContext.ts`
- `src/vps/core/RailSolver.ts`
- `src/vps/core/IntentBasket.ts`
- `src/vps/core/IntentStateMachine.ts`
- `src/vps/core/OfferRanker.ts`
- `src/vps/core/RouteHopPolicy.ts`
- `src/vps/core/RpcCache.ts`
- `src/vps/core/RpcPool.ts`
- `src/vps/core/RpcUpstream.ts`
- `src/vps/core/CachingProvider.ts`
- `src/vps/core/erc7683.ts`

Functional improvement:

- Cleaner separation between execution context, routing logic, solver selection, and provider strategy
- Better RPC abstraction for BYO RPC, premium RPC, and free fallback tiers
- A proper model for baskets and multi-intent composition

Impact:

- This is the biggest architectural change in the whole update.
- `PartnerAPI`, runtime wiring, the SDK, and some services now assume this layer exists.

### 3. Persistence and reliability plane

New database and persistence additions:

- `src/vps/db/IdempotencyStore.ts`
- `src/vps/db/RelayerNonceStore.ts`
- `src/vps/db/ChainOffsetRepository.ts`
- `src/vps/db/ReliabilityRepository.ts`
- `src/vps/db/SolversRepository.ts`
- `src/vps/db/migrations/002_reliability_and_attribution.sql`
- `src/vps/db/migrations/003_revenue_tier.sql`
- `src/vps/db/migrations/004_solvers.sql`
- `src/vps/db/migrations/005_parent_basket_id.sql`
- `src/vps/db/migrations/006_relayer_nonces.sql`
- `src/vps/db/migrations/007_drop_partner_api_key.sql`

Functional improvement:

- Cross-instance idempotency
- Durable relayer nonce reservation
- Reliability stats by rail/route/tier
- Solver directory for internal/external solver registration
- Basket lineage and revenue attribution

Impact:

- This is a real maturity step for multi-instance runtime behavior.
- These changes align with the current repo structure, but they are not optional if you want the full v2 API surface.

### 4. Product/API surface expansion

New service/API capabilities in `version-2`:

- Single-chain swap endpoint
- Basket quote and execute flows
- Wallet scan and liquidation flows
- ERC-7683 resolve/open endpoints
- Native USD oracle snapshot and reset endpoints
- Reliability and solver admin endpoints
- Observability middleware and `/metrics`

Functional improvement:

- Much broader integrator-facing product surface
- Better internal operations visibility
- A clearer path to solver-network or external intent integrations

Impact:

- This is where most of the coupling shows up.
- The backend is no longer “quote + select + status”; it becomes a platform surface.

### 5. SDK expansion

Current repo SDK:

- `src/vps/sdk/EmpxCrossChainSDK.ts`

Version-2 SDK:

- `src/vps/sdk/EmpxSDK.ts`
- `src/vps/sdk/swapAdapter.ts`
- `src/vps/sdk/agentTools.ts`

Functional improvement:

- Cross-chain swap still exists
- Adds single-chain execution
- Adds basket/multiswap/rebalance/liquidation helpers
- Adds wallet scan, ERC-7683 helpers, and richer route access
- Re-exports and integrates with `empx-swap-sdk-beta`

Impact:

- This is not just a rename. It is a platform SDK.
- It requires backend endpoints and supporting runtime/services that current `ruflo` does not yet have.

## What Version 2 Drops or Leaves Thinner

Relative to current `ruflo`, `version-2` is thinner in these areas:

- Operational docs and incident notes under `docs/root-notes/` and `docs/ops/`
- Helper tx scripts under `src/vps/scripts/`
- Environment/config helpers such as `config/providers.yaml` and `config/foundry/env/*`
- Breadth of checked-in VPS unit tests
- Existing OFT/token contract path `src/contracts/tokens/EmpxOFT.sol`

This does not make `version-2` worse overall, but it does mean it should not replace the current repo wholesale without preserving current ops assets.

## Alignment Check For Incomplete Areas

This section answers the specific concern about `sdk`, `PartnerAPI`, `AdminAPI`, and `WebSocketAPI`.

### AdminAPI

Status: aligned, low-to-medium migration risk.

Current repo already has:

- `src/vps/api/AdminAPI.ts`
- `src/vps/services/IntentService.ts`

What v2 adds:

- Constant-time admin-key comparison
- Fail-closed startup behavior when `VPS_ADMIN_API_KEY` is empty in production-like environments
- Reliability endpoints
- Solver directory endpoints
- Oracle snapshot/reset endpoints

What must come with it:

- Runtime wiring to pass `reliability`, `solvers`, and `usdOracle`
- Repository implementations for reliability and solver storage

Conclusion:

- The admin update fits the existing structure.
- It is a good candidate for early adoption.

### WebSocketAPI

Status: aligned, low migration risk.

Current repo already has:

- `src/vps/api/WebSocketAPI.ts`
- `src/vps/services/IntentEngine.ts`
- `src/vps/services/ApiKeyManager.ts`

What v2 changes:

- Subprotocol shifts from `rflo-auth` to `empx.v1`
- API key travels as `key.<apiKey>` in `Sec-WebSocket-Protocol`
- Query-string key remains only as deprecated fallback
- Auth check uses `checkQuote()` path

Functional improvement:

- Better credential handling than query-string transport

Conclusion:

- This aligns cleanly with the current structure.
- The main requirement is synchronized SDK/client upgrade.

### PartnerAPI

Status: partially aligned, high migration risk if ported alone.

Current repo already has:

- `ApiKeyManager`
- `IntentService`
- `QuoteEngine`
- `RpcProviderRegistry`
- `IntentCalldataBuilder`
- `IntentRepository`

Version-2 `PartnerAPI` also requires files that do not exist in current `ruflo`:

- `src/vps/sdk/swapAdapter.ts`
- `src/vps/core/ExecutionContext.ts`
- `src/vps/db/IdempotencyStore.ts`
- `src/vps/services/BasketQuoteEngine.ts`
- `src/vps/services/BasketStatusEngine.ts`
- `src/vps/services/WalletScanner.ts`
- `src/vps/services/Erc7683Adapter.ts`
- `src/vps/services/DestinationGasAutoFund.ts`
- `src/vps/services/NativeUsdOracle.ts`
- `src/vps/core/IntentBasket.ts`
- `src/vps/app/observability.ts`

What this means:

- The v2 `PartnerAPI` is not just an endpoint patch.
- It assumes the new execution-context model, basket abstractions, oracle logic, and expanded SDK/backend product surface.

Conclusion:

- Do not cherry-pick `PartnerAPI.ts` by itself.
- Migrate it only alongside the new core/runtime/service layer it depends on.

### SDK

Status: not aligned as a standalone update.

Current repo SDK:

- `EmpxCrossChainSDK.ts` focused on quote/swap/status

Version-2 SDK:

- `EmpxSDK.ts` depends on new backend routes and these missing local modules:
  - `src/vps/core/ExecutionContext.ts`
  - `src/vps/sdk/swapAdapter.ts`
  - `src/vps/core/IntentBasket.ts`
  - `src/vps/sdk/agentTools.ts`
- Also adds package dependency:
  - `empx-swap-sdk-beta`

What this means:

- The SDK and backend must move together.
- Porting the SDK first would create dead routes and broken features.

Conclusion:

- Adopt the new SDK only after the backend routes and supporting services are present.

## Validation Results

### Runtime/build validation

Inside `version-2-cross-chain`:

- `npx tsc --noEmit`: passed
- `npm run test:typehash-sync`: passed
- `forge build --config-path config/foundry.toml --skip test`: passed

### Foundry test validation

Command run:

```bash
forge test --config-path config/foundry.toml --no-match-contract MultiHopE2ETest -vv
```

Result:

- `24` tests passed
- `1` test failed
- Failing test:
  - `tests/contracts/EmpsealMulticallRouter.t.sol`
  - `testUnexpectedNativeValue_reverts()`

This matches the checkpoint-level claim that the milestone is close to green but not fully clean.

### Dependency/security validation

As of June 4, 2026, `npm audit --omit=dev --json` reported:

- `1` critical
- `11` high
- `13` moderate
- `13` low

Main transitive risk clusters observed:

- `protobufjs`
- `axios`
- `ws`
- `agentic-flow` / `agentdb`
- several framework/util transitive packages

Conclusion:

- `version-2` is buildable, but not dependency-clean.
- It should not be treated as production-ready without a dependency remediation pass.

## Improvement Assessment

Where `version-2` clearly improves functionality:

- Multi-hop routing
- Basket and multiswap orchestration
- Destination gas automation
- External solver and ERC-7683 readiness
- Better runtime state management
- Better RPC/provider abstraction
- Better admin observability
- Better API and SDK breadth

Where current `ruflo` is still stronger:

- Operational documentation
- Helper scripts for manual recovery/tx workflows
- Breadth of repo-local test coverage in the checked-in tree
- Deployment/env support material

## Recommended Adoption Strategy

Do not replace current `ruflo` with `version-2-cross-chain` wholesale.

Recommended order:

1. Migrate the persistence/runtime substrate first.
   - Bring over `core/*`
   - Bring over DB repositories and migrations
   - Bring over runtime wiring updates

2. Migrate low-risk API improvements next.
   - `AdminAPI`
   - `WebSocketAPI`
   - `StatusAPI` replay/idempotency improvements
   - `app/observability.ts`

3. Migrate protocol capability slices.
   - Multi-hop contracts
   - Any-token-gas contracts
   - `IntentCalldataBuilder` and related type changes

4. Migrate high-coupling product surfaces after the substrate exists.
   - `PartnerAPI`
   - basket flows
   - wallet scan
   - ERC-7683 endpoints

5. Migrate the SDK last.
   - Only after backend parity exists
   - Only after the WebSocket protocol change is live

6. Preserve current operational assets.
   - Keep current scripts/docs unless you intentionally replace them
   - Do not assume `version-2` contains all current runbook knowledge

## Migration Matrix

This matrix reflects the clarified target:

- current `ruflo` stays the production source of truth
- architecture remains peer/mesh-first, not hub-and-spoke-first
- same-chain coverage is still useful because this backend is an integration layer consumed by APIs and SDKs
- V2 should be mined for capabilities, not adopted wholesale

| Area | V2 component(s) | Decision | Why |
|---|---|---|---|
| Runtime hardening | `core/RpcCache.ts`, `core/RpcPool.ts`, `core/RpcUpstream.ts`, `core/CachingProvider.ts`, runtime wiring | Required | Improves multi-RPC reliability, cache consistency, and provider isolation without changing routing philosophy. |
| Reliability persistence | `db/IdempotencyStore.ts`, `db/RelayerNonceStore.ts`, `db/ReliabilityRepository.ts`, related migrations | Required | High-value operational improvement for a mainnet-tested system; reduces duplicate submission and nonce-management risk. |
| API hardening | `api/AdminAPI.ts`, `api/WebSocketAPI.ts`, selected `StatusAPI.ts` improvements, `app/observability.ts` | Required | Low-to-medium risk improvements with clear operational upside. |
| Observability | metrics middleware, oracle snapshot/reset, reliability admin endpoints | Required | Helps production operations and incident response; does not force product-scope expansion. |
| Same-chain integrator coverage | selected `PartnerAPI` routes, especially `/partner/swap-single-chain` | Required | Fits your integration-layer goal even if the user-facing DEX-agg dapp already exists separately. |
| SDK client ergonomics | selected parts of `sdk/EmpxSDK.ts` | Required in slices | Useful as an integration surface, but should be ported as wrappers over stable backend routes rather than adopted wholesale. |
| Destination gas UX | `ReceiverV1AnyTokenGas.sol`, `DestinationGasAutoFund.ts`, `NativeUsdOracle.ts` | Optional but strong candidate | Useful feature with contained architectural impact; worth adopting if destination-gas UX matters. |
| Basket / multiswap execution | `plugins/EmpsealMulticallRouter.sol`, `services/BasketQuoteEngine.ts`, `core/IntentBasket.ts` | Optional | Valuable only if basket or split-routing product goals matter soon. |
| Partner API expansion | wallet scan, rebates, richer attribution, quotas, selected partner-only flows | Optional in slices | Product-useful, but should be normalized against existing public/status surfaces instead of copied wholesale. |
| Full SDK default flip | `sdk/EmpxSDK.ts` as the main client surface | Defer | Too much coupling to new backend routes and the beta swap SDK to make this the default immediately. |
| Multi-hop contracts | `RouterV1MultiHop.sol`, `ReceiverV1MultiHop.sol` | Defer | Real capability, but it introduces a hub-route execution model that does not match a mesh-first default. |
| Multi-hop routing policy | `core/RouteHopPolicy.ts`, multi-hop paths in `QuoteEngine.ts`, `RouterBuilder.ts` | Defer | V2 embeds a revenue-biased preference for agg-wired two-hop routes; that should not become default policy in the current architecture. |
| Solver directory / external solver surface | `db/SolversRepository.ts`, migration `004_solvers.sql`, solver admin endpoints, external-solver placeholders | Defer | The abstraction exists, but actual third-party live solver routing is not finished and is not needed for current production goals. |
| ERC-7683 full push | `Erc7683Adapter.ts`, related endpoints, pending on-chain settler path | Defer | Promising integration surface, but it expands product scope before the current core migration is settled. |
| Hub-first strategy | revenue-biased two-hop preference, hub-chain execution assumptions | Avoid as default | Conflicts with the stated peer/mesh routing philosophy. If adopted at all, it should only be a constrained fallback. |
| Wholesale V2 PartnerAPI replacement | copying `PartnerAPI.ts` as-is | Avoid | It assumes new execution-context, basket, oracle, idempotency, and SDK layers that are not isolated patches. |
| Wholesale V2 SDK replacement | replacing `EmpxCrossChainSDK.ts` directly with `EmpxSDK.ts` | Avoid | Too tightly coupled to backend changes and `empx-swap-sdk-beta` assumptions. |

## Practical Port Shape

The safest working split is:

### 1. Port now

- runtime/provider hardening
- idempotency and relayer nonce persistence
- reliability and observability
- `AdminAPI` and `WebSocketAPI` hardening
- selected same-chain integration coverage for partner/API consumers

### 2. Port behind flags or phased rollout

- destination gas autofund
- basket execution surfaces
- expanded partner endpoints
- selected SDK convenience APIs

### 3. Leave out of the mainnet path for now

- multi-hop contracts and routing policy
- external solver strategy
- full ERC-7683 expansion
- hub-biased route selection

## empx-swap-sdk-beta Coupling Guidance

V2 uses `empx-swap-sdk-beta` as the default single-chain routing primitive, not just as a convenience dependency. That is why it appears in:

- `sdk/swapAdapter.ts`
- `/partner/swap-single-chain`
- basket same-chain legs
- `NativeUsdOracle`
- `WalletScanner`
- `EmpxSDK` re-exports

Recommended posture for `ruflo`:

- keep the same-chain integration coverage
- keep `EmpsealSwapPlugin` as the on-chain execution primitive
- treat `empx-swap-sdk-beta` as an adapter dependency, not a system-defining foundation
- port only the SDK-backed surfaces that are useful for integrators
- avoid letting the beta SDK dictate overall routing architecture

That gives you the API/SDK coverage benefit without forcing the broader V2 product assumptions into the main protocol path.

## Final Conclusion

`version-2-cross-chain` is a meaningful and technically coherent milestone. It improves the product in important ways, especially around routing sophistication, solver abstraction, gas handling, and SDK breadth.

It is not aligned as a file-for-file swap into the current repo. The update is best treated as a checkpoint branch whose architectural slices should be merged deliberately into `ruflo`, starting with core/runtime/db changes, then low-risk API upgrades, then the higher-coupling partner and SDK surfaces.

If you want, the next useful step is a migration map that turns this analysis into a file-by-file merge plan for `ruflo`.
