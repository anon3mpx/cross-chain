# EmpX Swap SDK Feature Selection: Phase 1

> Date: June 5, 2026
> Scope: selected SDK features from `/Users/ganadhish/code/work/empx-checkpoint-v6/empx-swap-sdk`
> Reference package reviewed separately: `/Users/ganadhish/code/work/empx-sdk/src`

## Purpose

This document defines the first approved SDK feature-selection slice from the
checkpoint repos for migration into the main `empx-swap-sdk` line.

This is not a package replacement plan. It is a constrained selection for the
current production SDK direction.

For bridge-linked roadmap alignment, read this together with the June 8
complete handoff package at
`/Users/ganadhish/code/work/empx-cross-chain-bridge-V2-updates/empx-complete-handoff-20260608`
and its bridge runtime tree at
`/Users/ganadhish/code/work/empx-cross-chain-bridge-V2-updates/empx-complete-handoff-20260608/empx-cross-bridge`.

## Selection Principles

- Keep the TypeScript `empx-swap-sdk` as the primary SDK line.
- Prefer additive improvements over package-surface rewrites.
- Preserve the current config-based affiliate model as the default.
- Treat the JS beta SDK as a reference for future integrator-router work, not
  as the canonical SDK.
- Only adopt features that are typecheck-clean and test-clean.

## Selected Features

### 1. Packaging and export hardening

Decision: `Required`

Adopt:

- expanded `exports` compatibility for `import`, `require`, and `types`
- build asset-copy step
- supporting build-script cleanup

Why:

- improves package consumption across Node, bundlers, and browser builds
- reduces friction for UI and partner integrations
- is low risk and already validated in the checkpoint SDK

### 2. Split-routing core

Decision: `Required`, but behind feature gating

Adopt:

- `src/core/splitSolver.ts`
- `src/core/splitCalldata.ts`
- supporting type additions for split results and multicall support

Why:

- this is the main substantive SDK improvement in the checkpoint
- it is typecheck-clean and test-clean
- it cleanly extends the SDK without forcing a new top-level product model

Constraints:

- keep split routing opt-in first
- only enable on chains with `EmpsealMulticallRouter` support
- require bridge/UI callers to handle gas-vs-output tradeoffs explicitly

### 3. Split-routing tests

Decision: `Required`

Adopt:

- `src/core/splitSolver.test.ts`
- `src/core/splitCalldata.test.ts`

Why:

- these are the strongest validation artifacts in the checkpoint SDK
- they make the split-routing lift much safer

### 4. Chain metadata and ABI updates needed by selected SDK features

Decision: `Required`

Adopt:

- updated chain metadata where required by split-routing
- updated ABI and calldata support where required by split-routing
- supporting type/export updates used by the selected SDK surfaces

Why:

- split-routing cannot be lifted safely without the exact metadata and ABI
  pieces it depends on

Constraints:

- do not mix unrelated chain-metadata churn into this phase
- keep the migration scoped to what the selected SDK features actually use

### 5. Affiliate-fee visibility improvements

Decision: `Required`

Adopt:

- any clean checkpoint improvements to fee breakdown surfaces
- affiliate earning estimation improvements that fit the current TS SDK model

Why:

- affiliate support already exists in the TypeScript SDK
- better fee visibility improves integrator usability without changing the
  routing model

### 6. Integrator-router affiliate model as reference input

Decision: `Optional but approved candidate`

Use from `/Users/ganadhish/code/work/empx-sdk/src` as reference for:

- `createAffiliateRouter(chainId, integratorId, provider?)`
- affiliate-aware ABI variant selection
- chain-specific affiliate router overrides

Why:

- this is the actual value of the JS beta SDK
- it represents a different affiliate model than the current TS SDK

Constraints:

- do not replace the current TS SDK with the beta package
- do not adopt the integratorId model until protocol-level requirements are
  clear
- treat this as design input for a future phase, not an immediate package flip

## Explicitly Out of Scope for Phase 1

The following are not part of this selection document:

- replacing the TypeScript SDK with `empx-swap-sdk-beta`
- making the JS beta SDK the official SDK line
- adopting the `integratorId` model as the default affiliate model
- cross-chain bridge SDK surfaces
- basket or portfolio-level client orchestration
- package-surface changes that require backend/API redesign

## Implementation Order

Recommended order for this phase:

1. packaging and export hardening
2. split-routing core
3. split-routing tests
4. exact ABI/metadata updates needed by split routing
5. fee visibility improvements
6. document the integrator-router affiliate model for a later phase

## Final Position

SDK phase 1 should keep the TypeScript `empx-swap-sdk` as the canonical SDK
and selectively absorb the checkpoint’s clean improvements.

The approved SDK selection is:

- packaging/export hardening
- split-routing core
- split-routing tests
- exact supporting ABI/metadata updates
- fee visibility improvements
- JS beta affiliate-router logic only as future reference input

Everything beyond that should be treated as a later SDK evolution decision.
