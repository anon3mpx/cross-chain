# Phase 4 Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for inline execution. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full Phase 4 scope from `docs/version-2-feature-selection-phase-4-platform-handoff-20260609.md`: basket orchestration, wallet discovery and liquidation, batching, ERC-7683 interoperability, solver registration/control surfaces, and partner/agent API exposure.

**Architecture:** Keep the existing `ruflo` single-intent runtime as the substrate. Add a platform layer above it: grouped intent orchestration (`IntentBasket`), wallet-driven planning (`WalletScanner`, `WalletLiquidator`), batching (`EmpsealMulticallRouter` plus wallet batch hints), interoperability (`erc7683`, `Erc7683Adapter`), and solver directory/control plane (`SolversRepository`). Cross-chain child legs continue to use the current `QuoteEngine`, `IntentService`, provider-direct rails, and monitor workers.

**Tech Stack:** TypeScript, Node.js, Express, Postgres, Solidity, existing VPS runtime/services, `node:test`

---

### Task 1: Add the Phase 4 platform foundation

**Files:**
- Create: `src/vps/core/IntentBasket.ts`
- Create: `src/vps/core/erc7683.ts`
- Create: `src/vps/services/BasketQuoteEngine.ts`
- Create: `src/vps/services/BasketStatusEngine.ts`
- Create: `src/vps/services/WalletScanner.ts`
- Create: `src/vps/services/WalletLiquidator.ts`
- Create: `src/vps/services/Erc7683Adapter.ts`
- Create: `src/vps/db/SolversRepository.ts`
- Create: `src/contracts/plugins/EmpsealMulticallRouter.sol`

- [ ] Port the handoff basket, ERC-7683, scanner, adapter, and solver directory primitives into the current repo shape.
- [ ] Keep the implementation bounded to single-hop child legs and same-chain swap calls only.
- [ ] Add a wallet-liquidator service on top of `WalletScanner` + `BasketQuoteEngine` rather than inventing a separate planner stack.
- [ ] Port `EmpsealMulticallRouter` as the contract-side batching primitive for selected same-chain grouped execution.

### Task 2: Extend persistence and intent lifecycle for Phase 4

**Files:**
- Modify: `src/vps/types/index.ts`
- Modify: `src/vps/services/IntentService.ts`
- Modify: `src/vps/db/IntentRepository.ts`
- Modify: `src/vps/db/schema.sql`
- Create: `src/vps/db/migrations/20260611_add_phase4_platform_tables.sql`
- Modify: `src/vps/db/schemaCompatibility.ts`

- [ ] Add `parentBasketId` to persisted intents so basket status can roll up child legs without a separate shadow entity.
- [ ] Add basket lookup helpers to `IntentRepository`.
- [ ] Add the `solvers` table to the live schema and migration path.
- [ ] Keep the changes additive so old intents and deployments remain valid.

### Task 3: Wire basket, wallet, solver, and ERC-7683 services into runtime and APIs

**Files:**
- Modify: `src/vps/app/runtime.ts`
- Modify: `src/vps/app/api.ts`
- Modify: `src/vps/api/PartnerAPI.ts`
- Modify: `src/vps/api/StatusAPI.ts`

- [ ] Add partner basket quote/execute/status endpoints.
- [ ] Add partner wallet scan and liquidation quote/execute endpoints.
- [ ] Add partner ERC-7683 resolve/open endpoints.
- [ ] Add solver register/list/update-active surfaces.
- [ ] Mirror the selected platform capabilities on agent-friendly `/api/v1/*` surfaces using `routeSource: 'agent-sdk'`.

### Task 4: Add focused Phase 4 verification

**Files:**
- Create: `tests/vps/basket-quote-engine.test.ts`
- Create: `tests/vps/basket-status-engine.test.ts`
- Create: `tests/vps/wallet-scanner.test.ts`
- Create: `tests/vps/wallet-liquidator.test.ts`
- Create: `tests/vps/erc7683-adapter.test.ts`
- Create: `tests/vps/partner-api-phase4.test.ts`
- Create: `tests/vps/status-api-phase4.test.ts`
- Modify: `tests/vps/postgres-schema-compat.test.ts`
- Modify: `tests/vps/db-migrate-runner.test.ts`

- [ ] Add focused service tests for basket quoting/status, wallet scan/liquidation, and ERC-7683 flows.
- [ ] Add API tests for partner and agent-facing Phase 4 endpoints.
- [ ] Extend DB migration/schema tests for `parent_basket_id` and `solvers`.

### Task 5: Verify and refresh project graph

- [ ] Run the focused Phase 4 test slice.
- [ ] Run `graphify update .`
- [ ] Report remaining repo-wide regressions separately from the new Phase 4 work.
