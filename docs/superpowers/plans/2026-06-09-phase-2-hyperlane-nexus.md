# Phase 2 Hyperlane Nexus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first Phase 2 bridge rail to the current VPS stack by integrating Hyperlane Nexus as a provider-direct stablecoin rail with actionable quote output and monitorable lifecycle handling.

**Architecture:** Port only the Hyperlane pieces that fit the current `ruflo` architecture: extend the existing rail registry and route-selection model, add a Hyperlane quote worker plus monitor worker, plug Hyperlane into `QuoteEngine` and runtime worker startup, and surface direct-execution instructions through `DirectRailIntegrationBuilder`. Do not import the handoff branch's generic `RailSolver` layer or any phase-3 rails.

**Scope note:** This plan intentionally implements the narrower executed Phase 2 slice. Any deferred bridge-side solver decomposition or `HyperlaneNexusSolver` migration belongs to the later Phase 3 bridge doc, not this plan.

**Tech Stack:** TypeScript, Node.js, `ethers`, current VPS quote/runtime services, `node:test`

---

### Task 1: Add Hyperlane-first regression tests

**Files:**
- Create: `tests/vps/hyperlane-nexus-quote-worker.test.ts`
- Create: `tests/vps/hyperlane-nexus-monitor-worker.test.ts`
- Modify: `tests/vps/quote-engine-layerzero-transfer-api.test.ts`
- Modify: `tests/vps/direct-rail-integration.test.ts`

- [ ] **Step 1: Write the failing quote-worker tests**

Add tests that prove:
- the worker returns `null` without a configured warp-route env var,
- the worker returns a 1:1 quote with parsed IGP fee and destination domain when configured,
- malformed env addresses are rejected.

- [ ] **Step 2: Run the quote-worker test and verify it fails**

Run: `node --import tsx --test tests/vps/hyperlane-nexus-quote-worker.test.ts`
Expected: FAIL because `src/vps/services/hyperlane/HyperlaneNexusQuoteWorker.ts` does not exist yet.

- [ ] **Step 3: Write the failing monitor-worker tests**

Add tests that prove:
- Hyperlane monitor polls active `SUBMITTED`/`IN_TRANSIT` intents for the Hyperlane rail,
- a delivered Explorer response settles the intent and records a provider transfer,
- a failed Explorer response marks the intent failed.

- [ ] **Step 4: Run the monitor-worker test and verify it fails**

Run: `node --import tsx --test tests/vps/hyperlane-nexus-monitor-worker.test.ts`
Expected: FAIL because the Hyperlane monitor worker and provider type do not exist yet.

- [ ] **Step 5: Extend the direct integration and quote-engine tests**

Add:
- a `QuoteEngine` provider-direct offer test for Hyperlane,
- a `DirectRailIntegrationBuilder` test that expects a `transferRemote(...)` tx helper and approval metadata.

- [ ] **Step 6: Run the targeted test set and verify red**

Run: `node --import tsx --test tests/vps/hyperlane-nexus-quote-worker.test.ts tests/vps/hyperlane-nexus-monitor-worker.test.ts tests/vps/quote-engine-layerzero-transfer-api.test.ts tests/vps/direct-rail-integration.test.ts`
Expected: FAIL with missing Hyperlane rail/type/worker symbols.

### Task 2: Add Hyperlane rail definitions and worker primitives

**Files:**
- Create: `src/vps/services/hyperlane/HyperlaneNexusQuoteWorker.ts`
- Create: `src/vps/services/hyperlane/HyperlaneNexusMonitorWorker.ts`
- Modify: `src/vps/types/index.ts`
- Modify: `src/vps/config/routeExecution.ts`
- Modify: `src/vps/rails/registry.ts`

- [ ] **Step 1: Add the Hyperlane rail and related type extensions**

Update `src/vps/types/index.ts` to add:
- `Rail.HYPERLANE_NEXUS`,
- Hyperlane to `MESSAGING_RAILS`,
- `RailOfferType` entry for Hyperlane provider-direct offers,
- `ProviderTransferProvider` entry for Hyperlane monitoring.

- [ ] **Step 2: Add the quote worker**

Implement `HyperlaneNexusQuoteWorker.ts` with:
- env-driven warp-route lookup per source chain and `USDC`/`USDT`,
- chain-domain mapping for supported EVM chains,
- IGP fee and ETA overrides,
- `quote()` returning `null` for unsupported or unconfigured pairs.

- [ ] **Step 3: Add the monitor worker**

Implement `HyperlaneNexusMonitorWorker.ts` to:
- poll Hyperlane Explorer by tracked source tx hash,
- map Explorer status to `IntentStatus`,
- expose a simple status-client interface for test injection.

- [ ] **Step 4: Extend route allowlists and registry**

Update `routeExecution.ts` and `registry.ts` so Hyperlane:
- is discoverable by `RailSelector`,
- advertises `USDC` + `USDT` only,
- uses `ZERO_PLUGIN_ID`,
- is enabled on the intended Phase 2 EVM chains only.

- [ ] **Step 5: Run the new worker tests and verify green**

Run: `node --import tsx --test tests/vps/hyperlane-nexus-quote-worker.test.ts tests/vps/hyperlane-nexus-monitor-worker.test.ts`
Expected: PASS

### Task 3: Integrate Hyperlane into quote generation and runtime monitoring

**Files:**
- Modify: `src/vps/services/QuoteEngine.ts`
- Modify: `src/vps/app/runtime.ts`
- Modify: `src/vps/rails/execution.ts`
- Modify: `src/vps/services/IntentService.ts`

- [ ] **Step 1: Add the Hyperlane quote worker dependency to `QuoteEngine`**

Follow the existing LayerZero/Gas.zip pattern:
- new optional dependency,
- env gate,
- inclusion in `_computeOfferSet(...)`.

- [ ] **Step 2: Implement `_buildHyperlaneNexusProviderDirectOffer(...)`**

The offer should:
- only appear for supported `USDC`/`USDT` routes,
- set `executionMode: 'provider_direct'`,
- persist the normalized quote payload under `execution.quote`,
- carry `warpRouteAddress`, `destinationDomain`, and `interchainGasFee` in `execution`.

- [ ] **Step 3: Wire runtime and worker startup**

Add runtime/env plumbing so Hyperlane monitoring can be toggled similarly to LayerZero provider-direct monitoring.

- [ ] **Step 4: Add any needed `IntentService` support**

Keep this minimal:
- ensure Hyperlane intents can be discovered and provider transfers persisted without adding a new generic abstraction layer.

- [ ] **Step 5: Run the quote-engine test and verify green**

Run: `node --import tsx --test tests/vps/quote-engine-layerzero-transfer-api.test.ts`
Expected: PASS with the added Hyperlane assertions.

### Task 4: Surface Hyperlane execution to clients

**Files:**
- Modify: `src/vps/services/DirectRailIntegrationBuilder.ts`
- Modify: `tests/vps/direct-rail-integration.test.ts`

- [ ] **Step 1: Add Hyperlane provider-direct detection**

Recognize Hyperlane offers by rail and offer type.

- [ ] **Step 2: Return a normalized Hyperlane integration payload**

The returned provider-direct integration should include:
- a Hyperlane-specific action kind,
- the source warp-route tx helper,
- approval metadata for ERC-20 token transfers,
- the quoted interchain gas value.

- [ ] **Step 3: Run the direct integration test and verify green**

Run: `node --import tsx --test tests/vps/direct-rail-integration.test.ts`
Expected: PASS

### Task 5: Verify the full Hyperlane Phase 2 slice

**Files:**
- Verify only

- [ ] **Step 1: Run the targeted Hyperlane regression set**

Run:
`node --import tsx --test tests/vps/hyperlane-nexus-quote-worker.test.ts tests/vps/hyperlane-nexus-monitor-worker.test.ts tests/vps/quote-engine-layerzero-transfer-api.test.ts tests/vps/direct-rail-integration.test.ts`

Expected: PASS

- [ ] **Step 2: Run TypeScript verification**

Run: `npx tsc --noEmit`
Expected: exit `0`

- [ ] **Step 3: Review the diff for Phase 2 scope discipline**

Confirm the change set only adds:
- Hyperlane rail support,
- minimal provider-direct/runtime plumbing,
- no Chainflip/Maya/TeleSwap imports,
- no `RailSolver` framework port.
