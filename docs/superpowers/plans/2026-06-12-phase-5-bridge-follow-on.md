# 2026-06-12 Phase 5 Bridge Follow-On

Source of truth:
- `docs/version-2-feature-selection-phase-5-bridge-follow-on-handoff-20260609.md`
- `/Users/ganadhish/code/work/empx-cross-chain-bridge-V2-updates/empx-complete-handoff-20260608/RAILS-AND-EXPANSION.md`
- `/Users/ganadhish/code/work/empx-cross-chain-bridge-V2-updates/empx-complete-handoff-20260608/ROADMAP-via-labs-bridge.md`
- `/Users/ganadhish/code/work/empx-cross-chain-bridge-V2-updates/empx-complete-handoff-20260608/ROADMAP-non-evm-sources.md`

Goal:
- complete the remaining bridge-only follow-on scope after Phases 2-4
- keep the implementation aligned to the current `ruflo` runtime shape
- keep multi-hop and hub-biased routing excluded

## Scope Verdict

`TeleSwap` does not need new Phase 5 implementation unless a real gap is found.
The current repo already has:
- rail registration
- quote worker wiring
- monitor wiring
- provider-direct integration output
- focused tests

Phase 5 implementation therefore centers on:
1. shared bridge follow-on request and lifecycle semantics
2. first concrete official native-bridge rollout
3. explicit `urgency='patient'` routing semantics
4. Via Labs rebuild / relaunch in the current runtime
5. non-EVM source-side bridge flow completion
6. remaining messaging-rail activation and route-surface cleanup

## Execution Slices

### Slice 5.1 — Shared Semantics And Submission Surfaces

Required because the current runtime still assumes:
- `urgency` is only `fast | normal`
- provider-direct refund behavior is partly implicit
- partner execution has no clean provider-direct `submitted` callback

Implementation:
- extend quote/request types to support `urgency: 'patient'`
- add explicit `refundAddress` to the quote request surface
- thread `refundAddress` through quote building for liquidity rails
- add partner API provider-direct submit endpoints so non-EVM-source and other provider-direct flows can be marked submitted without EVM signed-action coupling
- keep comments only around the non-obvious semantics:
  - why `patient` exists separately from `normal`
  - why refund handling is explicit for provider-direct rails

Verification:
- codec tests
- partner/status API submit tests
- quote-engine tests for refund propagation and patient parsing

### Slice 5.2 — Official Native Bridge Rollout

Selected concrete rollout:
- `Ethereum <-> Optimism Standard Bridge`

Why:
- explicitly matches the handoff's canonical native-bridge template
- gives one real official bridge implementation instead of leaving the family abstract
- provides a clean base for later OP-stack-native subclasses without inventing a new execution model

Implementation:
- add a new provider-direct rail for the first official native bridge rollout
- build quote generation for:
  - L1 -> L2 deposits
  - L2 -> L1 withdrawals gated by `urgency='patient'`
- build direct execution payloads for:
  - ETH deposits
  - ERC-20 deposits
  - ETH withdrawals
  - ERC-20 withdrawals
- add a monitor worker that follows the source tx through the expected lifecycle and marks:
  - submitted
  - in transit
  - destination received / settled
- keep the rollout narrow to the first concrete ecosystem choice instead of pretending the full family is shipped

Verification:
- quote-engine native-bridge tests
- direct integration builder tests
- native-bridge monitor tests

### Slice 5.3 — Via Labs Rebuild / Relaunch In Current Runtime

Runtime decision:
- implement Via Labs as a real advertised bridge surface in `ruflo`
- use the current router-intent / event-monitor architecture where possible instead of inventing a second runtime

Implementation:
- promote `VIA_LABS` from modeled-only metadata into a real route-surface candidate
- enable settlement asset allowlists and destination gas defaults for Via Labs
- add chain advertisement only where route token metadata or env-backed token coverage exists
- add contract/config support needed by the current router-intent path
- add tests that Via Labs offers can be surfaced only when the route is actually executable

Explicit non-goal in this slice:
- no frontend `/via-bridge` rebuild here; this phase remains bridge runtime only

Verification:
- registry / route policy tests
- quote-engine offer tests
- partner selection tests

### Slice 5.4 — Non-EVM Source-Side Flow Completion

Current repo state:
- liquidity rails already partially support non-EVM source chains
- the remaining gap is consistency and operational semantics

Implementation:
- make refund handling explicit for non-EVM source flows across:
  - THORChain
  - Chainflip
  - Maya
  - TeleSwap
- preserve destination-native address handling
- ensure partner-facing quote/select/submit/status surfaces work for non-EVM source users without assuming the source signer is an EVM wallet
- enrich provider-direct integrations with the data needed to craft or relay the source deposit cleanly

Verification:
- THORChain / Chainflip / Maya / TeleSwap quote tests
- direct integration tests
- partner submit/status tests for provider-direct non-EVM flows

### Slice 5.5 — Remaining Messaging-Rail Activation And Route-Surface Cleanup

Required doc items:
- re-evaluate `Axelar`
- re-evaluate `Wormhole`
- close current runtime vs handoff rail-surface gaps

Implementation:
- activate `Axelar` where route metadata and destination token-id support are already present
- keep activation pair-scoped and asset-scoped, not global
- activate `Wormhole` only on the narrow routes that the current runtime can honestly support
- keep rails disabled where route metadata, deployment reality, or execution readiness is still missing

This slice is about closing real runtime gaps, not maximizing enum exposure.

Verification:
- route-surface tests
- provider isolation tests
- quote selection tests for newly activated rails

## Expected Files

Primary runtime files:
- `src/vps/types/index.ts`
- `src/vps/api/quoteCodec.ts`
- `src/vps/api/PartnerAPI.ts`
- `src/vps/api/StatusAPI.ts`
- `src/vps/services/QuoteEngine.ts`
- `src/vps/services/DirectRailIntegrationBuilder.ts`
- `src/vps/services/RailSelector.ts`
- `src/vps/services/RouterBuilder.ts`
- `src/vps/rails/registry.ts`
- `src/vps/rails/execution.ts`
- `src/vps/app/runtime.ts`
- `src/vps/config/contracts.ts`
- `src/vps/config/routeExecution.ts`
- `src/vps/config/routeMetadata.ts`

New service families expected:
- native bridge quote / monitor support
- optional provider-direct submission helpers where needed

Tests expected:
- new focused Phase 5 tests for native bridge, Via Labs activation, partner direct-submit, and non-EVM-source semantics
- extensions to existing quote/direct-integration/provider-isolation coverage

## Completion Criteria

Phase 5 is only complete when:
- the first concrete official native bridge is executable end to end
- `patient` semantics are explicit and do not pollute normal route ranking
- Via Labs is either genuinely activated on supported routes or still explicitly gated by executable coverage
- non-EVM source-side bridge flows have explicit refund and submit semantics
- the remaining justified Axelar / Wormhole route-surface gaps are closed
- focused Phase 5 tests pass
- `graphify update .` passes
