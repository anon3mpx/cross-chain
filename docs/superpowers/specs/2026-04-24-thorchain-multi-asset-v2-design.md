# THORChain + Multi-Asset Rails V2 Design

**Date:** 2026-04-24
**Status:** Draft for review
**Scope:** Introduce THORChain as a production rail while refactoring the existing rail architecture from fixed settlement assets to a multi-asset, multi-offer model.

---

## Goal

Ship a single V2 refactor that:

- adds THORChain as a user-selectable rail
- changes quote generation from "pick one best rail" to "return all viable rail offers"
- migrates rail execution from fixed settlement tokens to dynamic provider assets
- strengthens destination-side settlement validation so the expected asset is explicit per intent

The product goal is to let the user choose among all currently viable rails for a transfer instead of hard-wiring a preferred rail for each route.

---

## Decision Summary

### 1. THORChain integration model

Use a hybrid model:

- **VPS is authoritative** for THORChain quote discovery, asset mapping, memo construction, router/vault discovery, expiry handling, and monitoring.
- **On-chain THORChain rail plugin** stays thin and execution-only. It validates obvious invariants and calls `depositWithExpiry`.

This matches THORChain's actual execution model. The mutable and time-sensitive parts live in THORNode and related APIs, not in the contract.

### 2. Refactor scope

Do **one coordinated V2 refactor** that combines:

- THORChain integration
- migration of existing rails from single-asset assumptions to multi-asset architecture
- shift from best-route selection to multi-offer response generation

This should be one architectural program, not two unrelated projects. THORChain should be the first real rail that exercises the new abstractions.

### 3. Rollout strategy

Go **mainnet-first**, but as a **canary rollout**, not a broad launch.

- Launch a small allowlist of mainnet THORChain pairs first.
- Only show THORChain when the VPS gets a live authoritative quote.
- If the quote fails or expires, THORChain drops out of the offer set and the other rails remain available.

---

## Current Constraints In The Repo

The current architecture assumes a small set of fixed settlement assets and a single selected rail:

- `src/contracts/interfaces/IIntentTypes.sol` uses `SettlementToken`-style assumptions.
- `src/vps/services/QuoteEngine.ts` currently returns a single best quote rather than a marketplace of offers.
- `src/vps/services/RailSelector.ts` scores rails to pick a winner.
- `src/contracts/rails/THORChainRailPlugin.sol` already reflects the intended hybrid boundary, but the rest of the stack is not yet shaped around a live-quote liquidity rail.
- Existing Axelar and LayerZero handling is still conceptually closer to curated single-settlement-token execution than broad dynamic asset support.

That is good enough for a curated USDC-style MVP, but it is the wrong shape for:

- THORChain
- broad Axelar / LayerZero asset coverage
- user-chosen rail offers across many chains

---

## Target Product Behavior

For a quote request:

1. The VPS builds all viable offers in parallel.
2. Each rail returns an offer only if it can produce a valid current quote or execution path.
3. The API returns all successful offers.
4. The user chooses the rail explicitly.
5. The VPS executes the chosen offer using the provider-specific metadata captured during quote generation or a refreshed equivalent if the offer is near expiry.

No route is permanently fixed to one rail.

Offer comparison should be based on provider-aware economics, not just nominal output amount. The normalized offer model should preserve enough detail to compare:

- provider fee
- protocol fee
- source-chain gas
- destination or outbound fee / gas component
- slippage or price impact, where applicable
- expected settlement time
- quote expiry / freshness confidence

Examples:

- If CCTP, Axelar, LayerZero, and THORChain can all serve a transfer, return all four offers.
- If THORChain quote generation fails, return the other rails only.
- If THORChain can quote `BASE.ETH -> BTC.BTC` live, show it as a native-destination option.

---

## V2 Architecture

### A. Core model

Replace fixed settlement-token assumptions with a dynamic provider-asset model.

Each offer should carry:

- rail / provider identity
- source chain and destination chain
- source settlement asset
- expected destination settlement asset
- provider-native asset identifiers
- quoted amount out
- minimum executable amount out
- fee breakdown
- gas cost breakdown
- slippage / price impact data where applicable
- settlement time estimate
- expiry
- provider-specific execution metadata

The normalized offer model should preserve both:

- user-facing economics for display and rail comparison
- execution-critical provider parameters required to submit the transfer safely

At minimum, the offer schema should support:

- provider fee
- protocol fee
- source gas estimate
- destination gas or outbound fee estimate where the provider exposes one
- slippage or price impact, if the rail is liquidity-based
- quote expiry / freshness window
- settlement time estimate
- minimum input amount required by the provider
- minimum expected output after provider-side fee and slippage effects

The internal model should support both:

- a canonical internal asset identifier
- provider-specific identifiers needed for execution

Examples:

- THORChain asset: `BTC.BTC`, `ETH.ETH`, `BASE.USDC-0x...`
- Axelar ITS token identifier / token ID
- LayerZero OFT or adapter route metadata

### B. Offer marketplace instead of winner-take-all routing

`QuoteEngine` should stop returning only one route and instead return an ordered list of viable offers.

`RailSelector` should evolve from winner selection into offer construction / ranking support. Ranking is still useful for display order, but not for silently discarding all non-winning rails.

### C. Settlement validation moves from implicit to explicit

Destination-side execution should validate the exact expected settlement asset before an intent is marked settled.

The signed payload should include:

- expected destination settlement token/address
- expected destination provider asset identifier
- minimum acceptable settlement amount

Receiver-side settlement should reject:

- wrong token
- wrong provider asset metadata
- amount below minimum
- duplicate or stale settlement attempts

This is necessary for a multi-asset architecture so that a wrong asset cannot settle an intent first.

---

## THORChain Design

### THORChain responsibilities

#### VPS responsibilities

The VPS is authoritative for:

- asset mapping from internal request to THORChain assets
- `/quote/swap` calls
- `/inbound_addresses` lookups or cached discovery
- router and vault resolution
- minimum-amount handling using THORChain quote responses
- provider-side fee decomposition
- slippage / price impact extraction
- outbound fee interpretation
- memo construction inputs
- quote expiry handling
- chain halt / unsupported pool detection
- monitoring via THORChain / Midgard style APIs

#### Contract responsibilities

`THORChainRailPlugin.sol` should remain thin:

- receive the prepared bridge params
- validate basic invariants
- approve / transfer assets as needed
- call `depositWithExpiry`
- emit sufficient execution metadata for audit and monitoring

The contract should not attempt to discover live quote state or reconstruct provider truth on-chain.

### THORChain workers

Split the VPS work into focused components:

- `THORChainQuoteWorker`
  - determines whether a requested pair is currently quotable
  - fetches live quote data
  - normalizes fee breakdown, slippage, outbound fee, ETA, min amount, expected out, expiry, router, vault, and memo inputs
- `THORChainExecutionWorker`
  - revalidates the selected offer if needed
  - prepares final execution metadata
  - hands the data into existing calldata / intent generation
- `THORChainMonitorWorker`
  - tracks source submission, THORChain progression, and destination receipt
  - advances intent state or marks failure / stuck conditions

### THORChain eligibility rules

THORChain should only be shown when:

- a live authoritative quote succeeds
- the pair is currently supported
- the requested amount satisfies `recommended_min_amount_in`
- the quote has not expired

THORChain offers should include, when available from the provider quote:

- liquidity fee
- outbound fee
- total fee
- slippage basis points
- total swap seconds
- quote expiry
- recommended minimum input

THORChain should disappear from the offer set when:

- quote retrieval fails
- pool state is unsupported or halted
- the amount is below the provider-recommended minimum
- the offer becomes stale before execution

---

## Existing Rail Migration Under The Same V2 Model

### Axelar

Move from a curated settlement-token model toward dynamic provider asset metadata.

The long-term validation model should be:

- VPS discovers and selects Axelar-compatible settlement assets
- execution includes provider-native token metadata
- destination-side validation confirms the received token matches the expected asset encoded in the signed payload

Axelar offers should normalize provider economics such as:

- bridge fee or gas-service fee when quoted
- source gas requirements
- destination gas funding assumptions if applicable
- settlement time estimate
- any provider-specific execution expiry or validity window

An emergency denylist should still exist for bad assets or route-level shutdowns.

### LayerZero

Treat LayerZero as a dynamic route/provider-asset rail rather than an immutable single-OFT setup.

The V2 model should support:

- VPS-managed OFT or adapter metadata per offer
- destination-side validation that the callback source and settlement token match the expected route metadata

LayerZero offers should normalize provider economics such as:

- messaging fee
- executor / DVN / endpoint fee components where surfaced
- source-chain gas estimate
- destination execution gas assumptions
- settlement time estimate
- route-specific validity constraints

### CCTP

CCTP remains simpler because the asset universe is narrower, but it still needs to fit the same offer marketplace and intent validation model.

CCTP offers should still expose:

- Circle fee where applicable
- source gas
- estimated settlement time
- fast-finality fee and buffer, when using fast mode

---

## Data Flow

1. User requests quote.
2. VPS normalizes the request into internal asset identifiers.
3. Each rail-specific quote worker attempts to produce a viable offer in parallel.
4. Successful offers are normalized into a common offer schema.
5. API returns all viable offers.
6. User selects one offer.
7. VPS validates freshness, economic assumptions, and provider-specific execution prerequisites.
8. Source execution is submitted using the chosen rail.
9. Provider-specific monitoring updates intent state.
10. Destination settlement is only accepted if the actual received asset matches the signed expected asset and amount constraints.

The selected offer should be treated as an economic contract with the user. If a refresh materially changes fee, slippage, minimum input, settlement time, or expected output beyond the allowed tolerance, the VPS should invalidate the old offer rather than silently submitting changed economics.

---

## Mainnet-First Rollout

Mainnet-first is acceptable if rollout is deliberately constrained.

### Canary launch rules

- enable only a small allowlist of THORChain pairs initially
- cap operational exposure through manual rollout controls
- show THORChain only on successful live quote
- require refreshed quote validation near execution time
- monitor each early execution end-to-end before broadening availability

### Practical note on small-value validation

Tiny tests like `$1` are not a reliable proof of THORChain viability.

Live mainnet checks on 2026-04-24 showed:

- some paths quote successfully
- some paths fail due to unsupported pool or route state
- THORChain exposes `recommended_min_amount_in` in quote responses
- realistic canary amounts should be above that provider minimum and above source-chain gas noise

For early mainnet validation, use a small but non-trivial canary amount and a known-good pair.

---

## Error Handling

### THORChain-specific

- stale offer => invalidate and require refresh
- quote failure => omit THORChain offer
- below minimum => omit THORChain offer
- halted or unsupported state => omit THORChain offer
- materially changed fee / slippage / output / settlement time on refresh => invalidate and require refresh
- submitted but unconfirmed => monitor until success, stuck threshold, or failure

### Multi-asset receiver-side

- unexpected settlement token => revert
- unexpected provider asset metadata => revert
- amount below minimum => revert
- duplicate settlement => revert

---

## Testing Strategy

### 1. Deterministic local tests

Cover:

- asset normalization
- offer generation
- provider economics normalization
- receiver settlement validation
- provider metadata encoding / decoding
- stale quote handling

### 2. Provider-mocked or fork-backed tests

Cover:

- THORChain quote parsing
- THORChain fee / slippage parsing
- THORChain offer omission on unsupported or stale state
- Axelar / LayerZero dynamic asset metadata flow
- provider fee and gas normalization across rails
- execution payload correctness

### 3. Mainnet canary tests

Cover:

- small controlled allowlist of real pairs
- manual inspection of quote -> submit -> monitor -> settle
- gradual expansion after repeated success

---

## Out Of Scope For This Refactor

The refactor should avoid accidental scope explosion.

Out of scope:

- full generalized support for every possible provider asset on day one
- broad autonomous rollout of all THORChain-compatible pairs
- unrelated UI redesign beyond supporting multi-offer selection
- unrelated contract refactors not required by the V2 model

---

## Recommended Execution Order

1. Introduce V2 core types and offer schema.
2. Refactor quote flow from single-best route to multi-offer response.
3. Refactor destination settlement validation to require expected asset metadata.
4. Integrate THORChain quote, execution, and monitoring workers.
5. Wire THORChain into offer generation and execution.
6. Migrate Axelar onto the new asset model.
7. Migrate LayerZero onto the new asset model.
8. Adapt CCTP to the same offer-marketplace interface where needed.
9. Run mainnet canary rollout with narrow pair allowlist.
10. Expand chain and asset coverage after successful observation.

---

## Sources

- THORChain sending transactions and EVM router flow:
  - https://dev.thorchain.org/concepts/sending-transactions.html
- THORChain querying, pools, and chain endpoints:
  - https://dev.thorchain.org/concepts/querying-thorchain.html
- THORChain fees, wait times, and quote minimum guidance:
  - https://dev.thorchain.org/swap-guide/fees-and-wait-times.html
- THORChain development environments:
  - https://docs.thorchain.org/thornodes/developing
- Axelar Interchain Token Service reference:
  - https://axelarnetwork.github.io/interchain-token-service/InterchainTokenService.html
- LayerZero contract standards:
  - https://docs.layerzero.network/v2/concepts/protocol/contract-standards
- LayerZero FAQ:
  - https://docs.layerzero.network/v2/faq
- Stargate V2 primitives:
  - https://docs.stargate.finance/primitives/routes/stargateV2
