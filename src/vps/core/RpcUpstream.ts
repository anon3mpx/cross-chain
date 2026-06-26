// ─────────────────────────────────────────────────────────────────────────────
// RpcUpstream — single endpoint health + budget tracker.
//
// Strategic purpose: every RPC URL is a metered resource we want to use
// carefully.  This object tracks for ONE endpoint:
//   • tier (byo / premium / free) — drives selection priority
//   • cooldown after a transient failure
//   • token-bucket rate limit (so we don't burst-ban free endpoints)
//   • rolling latency window (so a slow but alive endpoint gets deprioritised)
//   • daily call counter (so we can fast-fail premium plan exhaustion)
//
// All counters are in-memory + per-process.  When we scale to multi-instance
// the same shape can later be backed by Redis without changing callers.
// ─────────────────────────────────────────────────────────────────────────────

export type RpcTier = 'byo' | 'premium' | 'free';

export interface RpcUpstreamOptions {
  url: string;
  chainId: number;
  tier: RpcTier;
  /** Lower = preferred within its tier. */
  priority?: number;
  /** Token-bucket capacity (max burst) and refill (per second). */
  rateLimit?: { capacity: number; refillPerSec: number };
  /** Hard daily-call cap.  Set to Infinity to disable. */
  dailyCallCap?: number;
  cooldownMs?: number;
  now?: () => number;
}

const DEFAULTS_BY_TIER: Record<
  RpcTier,
  { rateLimit: { capacity: number; refillPerSec: number }; dailyCap: number; cooldownMs: number }
> = {
  // BYO endpoints belong to the caller — we don't enforce caps on their dime,
  // only a sane burst cap to protect their plan from our bugs.
  byo:     { rateLimit: { capacity: 50,  refillPerSec: 50  }, dailyCap: Infinity, cooldownMs: 15_000 },
  // Premium = QuickNode etc.  Healthy default — overridable per-chain via opts.
  premium: { rateLimit: { capacity: 30,  refillPerSec: 30  }, dailyCap: 5_000_000, cooldownMs: 15_000 },
  // Free public RPCs — protect them from us so we don't get banned.
  free:    { rateLimit: { capacity: 10,  refillPerSec: 5   }, dailyCap: 500_000,   cooldownMs: 60_000 },
};

export class RpcUpstream {
  readonly url: string;
  readonly chainId: number;
  readonly tier: RpcTier;
  readonly priority: number;

  private readonly capacity: number;
  private readonly refillPerSec: number;
  private readonly dailyCap: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;

  // Token bucket state
  private tokens: number;
  private lastRefillMs: number;

  // Health
  private cooldownUntil = 0;
  private consecutiveFailures = 0;

  // Latency: rolling window of last N samples (ms)
  private latencyWindow: number[] = [];
  private static readonly LATENCY_WINDOW_SIZE = 32;

  // Daily counter
  private dayKey: string;
  private dailyCalls = 0;
  // Lifetime counters (cheap, useful for /metrics)
  totalCalls = 0;
  totalFailures = 0;

  constructor(opts: RpcUpstreamOptions) {
    this.url = opts.url;
    this.chainId = opts.chainId;
    this.tier = opts.tier;
    this.priority = opts.priority ?? (opts.tier === 'byo' ? 0 : opts.tier === 'premium' ? 1 : 2);
    this.now = opts.now ?? (() => Date.now());

    const tierDefaults = DEFAULTS_BY_TIER[opts.tier];
    const rl = opts.rateLimit ?? tierDefaults.rateLimit;
    this.capacity = rl.capacity;
    this.refillPerSec = rl.refillPerSec;
    this.dailyCap = opts.dailyCallCap ?? tierDefaults.dailyCap;
    this.cooldownMs = opts.cooldownMs ?? tierDefaults.cooldownMs;

    this.tokens = this.capacity;
    this.lastRefillMs = this.now();
    this.dayKey = this.currentDayKey();
  }

  /**
   * Attempt to reserve a token.  Returns true on success (caller may proceed
   * with the RPC) or false on rate-limit / cooldown / daily-cap.  Caller MUST
   * call reportSuccess / reportFailure afterwards regardless.
   */
  tryAcquire(): { ok: true } | { ok: false; reason: 'cooldown' | 'rate-limit' | 'daily-cap' } {
    const t = this.now();
    if (t < this.cooldownUntil) return { ok: false, reason: 'cooldown' };

    this.rolloverDayIfNeeded();
    if (this.dailyCalls >= this.dailyCap) return { ok: false, reason: 'daily-cap' };

    this.refillTokens(t);
    if (this.tokens < 1) return { ok: false, reason: 'rate-limit' };

    this.tokens -= 1;
    this.dailyCalls += 1;
    this.totalCalls += 1;
    return { ok: true };
  }

  reportSuccess(latencyMs: number): void {
    this.consecutiveFailures = 0;
    this.pushLatency(latencyMs);
  }

  reportFailure(err: unknown, retryable: boolean): void {
    this.totalFailures += 1;
    this.consecutiveFailures += 1;
    if (retryable) {
      // Cooldown grows on repeated failures (capped at 5x base).
      const factor = Math.min(this.consecutiveFailures, 5);
      this.cooldownUntil = this.now() + this.cooldownMs * factor;
    }
    void err;
  }

  /** p50 latency in ms, or Infinity if not enough samples. */
  p50LatencyMs(): number {
    if (this.latencyWindow.length < 4) return Infinity;
    const sorted = [...this.latencyWindow].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  inCooldown(): boolean {
    return this.now() < this.cooldownUntil;
  }

  snapshot(): {
    url: string; tier: RpcTier; priority: number;
    inCooldown: boolean; cooldownUntilMs: number;
    p50LatencyMs: number; dailyCalls: number; dailyCap: number;
    totalCalls: number; totalFailures: number; tokens: number;
  } {
    return {
      url: this.url, tier: this.tier, priority: this.priority,
      inCooldown: this.inCooldown(), cooldownUntilMs: this.cooldownUntil,
      p50LatencyMs: this.p50LatencyMs(),
      dailyCalls: this.dailyCalls, dailyCap: this.dailyCap,
      totalCalls: this.totalCalls, totalFailures: this.totalFailures,
      tokens: Math.floor(this.tokens),
    };
  }

  private refillTokens(t: number): void {
    const elapsedSec = (t - this.lastRefillMs) / 1000;
    if (elapsedSec <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSec * this.refillPerSec);
    this.lastRefillMs = t;
  }

  private pushLatency(ms: number): void {
    this.latencyWindow.push(ms);
    if (this.latencyWindow.length > RpcUpstream.LATENCY_WINDOW_SIZE) {
      this.latencyWindow.shift();
    }
  }

  private currentDayKey(): string {
    const d = new Date(this.now());
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
  }

  private rolloverDayIfNeeded(): void {
    const key = this.currentDayKey();
    if (key !== this.dayKey) {
      this.dayKey = key;
      this.dailyCalls = 0;
    }
  }
}
