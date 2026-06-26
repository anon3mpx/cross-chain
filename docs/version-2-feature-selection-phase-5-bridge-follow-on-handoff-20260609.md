# Version 2 Feature Selection: Phase 5 Bridge Follow-On Handoff

> Date: June 9, 2026
> Scope: remaining bridge-only follow-on features from
> `/Users/ganadhish/code/work/empx-cross-chain-bridge-V2-updates/empx-complete-handoff-20260608`
> after the approved phase-2, phase-3, and phase-4 selections
> with bridge follow-on implementation continuing in
> `/Users/ganadhish/code/work/empx-cross-chain-bridge-V2-updates/empx-complete-handoff-20260608/empx-cross-bridge`

## Purpose

This document defines the remaining bridge-only migration slice after:

- phase 2 bridge foundation and Hyperlane-first adoption
- phase 3 remaining bridge-rail expansion
- phase 4 platform expansion

Phase 5 is the tail-end bridge roadmap.

It is where the migration picks up the bridge-specific items that were still
deferred after phases 2 and 3, plus the remaining bridge rails or bridge
surfaces that the handoff assumes more strongly than the current `ruflo`
runtime does.

## Relationship to Earlier Phase Docs

- `docs/version-2-feature-selection-phase-2-bridge-handoff-20260608.md`
  - Mode B pattern, Hyperlane-first adoption, and the initial provider-direct
    bridge slice
- `docs/version-2-feature-selection-phase-3-bridge-handoff-20260609.md`
  - Chainflip, Maya, conditional TeleSwap, deferred solver-localization, and
    bridge-runtime completion
- `docs/version-2-feature-selection-phase-4-platform-handoff-20260609.md`
  - basket, wallet, multicall, ERC-7683, and broader execution-platform
    families

Phase 5 returns to bridge-only work.

## Source Inputs

Primary handoff package root:

- `/Users/ganadhish/code/work/empx-cross-chain-bridge-V2-updates/empx-complete-handoff-20260608`

Primary source tree:

- `/Users/ganadhish/code/work/empx-cross-chain-bridge-V2-updates/empx-complete-handoff-20260608/empx-cross-bridge`

Reference documents:

- `docs/version-2-feature-selection-phase-3-bridge-handoff-20260609.md`
- `docs/version-2-feature-selection-phase-4-platform-handoff-20260609.md`
- `empx-complete-handoff-20260608/RAILS-AND-EXPANSION.md`
- `empx-complete-handoff-20260608/ROADMAP-via-labs-bridge.md`
- `empx-complete-handoff-20260608/ROADMAP-non-evm-sources.md`
- `empx-complete-handoff-20260608/empx-cross-bridge/ROADMAP.md`

## Selection Principles

- Keep this phase bridge-only.
- Keep frontend migration and broader same-chain SDK migration out.
- Keep all multi-hop and hub-biased logic permanently excluded.
- Prefer tail-end bridge coverage that expands real route availability or trust
  options rather than broad speculative scope.
- Treat a rail or bridge family as selected only when quote, watch, settle, and
  operational readiness are all present.

## What Phase 5 Is Actually About

Phase 5 is about the bridge surface that still remains after the main bridge
rails and the platform families are already accounted for.

That remaining bridge-only bucket breaks into six parts:

1. TeleSwap finalization if it was not justified or completed in phase 3
2. official native-bridge family rollout
3. native-bridge patient withdrawal support
4. Via Labs rebuild / relaunch
5. non-EVM source-side bridge flows
6. remaining messaging-rail activation where current `ruflo` still advertises a
   narrower rail surface than the handoff

## Selected Features

### 1. TeleSwap follow-on

Decision: `Required if not already completed in phase 3`

Adopt:

- `TeleSwap` end-to-end if it remains outside the completed phase-3 bridge set
- quote / solver / monitor / lifecycle wiring
- BTC-specialized Polygon and BSC route coverage where it proves product value

Why:

- it is the last explicitly named queued liquidity rail from the handoff
- it remains bridge-only and does not depend on the phase-4 platform families

Constraints:

- if TeleSwap is already complete by the end of phase 3, do not duplicate it
  here
- require route-value evidence over existing rails before rollout

### 2. Official native-bridge family rollout

Decision: `Required`

Adopt:

- native-bridge solver family beyond template-only status
- concrete ecosystem choices for the first official bridge integrations
- chain-specific native-bridge subclasses using the handoff's canonical solver
  interface shape

Likely first family members:

- Optimism-family standard bridge rollout
- additional official bridges only when the target ecosystem is explicitly
  selected

Why:

- this is the main remaining bridge family deferred from phase 3
- it improves trust-minimized tail-end coverage for ecosystems where third-party
  rails lag or are unavailable

Constraints:

- do not treat the template itself as shipped coverage
- choose concrete ecosystems based on partner or route demand, not abstract
  completeness

### 3. Native-bridge `urgency='patient'` flows

Decision: `Required with native-bridge rollout`

Adopt:

- explicit route semantics for long-withdrawal official bridge flows
- quote and ranking behavior that only surfaces those routes when the user or
  caller accepts the timing profile
- monitor/watch behavior appropriate for very long settlement windows

Why:

- official native bridges are not product-complete without honest handling of
  their withdrawal latency
- the handoff already identifies this as the correct gating concept

Constraints:

- keep patient-flow semantics explicit
- do not let long-native-bridge withdrawals distort standard fast-path route
  ranking

### 4. Via Labs rebuild / relaunch

Decision: `Required`

Adopt:

- `ViaLabsRailPlugin` rebuild against the current docs and integration shape
- `ViaLabsSolver` or equivalent off-chain rail support
- quote, execution, watch, and settle completion for the rebuilt surface

Why:

- the handoff treats Via Labs as an explicit independent bridge track
- the current repo still treats it as intentionally disabled
- this is a real bridge gap between the broader handoff surface and the current
  advertised runtime

Constraints:

- rebuild it against current Via Labs documentation rather than historical code
- do not couple this to frontend bridge-page work

### 5. Non-EVM source-side bridge flows

Decision: `Required`

Adopt:

- backend and bridge-runtime work for Phase B non-EVM sources
- source-side flows such as BTC / SOL / DOGE source into EVM destinations where
  supported by the selected bridge rails
- refund and source-specific operational semantics needed for those flows

Why:

- this is the clearest remaining bridge-only expansion after the named rail and
  native-bridge tracks
- it broadens the bridge from "EVM source outward" into a fuller cross-chain
  ingress model

Constraints:

- keep frontend destination/source wallet UX out of this phase
- scope this to backend/runtime/rail support and partner-facing execution
  surfaces only

### 6. Remaining messaging-rail activation and route-surface expansion

Decision: `Required where handoff and current runtime diverge`

Adopt:

- bridge-surface cleanup for messaging rails that the handoff treats as active
  or preserved while the current repo still narrows or disables them
- route-surface re-evaluation for `Wormhole`
- route-surface re-evaluation for `Axelar` where relevant
- activation only if quote, watch, settle, and deployment reality support it

Why:

- current `ruflo` still intentionally disables some provider definitions in the
  public rail surface
- this is part of the remaining bridge-only gap between the repo and the
  broader handoff bridge model

Constraints:

- do not advertise rails just because definitions exist in code
- use this item to close real bridge-surface gaps, not to bulk-enable every
  modeled provider blindly

## Explicitly Included Bridge Follow-On Families

To avoid ambiguity, phase 5 intentionally includes:

- deferred bridge rails that remain after phase 3
- native-bridge rollout and long-settlement handling
- Via Labs rebuild
- non-EVM source-side bridge runtime work
- remaining messaging-rail activation where the current repo is narrower than
  the handoff

## Explicitly Deferred Within or After Phase 5

These may still exist after this phase, but they should not block the main
phase-5 bridge selection:

- ecosystem-specific native bridges beyond the first selected rollout set
- additional non-EVM source families not justified by demand
- bridge-adjacent frontend wallet/address UX
- broader ops or product polish unrelated to the selected bridge runtime work

## Permanent Exclusions

These remain dropped from phase 5 and future migration docs unless explicitly
reopened later:

- all multi-hop functionality
- all hub-biased route logic
- all hub-hop route construction
- `RouteHopPolicy`
- `RouterV1MultiHop`
- `ReceiverV1MultiHop`
- multi-hop execution builders
- hub-swap dispatch logic
- any runtime, route, or contract branch whose purpose is to revive hub-based
  routing

## Still Out of Scope

Even in this bridge follow-on phase, the following remain outside the selected
scope:

- frontend migration work
- broader same-chain SDK migration
- basket / wallet / multicall / ERC-7683 platform work already selected into
  phase 4

## Implementation Order

Recommended order for phase 5:

1. finish TeleSwap only if phase 3 left it unresolved
2. ship Via Labs rebuild / relaunch
3. ship the first concrete native-bridge rollout
4. add explicit `urgency='patient'` route semantics for native-bridge withdraw
   flows
5. ship backend/runtime support for non-EVM source-side bridge flows
6. re-evaluate and close remaining messaging-rail activation gaps such as
   `Wormhole` and `Axelar` where justified

## Final Position

Phase 5 should collect the remaining bridge-only follow-on work after the main
bridge-rail phases and the phase-4 platform expansion are already defined.

The approved phase-5 selection is:

- TeleSwap follow-on if still incomplete after phase 3
- official native-bridge family rollout
- native-bridge `urgency='patient'` flows
- Via Labs rebuild / relaunch
- non-EVM source-side bridge flows
- remaining messaging-rail activation where the current runtime is narrower
  than the handoff bridge surface

This phase is the bridge tail-end coverage and bridge-surface alignment pass,
not another platform-expansion phase.
