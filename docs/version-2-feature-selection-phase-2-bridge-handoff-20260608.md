# Version 2 Feature Selection: Phase 2 Bridge Handoff

> Date: June 8, 2026
> Scope: selected bridge-only features from
> `/Users/ganadhish/code/work/empx-cross-chain-bridge-V2-updates/empx-complete-handoff-20260608`
> with bridge-runtime migration anchored in
> `/Users/ganadhish/code/work/empx-cross-chain-bridge-V2-updates/empx-complete-handoff-20260608/empx-cross-bridge`

## Purpose

This document replaces the earlier checkpoint-v6-only phase-2 framing with a
new bridge-specific selection based on the June 8, 2026 complete handoff.

It is intentionally narrower than the full handoff package.

This selection is for the bridge-foundation slice plus the first required
handoff rail.

It is specifically for:

- bridge runtime
- bridge quote / watch / settle logic
- rail expansion and rail-serving architecture
- Hyperlane Nexus as the first end-to-end adoption target

This selection is **not** for:

- frontend migration
- same-chain SDK expansion as a standalone project
- multi-hop routing
- hub-biased route logic
- basket / multiswap product expansion
- ERC-7683 / solver-marketplace work

## Source Inputs

Primary handoff package root:

- `/Users/ganadhish/code/work/empx-cross-chain-bridge-V2-updates/empx-complete-handoff-20260608`

Primary source tree:

- `/Users/ganadhish/code/work/empx-cross-chain-bridge-V2-updates/empx-complete-handoff-20260608/empx-cross-bridge`

Reference documents:

- `docs/version-2-feature-selection-phase-1.md`
- `docs/version-2-feature-selection-phase-2.md`
- `docs/empx-checkpoint-v6-analysis.md`
- `empx-complete-handoff-20260608/RAILS-AND-EXPANSION.md`
- `empx-complete-handoff-20260608/ARCHITECTURE.md`
- `empx-complete-handoff-20260608/PARTNER-AND-AGENT-INTEGRATION.md`

## Selection Principles

- Keep current `ruflo` as the production source of truth.
- Preserve the current direct cross-chain bridge model as the default.
- Treat multi-hop and hub-biased routing as permanently dropped from the
  migration path.
- Prefer bridge improvements that are operationally complete:
  - quote path
  - route eligibility
  - monitor/watch path
  - settle/finalize path
- Prefer Mode B / passthrough integrations where they reduce contract and
  deployment surface without weakening the product.
- Keep frontend, broader SDK, and marketplace ambitions out of the bridge
  migration slice unless they are strictly required for bridge execution.

## What Phase 2 Is Actually About

Phase 2 is not "adopt every promising rail from the handoff."

The bridge-side upgrades in the June 8 handoff naturally split into five
feature families:

1. rail expansion
2. per-rail solver / worker decomposition
3. Mode B passthrough bridge integrations
4. watch / settle lifecycle completion for new rails
5. registry and accessibility expansion for new chain-token coverage

Those families matter here, but this phase should only own the bridge
foundation required to support new rails cleanly inside the current
`ruflo` runtime shape plus `Hyperlane Nexus` as the first end-to-end adoption.

The remaining candidate rails belong to a later bridge-only phase once that
foundation exists.

## Selected Features

### 1. Rail expansion framework

Decision: `Required`

Adopt:

- the expanded `Rail` enum and supporting registry pattern
- accessible-chain mapping updates
- rail-level support declarations
- per-rail smoke/regression tests as migration guides

Why:

- new bridge coverage is only maintainable if rails stop being hard-coded
  ad hoc inside monolithic quote logic
- this is the base required for every later bridge rail adoption

Constraints:

- do not import multi-hop helpers or hub-hop policies
- do not import basket-driven or solver-marketplace abstractions unless a
  selected rail truly depends on them

### 2. Mode B / passthrough bridge integration pattern

Decision: `Required`

Adopt:

- the handoff's clearer split between:
  - contract-mediated bridge rails
  - passthrough/provider-direct/Mode B rails
- direct-bridge integrations where EMPX:
  - quotes
  - ranks
  - builds integration payloads
  - tracks status
  - but does not introduce unnecessary new on-chain EMPX contract hops

Why:

- several phase-2 rails fit better as passthrough integrations than as new
  contract-heavy EMPX rail-plugin surfaces
- this lowers deployment and audit burden while preserving bridge coverage

Applies in phase 2 to:

- Hyperlane Nexus

This pattern may later support additional rails, but those later rail adoptions
do not belong to this phase document.

Constraints:

- preserve the existing EMPX contract path for rails that actually require it
- do not force all rails into a single contract model

### 3. Hyperlane Nexus

Decision: `Required`

Adopt:

- `Hyperlane Nexus` as the first bridge-expansion rail from the June 8 handoff
- its quote worker / monitor worker / provider-direct integration
- registry and chain-accessibility updates needed for it
- Mode B passthrough treatment rather than a new EMPX source-chain plugin path

Why:

- it has the cleanest architectural fit with the current system
- it expands stablecoin bridge reach without pulling in multi-hop
- it has lower blast radius than the liquidity-rail additions
- it is the strongest first candidate from both the older phase-2 selection
  and the newer handoff

Constraints:

- keep it focused on the bridge logic
- do not bundle unrelated partner, UI, or broad SDK work with it

### 4. Rail-specific watch / settle completion

Decision: `Required prerequisite`

Require for the adopted phase-2 rail and for the bridge foundation it depends
on:

- real quote worker or validated bridge-facing quote path
- real monitor/watch path
- intent lifecycle transition wiring
- final status mapping into existing intent states
- failure semantics that do not break the current bridge lifecycle

Why:

- a rail that only quotes is not a bridge feature
- phase 2 should only ship rails that the bridge can actually observe and
  complete operationally

### 5. Registry and accessibility expansion

Decision: `Required`

Adopt:

- chain-to-rail accessibility expansion for the selected phase-2 rails
- settlement-token and destination-coverage updates needed by those rails
- fallback relationships where they are coherent with the current bridge model

Why:

- this is what turns new rail code into actual route coverage
- without this layer, the bridge cannot honestly surface the new options

Constraints:

- keep accessibility logic aligned with real quote/watch support
- do not overclaim support for rails still in scaffold state

## Explicitly Included Non-Rail-Expansion Updates

To avoid ambiguity, the following are in scope for phase 2 even though they
are not simply "add a rail":

- Mode B / passthrough bridge integration pattern
- per-rail quote/monitor/settle lifecycle wiring
- registry and chain-coverage expansion
- quote/runtime cleanup that supports Hyperlane inside the current runtime
  structure

This is a foundation-first phase, not a breadth-first rail rollout phase.

## Explicitly Excluded From This Phase 2

### Permanent exclusions

These are dropped permanently from the migration path unless a future document
explicitly reopens them:

- all multi-hop functionality
- all hub-biased route logic
- all hub-hop route construction
- `RouteHopPolicy`
- `RouterV1MultiHop`
- `ReceiverV1MultiHop`
- multi-hop execution builders
- hub-swap dispatch logic
- multi-hop basket execution paths
- any migration work whose purpose is to revive hub-based bridge routing

### Exclusions from the June 8 handoff

These may exist in the handoff, but they are out of scope for this phase-2
bridge migration:

- frontend migration work
- landing/SEO work
- UI-specific chain wallet work
- same-chain `empx-swap-sdk` migration as a standalone track
- broader partner/agent product expansion unrelated to bridge execution
- `IntentBasket`
- `BasketQuoteEngine`
- `BasketStatusEngine`
- basket/multiswap execution
- `EmpsealMulticallRouter`
- full ERC-7683 expansion
- `Erc7683Adapter`
- external solver directory / marketplace work
- `SolversRepository` and solver-registration product surface
- native-bridge family rollout as a main phase-2 target
- `OptimismNativeBridgeSolver` as a shipping objective for this phase
- wholesale `PartnerAPI` replacement
- wholesale `EmpxSDK` replacement

### Deferred to phase 3

The following handoff updates remain valid inputs, but they do not belong to
this phase-2 selection:

- bridge-side solver decomposition from the handoff
- `RailSolver`-oriented rail localization under `src/vps/rails/solvers/*`
- deferred Hyperlane solver/helper migration such as
  `HyperlaneNexusSolver.ts` and any shared bridge-only solver helpers that are
  still worth adopting
- remaining bridge-runtime cleanup whose main purpose is solver-localization

The following bridge rails also remain valid handoff inputs, but they do not
belong to this phase-2 selection:

- `Chainflip`
- `Maya`
- `TeleSwap`

They should be handled by the later bridge-only remainder document after the
phase-2 foundation and `Hyperlane Nexus` slice are complete.

### Phase-1 leftovers that remain excluded

Some bridge-adjacent work from earlier documents remains intentionally out of
scope here:

- any phase-1 leftover whose primary purpose was multi-hop enablement
- any destination-gas extension that depends on multi-hop execution
- any quote/runtime branch whose only value is hub-based routing

## Implementation Order

Recommended order for this bridge-only phase 2:

1. adopt the rail expansion framework and registry/accessibility deltas
2. ship Hyperlane Nexus end to end through the current provider-direct path
3. validate quote + watch + settle behavior for Hyperlane
4. stop the phase after the Hyperlane slice is operationally complete

## Final Position

The June 8 handoff broadens phase 2 beyond "just add more rails," but the
bridge migration should still remain narrow and disciplined.

The approved bridge-only phase-2 selection is:

- rail expansion framework
- Mode B / passthrough bridge integration pattern
- Hyperlane Nexus as the first required rail
- rail-specific watch/settle completion
- registry and accessibility expansion for adopted rails

The following are explicitly not part of this migration slice:

- deferred solver-localization and `RailSolver` framework migration
- later rail adoptions beyond Hyperlane
- multi-hop
- hub-biased routing
- basket / multiswap
- ERC-7683 / solver-marketplace work
- frontend / broader SDK work

Everything excluded above should be ignored during migration unless a later
selection document explicitly changes that decision.
