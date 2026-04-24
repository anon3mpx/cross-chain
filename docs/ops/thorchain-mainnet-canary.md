# THORChain Mainnet Canary

## Objective

Run THORChain mainnet in a controlled rollout while preserving explicit user rail selection and fast rollback capability.

## Required Guardrails

- Enable canary gating with `ENABLE_THORCHAIN_CANARY=true`.
- Restrict allowed quote pairs via `THORCHAIN_CANARY_ALLOWLIST`.
- Reject stale offers:
  - Offer-set TTL is 30s.
  - THOR provider expiry in quote payload must still be valid at submit time.
- Do not switch rails after user selection:
  - If a selected rail stalls, mark the intent failed and require a new quote.

## Environment Variables

- `ENABLE_THORCHAIN_WORKER=true`
- `ENABLE_THORCHAIN_QUOTE_WORKER=true`
- `ENABLE_THORCHAIN_CANARY=true`
- `THORCHAIN_CANARY_ALLOWLIST=8453:1:BASE.ETH:ETH.ETH,8453:0:BASE.ETH:BTC.BTC`
- `THORCHAIN_BASE_URL=https://thornode.ninerealms.com`

`THORCHAIN_CANARY_ALLOWLIST` key format:

`<srcChainId>:<dstChainId>:<fromAsset>:<toAsset>`

Example: `8453:0:BASE.ETH:BTC.BTC`

## Rollout Procedure

1. Start with one pair and one destination chain.
2. Run low-notional transfers only after quote parity and execution checks pass.
3. Monitor:
   - quote rejection rate,
   - THOR outbound completion latency,
   - stuck intents and failure reasons,
   - destination receipt confirmations.
4. Expand allowlist gradually after stable canary metrics.

## Rollback Procedure

1. Stop new THORChain quote generation:
   - set `ENABLE_THORCHAIN_QUOTE_WORKER=false`, or
   - clear `THORCHAIN_CANARY_ALLOWLIST`.
2. Stop THORChain monitor worker for new tracking:
   - set `ENABLE_THORCHAIN_WORKER=false`.
3. Keep other rails active; users can re-quote and select alternative rails.
