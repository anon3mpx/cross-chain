// ─────────────────────────────────────────────────────────────────────────────
// RpcCache — method-aware in-process RPC cache + in-flight deduplication.
//
// Strategic purpose (from notes.txt — "aggressive caching to avoid request
// explosions"):
//
//   Most aggregator workloads are quote-heavy and re-read the same hot data
//   thousands of times per minute: token decimals, chain id, allowance for
//   common pairs, gas price, latest block.  Without caching every quote
//   bursts 10–30 RPC calls into upstream and we pay (or get rate-limited).
//
// Two layers:
//
//   1. RESULT CACHE — keyed on (chainId, method, paramHash, blockTag).  TTL
//      per-method via STRATEGIES table.  Immutable results (eth_chainId,
//      mined-receipt) cached forever.  Latest-state reads cached for a
//      single block-time.  Mutating methods (sendRawTransaction) never
//      cached.
//
//   2. IN-FLIGHT DEDUP — if two concurrent calls hit the same key while the
//      first is still outstanding, they share the pending promise.  This
//      alone collapses 5–10x of duplicate quote-time reads.
//
// LRU-bounded so a long-running process can't OOM.  Default 5,000 entries.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'node:crypto';

export type CacheStrategy =
  | { kind: 'never' }                  // do not cache
  | { kind: 'forever' }                // cache lifetime
  | { kind: 'ttl'; ttlMs: number }     // cache for fixed TTL
  | { kind: 'blockScoped'; ttlMs: number }; // cache keyed on resolved block

export interface RpcCacheOptions {
  maxEntries?: number;
  now?: () => number;
  /**
   * Per-chain default block time (ms).  Used as TTL for blockScoped strategy
   * when the chain isn't found in the table.
   */
  defaultBlockTimeMs?: number;
  /** Per-chain block-time override.  e.g. { 1: 12_000, 8453: 2_000, … } */
  blockTimeMs?: Record<number, number>;
  /** Optional callback for metrics (hit/miss/dedup/skip). */
  onEvent?: (ev: CacheEvent) => void;
}

export type CacheEvent =
  | { type: 'hit'; chainId: number; method: string }
  | { type: 'miss'; chainId: number; method: string }
  | { type: 'dedup'; chainId: number; method: string }
  | { type: 'skip'; chainId: number; method: string; reason: 'never' | 'mutating' };

interface Entry {
  value: unknown;
  expiresAt: number; // Infinity = forever; -1 = no entry (sentinel)
}

/** Method → strategy.  Conservative defaults — extend as we learn workload. */
export const DEFAULT_STRATEGIES: Record<string, CacheStrategy> = {
  // Immutable — cache forever
  eth_chainId:                     { kind: 'forever' },
  net_version:                     { kind: 'forever' },
  eth_getBlockByHash:              { kind: 'forever' },

  // Latest-block reads — cache one block-time
  eth_blockNumber:                 { kind: 'blockScoped', ttlMs: 0 },
  eth_call:                        { kind: 'blockScoped', ttlMs: 0 },
  eth_getBalance:                  { kind: 'blockScoped', ttlMs: 0 },
  eth_getCode:                     { kind: 'blockScoped', ttlMs: 0 },
  eth_getStorageAt:                { kind: 'blockScoped', ttlMs: 0 },
  eth_getTransactionCount:         { kind: 'blockScoped', ttlMs: 0 },

  // Fee market — short TTL, 1-2 blocks
  eth_gasPrice:                    { kind: 'ttl', ttlMs: 3_000 },
  eth_maxPriorityFeePerGas:        { kind: 'ttl', ttlMs: 3_000 },
  eth_feeHistory:                  { kind: 'ttl', ttlMs: 5_000 },

  // Logs — cache when toBlock is bounded (handled in canCacheLogs); short TTL.
  eth_getLogs:                     { kind: 'ttl', ttlMs: 10_000 },

  // Mined receipts/blocks (by NUMBER, not 'latest') are practically immutable.
  // We keep them under a long TTL rather than 'forever' so reorg-affected
  // entries on shallow chains eventually flush.
  eth_getBlockByNumber:            { kind: 'ttl', ttlMs: 60_000 },
  eth_getTransactionByHash:        { kind: 'ttl', ttlMs: 60_000 },
  eth_getTransactionReceipt:       { kind: 'ttl', ttlMs: 60_000 },

  // NEVER cache — mutating or write-path
  eth_sendRawTransaction:          { kind: 'never' },
  eth_sendTransaction:             { kind: 'never' },
  eth_estimateGas:                 { kind: 'never' },
  eth_subscribe:                   { kind: 'never' },
  eth_newFilter:                   { kind: 'never' },
  eth_uninstallFilter:             { kind: 'never' },
};

const FOREVER = Number.POSITIVE_INFINITY;

export class RpcCache {
  private readonly cache = new Map<string, Entry>();
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly maxEntries: number;
  private readonly now: () => number;
  private readonly defaultBlockTimeMs: number;
  private readonly blockTimeMs: Record<number, number>;
  private readonly onEvent?: (ev: CacheEvent) => void;

  constructor(opts: RpcCacheOptions = {}) {
    this.maxEntries = opts.maxEntries ?? 5_000;
    this.now = opts.now ?? (() => Date.now());
    this.defaultBlockTimeMs = opts.defaultBlockTimeMs ?? 6_000;
    this.blockTimeMs = opts.blockTimeMs ?? {
      1:        12_000, // ETH
      8453:      2_000, // Base
      42161:     250,   // Arbitrum (effectively sub-second)
      10:        2_000, // Optimism
      137:       2_000, // Polygon
      56:        3_000, // BSC
      43114:     2_000, // Avalanche
      534352:    3_000, // Scroll
      324:       1_000, // zkSync
      59144:     2_000, // Linea
    };
    this.onEvent = opts.onEvent;
  }

  /**
   * Wrap an upstream fetch with cache + dedup.
   *   • Returns the cached value if fresh.
   *   • Otherwise joins an in-flight request for the same key.
   *   • Otherwise calls fetch() and caches per strategy.
   */
  async wrap<T>(
    chainId: number,
    method: string,
    params: unknown[],
    fetch: () => Promise<T>,
    strategy: CacheStrategy = DEFAULT_STRATEGIES[method] ?? { kind: 'never' },
  ): Promise<T> {
    if (strategy.kind === 'never') {
      this.onEvent?.({ type: 'skip', chainId, method, reason: 'never' });
      return fetch();
    }

    const key = this.key(chainId, method, params);

    // 1. Result cache
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > this.now()) {
      // refresh LRU position
      this.cache.delete(key);
      this.cache.set(key, entry);
      this.onEvent?.({ type: 'hit', chainId, method });
      return entry.value as T;
    }

    // 2. In-flight dedup
    const pending = this.inflight.get(key);
    if (pending) {
      this.onEvent?.({ type: 'dedup', chainId, method });
      return pending as Promise<T>;
    }

    // 3. Fire upstream, then insert under appropriate TTL
    this.onEvent?.({ type: 'miss', chainId, method });
    const p = (async () => {
      try {
        const value = await fetch();
        const expiresAt = this.expiryFor(strategy, chainId);
        if (expiresAt > this.now()) {
          this.cache.set(key, { value, expiresAt });
          this.enforceBound();
        }
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, p);
    return p;
  }

  invalidate(chainId: number, method?: string): void {
    if (!method) {
      for (const k of [...this.cache.keys()]) {
        if (k.startsWith(`${chainId}:`)) this.cache.delete(k);
      }
      return;
    }
    const prefix = `${chainId}:${method}:`;
    for (const k of [...this.cache.keys()]) {
      if (k.startsWith(prefix)) this.cache.delete(k);
    }
  }

  size(): number { return this.cache.size; }
  inflightSize(): number { return this.inflight.size; }

  private expiryFor(strategy: CacheStrategy, chainId: number): number {
    if (strategy.kind === 'forever') return FOREVER;
    if (strategy.kind === 'ttl') return this.now() + strategy.ttlMs;
    if (strategy.kind === 'blockScoped') {
      const blockMs = this.blockTimeMs[chainId] ?? this.defaultBlockTimeMs;
      return this.now() + (strategy.ttlMs > 0 ? strategy.ttlMs : blockMs);
    }
    return -1;
  }

  private key(chainId: number, method: string, params: unknown[]): string {
    // Stable param hash — small (16 hex) so map keys stay light.
    const h = createHash('sha256').update(JSON.stringify(params ?? [])).digest('hex').slice(0, 16);
    return `${chainId}:${method}:${h}`;
  }

  private enforceBound(): void {
    while (this.cache.size > this.maxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }
}
