# Backend and Frontend Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved backend/VPS and frontend hardening fixes from the validation document without touching Solidity items.

**Architecture:** The work stays narrowly scoped to validated vulnerabilities and reliability gaps. Backend changes preserve compatibility where public clients are affected, while frontend changes default to safer configuration and narrower browser exposure.

**Tech Stack:** TypeScript, Node.js, Express, Redis, ethers, ws, React, Vite, Vitest, Vercel config

---

### Task 1: Backend Red Tests

**Files:**
- Modify: `tests/vps/recovery-engine.test.ts`
- Create: `tests/vps/status-api-signed-actions.test.ts`
- Create: `tests/vps/quote-cache.test.ts`
- Create: `tests/vps/paymaster-service.test.ts`
- Create: `tests/vps/websocket-api.test.ts`
- Modify: `tests/vps/quote-engine-offers.test.ts`

- [ ] Write failing tests for recovery overlap, signed-action replay handling, quote-cache integrity, paymaster cache freshness, websocket auth transport, and provider failure isolation.
- [ ] Run the targeted backend test files and confirm the new assertions fail for the expected reasons.

### Task 2: Backend Implementation

**Files:**
- Modify: `src/vps/services/RecoveryEngine.ts`
- Modify: `src/vps/utils/intentActionAuth.ts`
- Modify: `src/vps/api/StatusAPI.ts`
- Modify: `src/vps/services/QuoteEngine.ts`
- Modify: `src/vps/services/PaymasterService.ts`
- Modify: `src/vps/cache/QuoteCache.ts`
- Modify: `src/vps/api/WebSocketAPI.ts`
- Modify: `src/vps/sdk/EmpxCrossChainSDK.ts`

- [ ] Implement the minimal backend changes to satisfy the new tests.
- [ ] Re-run the targeted backend test files until they pass.

### Task 3: Frontend Hardening

**Files:**
- Modify: `/Users/ganadhish/code/work/EMPSEAL-UI/src/config/rpc.ts`
- Modify: `/Users/ganadhish/code/work/EMPSEAL-UI/src/lib/api/coingecko.ts`
- Modify: `/Users/ganadhish/code/work/EMPSEAL-UI/vercel.json`
- Modify: `/Users/ganadhish/code/work/EMPSEAL-UI/src/pages/landing/FrameCanvas.tsx`
- Modify: `/Users/ganadhish/code/work/EMPSEAL-UI/src/pages/swap/ConnectWallet.jsx`

- [ ] Add targeted frontend tests where practical.
- [ ] Implement the focused frontend changes.
- [ ] Run frontend tests/build for verification.

### Task 4: Verification

**Files:**
- No code changes expected

- [ ] Run the backend targeted tests covering the changed paths.
- [ ] Run the frontend verification commands for the touched app.
- [ ] Review the diff for scope drift before reporting completion.
