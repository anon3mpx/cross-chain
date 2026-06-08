# Backend and Frontend Hardening Design

Date: 2026-06-04

## Goal

Apply the validated backend/VPS and frontend fixes from `docs/claude-analysis-validation.md`, excluding all Solidity audit items.

## Scope

This pass is limited to focused hardening with clear local evidence:

- Backend/VPS
  - Signed status-action replay protection
  - Recovery cycle overlap prevention
  - Quote provider failure isolation
  - Paymaster token-rate cache correctness and freshness
  - Rate-limit client IP hardening
  - WebSocket API key transport hardening with compatibility fallback
  - Redis quote-cache integrity checks
- Frontend
  - Remove hardcoded DRPC key
  - Stop implicitly shipping CoinGecko API keys from the browser path
  - Add Vercel security headers
  - Lazy/windowed landing-frame preloading
  - Make the legacy swap wallet modal actionable

## Out of Scope

- Solidity issues and fixes
- Partner API secret-at-rest redesign
- Broad intent state-machine refactors
- Architectural observability work
- Large frontend flow changes beyond validated issues

## Backend Design

### Signed status actions

Current signed actions are timestamp-bound but replayable inside the time window. The fix is to extend the signed payload with a client nonce and derive a stable action id from `intentId`, action, wallet, timestamp, nonce, and action-specific fields. The API will reject previously consumed action ids.

To avoid an unnecessary breaking change, the implementation will support two modes:

- strict mode: nonce required and replay cache enforced
- compatibility mode: legacy signatures allowed only when an env flag permits them

The SDK will emit nonce-bearing signed requests by default.

### Recovery overlap

`RecoveryEngine.start()` currently schedules `_runCycle()` on an interval without guarding against overlap. Add a process-local in-flight guard so a new cycle is skipped while the previous cycle is still running.

### Quote provider isolation

`QuoteEngine._computeOfferSet()` currently uses a top-level `Promise.all` fanout. One provider failure can fail the whole offer-set build. Replace the fanout with isolated settlement so each provider failure degrades only that provider result.

### Paymaster token-rate cache

`PaymasterService` writes rates under `token` and reads them under `${chainId}:${token}`. Fix the write/read key mismatch and enforce cache freshness with a bounded max age before using cached rates.

### Rate-limit client identity

`StatusAPI` currently trusts `cf-connecting-ip` and `x-forwarded-for` directly. Default to socket/Express IP unless an explicit trusted-proxy env toggle is enabled.

### WebSocket auth transport

The SDK currently places the API key in the WebSocket query string. Move the preferred auth path to `Sec-WebSocket-Protocol`, with server support for both protocol-based auth and temporary query-string fallback.

### Quote-cache integrity

Redis-backed quote-cache entries are currently unsigned JSON. Add optional HMAC signing with an env secret. If the secret is absent, preserve current unsigned behavior for compatibility.

## Frontend Design

### DRPC configuration

Remove the hardcoded DRPC public key from browser code. Read the key from Vite env and only construct DRPC URLs when the key exists; otherwise fall back to the chain-specific public RPC URL already passed by callers.

### CoinGecko browser keys

Browser requests should default to anonymous CoinGecko access. Only attach browser-side keys when an explicit env flag opts into that behavior.

### Security headers

Add a Vercel `headers` section with a constrained CSP and baseline browser hardening headers.

### Landing frames

Replace full eager preloading of 240 frame images with windowed loading around the current frame, while still drawing the first frame promptly.

### Legacy swap wallet modal

The current modal renders static wallet rows without actions. Reuse the existing wallet-connect flow so the modal rows invoke real connectors or delegate to the existing wallet popup.

## Testing Strategy

- Add backend tests first for each changed behavior where the repo already has coverage patterns.
- Add frontend tests where the target module is already testable in Vitest; otherwise rely on build verification for narrow configuration changes.
- Prefer focused regression coverage over broad snapshot tests.

## Risks and Constraints

- Signed-action changes touch SDK/API compatibility, so legacy support is gated rather than removed immediately.
- Quote isolation must preserve existing null-degrade behavior for optional providers.
- Vercel CSP must not block the existing app runtime or wallet integrations.
