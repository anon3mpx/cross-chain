# Version 2 Feature Selection: Phase 3 Bridge Handoff

> Date: June 9, 2026
> Scope: remaining bridge-only features from
> `/Users/ganadhish/code/work/empx-cross-chain-bridge-V2-updates/empx-complete-handoff-20260608`
> after the phase-2 bridge selection
> with bridge-runtime follow-on work continuing in
> `/Users/ganadhish/code/work/empx-cross-chain-bridge-V2-updates/empx-complete-handoff-20260608/empx-cross-bridge`

## Purpose

This document defines the remaining bridge-side migration slice after the
phase-2 bridge handoff selection in
`docs/version-2-feature-selection-phase-2-bridge-handoff-20260608.md`.

Phase 3 is not a "merge everything left in the handoff" instruction.

It is the bridge-only remainder after phase 2, with the same production
constraints:

- keep current `ruflo` as the source of truth
- keep the main cross-chain quote model stable
- expand bridge coverage only when quote, watch, and settle paths are complete
- permanently exclude multi-hop and hub-biased route logic

## Relationship to Earlier Phase Docs

- `docs/version-2-feature-selection-phase-1.md`
  - phase 1 focused on reliability, partner-facing API hardening, and runtime
    safety
- `docs/version-2-feature-selection-phase-2.md`
  - older checkpoint-v6 bridge framing
- `docs/version-2-feature-selection-phase-2-bridge-handoff-20260608.md`
  - current bridge-specific phase-2 handoff selection

Phase 2 should own:

- Mode B / passthrough bridge integration pattern
- Hyperlane Nexus as the first required handoff rail through the current
  provider-direct/runtime path
- registry/accessibility and watch/settle completion for that Hyperlane slice

Phase 3 should pick up the bridge-only remainder after that foundation exists,
including the deferred solver-localization work.

## Source Inputs

Primary handoff package root:

- `/Users/ganadhish/code/work/empx-cross-chain-bridge-V2-updates/empx-complete-handoff-20260608`

Primary source tree:

- `/Users/ganadhish/code/work/empx-cross-chain-bridge-V2-updates/empx-complete-handoff-20260608/empx-cross-bridge`

Reference documents:

- `docs/version-2-feature-selection-phase-2-bridge-handoff-20260608.md`
- `empx-complete-handoff-20260608/RAILS-AND-EXPANSION.md`
- `empx-complete-handoff-20260608/ROADMAP.md`
- `empx-complete-handoff-20260608/PARTNER-AND-AGENT-INTEGRATION.md`
- `empx-complete-handoff-20260608/README-COMPLETE-HANDOFF.md`

## Selection Principles

- Treat all multi-hop and hub-biased logic as permanently dropped from this
  migration path and from future phase docs unless explicitly reopened later.
- Keep phase 3 bridge-only.
- Prefer end-to-end rail completion over breadth.
- Preserve the current core cross-chain quote engine behavior.
- Use bridge-runtime cleanup only where it directly supports adopted rails.
- Keep non-bridge product surfaces out unless a selected rail truly depends on
  them operationally.

## What Phase 3 Is Actually About

Phase 3 is primarily the remaining bridge-expansion and bridge-runtime work
left after a Hyperlane-first phase 2.

That remainder breaks into six practical buckets:

1. Chainflip end-to-end bridge adoption
2. Maya end-to-end bridge adoption
3. TeleSwap as a conditional niche rail
4. deferred solver-localization and remaining bridge-only runtime cleanup for
   direct and liquidity rails
5. coverage and settlement-asset expansion required by those rails
6. per-rail monitoring and operational completion

## Selected Features

### 1. Chainflip

Decision: `Required`

Adopt:

- `Chainflip` as the first required post-Hyperlane rail
- broker-driven Mode B execution flow
- quote worker / solver / monitor wiring
- status mapping from Chainflip webhook and poll states into the current
  intent lifecycle
- registry and accessibility updates for the asset and chain pairs it unlocks

Why:

- it is the strongest remaining rail in the handoff after Hyperlane
- it adds meaningful product coverage rather than incremental overlap
- it brings DOT reach and stronger BTC / SOL competitive positioning

Constraints:

- require real broker registration and fee configuration as part of rollout
- require end-to-end quote + watch + settle behavior before it is treated as
  live
- do not treat design docs or test scaffolds as shipped functionality

### 2. Maya

Decision: `Required`

Adopt:

- `Maya` as the second required phase-3 rail
- THOR-like quote and execution handling where compatible
- monitor/watch path and lifecycle propagation
- coverage updates for its unique chains and assets

Why:

- it is the clearest bridge-only follow-on after Chainflip
- it adds redundancy for THOR-like routes
- it unlocks net-new coverage such as KUJI, DASH, and ZEC

Constraints:

- verify memo and outbound execution compatibility instead of assuming full
  THOR parity
- require the same lifecycle completeness standard as Chainflip

### 3. TeleSwap

Decision: `Conditional`

Evaluate within phase 3 only if the rate and coverage advantage remains real.

Adopt if justified:

- `TeleSwap` solver / quote / monitor path
- BTC-to-Polygon and BTC-to-BSC niche route coverage
- destination-side expectation handling for its longer finality profile

Why:

- it is the main remaining niche rail in the handoff that still fits the
  bridge-only migration boundary
- it may improve specific BTC-to-EVM token routes where broader rails are weak

Constraints:

- do not treat it as mandatory alongside Chainflip and Maya
- require evidence that it beats existing rails for the targeted route families
- keep it behind the more generally useful rails in sequencing

### 4. Remaining bridge-only runtime cleanup

Decision: `Required where needed by adopted rails`

Adopt:

- deferred bridge-side solver decomposition from the handoff, including any
  still-useful `Hyperlane` solver/helper localization
- remaining bridge-only `QuoteEngine` orchestration cleanup needed to support
  direct and liquidity rails cleanly
- additional solver-localization that reduces monolithic rail branching
- runtime fan-out and failure handling improvements that stay inside the
  current quote model

Why:

- the handoff still carries bridge-runtime cleanup beyond the first Hyperlane
  slice
- phase 2 closed on the narrower provider-direct Hyperlane implementation, so
  the remaining solver-localization work has to land here if it is still
  desired
- Chainflip, Maya, and TeleSwap should not be added by increasing ad hoc rail
  branching inside one giant quote path

Constraints:

- do not turn this into a wholesale quote-engine rewrite
- do not import multi-hop, basket, or external-solver abstractions through this
  cleanup path

### 5. Coverage and settlement-asset expansion

Decision: `Required`

Adopt:

- chain and asset accessibility updates required by adopted rails
- settlement-token support where the bridge genuinely exposes it
- fallback and ranking metadata coherent with the current rail model

Expected examples:

- DOT via Chainflip
- KUJI / DASH / ZEC via Maya
- BTC-specialized Polygon / BSC paths if TeleSwap is adopted

Why:

- these are the actual bridge-surface deltas the handoff adds after Hyperlane
- without this layer, the rails remain isolated code rather than usable route
  coverage

Constraints:

- only advertise coverage that the bridge can quote, monitor, and settle
- do not broaden chain claims based on handoff docs alone

### 6. Rail-specific monitoring and operations completion

Decision: `Required`

Require for every adopted phase-3 rail:

- real bridge-facing quote path
- real watch / monitor path
- final status mapping into the existing intent model
- operational config for the rail's required credentials, registries, or
  provider metadata
- failure semantics that do not break current production flows

Examples:

- Chainflip broker registration and status monitoring
- Maya vault and endpoint operations
- TeleSwap SDK validation and delayed-finality status handling

Why:

- the remaining handoff bridge work is not only about quoting
- operational completeness is what separates a migration from a scaffold

## Explicitly Included Non-Rail-Expansion Updates

To avoid ambiguity, the following are part of phase 3 if they are needed to
ship the selected rails:

- remaining bridge-only solver/runtime decomposition
- Mode B liquidity and passthrough handling improvements
- quote-surface normalization for broker or provider-direct rails
- monitoring, webhook, and poll-state integration for new rails
- chain and settlement-asset accessibility expansion

## Explicitly Deferred After Phase 3

These remain bridge-related, but they should stay out of the main phase-3
commitment unless a later document explicitly promotes them:

- broad official native-bridge rollout
- `OptimismNativeBridgeSolver` beyond its role as a template/interface family
- native-bridge `urgency='patient'` withdrawal flows
- Via Labs rebuild / relaunch work
- generic non-EVM expansion not directly required by selected rails

## Permanent Exclusions

These are dropped from phase 3 and from future migration docs unless a later
document explicitly reopens them:

- all multi-hop functionality
- all hub-biased route logic
- all hub-hop route construction
- `RouteHopPolicy`
- `RouterV1MultiHop`
- `ReceiverV1MultiHop`
- multi-hop execution builders
- hub-swap dispatch logic
- any quote, runtime, or contract branch whose purpose is to revive hub-based
  routing

## Excluded Handoff Features

These remain out of scope even though they exist in the complete handoff:

- `IntentBasket`
- `BasketQuoteEngine`
- `BasketStatusEngine`
- basket / multiswap execution
- `WalletScanner`
- wallet-liquidator flows
- `EmpsealMulticallRouter`
- ERC-7683 adapter and external-solver flows
- solver marketplace or registration surfaces
- frontend migration work
- broader same-chain SDK migration
- broader partner/agent product expansion unrelated to bridge execution

## Implementation Order

Recommended order for phase 3:

1. complete the remaining bridge-only runtime cleanup needed for post-Hyperlane
   rails
2. ship Chainflip end to end
3. validate Chainflip quote + watch + settle behavior in production-like flows
4. ship Maya end to end
5. validate Maya coverage and lifecycle behavior
6. re-evaluate TeleSwap on real route-value evidence before implementation
7. only after that reconsider native-bridge family rollout or Via Labs rebuild

## Final Position

Phase 3 should contain the remaining bridge-only handoff work that still fits
the production migration boundary after a Hyperlane-first phase 2.

The approved phase-3 selection is:

- Chainflip as the first required post-Hyperlane rail
- Maya as the second required rail
- TeleSwap only as a conditional niche rail
- remaining bridge-only runtime cleanup needed for those rails
- coverage and settlement-asset expansion required by those rails
- rail-specific monitoring and operational completion

The following are explicitly not part of phase 3:

- multi-hop
- hub-biased routing
- basket / multiswap
- WalletScanner and liquidator flows
- ERC-7683 / solver-marketplace work
- frontend / broader SDK work
- broad native-bridge rollout

Everything excluded above should be ignored during migration unless a later
selection document explicitly changes that decision.
