// ─────────────────────────────────────────────────────────────────────────────
// RailReliabilityCache — synchronous read surface over `route_outcomes`.
//
// RailSelector advertises <1ms scoring and is on the hot path of every quote.
// We can't hit Postgres there.  This class periodically refreshes a snapshot
// of `windowedRailStats(...)` and exposes a sync getter that RailSelector
// reads at scoring time.
//
// When the snapshot is empty (e.g. cold start, no Postgres, < N samples), the
// getter returns `undefined` and RailSelector falls back to the static
// reliability score on RailConfig.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReliabilityRepository, RailReliabilityStats } from '../db/ReliabilityRepository';

export interface RailReliabilityCacheOptions {
  /** Reliability lookback window for the rolling stats query. */
  windowMs?: number;
  /** Refresh cadence. */
  refreshIntervalMs?: number;
  /** Minimum total samples before we trust the data over static config. */
  minSamples?: number;
}

export interface RailReliabilityView {
  rail: string;
  successRate: number;
  p50ActualEtaS: number | null;
  total: number;
}

export class RailReliabilityCache {
  private readonly windowMs: number;
  private readonly refreshIntervalMs: number;
  private readonly minSamples: number;
  private snapshot = new Map<string, RailReliabilityView>();
  private timer: NodeJS.Timeout | null = null;
  private inFlight = false;

  constructor(
    private readonly repo: ReliabilityRepository,
    opts: RailReliabilityCacheOptions = {},
  ) {
    this.windowMs          = opts.windowMs          ?? 7 * 24 * 60 * 60 * 1000; // 7 days
    this.refreshIntervalMs = opts.refreshIntervalMs ?? 60_000;
    this.minSamples        = opts.minSamples        ?? 25;
  }

  start(): void {
    if (this.timer) return;
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), this.refreshIntervalMs);
    // unref so this doesn't pin the event loop in CLI / test contexts
    (this.timer as unknown as { unref?: () => void }).unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Sync getter for RailSelector hot path.  Returns undefined for unseen
   *  rails or rails with too few samples to trust. */
  get(rail: string): RailReliabilityView | undefined {
    const view = this.snapshot.get(rail.toUpperCase());
    if (!view) return undefined;
    if (view.total < this.minSamples) return undefined;
    return view;
  }

  /** All rails in the current snapshot.  Used by /admin/reliability. */
  list(): RailReliabilityView[] {
    return Array.from(this.snapshot.values());
  }

  private async refresh(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      const stats: RailReliabilityStats[] = await this.repo.windowedRailStats(this.windowMs);
      const next = new Map<string, RailReliabilityView>();
      for (const s of stats) {
        next.set(s.rail.toUpperCase(), {
          rail: s.rail,
          successRate: s.successRate,
          p50ActualEtaS: s.p50ActualEtaS,
          total: s.total,
        });
      }
      this.snapshot = next;
    } catch (err) {
      // Non-fatal — leave the previous snapshot in place.
      console.warn('[RailReliabilityCache] refresh failed', err);
    } finally {
      this.inFlight = false;
    }
  }
}
