// ─────────────────────────────────────────────────────────────────────────────
// NativeUsdOracle — lean per-chain USD price source.
//
// Design constraints (from user directive — lean on RPC / VPS / off-chain):
//   • Zero new infrastructure (no Redis, no API keys, no third-party deps)
//   • One RPC read per (chain, TTL) bucket — amortised by CachingProvider
//   • No periodic timer; refresh on read (in-flight-deduped per chain)
//   • Fail-OPEN to static defaults so gas auto-attach degrades gracefully
//     when the swap SDK or RPC is unreachable
//
// Two surfaces:
//   nativeUsd(chainId)               — chain's gas token (consumed by
//                                       DestinationGasAutoFund)
//   tokenUsd(chainId, tokenAddress)  — any ERC20 (consumed by
//                                       BasketQuoteEngine._usdToCoarseWei)
//
// Both share the same backing logic + cache shape — only the cache key
// differs.  Reads return stale-while-revalidate; cold-misses block on one
// refresh; failed refreshes fall back to the static table.
// ─────────────────────────────────────────────────────────────────────────────

import type { ExecutionContext } from '../core/ExecutionContext';
import type { SwapAdapter } from '../sdk/swapAdapter';
import { isSwapSdkChain } from '../sdk/swapAdapter';

/** Conservative starting table — same numbers we already used as inline
 *  defaults in DestinationGasAutoFund.  The oracle treats this as the
 *  cold-start floor; once a chain has been refreshed at least once, the
 *  live value supersedes. */
const STATIC_NATIVE_USD: Record<number, number> = {
  1:        3_000,  // ETH
  10:       3_000,  // OP — ETH gas
  56:         600,  // BSC — BNB
  137:        0.4,  // Polygon — MATIC
  8453:    3_000,   // Base — ETH gas
  42161:   3_000,   // Arbitrum — ETH gas
  43114:      30,   // Avalanche — AVAX
  43113:      30,   // Avalanche Fuji
  534352:  3_000,   // Scroll — ETH gas
  324:     3_000,   // zkSync Era — ETH gas
  59144:   3_000,   // Linea — ETH gas
  5000:        0.5, // Mantle — MNT
  34443:   3_000,   // Mode — ETH gas
  81457:   3_000,   // Blast — ETH gas
  369:       0.00005, // PulseChain — PLS
};

const NATIVE_SENTINEL = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

interface CacheEntry { usd: number; fetchedAt: number; }

export interface NativeUsdOracleOptions {
  swapAdapter: SwapAdapter;
  /** Cache lifetime per entry.  Default 5 minutes — native prices don't
   *  move enough over this window to invalidate auto-attach decisions
   *  (the threshold/topUp envelopes absorb ±5%). */
  ttlMs?: number;
  /** Static fallback table.  Used cold AND on refresh failures. */
  staticNativeUsd?: Record<number, number>;
}

export class NativeUsdOracle {
  private readonly swapAdapter: SwapAdapter;
  private readonly ttlMs: number;
  private readonly staticNativeUsd: Record<number, number>;

  // Two caches keyed differently:
  //   nativeCache  → key = chainId
  //   tokenCache   → key = `${chainId}:${tokenAddress.toLowerCase()}`
  private readonly nativeCache = new Map<number, CacheEntry>();
  private readonly tokenCache  = new Map<string, CacheEntry>();

  // In-flight dedup — concurrent reads on a stale entry collapse to one
  // upstream refresh.  Keys mirror the cache.
  private readonly inflightNative = new Map<number, Promise<void>>();
  private readonly inflightToken  = new Map<string, Promise<void>>();

  // Observability counters — incremented on every read.  Exposed via
  // snapshot() for /admin/oracle.  Cheap: 8 ints, no allocation per read.
  private counters = {
    nativeFreshHit:    0,   // cache hit within TTL
    nativeStaleHit:    0,   // cache hit, stale (background refresh fired)
    nativeColdMiss:    0,   // no entry, blocked on refresh
    nativeRefreshFail: 0,   // refresh path threw
    tokenFreshHit:     0,
    tokenStaleHit:     0,
    tokenColdMiss:     0,
    tokenRefreshFail:  0,
  };

  constructor(opts: NativeUsdOracleOptions) {
    this.swapAdapter = opts.swapAdapter;
    this.ttlMs = opts.ttlMs ?? 5 * 60 * 1000;
    this.staticNativeUsd = opts.staticNativeUsd ?? STATIC_NATIVE_USD;
  }

  /**
   * Native gas-token USD price for `chainId`.  Stale-while-revalidate:
   *   • fresh hit       → returns cached value (~0ms)
   *   • stale hit       → returns stale value + kicks off background refresh
   *   • cold miss       → blocks on one refresh, falls back to static on err
   *   • chain not in swap SDK → returns static default; no RPC
   */
  async nativeUsd(chainId: number, ctx?: ExecutionContext): Promise<number> {
    const now = Date.now();
    const entry = this.nativeCache.get(chainId);

    if (entry && (now - entry.fetchedAt) < this.ttlMs) {
      this.counters.nativeFreshHit++;
      return entry.usd;
    }

    if (entry) {
      // Stale — return immediately, refresh async.
      this.counters.nativeStaleHit++;
      this.refreshNativeAsync(chainId, ctx);
      return entry.usd;
    }

    // Cold — block on one refresh.
    this.counters.nativeColdMiss++;
    try {
      await this.refreshNative(chainId, ctx);
    } catch {
      this.counters.nativeRefreshFail++;
      /* swallowed; fall back below */
    }
    return this.nativeCache.get(chainId)?.usd ?? this.staticNativeUsd[chainId] ?? 0;
  }

  /**
   * Token USD price.  Same stale-while-revalidate pattern.  No static
   * fallback because tokens are too varied for a default table; callers
   * that hit a cold-miss-and-refresh-failure get 0 (and should handle
   * "unknown price" by skipping the conversion, not by assuming $1).
   */
  async tokenUsd(chainId: number, tokenAddress: string, ctx?: ExecutionContext): Promise<number> {
    if (!tokenAddress) return 0;
    const t = tokenAddress.toLowerCase();
    // Native sentinel — defer to nativeUsd path.
    if (t === NATIVE_SENTINEL) return this.nativeUsd(chainId, ctx);

    const key = `${chainId}:${t}`;
    const now = Date.now();
    const entry = this.tokenCache.get(key);

    if (entry && (now - entry.fetchedAt) < this.ttlMs) {
      this.counters.tokenFreshHit++;
      return entry.usd;
    }

    if (entry) {
      this.counters.tokenStaleHit++;
      this.refreshTokenAsync(chainId, tokenAddress, ctx);
      return entry.usd;
    }

    this.counters.tokenColdMiss++;
    try {
      await this.refreshToken(chainId, tokenAddress, ctx);
    } catch {
      this.counters.tokenRefreshFail++;
      /* swallowed */
    }
    return this.tokenCache.get(key)?.usd ?? 0;
  }

  // ── Cache management ─────────────────────────────────────────────────────

  /** Operator surface — wired to /admin/oracle/snapshot.
   *
   *  Returns:
   *    nativeBy   per-chain cache entries with age + USD
   *    tokenBy    per-(chain,token) cache entries with age + USD
   *    sizes      cache cardinality
   *    counters   raw read counters (8 fields)
   *    hitRates   derived from counters:
   *               nativeFreshPct, nativeColdMissPct, nativeFailPct,
   *               tokenFreshPct,  tokenColdMissPct,  tokenFailPct
   *    ttlMs      configured TTL — operator can sanity-check vs ageMs
   *    inflight   { native, token } — current refresh-in-progress counts
   */
  snapshot(): {
    nativeBy: Array<{ chainId: number; usd: number; ageMs: number }>;
    tokenBy:  Array<{ key: string; usd: number; ageMs: number }>;
    sizes:    { native: number; token: number };
    counters: typeof NativeUsdOracle.prototype.counters;
    hitRates: {
      nativeFreshPct:    number;
      nativeColdMissPct: number;
      nativeFailPct:     number;
      tokenFreshPct:     number;
      tokenColdMissPct:  number;
      tokenFailPct:      number;
    };
    ttlMs:    number;
    inflight: { native: number; token: number };
  } {
    const now = Date.now();
    const nativeBy = [...this.nativeCache.entries()].map(([chainId, e]) => ({
      chainId, usd: e.usd, ageMs: now - e.fetchedAt,
    }));
    const tokenBy = [...this.tokenCache.entries()].map(([key, e]) => ({
      key, usd: e.usd, ageMs: now - e.fetchedAt,
    }));
    const c = this.counters;
    const nTot = c.nativeFreshHit + c.nativeStaleHit + c.nativeColdMiss;
    const tTot = c.tokenFreshHit  + c.tokenStaleHit  + c.tokenColdMiss;
    const pct = (n: number, d: number) => d > 0 ? Math.round((n / d) * 10000) / 100 : 0;
    return {
      nativeBy,
      tokenBy,
      sizes:    { native: nativeBy.length, token: tokenBy.length },
      counters: { ...this.counters },
      hitRates: {
        nativeFreshPct:    pct(c.nativeFreshHit,    nTot),
        nativeColdMissPct: pct(c.nativeColdMiss,    nTot),
        nativeFailPct:     pct(c.nativeRefreshFail, nTot),
        tokenFreshPct:     pct(c.tokenFreshHit,     tTot),
        tokenColdMissPct:  pct(c.tokenColdMiss,     tTot),
        tokenFailPct:      pct(c.tokenRefreshFail,  tTot),
      },
      ttlMs: this.ttlMs,
      inflight: { native: this.inflightNative.size, token: this.inflightToken.size },
    };
  }

  /** Reset all counters to zero.  Useful when an operator wants to measure
   *  hit rates over a specific window (call before, snapshot after). */
  resetCounters(): void {
    for (const k of Object.keys(this.counters) as Array<keyof typeof this.counters>) {
      this.counters[k] = 0;
    }
  }

  // ── Internal: refresh paths ──────────────────────────────────────────────

  private refreshNativeAsync(chainId: number, ctx?: ExecutionContext): void {
    if (this.inflightNative.has(chainId)) return;
    const p = this.refreshNative(chainId, ctx)
      .catch(() => undefined)
      .finally(() => { this.inflightNative.delete(chainId); });
    this.inflightNative.set(chainId, p);
  }

  private async refreshNative(chainId: number, ctx?: ExecutionContext): Promise<void> {
    if (!isSwapSdkChain(chainId)) {
      // Chain not covered by the swap SDK — there's no on-chain price
      // path we can use here.  Static default applies.
      return;
    }
    const wnative = this.lookupWrappedNative(chainId);
    if (!wnative) return;

    const router = this.swapAdapter.getRouter(chainId, ctx);
    const price = await router.getTokenPriceUSD(wnative, 3);
    if (price > 0) {
      this.nativeCache.set(chainId, { usd: price, fetchedAt: Date.now() });
    }
  }

  private refreshTokenAsync(chainId: number, tokenAddress: string, ctx?: ExecutionContext): void {
    const key = `${chainId}:${tokenAddress.toLowerCase()}`;
    if (this.inflightToken.has(key)) return;
    const p = this.refreshToken(chainId, tokenAddress, ctx)
      .catch(() => undefined)
      .finally(() => { this.inflightToken.delete(key); });
    this.inflightToken.set(key, p);
  }

  private async refreshToken(chainId: number, tokenAddress: string, ctx?: ExecutionContext): Promise<void> {
    if (!isSwapSdkChain(chainId)) return;
    const key = `${chainId}:${tokenAddress.toLowerCase()}`;
    const router = this.swapAdapter.getRouter(chainId, ctx);
    const price = await router.getTokenPriceUSD(tokenAddress, 3);
    if (price > 0) {
      this.tokenCache.set(key, { usd: price, fetchedAt: Date.now() });
    }
  }

  /** Pull WRAPPED_NATIVE from the swap SDK's getChainConfig.  Cached at
   *  module-init in a tiny in-process map. */
  private lookupWrappedNative(chainId: number): string | undefined {
    if (!_wnativeCache) {
      _wnativeCache = new Map();
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const sdk = require('empx-swap-sdk-beta');
        for (const info of sdk.getAllChains?.() ?? []) {
          if (info.WRAPPED_NATIVE) _wnativeCache.set(Number(info.chainId), info.WRAPPED_NATIVE);
        }
      } catch {
        // Swap SDK not installed (tests / partial deploys) — leave cache empty.
      }
    }
    return _wnativeCache.get(chainId);
  }
}

let _wnativeCache: Map<number, string> | null = null;
