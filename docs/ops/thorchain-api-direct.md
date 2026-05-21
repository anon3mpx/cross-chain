# THORChain API-Direct Ops Guide

## Execution Model

- Ruflo quotes THORChain routes off-chain.
- Ruflo returns provider-direct integration instructions.
- THORChain delivers natively to the user's destination address.
- No Ruflo destination deployment is required for BTC, SOL, Cosmos, or similar THOR-supported destinations.

## Operational Expectations

- THORChain routes are monitor-driven, not receiver-driven.
- VPS remains responsible for quote freshness, canary rollout, and transaction monitoring.
- Source-side THOR-specific contracts are optional and are not required for this rollout model.

## Required Runtime Flags

- `ENABLE_THORCHAIN_WORKER=true`
- `ENABLE_THORCHAIN_QUOTE_WORKER=true`
- `ENABLE_THORCHAIN_CANARY=true`
- `THORCHAIN_CANARY_ALLOWLIST=8453:99:BASE.ETH:SOL.SOL,8453:0:BASE.ETH:BTC.BTC`

## Monitoring Inputs

- `GET /thorchain/quote/swap`
- `GET /thorchain/inbound_addresses`
- `GET /thorchain/tx/status/:hash`

## Rollback

- set `ENABLE_THORCHAIN_QUOTE_WORKER=false` to stop returning THOR offers
- set `ENABLE_THORCHAIN_WORKER=false` to stop background monitoring
- clear `THORCHAIN_CANARY_ALLOWLIST` or disable `ENABLE_THORCHAIN_CANARY` to widen or close the rollout surface deliberately
