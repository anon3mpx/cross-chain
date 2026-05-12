# Gas.zip API-Layer Integration Plan

**Date:** 2026-05-05  
**Status:** Analysis  
**Scope:** Integrate Gas.zip strictly as an API-layer, provider-direct path in Ruflo. Phase 1 is limited to Gas.zip's EVM v2 Direct Deposit flow. No `RouterV1`, `ReceiverV1`, rail plugin, or signed-intent contract changes are in scope.

---

## Goal

Allow a user to request destination native gas as part of the offchain quoting and execution flow.

Example:

- source chain: Base
- destination chain: Arbitrum
- primary goal: bridge or swap into the desired destination asset
- additional goal: also receive a specified amount of native ETH on Arbitrum

The Gas.zip leg is not a Ruflo contract execution path. It is a provider-direct API integration, similar in shape to:

- `thor_api_direct`
- `lz_api_direct`

That means Ruflo should:

1. quote it offchain
2. return provider execution instructions
3. track provider status offchain

---

## Architectural Decision

Gas.zip belongs entirely in the VPS/provider-direct layer.

We are explicitly not doing any of the following:

- extending `RouterV1`
- extending `ReceiverV1`
- modifying `IIntentTypes.sol`
- adding Gas.zip data to signed intents
- routing Gas.zip through existing Ruflo rail plugins
- trying to make the Gas.zip leg look like a Ruflo onchain settlement path

This feature should be modeled as Ruflo orchestrating an external provider flow, not Ruflo executing it onchain itself.

---

## Product Model

There are two valid API-layer product shapes.

### 1. Gas-only provider-direct offer

User wants native gas on the destination chain.

Example:

- Base native ETH -> Arbitrum native ETH gas top-up

Ruflo returns a Gas.zip-backed `provider_direct` offer. User submits the provider transaction directly.

### 2. Token route plus Gas.zip sidecar

User wants:

- a token transfer or swap outcome on the destination chain
- plus native gas on the destination chain

Example:

- Base USDC -> Arbitrum USDC
- plus `0.0008` ETH on Arbitrum

At the API layer this should be represented as two coordinated execution legs:

1. the token-transfer leg
2. the Gas.zip gas-delivery leg

These are coordinated in the product and UI, but they are not one atomic Ruflo contract flow.

For MVP, this should remain an API-level composition, not a synthetic onchain abstraction.

---

## Why This Fits Ruflo

The codebase already supports provider-direct offers and direct execution payloads.

Relevant existing pieces:

| Area | Current role | Gas.zip impact |
|---|---|---|
| `src/vps/types/index.ts` | Offer types and execution modes | Add `gaszip_api_direct` and execution payload fields |
| `src/vps/api/quoteCodec.ts` | Quote request parsing | Parse optional destination gas request |
| `src/vps/services/QuoteEngine.ts` | Offer construction | Build Gas.zip-backed provider-direct offers |
| `src/vps/services/DirectRailIntegrationBuilder.ts` | Provider-direct execution action builder | Add Gas.zip action branch |
| `src/vps/services/IntentService.ts` | Quote persistence and status envelope | Store Gas.zip quote payload and provider status metadata |
| `src/vps/app/runtime.ts` | Service wiring | Add Gas.zip client and optional status worker |

Most relevant precedents already in the repo:

- THORChain API direct flow
- LayerZero Value Transfer API direct flow

Gas.zip should follow that same pattern.

---

## Gas.zip Capabilities Needed

Gas.zip's published API surface already matches an offchain integration model.

Useful endpoints:

- chains API
- quote API
- reverse quote API
- calldata API
- deposit status API
- outbound status API

What Ruflo needs from Gas.zip at integration time:

1. determine whether a source/destination pair is supported
2. determine the source-side value needed for the requested destination native amount
3. retrieve the provider-specific execution details the wallet needs
4. poll provider status after submission

The important implication is simple:

- Gas.zip is being consumed as a quote-and-execute API provider
- Ruflo is not acting as the transaction executor contract for that leg

### Phase 1 boundary

Phase 1 should assume only the Gas.zip EVM v2 Direct Deposit path is supported.

That means:

- the initial supported set is the chains reachable through Gas.zip's EVM v2 direct-deposit flow
- full Gas.zip chain coverage should not be claimed yet
- additional execution adapters such as contract-deposit or Solana-specific flows are later phases

This keeps the first implementation concrete and avoids pretending that one adapter covers every provider path.

---

## API Request Shape

Add an optional destination gas request to the quote payload.

Suggested shape:

```ts
interface DestinationGasRequest {
  provider?: 'gaszip';
  chainId: number;
  amountWei: string;
  recipient?: string;
}

interface QuoteRequest {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  srcChainId: number;
  dstChainId: number;
  userAddress: string;
  nativeDstAddress?: string;
  destinationGas?: DestinationGasRequest[];
  urgency?: 'fast' | 'normal';
}
```

Recommended MVP constraints:

- allow `0` or `1` `destinationGas` request
- require `destinationGas[0].chainId === dstChainId`
- default recipient to `nativeDstAddress ?? userAddress`
- require wei string format
- allow arbitrary wei amounts at the API layer
- enforce per-chain max requested amount server-side

Reasoning:

- one gas request is enough to validate the model
- matching destination chain keeps semantics clear
- arbitrary amounts make the API reusable for partners and different frontends
- UI presets can still exist, but they should be a frontend concern, not an API limitation

---

## Offer Model

Add a Gas.zip-specific provider-direct offer type.

Suggested type addition:

```ts
type RailOfferType =
  | 'cctp_standard'
  | 'cctp_fast'
  | 'axelar_direct'
  | 'axelar_dst_swap'
  | 'lz_oft'
  | 'lz_oft_adapter'
  | 'lz_stargate_pool'
  | 'lz_stargate_oft'
  | 'lz_api_direct'
  | 'thor_api_direct'
  | 'gaszip_api_direct';
```

Gas.zip offers should always be:

- `executionMode: 'provider_direct'`
- `offerType: 'gaszip_api_direct'`

Gas.zip should not be added as a new Ruflo onchain rail in this implementation.

---

## Execution Payload Shape

Gas.zip offers need enough execution data for the client wallet to submit the provider transaction directly.

Suggested payload stored under `RailOffer.execution`:

```ts
interface GasZipExecutionPayload {
  provider: 'gaszip';
  srcChainId: number;
  dstChainId: number;
  recipient: string;
  requestedAmountWei: string;
  expectedAmountWei: string;
  sourceValueWei: string;
  expiresAt: number;
  depositAddress?: string;
  to?: string;
  data?: string;
  value?: string;
  chainId?: number;
  quoteId?: string;
  depositStatusRef?: string;
  outboundStatusRef?: string;
  depositTxHash?: string;
  outboundTxHash?: string;
}
```

Notes:

- Phase 1 should normalize the EVM v2 Direct Deposit shape first.
- Internally store whatever Gas.zip returns, but expose one normalized wallet transaction shape from Ruflo.
- Persist every stable provider identifier available:
  - `quoteId`
  - `depositStatusRef`
  - `outboundStatusRef`
  - `depositTxHash`
  - `outboundTxHash`

This keeps Ruflo flexible if Gas.zip status correlation differs by route or by API response shape, while keeping Phase 1 narrowly scoped.

---

## Core Client Boundary

The Gas.zip core implementation must be separated from `QuoteEngine` and other orchestration code.

Required rule:

- `QuoteEngine`, `DirectRailIntegrationBuilder`, workers, and APIs should only use method calls on a dedicated Gas.zip client or facade
- no inline `fetch`
- no direct Gas.zip response parsing outside the client layer
- no Gas.zip chain-id mapping logic outside the client layer

Recommended structure:

```ts
src/vps/services/gaszip/GasZipClient.ts
src/vps/services/gaszip/GasZipQuoteClient.ts
src/vps/services/gaszip/GasZipMonitorClient.ts
src/vps/services/gaszip/GasZipMapper.ts
src/vps/services/gaszip/GasZipTypes.ts
```

Suggested responsibility split:

- `GasZipClient`
  - low-level HTTP calls
- `GasZipMapper`
  - Ruflo chain id <-> Gas.zip identifiers
  - raw provider payload -> normalized payload
- `GasZipQuoteClient`
  - high-level quote methods used by `QuoteEngine`
- `GasZipMonitorClient`
  - status lookup methods used by workers

`QuoteEngine` should only do this kind of work:

```ts
const gasQuote = await gasZipQuoteClient.quoteDestinationGas(...);
```

It should not know:

- which endpoint was called
- how payloads are mapped
- how status refs are extracted
- anything about Gas.zip execution specifics beyond the normalized client contract

That separation is important because this integration will likely evolve independently of route selection logic.

---

## QuoteEngine Changes

`QuoteEngine` is the primary integration point.

Required changes:

1. Parse `destinationGas` input from the quote request.
2. Call a new `GasZipQuoteClient` when a destination gas request is present.
3. If supported, build a `gaszip_api_direct` offer.
4. Attach the Gas.zip execution payload to that offer.
5. For token-plus-gas flows, return the Gas.zip result as a sidecar-compatible offer rather than forcing it into the token route itself.

Recommended service boundary:

```ts
interface GasZipQuoteClient {
  quoteDestinationGas(input: {
    srcChainId: number;
    dstChainId: number;
    recipient: string;
    requestedAmountWei: string;
  }): Promise<GasZipExecutionPayload | null>;
}
```

Responsibilities of `GasZipQuoteClient`:

- map Ruflo chain ids to Gas.zip-supported chain identifiers
- call provider quote APIs
- validate the provider response
- build normalized execution payload
- return `null` when the pair is unsupported

`QuoteEngine` should not contain Gas.zip response parsing logic directly beyond consuming the normalized client result.

Decision for token-plus-gas support:

- the API needs to support both legs together, not as unrelated offers
- Ruflo should therefore return a linked response structure when both a token leg and a gas leg exist
- internally, they remain separate execution legs
- externally, they should be grouped in one composed API response so clients do not have to guess how to pair them

---

## DirectRailIntegrationBuilder Changes

`DirectRailIntegrationBuilder` needs a new provider-direct branch for Gas.zip.

Suggested output shape:

```ts
{
  mode: 'provider_direct',
  action: {
    kind: 'gaszip_transfer',
    recipient: string,
    expectedAmountOut: string,
    expiresAt: number
  },
  tx: {
    to: string,
    data: string,
    value: string,
    chainId: number
  }
}
```

If the provider flow is a plain transfer rather than calldata-driven, `tx.data` can be `0x` and `to` can be the deposit address.

The important point is that `DirectRailIntegrationBuilder` should shield the client from the raw provider shape and return the same kind of normalized execution action it already returns for other provider-direct offers.

Decision on wallet execution normalization:

- for Phase 1, support the EVM v2 Direct Deposit execution flow
- normalize it into a single `tx` object with:
  - `to`
  - `data`
  - `value`
  - `chainId`

Later execution variants can map into the same `tx` shape without changing the higher-level API contract.

---

## Status Tracking

Gas.zip status must be tracked offchain.

`EventMonitor` is not the right primitive for this because the Gas.zip leg is not a Ruflo contract event flow.

Recommended approach:

- add a `GasZipMonitorWorker`
- poll Gas.zip deposit and outbound status APIs
- store provider status metadata against the quoted intent or provider-direct selection

Suggested MVP provider status states:

- `PENDING_SUBMISSION`
- `DEPOSIT_SEEN`
- `OUTBOUND_PENDING`
- `DELIVERED`
- `FAILED`

These do not need to replace Ruflo's core `IntentStatus` enum immediately. For MVP they can live under provider metadata in the persisted quote/intent object.

---

## Persistence Model

No schema migration is strictly required for MVP if Gas.zip data is stored inside the existing `quote` JSON payload.

Recommended MVP persistence approach:

- store the normalized Gas.zip execution payload in `quote.execution`
- store current provider status in quote metadata
- store all provider identifiers used for polling and reconciliation

Schema changes become useful only if later you need:

- indexed queries by provider status
- dedicated provider-attempt history
- cross-provider orchestration analytics

That should be deferred unless needed.

---

## Security Requirements

This is API-layer work, but it still needs tight validation.

1. Validate request shape
   - chain id, wei amount, and recipient must be normalized before quote construction.

2. Validate provider response
   - confirm returned chain ids, value fields, and addresses are sane before exposing them to wallets.

3. Cap requested gas amounts
   - enforce per-chain limits so a bad request cannot create unreasonable source-value asks.

4. Keep provider payload server-built
   - clients may request destination gas, but they should not submit arbitrary provider payloads back into Ruflo.

5. Correlate status deterministically
   - polling should use stored provider references, not inferred wallet behavior.

6. Feature-flag the integration
   - enable per source/destination chain pair.

---

## Failure Modes

| Failure | Expected behavior | Handling |
|---|---|---|
| Gas.zip does not support the pair | No Gas.zip offer returned | Return explicit error only when gas was explicitly requested |
| Quote expires before submission | Wallet submission fails or provider rejects | Refresh quote on selection or rebuild integration |
| Wrong recipient in request | Native gas goes to wrong wallet | Normalize and bind recipient at quote time |
| Deposit seen, outbound delayed | User waits for gas arrival | Poll status and surface intermediate states |
| Deposit fails or provider rejects | Provider-direct leg fails | Surface provider error and keep token leg independent |
| Token leg succeeds, gas leg not submitted | User has tokens but no native gas | Present the Gas.zip leg clearly as a second execution leg |
| Cache key too coarse | Wrong provider payload reused | Include recipient, source chain, destination chain, and requested gas amount in the cache key |

---

## Complexity Assessment

For a strict API-layer integration, complexity is medium.

Breakdown:

- quote parsing and request validation: low
- Gas.zip provider client: medium
- `QuoteEngine` offer construction: medium
- `DirectRailIntegrationBuilder` action branch: low-medium
- status worker: medium
- composite token-plus-gas orchestration: medium-high

What makes it medium rather than low:

- provider payload normalization
- quote expiry handling
- status polling
- token-plus-gas composition semantics

What keeps it from being high:

- no Solidity work
- no contract deployment
- no signature/ABI migration
- no rail plugin changes

---

## Recommended Delivery Sequence

### Phase 1: Gas.zip provider client and gas-only offers

Implement:

- `destinationGas` request parsing
- `GasZipQuoteClient`
- EVM v2 Direct Deposit chain mapping and payload normalization
- `gaszip_api_direct` offers in `QuoteEngine`
- Gas.zip branch in `DirectRailIntegrationBuilder`

Outcome:

- Ruflo can return pure Gas.zip provider-direct offers for destination native gas on the chains supported by Gas.zip's EVM v2 Direct Deposit flow

### Phase 2: Gas.zip status worker

Implement:

- `GasZipMonitorWorker`
- runtime wiring
- provider status persistence
- `/intent/:id` metadata exposure

Outcome:

- users and support can track the provider-direct leg

### Phase 3: Additional Gas.zip execution adapters

Implement:

- contract-deposit adapter if needed
- non-EVM or provider-specific deposit adapters if needed
- extension of `GasZipQuoteClient` normalization without leaking provider details into `QuoteEngine`

Outcome:

- Ruflo extends from Phase 1 EVM direct-deposit coverage toward the full Gas.zip provider surface

### Phase 4: Token-plus-gas API composition

Implement:

- composed response model linking a token leg and a Gas.zip leg
- shared expiry handling
- clearer client orchestration format

Outcome:

- Ruflo can express "get the token and also get native gas" without pretending they are one atomic settlement path

---

## Decisions

The current recommended decisions are:

1. Support both legs together in the API.
   - Do not return them as unrelated standalone results when the user requested token-plus-gas.
   - Return one composed response with explicit leg boundaries.

2. Accept arbitrary wei amounts at the API layer.
   - Keep presets as a frontend concern if needed.
   - Enforce safety with server-side caps.

3. Phase 1 supports Gas.zip EVM v2 Direct Deposit only.
   - other execution shapes are later adapters

4. Persist every stable provider identifier available.
   - quote id
   - deposit reference
   - outbound reference
   - deposit tx hash
   - outbound tx hash

5. Use one composite API object for token-plus-gas.
   - Internally two legs
   - Externally one grouped response

---

## Recommendation

Rewrite the feature plan as a pure VPS/provider-direct integration.

The implementation should focus on:

1. `GasZipQuoteClient`
2. `QuoteEngine` offer generation
3. `DirectRailIntegrationBuilder` execution action generation
4. optional `GasZipMonitorWorker`
5. composed token-leg plus gas-leg API response format

That is the correct scope for what you want. Any contract-level discussion is noise for this implementation and should stay out of the plan.

---

## References

- Gas.zip API overview: https://dev.gas.zip/gas/api/overview
- Gas.zip chains API: https://dev.gas.zip/gas/api/chains
- Gas.zip quote API: https://dev.gas.zip/gas/api/quote
- Gas.zip quote reverse API: https://dev.gas.zip/gas/api/quote-reverse
- Gas.zip calldata API: https://dev.gas.zip/gas/api/call-data
- Gas.zip direct deposit example: https://dev.gas.zip/gas/code-examples/evm-deposit/direct-forwarder
