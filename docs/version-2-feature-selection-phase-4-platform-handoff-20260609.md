# Version 2 Feature Selection: Phase 4 Platform Handoff

> Date: June 9, 2026
> Scope: selected non-frontend, non-swap-SDK platform features from
> `/Users/ganadhish/code/work/empx-cross-chain-bridge-V2-updates/empx-complete-handoff-20260608`
> that were previously excluded from the bridge-only phases
> while still using
> `/Users/ganadhish/code/work/empx-cross-chain-bridge-V2-updates/empx-complete-handoff-20260608/empx-cross-bridge`
> as the bridge-runtime subtree

## Purpose

This document defines the next migration slice after the bridge-focused phase
2 and phase 3 selections.

Phase 4 is where the project broadens from a bridge-runtime upgrade path into
the wider execution-platform capabilities that exist in the complete handoff.

This phase intentionally includes feature families that were previously listed
as excluded handoff items in
`docs/version-2-feature-selection-phase-3-bridge-handoff-20260609.md`,
except for:

- frontend migration work
- broader same-chain SDK migration

## Relationship to Earlier Phase Docs

- `docs/version-2-feature-selection-phase-2-bridge-handoff-20260608.md`
  - Mode B integration pattern, Hyperlane-first rail expansion, and initial
    provider-direct bridge-runtime slice
- `docs/version-2-feature-selection-phase-3-bridge-handoff-20260609.md`
  - remaining bridge-rail expansion, deferred solver-localization, and
    bridge-runtime completion

Phase 4 is different.

It is not primarily about adding more rails.

It is about adopting the handoff's broader execution and orchestration
families that sit above or around the bridge core.

## Source Inputs

Primary handoff package root:

- `/Users/ganadhish/code/work/empx-cross-chain-bridge-V2-updates/empx-complete-handoff-20260608`

Primary source tree:

- `/Users/ganadhish/code/work/empx-cross-chain-bridge-V2-updates/empx-complete-handoff-20260608/empx-cross-bridge`

Reference documents:

- `docs/version-2-feature-selection-phase-3-bridge-handoff-20260609.md`
- `empx-complete-handoff-20260608/README-COMPLETE-HANDOFF.md`
- `empx-complete-handoff-20260608/ARCHITECTURE.md`
- `empx-complete-handoff-20260608/PARTNER-AND-AGENT-INTEGRATION.md`
- `empx-complete-handoff-20260608/empx-cross-bridge/ROADMAP.md`

## Selection Principles

- Keep all multi-hop and hub-biased logic permanently excluded.
- Leave frontend migration and broader same-chain SDK migration out.
- Prefer product families that expand execution capability without rewriting the
  core bridge quote model.
- Treat these as higher-level orchestration and platform features, not as rail
  substitutions.
- Keep every selected family operationally complete:
  - API surface
  - runtime logic
  - persistence/lifecycle where needed
  - verification path

## What Phase 4 Is Actually About

Phase 4 broadens the system from "cross-chain bridge runtime" into
"cross-chain execution platform."

That means the selected handoff work is no longer only about quote a route,
submit a route, and monitor a route.

It adds:

1. multi-intent and portfolio-style orchestration
2. wallet-aware discovery and liquidation workflows
3. batched execution primitives
4. interoperability with external solver ecosystems
5. partner and agent surfaces that expose those capabilities

## Selected Features

### 1. IntentBasket and basket execution

Decision: `Required`

Adopt:

- `IntentBasket` as the main abstraction for grouped execution
- `BasketQuoteEngine`
- `BasketStatusEngine`
- partner basket quote/status endpoints and supporting persistence
- basket execution for grouped single-hop cross-chain and same-chain legs

Why:

- this is the main architectural step from single-intent routing to
  portfolio-level execution
- it creates the foundation for treasury, rebalance, liquidation, and agent
  workflows
- it is the broadest product lift among the previously excluded handoff items

Constraints:

- basket execution must not revive multi-hop
- each child leg should remain a normal supported route, not a hub-routed path
- no reintroduction of `RouterV1MultiHop`, `ReceiverV1MultiHop`, or hub-hop
  planners through the basket abstraction

### 2. WalletScanner

Decision: `Required`

Adopt:

- `WalletScanner` service
- partner-facing wallet scan surface where useful
- chain/token discovery using the existing RPC hardening approach
- wallet inventory output that can feed basket or liquidation workflows

Why:

- it moves the product from reactive quoting to wallet-aware orchestration
- it is the discovery layer needed for automated portfolio actions
- it becomes the natural source for basket prefill and liquidation candidates

Constraints:

- keep RPC fan-out disciplined and bounded
- keep the service independent from any multi-hop planning logic

### 3. Wallet-liquidator flows

Decision: `Required`

Adopt:

- wallet-liquidation workflow built on top of `WalletScanner`
- flow(s) that convert scattered assets into a target asset or target basket
- partner/agent-facing execution surface for that workflow

Why:

- this turns discovery into a concrete high-value automation product
- it is one of the clearest user-facing benefits of the broader handoff
- it creates real operational value for users, treasuries, and agents

Constraints:

- keep the workflow composed from supported single-hop legs and same-chain
  actions
- do not hide multi-hop execution behind liquidation terminology

### 4. EmpsealMulticallRouter

Decision: `Required`

Adopt:

- `EmpsealMulticallRouter` as the dedicated batching primitive
- deployment and runtime integration where needed for selected flows
- safety checks and batching limits consistent with the handoff contract tests

Why:

- basket and liquidation-style execution benefit from a clear batching
  primitive
- this expands what can be executed in one coordinated operation without
  changing the rail model

Constraints:

- keep it as a batching primitive, not a backdoor multi-hop engine
- use it for grouped or split execution where each leg is still individually
  valid

### 5. ERC-7683 adapter and external-solver flows

Decision: `Required`

Adopt:

- `erc7683` core types and drift-guard patterns
- `Erc7683Adapter`
- partner-facing resolve/open endpoints
- tracked-intent creation for cross-chain external-solver flows

Why:

- this is the handoff's main interoperability path into external intent
  ecosystems
- it turns the project from a closed in-house router into a participant in a
  broader execution network
- it can expand flow origination without requiring new rails first

Constraints:

- keep this as a well-bounded adapter surface first
- do not tie phase-4 success to a full open solver marketplace on day one

### 6. Solver registration and marketplace surfaces

Decision: `Staged within phase 4`

Adopt later in phase 4:

- solver registration surfaces
- solver discovery/listing surfaces
- reliability attribution for external solver-sourced volume

Why:

- this is the control-plane layer that turns ERC-7683 and external-solver
  support into a real platform feature
- it is what creates platform/network-effect upside rather than one-off adapter
  support

Constraints:

- stage this after the adapter/open/resolve path is stable
- keep admission, reliability, and attribution explicit

### 7. Partner and agent surfaces tied to phase-4 capabilities

Decision: `Required but bounded`

Adopt:

- partner API surface needed for baskets, wallet scan, liquidation, and
  external-solver flows
- agent/tool surfaces that directly expose those same capabilities

Why:

- these features matter strategically only if integrators and agents can
  actually drive them
- the handoff treats partner and agent access as first-class usage modes

Constraints:

- keep this tied to selected phase-4 capabilities only
- do not reopen unrelated frontend or generic SDK migration through this path

## Explicitly Included Non-Bridge Families

To avoid ambiguity, the following families are intentionally included in phase
4:

- basket / multiswap product family, but without multi-hop revival
- wallet scan and liquidation workflows
- execution batching primitives
- ERC-7683 interoperability
- external-solver onboarding/control surfaces
- partner and agent surfaces directly attached to the above

## Explicitly Deferred Within or After Phase 4

These may still be relevant later, but they should not block the main phase-4
selection:

- bridge-deferred native-bridge rollout from the phase-3 doc
- Via Labs rebuild / relaunch
- broader partner/agent product ambitions unrelated to selected phase-4
  capabilities
- any generalized autonomous orchestration beyond the selected handoff surfaces

## Permanent Exclusions

These remain dropped from phase 4 and future migration docs unless explicitly
reopened later:

- all multi-hop functionality
- all hub-biased route logic
- all hub-hop route construction
- `RouteHopPolicy`
- `RouterV1MultiHop`
- `ReceiverV1MultiHop`
- multi-hop execution builders
- hub-swap dispatch logic
- any route, contract, or runtime branch whose purpose is to revive hub-based
  routing

## Still Out of Scope

Even after promoting the previously excluded platform families into phase 4,
the following stay out:

- frontend migration work
- broader same-chain SDK migration
- unrelated UI/marketing/deployment polish outside the selected runtime and API
  surfaces

## Implementation Order

Recommended order for phase 4:

1. ship `IntentBasket`, `BasketQuoteEngine`, and `BasketStatusEngine`
2. add `WalletScanner` as the discovery layer
3. ship wallet-liquidator flows on top of scan + basket primitives
4. integrate `EmpsealMulticallRouter` where batching materially improves
   selected flows
5. ship `Erc7683Adapter` resolve/open flows
6. add staged solver registration and marketplace surfaces
7. expand partner and agent surfaces around the completed runtime capabilities

## Final Position

Phase 4 should promote the previously excluded handoff platform families into
the migration path, while still keeping frontend, broader same-chain SDK work,
and all multi-hop/hub logic out.

The approved phase-4 selection is:

- `IntentBasket`, `BasketQuoteEngine`, and `BasketStatusEngine`
- `WalletScanner`
- wallet-liquidator flows
- `EmpsealMulticallRouter`
- `Erc7683Adapter` and external-solver flows
- staged solver registration / marketplace surfaces
- partner and agent surfaces tied to those capabilities

Phase 4 is where the project stops being only a better bridge runtime and
starts becoming a broader execution platform.
