# LayerZero Value Transfer API Tier 2 Guide

## Purpose

Ruflo now supports LayerZero Value Transfer API as a Tier 2 provider-direct path.

This does not replace the existing Ruflo on-chain architecture. It adds a scalable path for chains where Ruflo contracts are not deployed.

## Tier Model

### Tier 1: Ruflo-Deployed Chains

Used when Ruflo has the full contract stack on-chain:

- `RouterV1`
- `ReceiverV1`
- `PluginRegistry`
- rail plugins
- swap plugins / DEX aggregator

Flow:

```text
any token -> Ruflo Router -> source swap -> rail -> Receiver -> destination swap -> any token
```

This supports full any-to-any swaps where Ruflo has aggregator coverage.

### Tier 2: LayerZero Provider-Direct Chains

Used when Ruflo does not deploy contracts on one or both chains.

Flow:

```text
supported source asset -> LayerZero/Stargate/OFT route -> supported destination asset
```

Ruflo does:

- route discovery through LayerZero API quotes
- quote normalization
- executable user step storage
- intent tracking
- status monitoring through LayerZero API

Ruflo does not:

- execute source swaps
- execute destination swaps
- deduct fees through `RouterV1`
- require destination receiver contracts

## Codebase Implementation

### Client

File:

```text
src/vps/services/layerzero/LayerZeroValueTransferApiClient.ts
```

Responsibilities:

- calls unauthenticated discovery endpoints:
  - `GET /chains`
  - `GET /tokens`
  - `GET /metadata`
- calls authenticated transfer lifecycle endpoints:
  - `POST /quotes`
  - `POST /build-user-steps`
  - `POST /submit-signature`
  - `GET /status/{quoteId}`
- sends `x-api-key` only on authenticated endpoints
- keeps API keys out of request bodies
- validates required quote ids, signatures, wallet fields, and integer amounts before calling the API

### Quote Worker

File:

```text
src/vps/services/layerzero/LayerZeroValueTransferApiQuoteWorker.ts
```

Responsibilities:

- maps Ruflo `QuoteRequest` into LayerZero quote request
- resolves chain keys from Ruflo chain config or env overrides
- filters returned tokens through Ruflo asset allowlist
- returns provider-direct quote result with:
  - LayerZero quote id
  - output amount
  - minimum output amount
  - fee USD
  - user steps
  - route steps

### Quote Engine Integration

File:

```text
src/vps/services/QuoteEngine.ts
```

Adds LayerZero API offers as:

```text
rail: LAYERZERO
offerType: lz_api_direct
executionMode: provider_direct
```

The offer execution payload stores:

- `provider: layerzero_value_transfer_api`
- `layerZeroValueTransferApiQuoteId`
- raw LayerZero Value Transfer API quote
- LayerZero Value Transfer API `userSteps`
- LayerZero Value Transfer API `routeSteps`

### Selected Offer Integration

File:

```text
src/vps/services/DirectRailIntegrationBuilder.ts
```

Responsibilities:

- returns LayerZero Value Transfer API user steps for selected `lz_api_direct` offers
- marks Solana routes as requiring fresh `/build-user-steps` immediately before signing
- marks `SIGNATURE` routes as requiring `/submit-signature` after wallet signing
- avoids RouterV1 calldata for provider-direct LayerZero API transfers

### Monitor Worker

File:

```text
src/vps/services/layerzero/LayerZeroValueTransferApiMonitorWorker.ts
```

Responsibilities:

- polls LayerZero `/status/{quoteId}`
- moves Ruflo intent from `SUBMITTED` to `IN_TRANSIT` after source send
- marks intent `SETTLED` after LayerZero reports delivery
- marks intent `FAILED` for failed/reverted/expired transfers

### Runtime Wiring

Files:

```text
src/vps/app/runtime.ts
src/vps/rails/execution.ts
```

When enabled, runtime starts:

- LayerZero Value Transfer API quote worker
- LayerZero Value Transfer API monitor worker

## Production Readiness Status

Implemented:

- LayerZero Value Transfer API client support for all documented endpoints:
  - `GET /chains`
  - `GET /tokens`
  - `GET /metadata`
  - `POST /quotes`
  - `POST /build-user-steps`
  - `POST /submit-signature`
  - `GET /status/{quoteId}`
- provider-direct quote generation through `QuoteEngine`
- explicit `lz_api_direct` offer metadata
- selected-offer execution metadata for EVM and Solana user steps
- Solana route flagging for fresh `/build-user-steps`
- signature route flagging for `/submit-signature`
- intent status polling through the LayerZero status endpoint
- existing DB-backed intent status transitions through `IntentService` when Postgres is enabled
- frontend-facing backend helper endpoints for discovery, fresh user steps, and signature submission
- provider-transfer persistence through `intent_provider_transfers`
- focused unit tests for client, quote worker, monitor worker, quote engine, selected-offer integration, HTTP API, and provider-transfer tracking

Remaining production hardening:

- run live smoke tests with a real LayerZero API key
- wire this into `PartnerAPI` when partner-facing exposure is approved
- resolve unrelated CCTP/THOR economics test expectation failures in the broader VPS suite

## Configuration

```text
ENABLE_LAYERZERO_TRANSFER_API=true
LAYERZERO_TRANSFER_API_KEY=<layerzero-api-key>
LAYERZERO_TRANSFER_API_BASE_URL=https://transfer.layerzero-api.com/v1
LAYERZERO_TRANSFER_ALLOWED_ASSETS=USDC,USDT,WETH,ETH
```

Optional chain key overrides:

```text
LAYERZERO_TRANSFER_CHAIN_KEY_8453=base
LAYERZERO_TRANSFER_CHAIN_KEY_42161=arbitrum
LAYERZERO_TRANSFER_CHAIN_KEY_146=sonic
```

Alternative form:

```text
CHAIN_146_LAYERZERO_TRANSFER_CHAIN_KEY=sonic
```

Use overrides when Ruflo chain names do not match LayerZero API chain keys.

## Asset Support

LayerZero API is not tied to Ruflo's settlement-token model.

It can support any asset route the LayerZero Value Transfer API exposes, such as:

- native tokens
- Stargate assets
- OFTs
- CCTP routes surfaced by LayerZero
- selected ecosystem tokens

Ruflo currently applies a safety allowlist:

```text
USDC, USDT, WETH, ETH
```

This is a Ruflo policy choice, not a LayerZero limitation.

## Route Availability Rule

Tier 2 route availability should be treated as pair-specific:

```text
source asset exists
+ destination asset exists
+ LayerZero API returns a valid quote
+ asset is enabled by Ruflo policy
= route available
```

Do not assume that because LayerZero supports an asset on Sonic, it can move to every other chain.

Example:

If Sonic has 10 LayerZero-supported assets, Ruflo should expose only the assets that also have valid destination routes and pass the Ruflo allowlist.

## What This Enables

Supported:

- Base USDC -> Sonic USDC, if LayerZero API returns a quote
- Sonic ETH -> Arbitrum ETH, if supported
- OFT token on one chain -> same OFT token on another chain
- provider-direct native token transfers where LayerZero supports them

Not guaranteed:

- random ERC20 -> random ERC20
- PEPE -> USDC
- WETH -> USDT

Those are swaps, not plain provider-direct transfers, unless LayerZero API returns a route type that includes swap functionality.

## Protocol Fees

Tier 1 fees are enforced by Ruflo contracts.

Tier 2 has no Ruflo contract in the transfer path. Protocol fees should use LayerZero API partner/base fee support where available.

Do not manually rewrite LayerZero calldata to insert fees.

The API returns executable `userSteps`. Execute them as returned.

## Asset Expansion Policy

Production rollout policy:

1. Start with `USDC`, `USDT`, `WETH`, `ETH`.
2. Use read-only discovery through LayerZero `/chains`, `/tokens`, and `/metadata`.
3. Maintain two sets:
   - discovered assets
   - enabled assets
4. Enable new assets only after validating:
   - route availability
   - decimals
   - liquidity / transfer behavior
   - fee output
   - user experience
   - monitoring behavior

Longer-term, Ruflo can move from simple symbol allowlists to a data-driven provider asset registry:

```ts
{
  provider: 'layerzero_value_transfer_api',
  chainKey: 'sonic',
  chainId: 146,
  canonicalAssetId: 'USDC',
  tokenAddress: '0x...',
  decimals: 6,
  enabled: true
}
```

That registry should still be curated. Discovery should not mean automatic exposure.

## Frontend and API Surface

The frontend should not call LayerZero directly for production routing.

Backend exposes Ruflo-normalized endpoints for:

- supported LayerZero Value Transfer API chains:
  - `GET /layerzero-value-transfer-api/chains`
- supported LayerZero Value Transfer API tokens:
  - `GET /layerzero-value-transfer-api/tokens`
- fresh Solana user steps:
  - `POST /layerzero-value-transfer-api/intents/:id/build-user-steps`
- signature submission:
  - `POST /layerzero-value-transfer-api/intents/:id/submit-signature`
- provider-direct source submission tracking:
  - `POST /layerzero-value-transfer-api/intents/:id/submitted`

Existing quote endpoints handle:

- route validation from source asset to destination asset
- selected-offer execution details:
  - `POST /quote`
  - `POST /quote/select`
- user-submitted EVM source tx hash for router/direct EVM flows:
  - `POST /intent/:id/submitted`

Frontend responsibilities:

- display backend-normalized chains and assets
- ask the user to sign the returned `userSteps`
- call backend for fresh Solana user steps immediately before signing
- submit EIP-712 signatures when a `SIGNATURE` step exists
- report the submitted tx hash or Solana signature back to Ruflo through the LayerZero-specific submitted endpoint for provider-direct LZ routes

## Provider Transfer Persistence

Current implementation stores the LayerZero API quote id on the intent quote using:

```text
layerZeroValueTransferApiQuoteId
```

Status transitions are persisted through the existing intent tables when Postgres is enabled.

Provider-direct transfer snapshots are persisted in `intent_provider_transfers` with:

- `intent_id`
- `provider = layerzero_value_transfer_api`
- `provider_quote_id`
- `source_tx_hash`
- `source_signature`
- `destination_tx_hash`
- `latest_provider_status`
- `route_step_types`
- `last_polled_at`
- `raw_error_payload`

This avoids overloading the quote JSON and makes THORChain, LayerZero, and future provider-direct rails easier to monitor consistently.

## Live Smoke Test Checklist

Run this only after receiving the real API key.

Minimum checks:

1. `GET /chains` returns expected EVM and Solana chains.
2. `GET /tokens` returns curated assets for configured chains.
3. `GET /metadata` returns transfer delegate and multicall metadata for EVM chains.
4. `POST /quotes` returns at least one EVM route for a small curated asset amount.
5. EVM quote `userSteps` can be signed and submitted from a test wallet.
6. Solana quote is rebuilt with `/build-user-steps` immediately before signing.
7. `POST /submit-signature` works for a route that returns a `SIGNATURE` step.
8. `GET /status/{quoteId}` moves from pending/processing to succeeded or failed.
9. Ruflo intent status updates match the provider status.
10. Failed/rejected quotes are normalized into a user-safe error.

## Tests

Current coverage:

```text
tests/vps/layerzero-value-transfer-api-client.test.ts
tests/vps/layerzero-value-transfer-api-quote-worker.test.ts
tests/vps/layerzero-value-transfer-api-status-api.test.ts
tests/vps/quote-engine-layerzero-transfer-api.test.ts
tests/vps/layerzero-value-transfer-api-monitor-worker.test.ts
tests/vps/direct-rail-integration.test.ts
tests/vps/provider-transfer-service.test.ts
tests/vps/db-schema-idempotency.test.ts
```

These verify:

- all seven LayerZero Value Transfer API endpoints are represented in the client
- discovery endpoints do not send API keys
- authenticated endpoints send API keys in headers, not bodies
- quotes map into provider-direct results
- asset allowlist is enforced
- QuoteEngine emits `lz_api_direct` offers
- StatusAPI exposes LayerZero Value Transfer API discovery and intent-bound execution helpers
- monitor maps LayerZero delivery status into Ruflo settled intent state
- provider-transfer snapshots are stored in memory and in the Postgres schema
- selected-offer integration returns EVM user steps
- selected-offer integration marks Solana routes for fresh user-step rebuilds
