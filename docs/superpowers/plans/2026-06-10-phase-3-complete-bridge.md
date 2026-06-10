# Phase 3 Complete Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full Phase 3 bridge scope from `docs/version-2-feature-selection-phase-3-bridge-handoff-20260609.md`: shared post-Hyperlane runtime cleanup, `Chainflip`, `Maya`, conditional `TeleSwap`, the required coverage expansion, and the monitoring/ops closure for every adopted rail.

**Architecture:** Keep the current `ruflo` provider-direct architecture as the production path, but factor the repeated post-Hyperlane liquidity-rail logic into shared VPS helpers before adding more rails. Port the handoff's `Chainflip`, `Maya`, and `TeleSwap` service primitives into the existing `QuoteEngine`, `DirectRailIntegrationBuilder`, and rail execution manager, then close Phase 3 with registry/schema/accessibility updates and full monitoring verification. The deferred handoff `RailSolver` work is treated here as selective bridge-only runtime cleanup, not as a separate platform rewrite.

**Tech Stack:** TypeScript, Node.js, `ethers`, current VPS quote/runtime services, `node:test`, existing Postgres schema/migration flow

---

### Task 1: Add the full Phase 3 red test matrix

**Files:**
- Create: `tests/vps/chainflip-broker-client.test.ts`
- Create: `tests/vps/chainflip-quote-worker.test.ts`
- Create: `tests/vps/chainflip-monitor-worker.test.ts`
- Create: `tests/vps/maya-client.test.ts`
- Create: `tests/vps/maya-quote-worker.test.ts`
- Create: `tests/vps/maya-monitor-worker.test.ts`
- Create: `tests/vps/teleswap-quote-worker.test.ts`
- Create: `tests/vps/teleswap-monitor-worker.test.ts`
- Modify: `tests/vps/quote-engine-layerzero-transfer-api.test.ts`
- Modify: `tests/vps/direct-rail-integration.test.ts`
- Modify: `tests/vps/postgres-schema-compat.test.ts`
- Modify: `tests/vps/offer-selection.test.ts`

- [ ] **Step 1: Write the failing Chainflip broker/worker/monitor tests**

Cover:
- broker client config gating and retry behavior,
- quote worker asset mapping and normalized output,
- monitor worker transitions from `AWAITING_DEPOSIT` to `COMPLETE` / `FAILED`.

Example worker test:

```ts
test('BrokerChainflipQuoteWorker returns a normalized indicative quote', async () => {
  const worker = new BrokerChainflipQuoteWorker({
    isConfigured: () => true,
    getIndicativeQuote: async () => ({
      expectedAmountOut: 90_000n,
      effectiveRateBps: 9_950,
      sourceFee: 1_000n,
      destinationFee: 500n,
      brokerFeeAmount: 100n,
      etaSeconds: 45,
    }),
  } as any);

  const result = await worker.quote({
    srcChainId: 1,
    dstChainId: CHAIN_ID.BTC,
    tokenIn: 'USDC',
    tokenOut: 'BTC',
    amountIn: 100_000n,
    destinationAddress: 'bc1qexample',
  });

  assert.ok(result);
  assert.equal(result?.expectedAmountOut, 90_000n);
});
```

- [ ] **Step 2: Write the failing Maya client/worker/monitor tests**

Cover:
- public-client quote and action-status mapping,
- quote worker vault/memo normalization,
- monitor worker mapping from Maya action status into `IntentStatus`.

Example monitor test:

```ts
test('MayaMonitorWorker settles successful outbound actions', async () => {
  const worker = new MayaMonitorWorker(
    { getActionStatus: async () => ({ txid: '0xsrc', status: 'success', outboundCompleted: true, outboundTxHash: '0xdst' }) } as any,
    { pollIntervalMs: 60_000 },
  );
  const status = await worker.getStatusOnce('0xsrc');
  assert.equal(status?.status, IntentStatus.SETTLED);
});
```

- [ ] **Step 3: Write the failing TeleSwap quote/monitor tests**

Cover:
- env-gated quote-worker behavior,
- narrow supported chain set,
- monitor-worker mapping for `PENDING_DEPOSIT`, `SWAP_COMPLETE`, `REFUNDED`.

Example quote test:

```ts
test('SdkTeleSwapQuoteWorker returns null when TELESWAP_API_URL is unset', async () => {
  const worker = new SdkTeleSwapQuoteWorker();
  const result = await worker.quote({
    srcChainId: CHAIN_ID.BTC,
    dstChainId: 137,
    tokenIn: 'BTC',
    tokenOut: 'USDC',
    amountIn: 100_000n,
    destinationAddress: '0x1111111111111111111111111111111111111111',
  });
  assert.equal(result, null);
});
```

- [ ] **Step 4: Extend shared quote/integration/schema tests**

Add assertions that:
- `QuoteEngine` can emit `Chainflip`, `Maya`, and `TeleSwap` provider-direct offers,
- `DirectRailIntegrationBuilder` returns normalized direct-deposit instructions for each rail,
- offer selection keeps a stable API shape,
- Postgres rail constraints accept `CHAINFLIP`, `MAYA`, and `TELESWAP`.

- [ ] **Step 5: Run the full red Phase 3 test set**

Run:
`node --import tsx --test tests/vps/chainflip-broker-client.test.ts tests/vps/chainflip-quote-worker.test.ts tests/vps/chainflip-monitor-worker.test.ts tests/vps/maya-client.test.ts tests/vps/maya-quote-worker.test.ts tests/vps/maya-monitor-worker.test.ts tests/vps/teleswap-quote-worker.test.ts tests/vps/teleswap-monitor-worker.test.ts tests/vps/quote-engine-layerzero-transfer-api.test.ts tests/vps/direct-rail-integration.test.ts tests/vps/offer-selection.test.ts tests/vps/postgres-schema-compat.test.ts`

Expected: FAIL with missing rails, worker classes, and schema support.

### Task 2: Add Phase 3 rail enums, schema support, and registry coverage

**Files:**
- Modify: `src/vps/types/index.ts`
- Modify: `src/vps/rails/registry.ts`
- Modify: `src/vps/db/schema.sql`
- Modify: `src/vps/db/schemaCompatibility.ts`
- Create: `src/vps/db/migrations/20260610_add_phase3_bridge_rail_constraints.sql`

- [ ] **Step 1: Add the new Phase 3 rail and provider types**

Update `src/vps/types/index.ts` to add:
- `Rail.CHAINFLIP`,
- `Rail.MAYA`,
- `Rail.TELESWAP`,
- `LIQUIDITY_RAILS` membership for all three,
- `RailOfferType` entries such as `'chainflip_broker_direct'`, `'maya_direct'`, and `'teleswap_direct'`,
- `ProviderTransferProvider` entries such as `'chainflip_broker'`, `'maya_midgard'`, and `'teleswap_api'`.

- [ ] **Step 2: Extend registry definitions**

Update `src/vps/rails/registry.ts` so:
- `Chainflip` is registered as a liquidity rail with BTC / SOL / DOT / USDC coverage,
- `Maya` is registered as a liquidity rail for its THOR-like and exclusive chains,
- `TeleSwap` is registered as a narrow BTC↔Polygon/BSC rail behind later gating,
- fallback rails are coherent with the current production model,
- `CHAIN_RAILS` entries only claim coverage that the workers can really quote and monitor.

- [ ] **Step 3: Update rail-check constraints**

Add the new rails to:
- `intents.rail`,
- `intents.fallback_rail`,
- `intent_rail_attempts.rail`,
- schema-compat validation logic.

- [ ] **Step 4: Run the schema and type-level tests**

Run:
`node --import tsx --test tests/vps/postgres-schema-compat.test.ts tests/vps/chainflip-quote-worker.test.ts tests/vps/maya-quote-worker.test.ts tests/vps/teleswap-quote-worker.test.ts`

Expected: PASS

### Task 3: Implement the shared post-Hyperlane runtime cleanup needed for Phase 3

**Files:**
- Create: `src/vps/services/directRails/providerDirectLiquidityHelpers.ts`
- Create: `src/vps/services/directRails/providerDirectMonitorHelpers.ts`
- Modify: `src/vps/services/QuoteEngine.ts`
- Modify: `src/vps/services/DirectRailIntegrationBuilder.ts`
- Modify: `src/vps/rails/execution.ts`
- Modify: `src/vps/services/IntentService.ts`

- [ ] **Step 1: Extract shared liquidity-rail offer-shaping helpers**

Move the repeated provider-direct liquidity offer shaping out of monolithic inline branches so `THORCHAIN`, `Chainflip`, `Maya`, and `TeleSwap` can share:
- execution metadata normalization,
- economics packing,
- route-asset assignment,
- provider-transfer key selection.

- [ ] **Step 2: Extract shared monitor-transition helpers**

Add helper functions for:
- listing active intents by rail,
- writing provider-transfer rows,
- mapping a provider transition into `markInTransit`, `markSettled`, or `markFailed`.

- [ ] **Step 3: Refactor existing THOR/Hyperlane branches onto the shared helpers**

Do this before adding the Phase 3 rails so the cleanup is real rather than dead code. Keep the current public behavior unchanged.

- [ ] **Step 4: Run existing provider-direct regression tests**

Run:
`node --import tsx --test tests/vps/direct-rail-integration.test.ts tests/vps/quote-engine-layerzero-transfer-api.test.ts tests/vps/hyperlane-nexus-monitor-worker.test.ts tests/vps/thorchain-monitor-worker.test.ts`

Expected: PASS

### Task 4: Port the Chainflip service primitives

**Files:**
- Create: `src/vps/services/chainflip/ChainflipBrokerClient.ts`
- Create: `src/vps/services/chainflip/ChainflipQuoteWorker.ts`
- Create: `src/vps/services/chainflip/ChainflipMonitorWorker.ts`
- Test: `tests/vps/chainflip-broker-client.test.ts`
- Test: `tests/vps/chainflip-quote-worker.test.ts`
- Test: `tests/vps/chainflip-monitor-worker.test.ts`

- [ ] **Step 1: Implement `ChainflipBrokerClient`**

Port the handoff client shape with:
- broker URL and commission env support,
- indicative quote, deposit-channel creation, and status lookup,
- timeout and retry behavior,
- graceful `null` on unconfigured or rejected requests.

- [ ] **Step 2: Implement `BrokerChainflipQuoteWorker`**

Support:
- ETH / ARB / BTC / SOL / DOT asset mapping,
- normalized indicative quote output,
- explicit broker fee and ETA reporting,
- deferred or quote-time deposit-channel creation depending on the current API choice.

- [ ] **Step 3: Implement `ChainflipMonitorWorker`**

Support:
- polling broker channel status,
- transition mapping into current intent states,
- provider-transfer persistence keyed by channel id.

- [ ] **Step 4: Run the Chainflip worker tests**

Run:
`node --import tsx --test tests/vps/chainflip-broker-client.test.ts tests/vps/chainflip-quote-worker.test.ts tests/vps/chainflip-monitor-worker.test.ts`

Expected: PASS

### Task 5: Integrate Chainflip end to end

**Files:**
- Modify: `src/vps/services/QuoteEngine.ts`
- Modify: `src/vps/services/DirectRailIntegrationBuilder.ts`
- Modify: `src/vps/app/runtime.ts`
- Modify: `src/vps/rails/execution.ts`
- Modify: `tests/vps/quote-engine-layerzero-transfer-api.test.ts`
- Modify: `tests/vps/direct-rail-integration.test.ts`
- Modify: `tests/vps/offer-selection.test.ts`

- [ ] **Step 1: Add the Chainflip quote-worker dependency to `QuoteEngine`**

Follow the current provider-direct pattern:
- optional dependency injection,
- env gate,
- inclusion in `_computeOfferSet(...)`.

- [ ] **Step 2: Implement `_buildChainflipProviderDirectOffer(...)`**

The offer must:
- set `executionMode: 'provider_direct'`,
- persist a normalized quote under `execution.quote`,
- include direct-deposit metadata such as `depositAddress`, `channelId`, `expiresAt`, and broker fee.

- [ ] **Step 3: Add Chainflip client integration payloads**

Return a `provider_direct` action such as:
- `kind: 'chainflip_swap'`,
- `depositAddress`,
- `channelId`,
- `expiresAt`,
- `expectedAmountOut`.

- [ ] **Step 4: Wire runtime monitoring**

Add env toggles and execution-adapter startup so the Chainflip monitor can run like the existing direct rails.

- [ ] **Step 5: Run the Chainflip end-to-end VPS tests**

Run:
`node --import tsx --test tests/vps/quote-engine-layerzero-transfer-api.test.ts tests/vps/direct-rail-integration.test.ts tests/vps/offer-selection.test.ts tests/vps/chainflip-monitor-worker.test.ts`

Expected: PASS

### Task 6: Port the Maya service primitives

**Files:**
- Create: `src/vps/services/maya/MayaClient.ts`
- Create: `src/vps/services/maya/MayaQuoteWorker.ts`
- Create: `src/vps/services/maya/MayaMonitorWorker.ts`
- Test: `tests/vps/maya-client.test.ts`
- Test: `tests/vps/maya-quote-worker.test.ts`
- Test: `tests/vps/maya-monitor-worker.test.ts`

- [ ] **Step 1: Implement `MayaClient`**

Support:
- Midgard quote lookups,
- action-status lookups by source tx hash,
- inbound-address reads,
- public default endpoints and retry behavior.

- [ ] **Step 2: Implement `MidgardMayaQuoteWorker`**

Support:
- Maya asset-string mapping,
- vault address + memo normalization,
- quote output with slip and outbound-fee reporting,
- exclusive chain coverage for `KUJI`, `DASH`, and `ZEC`.

- [ ] **Step 3: Implement `MayaMonitorWorker`**

Support:
- action-status polling,
- terminal and intermediate state mapping,
- provider-transfer persistence keyed by source tx hash.

- [ ] **Step 4: Run the Maya worker tests**

Run:
`node --import tsx --test tests/vps/maya-client.test.ts tests/vps/maya-quote-worker.test.ts tests/vps/maya-monitor-worker.test.ts`

Expected: PASS

### Task 7: Integrate Maya end to end

**Files:**
- Modify: `src/vps/services/QuoteEngine.ts`
- Modify: `src/vps/services/DirectRailIntegrationBuilder.ts`
- Modify: `src/vps/app/runtime.ts`
- Modify: `src/vps/rails/execution.ts`
- Modify: `tests/vps/quote-engine-layerzero-transfer-api.test.ts`
- Modify: `tests/vps/direct-rail-integration.test.ts`
- Modify: `tests/vps/offer-selection.test.ts`

- [ ] **Step 1: Add the Maya quote-worker dependency to `QuoteEngine`**

Wire it exactly like the other provider-direct rails, behind `ENABLE_MAYA`.

- [ ] **Step 2: Implement `_buildMayaProviderDirectOffer(...)`**

The offer must include:
- vault address,
- memo,
- expected output and slip,
- provider-direct execution metadata,
- proper route assets for native and EVM destinations.

- [ ] **Step 3: Add Maya client integration payloads**

Return a `provider_direct` action such as:
- `kind: 'maya_swap'`,
- `vaultAddress`,
- `memo`,
- `expiresAt`,
- `expectedAmountOut`.

- [ ] **Step 4: Wire runtime monitoring**

Start the Maya monitor through the execution manager and keep the current runtime lifecycle intact.

- [ ] **Step 5: Run the Maya end-to-end VPS tests**

Run:
`node --import tsx --test tests/vps/quote-engine-layerzero-transfer-api.test.ts tests/vps/direct-rail-integration.test.ts tests/vps/offer-selection.test.ts tests/vps/maya-monitor-worker.test.ts`

Expected: PASS

### Task 8: Implement the TeleSwap conditional track

**Files:**
- Create: `src/vps/services/teleswap/TeleSwapQuoteWorker.ts`
- Create: `src/vps/services/teleswap/TeleSwapMonitorWorker.ts`
- Modify: `src/vps/services/QuoteEngine.ts`
- Modify: `src/vps/services/DirectRailIntegrationBuilder.ts`
- Modify: `src/vps/app/runtime.ts`
- Modify: `src/vps/rails/execution.ts`
- Test: `tests/vps/teleswap-quote-worker.test.ts`
- Test: `tests/vps/teleswap-monitor-worker.test.ts`
- Test: `tests/vps/quote-engine-layerzero-transfer-api.test.ts`
- Test: `tests/vps/direct-rail-integration.test.ts`

- [ ] **Step 1: Implement the narrow TeleSwap quote worker**

Support:
- BTC ↔ Polygon/BSC pairs only,
- env-gated API usage,
- deposit-address and fee normalization,
- explicit no-quote behavior for unsupported pairs.

- [ ] **Step 2: Implement the TeleSwap monitor worker**

Support:
- polling the swap-status endpoint,
- transition mapping into the current intent model,
- provider-transfer persistence keyed by swap id.

- [ ] **Step 3: Add a TeleSwap evidence gate inside the quote path**

Keep the Phase 3 doc's conditional intent by gating TeleSwap on:
- `ENABLE_TELESWAP`,
- the narrow supported chain pairs,
- a configurable feature flag such as `ENABLE_TELESWAP_CANARY` so it can be implemented but not broadly exposed until route-value checks are done.

- [ ] **Step 4: Add TeleSwap integration payloads**

Return a `provider_direct` action such as:
- `kind: 'teleswap_swap'`,
- `depositAddress`,
- `swapId` when available,
- `expectedAmountOut`,
- `expiresAt` if exposed by the API.

- [ ] **Step 5: Run the TeleSwap VPS tests**

Run:
`node --import tsx --test tests/vps/teleswap-quote-worker.test.ts tests/vps/teleswap-monitor-worker.test.ts tests/vps/quote-engine-layerzero-transfer-api.test.ts tests/vps/direct-rail-integration.test.ts`

Expected: PASS

### Task 9: Expand chain coverage and settlement assets for all adopted Phase 3 rails

**Files:**
- Modify: `src/vps/rails/registry.ts`
- Modify: `src/vps/services/QuoteEngine.ts`
- Modify: `src/vps/types/index.ts`
- Modify: `tests/vps/quote-engine-route-assets.test.ts`
- Modify: `tests/vps/quote-engine-route-asset.test.ts`

- [ ] **Step 1: Add the actual new coverage surfaces**

Ensure the resulting route tables expose:
- `DOT` via `Chainflip`,
- `KUJI`, `DASH`, and `ZEC` via `Maya`,
- BTC-specialized Polygon/BSC coverage via `TeleSwap` only when the conditional rail is enabled.

- [ ] **Step 2: Normalize settlement-asset and route-asset metadata**

Make sure all new provider-direct rails emit:
- stable `routeAsset` and settlement metadata,
- explicit native/non-EVM asset kinds,
- coherent fallback relationships and ranking metadata.

- [ ] **Step 3: Run route-asset verification**

Run:
`node --import tsx --test tests/vps/quote-engine-route-assets.test.ts tests/vps/quote-codec-route-asset.test.ts`

Expected: PASS

### Task 10: Close the full Phase 3 monitoring and ops surface

**Files:**
- Modify: `src/vps/app/runtime.ts`
- Modify: `src/vps/rails/execution.ts`
- Modify: `docs/version-2-feature-selection-phase-3-bridge-handoff-20260609.md` only if rollout notes need clarification
- Verify only otherwise

- [ ] **Step 1: Add env toggles and runtime startup for all Phase 3 rails**

Support:
- `ENABLE_CHAINFLIP`,
- `ENABLE_MAYA`,
- `ENABLE_TELESWAP`,
- optional canary flags where needed.

- [ ] **Step 2: Verify every rail has a real quote + watch + settle path**

Confirm:
- `Chainflip` has broker quote, direct-deposit execution instructions, and channel monitoring,
- `Maya` has quote, vault/memo execution instructions, and action polling,
- `TeleSwap` has quote, narrow execution instructions, and status polling.

- [ ] **Step 3: Run the full targeted Phase 3 regression suite**

Run:
`node --import tsx --test tests/vps/chainflip-broker-client.test.ts tests/vps/chainflip-quote-worker.test.ts tests/vps/chainflip-monitor-worker.test.ts tests/vps/maya-client.test.ts tests/vps/maya-quote-worker.test.ts tests/vps/maya-monitor-worker.test.ts tests/vps/teleswap-quote-worker.test.ts tests/vps/teleswap-monitor-worker.test.ts tests/vps/quote-engine-layerzero-transfer-api.test.ts tests/vps/direct-rail-integration.test.ts tests/vps/offer-selection.test.ts tests/vps/quote-engine-route-assets.test.ts tests/vps/quote-codec-route-asset.test.ts tests/vps/postgres-schema-compat.test.ts`

Expected: PASS

- [ ] **Step 4: Run TypeScript verification**

Run: `npx tsc --noEmit`
Expected: exit `0`

- [ ] **Step 5: Review the diff for full Phase 3 scope coverage**

Confirm the final change set covers every Phase 3 selection item:
- `Chainflip` end to end,
- `Maya` end to end,
- `TeleSwap` implemented as the doc's conditional rail,
- shared post-Hyperlane runtime cleanup,
- coverage/settlement-asset expansion,
- per-rail monitoring and operations completion,
- no multi-hop, hub-routing, basket, ERC-7683, or marketplace work.
