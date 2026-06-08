// ─────────────────────────────────────────────────────────────────────────────
// RpcPool — per-chain ordered pool of upstreams with smart selection.
//
// Strategic purpose:
//   • Cycle BYO → premium → free fallback. Never get stuck on one endpoint.
//   • Skip upstreams that are in cooldown / over rate-limit / over daily cap.
//   • Within a tier, prefer lower p50 latency.
//   • Report success/failure to keep the pool self-healing.
// ─────────────────────────────────────────────────────────────────────────────

import { RpcUpstream, type RpcTier } from './RpcUpstream';
import { isRetryableInfraError } from '../app/infraErrors';

export interface RpcPoolOptions {
  chainId: number;
  upstreams: RpcUpstream[];
}

export interface PoolSelection {
  upstream: RpcUpstream;
  /** Caller invokes one of these once the RPC completes. */
  reportSuccess(latencyMs: number): void;
  reportFailure(err: unknown): void;
}

export class RpcPool {
  readonly chainId: number;
  private readonly upstreams: RpcUpstream[];

  constructor(opts: RpcPoolOptions) {
    this.chainId = opts.chainId;
    this.upstreams = [...opts.upstreams];
  }

  size(): number {
    return this.upstreams.length;
  }

  list(): RpcUpstream[] {
    return [...this.upstreams];
  }

  /** Cheap snapshot for `/admin/rpc/pool` style endpoints. */
  snapshot(): Array<ReturnType<RpcUpstream['snapshot']>> {
    return this.upstreams.map((u) => u.snapshot());
  }

  /**
   * Pick a viable upstream.  Returns `null` if every endpoint is currently
   * unavailable — caller's choice whether to block, throw, or queue.
   *
   * Selection algorithm:
   *   1. Group upstreams by tier in priority order [byo, premium, free].
   *   2. Within each tier, prefer lowest p50 latency (Infinity = unsampled).
   *   3. tryAcquire() — first one that returns ok wins.
   *   4. If no tier has a viable endpoint, return null.
   */
  pick(): PoolSelection | null {
    const tiers: RpcTier[] = ['byo', 'premium', 'free'];
    for (const tier of tiers) {
      const tierGroup = this.upstreams
        .filter((u) => u.tier === tier)
        .sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          return a.p50LatencyMs() - b.p50LatencyMs();
        });

      for (const u of tierGroup) {
        const got = u.tryAcquire();
        if (got.ok) {
          return this.makeSelection(u);
        }
      }
    }
    return null;
  }

  /**
   * Wait-for-pick.  Polls every `pollMs` up to `maxWaitMs` waiting for any
   * upstream to become available again (e.g. token bucket refills).  This is
   * preferable to throwing on transient rate-limits during a burst.
   */
  async pickWaiting(maxWaitMs = 2_000, pollMs = 50): Promise<PoolSelection | null> {
    const deadline = Date.now() + maxWaitMs;
    while (true) {
      const sel = this.pick();
      if (sel) return sel;
      if (Date.now() >= deadline) return null;
      await new Promise((r) => setTimeout(r, pollMs));
    }
  }

  private makeSelection(u: RpcUpstream): PoolSelection {
    return {
      upstream: u,
      reportSuccess: (latencyMs: number) => u.reportSuccess(latencyMs),
      reportFailure: (err: unknown) => u.reportFailure(err, isRetryableInfraError(err)),
    };
  }
}
