# Partner API Service Split And WebSocket Plan

> Date: June 8, 2026
> Scope: implemented serving model for frontend/status APIs, partner APIs, and WebSocket status streaming; recommended split into separate subdomains/services

## Purpose

This note records the current runtime topology in `ruflo`, what is actually
being served today, and the boundary between:

- app-facing APIs for the EMPX frontend/dapp
- partner-facing APIs for external integrators
- optional real-time streaming infrastructure

The goal is to keep `crosschain.empx.io` reserved for EMPX-owned frontend and
status flows while making partner exposure explicit, isolated, and easier to
operate.

## Current Status

### 1. Main HTTP app

The main HTTP server is built in:

- `src/vps/app/api.ts`

It currently:

- builds the base Express app from `buildStatusAPI(...)`
- mounts admin routes under `/admin`
- does not mount partner routes
- listens on one host and one port

Relevant code:

- `src/vps/app/api.ts`
- `src/vps/app/http.ts`

### 2. Status/public REST surface

`buildStatusAPI(...)` returns the main Express application and mounts its REST
router in two places:

- `/api/v1/*`
- root `/*`

Relevant code:

- `src/vps/api/StatusAPI.ts:678`
- `src/vps/api/StatusAPI.ts:679`

This means the current app-facing/public API surface is tied directly to the
main HTTP service.

### 3. Partner REST surface

Partner endpoints are implemented in:

- `src/vps/api/PartnerAPI.ts`

They are served by a dedicated partner process:

- `src/vps/app/partner-api.ts`

The partner process enables `buildRuntime({ enablePartnerApi: true })`, mounts
the partner router under `/partner`, and applies partner-specific CORS from
`PARTNER_API_CORS_ORIGIN`.

Runtime wiring:

- `src/vps/app/partner-api.ts`
- `src/vps/app/runtime.ts`

Mount point:

- `src/vps/app/http.ts`

So, when `partners.empx.io` is routed to the partner service, these routes exist
on the partner host:

- `POST /partner/register`
- `POST /partner/quote`
- `POST /partner/swap-single-chain`
- `POST /partner/quote/select`
- `GET /partner/intent/:id`
- `GET /partner/rebates`
- `POST /partner/withdraw`
- `POST /partner/webhook/test`

### 4. WebSocket status streaming

WebSocket support exists in code:

- `src/vps/api/WebSocketAPI.ts`

This is a separate `ws` server with its own port. It is not mounted into the
Express app.

Important current fact:

- as of this note, `WebSocketAPI` is not instantiated by runtime or the main
  API server
- it is only instantiated in tests

Evidence:

- `tests/vps/websocket-api.test.ts:37`
- no production instantiation found under `src/`

### 5. Current auth model

Partner REST:

- uses `x-api-key`

Partner WebSocket:

- uses API-key auth via `Sec-WebSocket-Protocol`
- accepts `rflo-auth` plus the partner API key
- still supports query-string fallback in the implementation

Relevant code:

- `src/vps/api/WebSocketAPI.ts:32`
- `src/vps/api/WebSocketAPI.ts:47`
- `src/vps/api/WebSocketAPI.ts:140`

## What This Means Operationally

Today there is no true frontend/partner service split.

The codebase currently supports:

- one main HTTP service for status/public routes
- optional partner REST mounted into that same service
- optional WebSocket code that exists separately but is not actually started

So the current design is service-collocated even though the route prefixes are
separate.

## Recommended Target Topology

### 1. Subdomain split

Recommended public topology:

- `crosschain.empx.io`
  - EMPX frontend-facing REST only
  - app-owned polling/status/quote flows
- `partners.empx.io`
  - partner REST only
  - API-key protected
- no public WebSocket hostname initially

This preserves `crosschain.empx.io` as the EMPX-controlled application API
surface and avoids mixing partner onboarding concerns into the frontend domain.

### 2. Service split

Implemented runtime split:

- Service A: frontend/status service
  - mounts `buildStatusAPI(...)`
  - mounts `/admin` only if needed internally
  - does not mount partner routes
- Service B: partner API service
  - mounts `buildPartnerAPI(...)`
  - does not mount app/public status routes except partner-specific intent
    status endpoints intentionally exposed by PartnerAPI

This should be implemented as two separate server entrypoints even if both
reuse the same underlying runtime components.

Reason:

- cleaner domain ownership
- separate rate limits
- separate CORS policy
- separate WAF/proxy rules
- easier incident isolation
- less accidental exposure of partner-only routes on the frontend host

### 3. WebSocket position

Recommended position for now:

- do not make WebSocket part of the initial partner launch
- do not serve WebSocket from `crosschain.empx.io`
- keep polling as the default integration model

Reason:

- it is not currently running in production wiring
- partner tracking already has REST polling via `GET /partner/intent/:id`
- webhook push exists as the more natural async mechanism for partners
- WebSocket adds operational complexity without being necessary for initial
  partner integration

## Why WebSocket Is Optional

Partner integrations typically need one of these patterns:

1. synchronous quote + intent creation
2. status polling
3. webhook callbacks on state change

For most partners, polling plus webhook is enough.

WebSocket becomes useful only when at least one of these is true:

- a partner has many simultaneous live intents and wants lower polling load
- a partner has a trading UI that needs near-real-time status transitions
- webhook delivery is not sufficient for their UX

That is not a prerequisite for separating partner REST into its own service.

## Recommended Rollout Order

### Phase A: split REST surfaces

Implemented two server entrypoints:

- `src/vps/app/api.ts`
- `src/vps/app/partner-api.ts`

Expected behavior:

- `crosschain.empx.io` serves only frontend/status/public REST
- `partners.empx.io` serves only partner REST

### Phase B: move proxy/ingress rules

The Docker/Caddy profile now supports:

- route `crosschain.empx.io` to the frontend/status service
- route `partners.empx.io` to the partner service

Keep independent:

- rate limits
- CORS
- cache/proxy behavior
- security headers if desired

### Phase C: harden partner service further

Before broad partner exposure:

- remove any remaining query-string auth fallback for websocket if websocket is
  ever enabled
- set `VPS_CORS_ORIGIN` for app-facing browser origins
- set `PARTNER_API_CORS_ORIGIN` for partner-facing browser origins
- tune partner-specific quote and write limits separately from app/public limits
- consider partner-only logging, audit trails, and API analytics

### Phase D: add streaming only if justified

If real-time streaming becomes necessary, add a dedicated streaming hostname:

- `stream.partners.empx.io`

This should remain a separate decision from the REST service split.

## Future Improvements

### 1. Partner-specific CORS and rate limiting

Partner service middleware is independent of `buildStatusAPI(...)`.

Recommended partner-service controls:

- explicit allowed origins for approved browser-based partner integrations
- stricter body-size limits
- partner-specific quote and write limits
- separate abuse controls from frontend traffic

### 2. Keep `crosschain.empx.io` app-focused

Longer-term, the frontend domain should avoid carrying partner onboarding or
partner admin behaviors.

That means:

- no `/partner/*` on `crosschain.empx.io`
- no partner-key websocket on `crosschain.empx.io`
- no mixed public docs that imply the same host is for both dapp and partners

### 4. Webhook-first partner async model

For partners, prefer:

- `POST /partner/quote`
- `POST /partner/quote/select`
- `GET /partner/intent/:id` for polling
- webhook push for settlement/failure transitions

This keeps the partner integration model simpler than introducing real-time
streaming immediately.

### 5. Only add partner WebSocket after a concrete need

If partner websocket is later approved:

- serve it from a partner-specific streaming hostname
- remove query-string API key fallback
- keep protocol auth only
- scope subscriptions carefully
- add connection quotas and idle timeouts

It should be treated as a new product surface, not as a default part of the
partner REST rollout.

## Final Recommendation

The clean production direction is:

- keep `crosschain.empx.io` for EMPX-owned frontend/dapp traffic
- move partner REST to a separate hostname and separate service
- do not expose WebSocket to partners initially
- revisit WebSocket only if polling plus webhooks proves insufficient

This gives the desired separation without changing the core quote engine or
the core cross-chain routing model.
