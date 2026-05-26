# Cross-Chain UI Public API Integration Guide

## Scope

This document covers the public UI-facing API under `/api/v1` for the cross-chain swap and bridge frontend.

It is written for frontend engineers building:

- quote and route selection
- wallet execution
- intent status tracking
- cancellation and refund UX
- optional composed flows for destination gas
- optional LayerZero provider-direct flows

It does not cover:

- `/partner/*` partner APIs
- `/admin/*` admin/support APIs
- internal worker-to-worker integrations

## Base Contract Between UI and API

- Base path: `/api/v1`
- Auth: no API key required for public UI endpoints
- CORS: enabled by the API
- Content type: `application/json`
- Big integer fields should be treated as strings in the UI, even where OpenAPI allows integers
- Timestamps are Unix milliseconds
- Quote/offer expiry must be enforced in the UI

## Endpoint Inventory

### Required for the core swap/bridge UI

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/quote` | Get an offer set for the requested route |
| `POST /api/v1/quote/select` | Lock the selected offer and get wallet execution payload |
| `GET /api/v1/intent/{id}` | Poll a single intent until terminal state |
| `POST /api/v1/intent/{id}/submitted` | Tell the API the wallet submitted the source transaction |
| `POST /api/v1/intent/{id}/cancel` | Cancel a quoted intent, or finalize wallet-side cancellation for a submitted intent |
| `POST /api/v1/intent/{id}/refund` | Request refund review for failed/stuck/in-transit cases |

### Required only for composed destination-gas UX

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/quote/select-composed` | Build a two-leg flow: primary transfer + Gas.zip destination gas |
| `GET /api/v1/intent/composed/{primaryIntentId}/{gasZipIntentId}` | Poll both legs as one composed status |

### Required only for LayerZero provider-direct UX

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/layerzero-value-transfer-api/chains` | Optional chain discovery for LayerZero-supported routes |
| `GET /api/v1/layerzero-value-transfer-api/tokens` | Optional token discovery for LayerZero-supported routes |
| `POST /api/v1/layerzero-value-transfer-api/intents/{id}/build-user-steps` | Refresh executable user steps before wallet execution when required |
| `POST /api/v1/layerzero-value-transfer-api/intents/{id}/submit-signature` | Submit off-chain signatures for LayerZero SIGNATURE steps |
| `POST /api/v1/layerzero-value-transfer-api/intents/{id}/submitted` | Mark LayerZero provider-direct execution as submitted |

### Optional operational endpoint

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/health` | Environment smoke check only; not part of user transaction flow |

## Recommended Frontend Flow

### 1. Quote

Call `POST /api/v1/quote` whenever the user has:

- source chain
- destination chain
- token in
- token out
- amount
- connected wallet address

Recommended request shape:

```json
{
  "tokenIn": "0x...",
  "tokenOut": "0x...",
  "amountIn": "1000000",
  "srcChainId": 42161,
  "dstChainId": 8453,
  "userAddress": "0x...",
  "urgency": "normal"
}
```

Additional request fields:

- `nativeDstAddress`: pass when the destination is a native-address flow such as BTC/SOL/DOGE-style delivery
- `destinationGas`: optional destination gas purchase request
- `urgency`: `normal` or `fast`

`destinationGas` shape:

```json
[
  {
    "provider": "gaszip",
    "chainId": 8453,
    "amountWei": "1000000000000000"
  }
]
```

Important UI rules:

- Send `amountIn` as a string to avoid precision loss.
- Treat `offerSet.expiresAt` as the quote expiry source of truth.
- Render routes from `offerSet.offers[]`.
- Do not assume the top-level `quote` field is always present.

The API intentionally omits the top-level `quote` field when the offer set contains provider-direct routes. In those cases, the UI must rely on `offerSet.offers[]` for route cards.

## What the UI should read from quote responses

`POST /api/v1/quote` returns:

- `offerSet.offerSetId`
- `offerSet.expiresAt`
- `offerSet.bestOfferId`
- `offerSet.offers[]`
- optional `quote`
- optional `gasZipComposition`

Per-offer fields the UI should normalize:

- `offerId`
- `rail`
- `offerType`
- `railType`
- `executionMode`
- `srcChainId`
- `dstChainId`
- `tokenIn`
- `tokenOut`
- `amountIn`
- `estimatedOut`
- `minAmountOut`
- `expiresAt`
- `deliveryShape`
- `routeAsset`
- `sourceSettlementAsset`
- `destinationSettlementAsset`
- `economics.providerFeeUSD`
- `economics.protocolFeeUSD`
- `economics.sourceGasUSD`
- `economics.destinationGasUSD`
- `economics.outboundFeeUSD`
- `economics.settlementTimeSeconds`

## 2. Select an offer

For a normal single-intent route, call `POST /api/v1/quote/select`.

Request:

```json
{
  "offerSetId": "0x...",
  "offerId": "0x...",
  "userAddress": "0x..."
}
```

Success response:

- `quote`
- `intentId`
- `integration`

`quote` is the finalized selected route and should be stored with the `intentId` in frontend state.

## 3. Execute the returned integration

The UI must branch on `integration.mode`.

### A. `router_intent`

This is the standard on-chain flow.

The API returns:

```json
{
  "mode": "router_intent",
  "integration": {
    "contractAddress": "0x...",
    "calldata": "0x...",
    "value": "0",
    "expiresAt": 1740000000000
  }
}
```

Wallet action:

- send a transaction to `contractAddress`
- use `calldata` as `data`
- use `value` as native value
- submit before `expiresAt`

### B. `provider_direct`

This is a provider-owned execution flow. The UI must branch again on `integration.action.kind`.

Observed variants in the implementation are:

- `thorchain_swap`
- `gaszip_transfer`
- `layerzero_value_transfer_api`

#### `thorchain_swap`

The integration includes:

- `depositAddress`
- `memo`
- `expiresAt`
- `expectedAmountOut`
- optional `tx`

If `tx` is present, the UI can submit it directly. If `tx` is not present, the UI must render provider-specific instructions using the returned action payload.

#### `gaszip_transfer`

The integration includes:

- `recipient`
- `expectedAmountOut`
- `expiresAt`
- optional `tx`

If `tx` is present, the UI can submit it directly.

#### `layerzero_value_transfer_api`

The integration includes:

- `quoteId`
- `userSteps`
- `requiresFreshUserSteps`
- `submitSignatureRequired`

This is not a simple single transaction payload. The UI must render the provider-driven step flow described in the LayerZero section below.

## OpenAPI gap the UI team should account for

The current `openapi.json` under-specifies `provider_direct` response variants.

In code, `SelectedOfferIntegration` supports:

- THORChain direct actions
- Gas.zip direct actions
- LayerZero Value Transfer API step-based actions

But the OpenAPI schema currently models only the THORChain-style `provider_direct` shape. Frontend types should therefore be based on real runtime payloads, not only the OpenAPI union.

## 4. Mark the intent as submitted

After the wallet successfully broadcasts the source transaction, the UI should call `POST /api/v1/intent/{id}/submitted`.

Request:

```json
{
  "userAddress": "0x...",
  "signature": "0x...",
  "timestamp": 1740000000000,
  "srcTxHash": "0x..."
}
```

### Signature contract

The API verifies a wallet signature over an exact plaintext message. The timestamp is valid for 10 minutes.

Submitted message format:

```text
EMPX-Cross-Chain intent submitted
intentId:0x...
wallet:0x...
timestamp:1740000000000
srcTxHash:0x...
```

Refund message format:

```text
EMPX-Cross-Chain intent refund
intentId:0x...
wallet:0x...
timestamp:1740000000000
reason:user readable reason
```

Cancel message format:

```text
EMPX-Cross-Chain intent cancel
intentId:0x...
wallet:0x...
timestamp:1740000000000
reason:user readable reason
replacementTxHash:0x...
```

Frontend requirements:

- sign exactly the message above with newline separators
- use the checksum-normalized wallet address if your wallet library exposes it
- keep client and server clocks reasonably aligned
- regenerate signatures if more than 10 minutes old

## 5. Poll status

Poll `GET /api/v1/intent/{id}` after quote selection and continue after submission until terminal.

Recommended polling cadence:

- every 3 to 5 seconds while active
- back off to 8 to 10 seconds if the session is backgrounded
- stop on terminal status

Status response fields the UI should use:

- `intentId`
- `status`
- `srcTxHash`
- `dstTxHash`
- `railTxId`
- `rail`
- `railVariant`
- `etaSeconds`
- `createdAt`
- `updatedAt`
- `errorMessage`
- `canCancel`
- `canCancelInWallet`
- `canRequestRefund`
- `refund`

### Intent status lifecycle

Possible single-intent statuses:

- `CREATED`
- `QUOTED`
- `SUBMITTED`
- `IN_TRANSIT`
- `DESTINATION_RECEIVED`
- `SETTLED`
- `STUCK`
- `RECOVERING`
- `FAILED`
- `CANCELLED`

Recommended UI handling:

- `QUOTED`: waiting for wallet execution
- `SUBMITTED`: source tx submitted, waiting for bridge/provider progress
- `IN_TRANSIT`: transfer is moving between chains/providers
- `DESTINATION_RECEIVED`: destination side received value, settlement still finishing
- `SETTLED`: success, terminal
- `STUCK`: show support/refund path
- `RECOVERING`: recovery in progress, continue polling
- `FAILED`: failed, show refund/support path
- `CANCELLED`: cancelled, terminal

## 6. Cancel flow

Call `POST /api/v1/intent/{id}/cancel` with a signed request.

Two different UX cases exist.

### Case A. Cancel before submission

If `canCancel === true`, the intent is still in `CREATED` or `QUOTED`.

Request:

```json
{
  "userAddress": "0x...",
  "signature": "0x...",
  "timestamp": 1740000000000,
  "reason": "User cancelled quote"
}
```

### Case B. Cancel after wallet submit

If `canCancelInWallet === true`, the intent is already submitted and the user must first cancel the pending source transaction in their wallet by sending a replacement transaction with the same nonce and higher fee.

Only after that replacement transaction is mined should the UI call:

```json
{
  "userAddress": "0x...",
  "signature": "0x...",
  "timestamp": 1740000000000,
  "reason": "User cancelled in wallet",
  "replacementTxHash": "0x..."
}
```

Expected 409 responses in this flow are part of normal UX:

- `CANCEL_IN_WALLET`
- `CANCEL_PENDING_WALLET_CONFIRMATION`
- `SOURCE_TX_ALREADY_MINED`
- `INVALID_REPLACEMENT_TX`

The UI should surface these as actionable wallet instructions, not generic fatal errors.

## 7. Refund flow

Call `POST /api/v1/intent/{id}/refund` only when `canRequestRefund === true`.

Request:

```json
{
  "userAddress": "0x...",
  "signature": "0x...",
  "timestamp": 1740000000000,
  "reason": "Funds not received on destination"
}
```

Success returns:

- `ok: true`
- `refund`
- `ts`

The UI should render `refund.status` as a separate support/recovery timeline.

Refund case states:

- `REQUESTED`
- `UNDER_REVIEW`
- `APPROVED`
- `REJECTED`
- `PROCESSING`
- `COMPLETED`

## Composed Flow: Primary Transfer + Destination Gas

Use this only when the quote response includes `gasZipComposition` and the product wants to execute a two-leg experience.

### Select composed offers

Call `POST /api/v1/quote/select-composed`.

Request:

```json
{
  "offerSetId": "0x...",
  "primaryTransferOfferId": "0x...",
  "gasZipDestinationGasOfferId": "0x...",
  "userAddress": "0x..."
}
```

The response contains:

- `composedIntentId`
- `status`
- `executionPlan`
- `primaryTransfer`
- `gasZipDestinationGas`
- `tracking`

Each leg has its own:

- `intentId`
- `quote`
- `integration`

`tracking.statusPath` points to the composed polling endpoint.

### Poll composed status

Call `GET /api/v1/intent/composed/{primaryIntentId}/{gasZipIntentId}`.

Composed statuses:

- `QUOTED`
- `SUBMITTED`
- `IN_TRANSIT`
- `PARTIALLY_SETTLED`
- `SETTLED`
- `PARTIALLY_FAILED`
- `FAILED`
- `CANCELLED`
- `STUCK`
- `RECOVERING`

UI guidance:

- show both legs independently
- show a top-level composed badge using the composed status
- allow refund if either leg becomes refund-eligible
- treat `PARTIALLY_SETTLED` and `PARTIALLY_FAILED` as special support-heavy states

## LayerZero Provider-Direct Flow

This flow applies only when `integration.mode === "provider_direct"` and `integration.action.kind === "layerzero_value_transfer_api"`.

### Optional discovery endpoints

Use these only if the UI wants LayerZero-native chain/token discovery:

- `GET /api/v1/layerzero-value-transfer-api/chains`
- `GET /api/v1/layerzero-value-transfer-api/tokens`

These are not required for a general quote-first UI.

### Execution flow

1. Quote as normal with `POST /api/v1/quote`
2. Select route with `POST /api/v1/quote/select`
3. Read `integration.action.userSteps`
4. If `requiresFreshUserSteps === true`, call `POST /api/v1/layerzero-value-transfer-api/intents/{id}/build-user-steps` immediately before signing
5. If `submitSignatureRequired === true`, collect wallet signatures and send them to `POST /api/v1/layerzero-value-transfer-api/intents/{id}/submit-signature`
6. After the provider-side source action is sent, call `POST /api/v1/layerzero-value-transfer-api/intents/{id}/submitted`
7. Poll the normal `GET /api/v1/intent/{id}` endpoint for lifecycle state

### LayerZero-specific notes

- `build-user-steps` returns opaque `userSteps`; the UI should render them generically and not hardcode assumptions about every step subtype
- `submit-signature` accepts `signatures: string[]`
- LayerZero submitted payload uses `sourceTxHash`, not `srcTxHash`

LayerZero submitted request:

```json
{
  "userAddress": "0x...",
  "sourceTxHash": "0x..."
}
```

## Error Handling Requirements

The UI must explicitly handle these status classes:

- `400`: invalid payload or unsupported route inputs
- `401`: invalid or expired signature
- `403`: intent does not belong to the provided wallet, or provider-specific authorization failure
- `404`: expired selection, missing intent, missing offer
- `409`: normal business conflict such as unavailable offers or wallet-cancel workflow requirements
- `429`: rate limited
- `502`: upstream provider unavailable
- `503`: quote builder or status service unavailable

Special handling:

- For `POST /api/v1/quote/select`, a `409` can return `fallbackOfferSet`. The UI should offer reselection instead of showing a dead-end error.
- For `GET /api/v1/intent/{id}`, `503 STATUS_UNAVAILABLE` should be shown as a retry state, not a failed intent.

## Rate Limits

The API emits:

- `RateLimit-Limit`
- `RateLimit-Remaining`
- `RateLimit-Reset`
- `Retry-After` on `429`

Current defaults in the implementation:

- global: 120 requests per minute per client IP
- quote endpoints: 20 requests per minute per client IP

Frontend implications:

- debounce quote requests
- cancel stale quote fetches
- avoid polling faster than necessary
- honor `Retry-After`

## Frontend Data Models To Normalize

At minimum, the UI state layer should normalize:

- `OfferSet`
- `RailOffer`
- `QuoteResult`
- `SelectedOfferIntegration`
- `IntentStatusResponse`
- `ComposedIntentStatusResponse`
- `IntentRefundCase`

## Minimum API Set By Product Surface

### Standard swap/bridge UI

Required:

- `POST /api/v1/quote`
- `POST /api/v1/quote/select`
- `GET /api/v1/intent/{id}`
- `POST /api/v1/intent/{id}/submitted`
- `POST /api/v1/intent/{id}/cancel`
- `POST /api/v1/intent/{id}/refund`

### UI with destination gas add-on

Also require:

- `POST /api/v1/quote/select-composed`
- `GET /api/v1/intent/composed/{primaryIntentId}/{gasZipIntentId}`

### UI that exposes LayerZero direct routes explicitly

Also require:

- `POST /api/v1/layerzero-value-transfer-api/intents/{id}/build-user-steps`
- `POST /api/v1/layerzero-value-transfer-api/intents/{id}/submit-signature`
- `POST /api/v1/layerzero-value-transfer-api/intents/{id}/submitted`

Optional:

- `GET /api/v1/layerzero-value-transfer-api/chains`
- `GET /api/v1/layerzero-value-transfer-api/tokens`

## Summary

For the standard public cross-chain UI, the critical integration path is:

1. quote routes
2. select a route
3. execute wallet action
4. mark submitted
5. poll status
6. support cancel/refund flows

Everything else is conditional:

- composed endpoints for destination gas
- LayerZero endpoints for provider-direct step execution
- health for operational smoke checks
