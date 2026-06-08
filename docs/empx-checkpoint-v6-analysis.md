# EmpX Checkpoint v6 Analysis

> Date: June 5, 2026
> Scope:
> - current bridge repo: `/Users/ganadhish/code/work/ruflo`
> - checkpoint bridge repo: `/Users/ganadhish/code/work/empx-checkpoint-v6/empx-cross-bridge`
> - current UI repo: `/Users/ganadhish/code/work/EMPSEAL-UI`
> - checkpoint UI repo: `/Users/ganadhish/code/work/empx-checkpoint-v6/ui-v2-workspace/EMPSEAL-UI-feature-cross-chain-integration`
> - current TS swap SDK: `/Users/ganadhish/code/work/empx-swap-sdk`
> - checkpoint TS swap SDK: `/Users/ganadhish/code/work/empx-checkpoint-v6/empx-swap-sdk`
> - JS beta affiliate SDK: `/Users/ganadhish/code/work/empx-sdk/src`

## Executive Summary

`empx-checkpoint-v6` is a cumulative checkpoint built on top of the V2
direction, not a clean “version 6” replacement branch.

The main result is:

- the bridge repo adds meaningful new rail scaffolding, but it is not fully
  integrated at the runtime/type level
- the UI repo adds more than a small patch; it includes a substantial
  cross-chain wallet UX layer and SDK wiring, though its test state is much
  healthier than its typecheck state
- the TypeScript `empx-swap-sdk` evolves mainly around split-routing and
  packaging improvements
- the separate JS `empx-swap-sdk-beta` is not just an older copy of the same
  SDK; it uses a different affiliate/integrator model based on `integratorId`
  and affiliate-aware router ABI variants

The practical conclusion is:

- use the bridge checkpoint as a source of rail-expansion research and tests,
  not as a merge-ready branch
- mine the UI checkpoint selectively for destination-wallet UX and SDK seam
  patterns
- treat the TypeScript swap SDK as the primary product SDK
- treat the JS beta SDK as a reference implementation for integrator-router
  affiliate logic, not as the package to standardize on

## Scope Mapping

Checkpoint layout:

- `empx-checkpoint-v6/empx-cross-bridge`
- `empx-checkpoint-v6/ui-v2-workspace/EMPSEAL-UI-feature-cross-chain-integration`
- `empx-checkpoint-v6/empx-swap-sdk`

Comparison note:

- checkpoint bridge is a cumulative V2-style bridge repo plus additional rail
  work
- checkpoint UI is a cumulative UX + wiring branch, not just a small overlay
  on the current UI
- checkpoint swap SDK and `empx-sdk/src` are different packages with different
  goals

## Validation Summary

### Bridge checkpoint

Commands run in `empx-checkpoint-v6/empx-cross-bridge`:

```bash
npm ci --legacy-peer-deps
npx tsc --noEmit
npm test
```

Results:

- `npm ci --legacy-peer-deps`: passed
- `npx tsc --noEmit`: failed
- `npm test`: passed

What passed:

- multi-hop and ERC-7683 typehash sync tests
- new rail tests for:
  - Chainflip
  - Maya
  - TeleSwap
  - Hyperlane Nexus

What failed in TypeScript:

- new rail solver classes do not fully satisfy `RailSolver`
- new rail enum additions are not fully propagated into some lifecycle maps
- some new solver code still references shapes that do not match the current
  `SolverIntent`

Interpretation:

- the rail additions are real
- the tests prove registry and gating logic exist
- the runtime integration is still scaffold-level, not complete

### UI checkpoint

Commands run in
`ui-v2-workspace/EMPSEAL-UI-feature-cross-chain-integration`:

```bash
npm ci
npm run typecheck
npm run test:run
```

Results:

- `npm ci`: passed
- `npm run typecheck`: failed
- `npm run test:run`: passed

Test result:

- `28` test files passed
- `316` tests passed

Typecheck failures cluster around:

- missing UI-package dependencies for several Radix and shadcn-style component files
- broader existing typing debt in the UI codebase
- wagmi/viem type changes
- unresolved asset/module declarations in some pages

Interpretation:

- the new UI features are functionally tested
- the branch is not a clean TypeScript branch
- the failure set is wider than just the new cross-chain wallet features

### TypeScript swap SDK checkpoint

Commands run in `empx-checkpoint-v6/empx-swap-sdk`:

```bash
npm ci
npm run typecheck
npm test
```

Results:

- `npm ci`: passed
- `npm run typecheck`: passed
- `npm test`: passed

Test result:

- split-solver tests: `16` passed
- split-calldata tests: `12` passed

Interpretation:

- this is the cleanest updated surface in the checkpoint
- split-routing work is implemented and validated here

### JS beta affiliate SDK

Command run in `/Users/ganadhish/code/work/empx-sdk/src`:

```bash
npm run build
```

Result:

- `npm run build`: passed via `npm pack --dry-run`

What was not validated:

- networked runtime tests such as affiliate tx tests were not run here

## Bridge Repo: What Actually Changed

The bridge checkpoint is not just the old bridge repo with four new rail files.
It still carries the broader V2-style additions:

- intent-model docs
- gas-integration docs
- split-routing docs
- multi-hop contracts
- multicall router contract
- ERC-7683 on-chain pieces
- runtime/provider abstraction
- observability
- solver-oriented core abstractions

On top of that, the new bridge-specific addition in this checkpoint is:

### New rail scaffolding

New rail families added:

- Chainflip
- Maya
- TeleSwap
- Hyperlane Nexus

What is present:

- enum and registry wiring
- rail-specific tests
- solver skeletons
- stub worker/service directories
- asset-mapping and accessibility logic

What is not complete:

- full `RailSolver` lifecycle implementation
- intent-service and engine wiring for all new enum members
- compile-clean runtime path
- live execution/watch/settle path

Meaning:

- these rails are currently expansion scaffolds with good guard/test coverage
- they are not yet a merge-ready production bridge expansion

## UI Repo: What Actually Changed

The UI delta is not minimal in absolute terms.

Main additions:

- `DestinationAddressInput`
- wallet-chain-kind registry
- address validators for 15 destination families
- zero-dependency codecs for non-EVM address formats
- lazy wallet adapters for Solana, Bitcoin, Tron, and Cosmos
- swap-page hook decomposition
- `useEmpxRouter` seam for SDK-driven swap writes
- safety components and shared formatting utilities
- local-file dependency on `empx-swap-sdk`

What matters most for the bridge/integration roadmap:

### 1. Destination wallet UX

This is the highest-signal UI addition.

It gives:

- format-aware destination address validation
- wrong-chain detection
- per-chain hints
- optional one-click adapter connect for selected non-EVM wallet families

This is relevant if the UI needs to front more non-EVM destination rails.

### 2. SDK seam on the swap page

`useEmpxRouter` makes the UI treat the SDK as the write path while wagmi
remains the read/reactivity layer.

This is a useful architectural pattern even if the exact checkpoint UI branch
is not adopted wholesale.

### 3. Safety and refactor work

The shared warning, modal, empty-state, and formatting layers are useful, but
they are UI quality improvements rather than cross-chain architecture changes.

Overall UI conclusion:

- the branch is functionally valuable
- the destination-address stack is worth preserving
- the SDK seam pattern is worth preserving
- the UI repo itself is not clean enough to treat as a direct upstream branch

## TypeScript Swap SDK: What Actually Changed

Relative to the current `empx-swap-sdk`, the checkpoint SDK adds:

- ESM-friendly exports alongside CommonJS compatibility
- build-time asset copy step
- split-routing solver
- split-routing calldata builder
- split-routing tests
- deployment metadata file

Important clarification:

the current TypeScript `empx-swap-sdk` already has affiliate support.

Its affiliate model is:

- `createRouter(chainId, provider, { affiliate: { address, feeBps } })`
- affiliate earns a share of the protocol fee
- user fee does not change

So the checkpoint TypeScript SDK is not “the one that adds affiliate support.”
It mainly adds split-routing and packaging maturity.

Practical meaning:

- if you want to continue with the TypeScript SDK as the official SDK, this is
  the right base to extend
- if you want split routing, the checkpoint SDK is the most mature place to
  lift it from

## JS Beta Affiliate SDK: What It Is

`/Users/ganadhish/code/work/empx-sdk/src` is the package published as
`empx-swap-sdk-beta`.

It is not the same product surface as the current TypeScript SDK.

Its distinctive feature is:

- `createAffiliateRouter(chainId, integratorId, provider?)`

This model differs from the TypeScript SDK’s affiliate config.

### TypeScript SDK affiliate model

- affiliate address + fee share config
- caller controls affiliate wallet address and share
- no separate router-constructor for affiliate mode

### JS beta SDK affiliate model

- `integratorId` is a protocol-issued `bytes32`
- SDK switches to affiliate-aware router ABI variants automatically
- some chains use affiliate-specific router-address overrides

What that means:

- the beta SDK is modelling a protocol-managed integrator identity system
- the TypeScript SDK is modelling a local affiliate revenue-share config

This is an important distinction. The beta SDK should be treated as a
reference for:

- integrator-bound router construction
- affiliate-aware calldata encoding
- protocol-issued integrator identity

It should not be treated as the package that replaces the current TypeScript
SDK outright.

## What Exists vs What Does Not

### Bridge checkpoint

Exists:

- new rail registry/test scaffolding
- V2-style contracts/runtime/docs
- rail-specific test coverage

Does not exist cleanly:

- compile-clean bridge runtime for the new rails
- full solver lifecycle implementation for the new rails
- production-ready end-to-end integration for those rails

### UI checkpoint

Exists:

- tested destination-address UX
- tested wallet validator/codec stack
- SDK seam on swap execution

Does not exist cleanly:

- typecheck-clean UI branch
- fully normalized dependency graph for all UI component packages

### TypeScript swap SDK checkpoint

Exists:

- clean split-routing implementation
- passing tests
- passing typecheck
- affiliate support through config-based fee sharing

Does not add:

- the beta SDK’s `integratorId`/affiliate-router ABI model

### JS beta SDK

Exists:

- integrator-aware affiliate router model
- CommonJS consumable package
- protocol-style affiliate/integrator encoding path

Does not appear to be the right long-term base for:

- the main TypeScript product SDK
- split-routing work
- wallet helper ergonomics already present in the TS SDK

## Recommended Migration Posture

### 1. Bridge

Do not merge the bridge checkpoint directly.

Recommended use:

- mine the new rail registry/tests/docs as planning input
- port a rail only when:
  - its solver lifecycle is fully implemented
  - `tsc` is clean
  - intent-engine and intent-service integration is complete

Current status:

- useful scaffold
- not merge-ready

### 2. UI

Do not treat the whole UI checkpoint as a clean upstream branch.

Recommended use:

- preserve the destination-address validation stack
- preserve the non-EVM wallet adapter pattern
- preserve the `useEmpxRouter` seam and SDK-write / wagmi-read split
- selectively lift safety/refactor utilities if needed

Current status:

- functionally strong
- type hygiene still weak

### 3. TypeScript swap SDK

This should remain the main SDK line.

Recommended use:

- keep it as the official SDK base
- port in split-routing from the checkpoint when `EmpsealMulticallRouter`
  becomes part of the selected product path
- retain the current config-based affiliate model unless protocol-level
  integrator IDs are explicitly required

Current status:

- strongest updated artifact in the checkpoint

### 4. JS beta SDK

Do not switch to it as the canonical SDK.

Recommended use:

- use it as reference material for a future protocol-managed affiliate model
- selectively port:
  - `createAffiliateRouter(...)`
  - integrator-aware ABI encoding
  - chain-specific affiliate router overrides

Current status:

- valuable reference implementation
- not the package to standardize on

## Final Conclusion

`empx-checkpoint-v6` is best understood as:

- bridge: V2-style cumulative branch plus incomplete new rail scaffolding
- UI: meaningful cross-chain wallet UX expansion plus SDK wiring, but not a
  type-clean branch
- TypeScript swap SDK: the cleanest and most adoption-ready updated surface
- JS beta SDK: a separate affiliate/integrator model worth studying, not
  replacing the TypeScript SDK with

The highest-value takeaways are:

- the bridge rail work is real but still scaffold-stage
- the UI destination-wallet layer is worth keeping
- the TypeScript swap SDK is the right base for continued productization
- the JS beta SDK’s real value is its `integratorId`-based affiliate router
  model
