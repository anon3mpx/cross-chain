# Version 2 Feature Selection: Phase 2

> Date: June 5, 2026
> Scope: selected bridge-expansion features after phase 1, using
> `/Users/ganadhish/code/work/empx-checkpoint-v6/empx-cross-bridge` as the
> current checkpoint source

## Purpose

This document defines the second approved bridge feature-selection slice after
the phase-1 selection in
`/Users/ganadhish/code/work/ruflo/docs/version-2-feature-selection-phase-1.md`.

Phase 2 is not a “merge checkpoint v6” instruction. It is a constrained bridge
expansion plan for the current production-oriented system.

## Selection Principles

- Keep current `ruflo` as the production source of truth.
- Preserve peer/mesh-first routing as the default architecture.
- Expand rail coverage only when runtime integration is complete and compile-clean.
- Prefer rail additions with strong test coverage and clear product value.
- Keep hub-first, multi-hop, and unfinished solver-marketplace assumptions out
  of the mainline path.

## Selected Features

### 1. Rail expansion framework

Decision: `Required`

Adopt:

- the pattern used for adding new rails into:
  - `Rail` enums
  - registry wiring
  - accessible-chain mappings
  - rail-specific tests

Why:

- phase 2 is primarily about bridge coverage expansion
- the checkpoint provides a clear pattern for how new rails should be modeled
- the tests are the strongest part of this expansion work

Constraints:

- do not copy incomplete solver classes blindly
- require compile-clean end-to-end rail integration before enabling a rail

### 2. New rail research and test assets

Decision: `Required`

Adopt as planning and validation inputs:

- Chainflip rail tests and mappings
- Maya rail tests and mappings
- TeleSwap rail tests and mappings
- Hyperlane Nexus rail tests and mappings

Why:

- these artifacts capture the coverage logic and intended product role of the
  new rails
- they reduce guesswork for future production rail implementation

Constraints:

- treat them as source material until the runtime path is complete
- do not label a rail “adopted” purely because its tests exist in the
  checkpoint

### 3. Hyperlane Nexus as the strongest candidate rail

Decision: `Optional but approved candidate`

Prioritize evaluation of:

- Hyperlane Nexus for low-cost stablecoin messaging coverage

Why:

- it aligns better with the current bridge architecture than the more bespoke
  external liquidity rails
- its role is clearer and narrower
- it appears less directionally disruptive than hub-routing or solver-market
  work

Constraints:

- still require compile-clean integration
- require real execution/watch/settle wiring before rollout

### 4. Chainflip, Maya, and TeleSwap as staged rail candidates

Decision: `Optional`

Evaluate later:

- Chainflip
- Maya
- TeleSwap

Why:

- they expand destination and asset coverage materially
- the checkpoint proves the product intent and coverage logic are already being
  shaped

Constraints:

- they are still scaffold-level in the checkpoint
- do not move any of them forward without:
  - full `RailSolver` lifecycle implementation
  - compile-clean runtime integration
  - actual worker/client implementation
  - ops/runbook readiness

### 5. Rail-specific worker and client completion

Decision: `Required prerequisite`

Require before any new rail goes live:

- real quote worker/client implementation
- real monitor/watch path
- settle/finalize path
- fallback behavior and failure semantics

Why:

- the checkpoint rails are not production rails yet
- the current compile failures show the integration is incomplete

### 6. Rail-specific runtime propagation

Decision: `Required prerequisite`

Require before any new rail goes live:

- all new rail enum values propagated through:
  - `IntentService`
  - `IntentEngine`
  - stuck-threshold maps
  - status tracking
  - lifecycle logic

Why:

- the checkpoint currently fails `tsc` partly because this propagation is not
  finished

## Explicitly Out of Scope for Phase 2

The following are not part of this selection document:

- hub-based multi-hop routing
- `RouterV1MultiHop` / `ReceiverV1MultiHop`
- revenue-biased multi-hop policy
- solver-directory and external-solver marketplace ambitions
- wholesale checkpoint bridge replacement
- enabling scaffold rails directly from the checkpoint without completing them

## Implementation Order

Recommended order for this phase:

1. adopt the rail-expansion framework and test pattern
2. select one candidate rail, with Hyperlane Nexus first
3. complete quote/worker/client/runtime lifecycle for that rail
4. propagate the rail through lifecycle maps and engine/service logic
5. validate compile, tests, and operational readiness
6. repeat for the next candidate rail

## Final Position

Bridge phase 2 should focus on controlled rail expansion, not on taking the
checkpoint branch directly.

The approved phase-2 bridge selection is:

- rail-expansion framework
- checkpoint rail tests and mappings as source material
- Hyperlane Nexus as the first serious candidate
- other new rails only as staged follow-on candidates
- runtime and lifecycle completion as a non-negotiable prerequisite

Everything beyond that should remain outside the mainline bridge path until it
is compile-clean, operationally clear, and strategically aligned.
