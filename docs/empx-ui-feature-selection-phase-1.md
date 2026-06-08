# EmpX UI Feature Selection: Phase 1

> Date: June 5, 2026
> Scope: selected UI features from `/Users/ganadhish/code/work/empx-checkpoint-v6/ui-v2-workspace/EMPSEAL-UI-feature-cross-chain-integration`

## Purpose

This document defines the first approved UI feature-selection slice from the
checkpoint UI branch for migration into the main `EMPSEAL-UI` line.

This is not a wholesale UI branch adoption plan. It is a constrained selection
for the current product direction.

## Selection Principles

- Keep the current UI repo as the production source of truth.
- Prefer features that improve cross-chain usability directly.
- Keep functional, tested additions ahead of large visual/component churn.
- Preserve existing wallet/read reactivity patterns where they already work.
- Only adopt UI additions that align with the selected bridge and SDK roadmap.

## Selected Features

### 1. Destination-address UX

Decision: `Required`

Adopt:

- `src/components/DestinationAddressInput.jsx`
- chain-kind routing
- per-chain destination placeholder and hint support
- wrong-chain detection and validation messaging

Why:

- this is the highest-value UI addition in the checkpoint
- it directly supports more non-EVM destination coverage
- it improves cross-chain safety and usability materially

### 2. Wallet address validator stack

Decision: `Required`

Adopt:

- `src/lib/wallet/chainKind.ts`
- `src/lib/wallet/validators/*`
- `src/lib/wallet/codec/*`
- supporting tests for validators and codecs

Why:

- this is the foundation under the destination-address UX
- it is well covered by checkpoint tests
- it gives the UI an explicit address-family model rather than ad hoc checks

### 3. Lazy non-EVM wallet adapters

Decision: `Optional but strong candidate`

Adopt:

- `src/lib/wallet/adapters/*`
- lazy adapter loading for:
  - Solana
  - Bitcoin
  - Tron
  - Cosmos

Why:

- improves destination-side wallet onboarding
- keeps bundle impact contained through lazy loading
- fits the broader non-EVM destination roadmap

Constraints:

- keep this as progressive enhancement
- manual address entry must remain fully supported
- do not block core cross-chain flows on adapter availability

### 4. SDK seam for swap execution

Decision: `Required`

Adopt:

- `src/hooks/swap/useEmpxRouter.js`
- the pattern of SDK-driven writes with wagmi-driven reads

Why:

- this is the cleanest UI integration seam in the checkpoint
- it keeps the UI aligned with the selected SDK direction
- it reduces coupling between page code and low-level swap execution details

Constraints:

- preserve wagmi/reactive reads where they already serve the UI well
- do not force a full page rewrite just to adopt this seam

### 5. Swap-page hook decomposition

Decision: `Optional`

Adopt selectively:

- `useSwapQuoteFetch`
- `useSwapBalances`
- `useSwapExecution`
- `useSwapPriceImpact`

Why:

- improves maintainability of swap-page logic
- creates cleaner boundaries for SDK integration

Constraints:

- only port the decomposition if it reduces actual page complexity in the
  current branch
- do not import unrelated UI churn with it

### 6. Safety and formatting utilities

Decision: `Optional`

Adopt selectively:

- token-warning and safety-badge surfaces
- shared formatting helpers
- shared empty-state and modal utilities where they fit current patterns

Why:

- these improve consistency and UX quality
- they are useful, but less critical than the cross-chain wallet layer

Constraints:

- do not mass-port checkpoint component churn
- keep visual/system choices aligned with the current UI line

## Explicitly Out of Scope for Phase 1

The following are not part of this selection document:

- wholesale adoption of the checkpoint UI branch
- unresolved typecheck-debt outside the selected feature slice
- large unrelated shadcn/Radix package expansion
- non-essential landing-page or broader marketing-page changes
- full rewrite of the swap page around checkpoint structure

## Implementation Order

Recommended order for this phase:

1. wallet validator and codec stack
2. destination-address UX
3. SDK seam for swap execution
4. lazy non-EVM wallet adapters
5. swap-page hook decomposition where useful
6. selected safety/formatting utilities

## Final Position

UI phase 1 should focus on cross-chain usability and safe SDK integration, not
on adopting the checkpoint branch wholesale.

The approved UI selection is:

- destination-address UX
- wallet validator and codec stack
- SDK seam for writes
- lazy wallet adapters as progressive enhancement
- selective swap-page refactor utilities
- selective safety/formatting utilities

Everything beyond that should be treated as later UI cleanup or design work.
