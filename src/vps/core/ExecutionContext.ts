// ─────────────────────────────────────────────────────────────────────────────
// ExecutionContext — per-call context threaded through the entire stack.
//
// Strategic purpose (from ROADMAP §Sprint 1):
//   • BYO-RPC: integrators / AI agents can supply their own RPC endpoints per
//     call without touching process-wide config. EMPX pays zero RPC cost when
//     the caller brings their own.
//   • Revenue attribution: identify the integrator, the agent, and the partner
//     making the call so reliability + revenue stats can be sliced later.
//   • Idempotency: every mutating call carries a key the server can dedupe on.
//
// This module is intentionally dependency-free so it can be imported by both
// the runtime (services/*) and the SDK without pulling Node-only modules.
// ─────────────────────────────────────────────────────────────────────────────

import type { JsonRpcProvider } from 'ethers';

/**
 * Map of chainId → RPC endpoint (URL string) or a pre-built ethers provider.
 * `Provider` form is useful for tests, custom transports, or callers that want
 * to share a websocket provider across requests.
 */
export type RpcProviderOverrides = Record<number, string | JsonRpcProvider>;

/**
 * Source of the call. Used for revenue attribution and per-source rate limits.
 *   • partner-api  — direct REST/SDK call from a registered partner
 *   • ui           — EMPX-owned front-end
 *   • agent-sdk    — autonomous agent using the agent SDK
 *   • external-solver — inbound from CoW/1inch/Across/deBridge intent network
 *   • internal     — internal worker / recovery / admin
 */
export type RouteSource =
  | 'partner-api'
  | 'ui'
  | 'agent-sdk'
  | 'external-solver'
  | 'internal';

export interface ExecutionContext {
  /** Resolved partner ID (never the raw API key — that is consumed at auth time). */
  partnerId?: string;

  /** Stable integrator identifier (a wallet, an app, a protocol). */
  integratorId?: string;

  /** Agent identifier when the caller is an autonomous agent. */
  agentId?: string;

  /** Provenance of the call — used for attribution + rate limiting buckets. */
  routeSource?: RouteSource;

  /**
   * Per-call RPC overrides. When set for a chain, the runtime MUST prefer the
   * override over platform-default endpoints (QuickNode etc.).
   */
  rpcProviders?: RpcProviderOverrides;

  /** Optional idempotency key for mutating calls (POST / select / cancel). */
  idempotencyKey?: string;

  /** Request-ID for log/metric correlation. Server-generated if absent. */
  requestId?: string;

  /** Wall-clock at request start, ms since epoch. Used for budget checks. */
  receivedAt?: number;
}

/** Sentinel for places that need a non-undefined context. */
export const EMPTY_EXECUTION_CONTEXT: ExecutionContext = Object.freeze({});

/** Convenience helper for tests + internal calls. */
export function makeContext(partial: Partial<ExecutionContext>): ExecutionContext {
  return {
    routeSource: 'internal',
    receivedAt: Date.now(),
    ...partial,
  };
}
