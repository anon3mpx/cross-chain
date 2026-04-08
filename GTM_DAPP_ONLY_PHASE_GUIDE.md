# EMPX Cross-Chain Dapp-Only GTM Guide (Phase-by-Phase)

This guide is for launching EMPX as an **official dapp only** product (no external partner API program yet), based on the current codebase.

## 1) Current Baseline (From Code)

### 1.1 What is already strong
- Multi-rail model is implemented in VPS routing logic:
  - `CCTP`, `AXELAR`, `LAYERZERO`, `VIA_LABS`, `THORCHAIN`
  - Files: `src/vps/services/RailSelector.ts`, `src/vps/services/RouterBuilder.ts`
- Aggregator-aware route classification exists:
  - `FULL_SWAP`, `SRC_SWAP`, `DST_SWAP`, `BRIDGE_ONLY`
  - File: `src/vps/types/index.ts`
- Axelar/LayerZero rail plugins and receiver adapters exist in contracts.
- Empseal swap plugin integration exists and Solidity tests pass.
- Foundry test setup is working (`npm run sol:test`).

### 1.2 Current chain posture in config
- Aggregator-enabled chains configured: **14**
  - `369,56,42161,8453,137,43114,10,143,146,1329,80094,30,10001,999`
  - File: `src/vps/config/chains.ts`
- Hub chains configured: **7**
  - `42161,8453,43114,10,56,137,1`
- Isolated/native non-EVM chains configured: **6**
  - `BTC, SOL, DOGE, LTC, BCH, COSMOS`

### 1.3 Gaps to close before public scale
- `buildRouterCalldata(...)` still stubbed in API code.
- Intent state and quote cache are still in-memory (not durable).
- `QuoteEngine` still uses stubbed pricing and requires startup quote-fn wiring.
- Paymaster gas estimation path has stubs.

## 2) Dapp-Only GTM Strategy

## Strategy Summary
Launch in controlled phases with strict allowlists. Prioritize **reliability and recoverability** over maximum chain count marketing.

Success principle:
1. Stable settlement on fewer chains first.
2. Controlled exposure limits and automated fallback.
3. Expand only after measurable SLO pass.

## 3) Phase Plan

## Phase 0: Production Hardening (Week 0-2)
Goal: make backend production-safe before opening beyond internal users.

Scope:
1. Replace stubs and wire execution path end-to-end.
2. Add durable storage and distributed cache.
3. Add observability + incident controls.

Required engineering tasks:
1. Implement calldata encoder for `RouterV1.initiateSwap(...)`.
   - Current location: `src/vps/api/PartnerAPI.ts` (`buildRouterCalldata` TODO)
2. Add persistent intent store.
   - Replace `IntentEngine` in-memory map with Postgres repository.
3. Add Redis for quote cache and idempotency.
   - Replace in-memory quote cache in `QuoteEngine`.
4. Wire DEX quote adapters at startup for each live chain.
   - Use `quoteEngine.registerDexQuoteFn(chainId, fn)`.
5. Fill env-backed contract and token addresses.
   - `CHAIN_<id>_ROUTER_V1`
   - `CHAIN_<id>_RECEIVER_V1`
   - `CHAIN_<id>_TOKEN_USDC|USDT|ETH`
   - Optional `CHAIN_<id>_SWAP_PLUGIN_ID`
6. Add rail kill-switch config.
   - Global and per-chain/per-rail switches used by route builder.

Exit criteria:
1. 7-day soak in staging with replay tests.
2. No lost intents across restart/failover.
3. p95 quote latency < 300ms at expected launch load.
4. Recovery engine demonstrates successful fallback replay.

## Phase 1: Internal Alpha (Week 2-4)
Goal: validate real user flows with tightly constrained exposure.

Launch scope:
1. Chains: `ARB (42161), BASE (8453), OP (10), BSC (56)`.
2. Rails: `CCTP + AXELAR + LAYERZERO` only.
3. Disable native destinations (`BTC/SOL/DOGE`) in UI for this phase.

Risk controls:
1. Max notional per intent and per wallet/day.
2. Circuit breaker if per-rail failure rate breaches threshold.
3. Automatic fallback rails enabled.

SLO targets:
1. Settled success rate >= 98.5%.
2. p95 settle time < 8 minutes.
3. Stuck intents recovered automatically >= 95%.

Exit criteria:
1. 1,000+ intents with zero fund-loss incidents.
2. Incident runbook tested (RPC outage + rail outage scenarios).

## Phase 2: Private Beta (Week 4-6)
Goal: open to invited users while expanding coverage.

Launch scope:
1. Add chains: `Polygon (137), Avalanche (43114), Ethereum (1 hub)`.
2. Keep native destinations gated.
3. Keep expansion chains hidden behind feature flags.

Platform tasks:
1. Add status page with per-rail health and latency.
2. Add structured incident alerting (pager + Slack/Discord).
3. Add support tooling for intent replay and manual remediation.

SLO targets:
1. Settled success rate >= 99.0%.
2. p95 quote latency < 400ms under beta traffic.
3. Recovery completion p95 < 20 minutes.

Exit criteria:
1. 10,000+ intents with stable weekly SLO.
2. No unresolved stuck intents older than SLA window.

## Phase 3: Public Dapp Launch (Week 6-8)
Goal: public launch with strong but controlled chain matrix.

Public scope recommendation:
1. Market “Core Coverage” first: 6-8 highest reliability EVM chains.
2. Keep full configured matrix operationally available behind risk controls.
3. Roll out additional aggregator chains one by one after per-chain burn-in.

Core launch SLO:
1. Monthly settlement success >= 99.2%.
2. Monthly API uptime >= 99.9%.
3. Mean time to detect incident < 2 minutes.
4. Mean time to mitigate incident < 15 minutes.

Go/No-Go checklist:
1. Durable DB + Redis in HA mode.
2. Chain-specific runbooks complete.
3. Replay/reconciliation jobs active.
4. Backups + restore drill completed.
5. Feature flags verified for fast rail disable.

## Phase 4: Expansion to Native/Isolated Chains (Post-launch)
Goal: safely add native destination flows (THORChain-heavy paths).

Scope:
1. Enable `BTC` first with low caps.
2. Add `SOL`, then `DOGE/LTC/BCH/COSMOS` based on reliability.
3. Keep native-address validation strict and chain-specific.

Controls:
1. Separate SLO board for native flows.
2. Lower default size limits for non-EVM destinations.
3. Mandatory memo/address validation before submit.

Exit criteria:
1. Native flow success >= 98.5% sustained.
2. No unresolved payout mismatch incidents.

## 4) Storage and Caching Architecture (Production)

## 4.1 What to store
Use Postgres as source of truth:
1. `intents` (latest state snapshot)
2. `intent_events` (append-only transitions)
3. `chain_events` (processed on-chain logs with `(chainId, txHash, logIndex)` uniqueness)
4. `quote_audit` (optional, sampled)
5. `webhook_delivery_log` (if used internally)

Use Redis:
1. Quote cache (`15-30s` TTL)
2. Hot status cache (`30-120s` TTL)
3. Idempotency keys (`5-30 min`)
4. Distributed locks for processors

## 4.2 Retention policy recommendation
1. Quote cache: ephemeral only.
2. Intent/event operational data: 12-24 months online.
3. Archive tier for compliance/accounting: up to 5-7 years if needed.

## 4.3 Supabase vs self-host decision
1. Managed first (fastest GTM): managed Postgres + managed Redis.
2. Self-host only when compliance/cost/control requires it.
3. Keep SQL/schema portable to avoid lock-in.

Recommendation for this stage:
- Start managed for speed.
- Reassess at sustained high throughput or strict compliance requirements.

## 5) Chain Coverage Rollout Matrix

## Tier A (Launch core)
- `42161, 8453, 10, 56, 137, 43114`

## Tier B (Public shortly after)
- `1` plus stable expansion EVMs you validate in burn-in

## Tier C (Advanced expansion)
- `369,143,146,1329,80094,30,10001,999`

## Tier D (Native/isolated)
- `BTC, SOL, DOGE, LTC, BCH, COSMOS`

## 6) Operational Model for Dapp-Only

Required services:
1. API service (internal/public dapp endpoints)
2. Quote/routing worker
3. Event monitor workers (per chain group)
4. Recovery worker
5. Reconciliation worker
6. Scheduler/cron for health checks and stale-intent scans

Recommended deployment:
1. 2+ API replicas behind LB.
2. Separate worker pools from API pods.
3. Blue/green deploy for rail config changes.

## 7) Immediate Backlog (Ordered)

1. Implement calldata builder and request signing path.
2. Add Postgres repositories for intents/events.
3. Add Redis cache and idempotency lock layer.
4. Add startup bootstrap for chain adapters and address registry verification.
5. Add feature-flagged chain/rail allowlist in routing.
6. Add metrics dashboards for quote/settle/fallback SLOs.

## 8) KPI Dashboard for Launch Governance

Track daily and weekly:
1. Quote success rate
2. Submit success rate
3. Settlement success rate
4. p50/p95 settlement latency by rail
5. Stuck intent rate
6. Recovery success rate
7. Incident count by chain/rail
8. Fund-loss incidents (must be zero)

## 9) Final Recommendation

For your current codebase, the best GTM is:
1. **Dapp-only launch with strict allowlists**.
2. **Core EVM chains first**, native/isolated later.
3. **Productionize storage and cache before broad marketing**.
4. Expand chain count only after each phase passes SLO gates.

This gives fastest path to market with controlled risk and preserves optional future partner API expansion.
