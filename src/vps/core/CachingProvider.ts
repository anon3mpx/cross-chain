// ─────────────────────────────────────────────────────────────────────────────
// CachingProvider — ethers v6 JsonRpcProvider that runs every read through
//                   the RpcPool (with rotation) and the RpcCache (with dedup).
//
// One CachingProvider instance represents ONE logical "chain provider" for a
// given chainId.  It owns the pool + cache references; per-call it picks the
// next viable upstream and short-circuits on cache hits / in-flight dedup.
//
// This intentionally does NOT subclass JsonRpcProvider (ethers v6 routes
// most calls through `_perform` which is protected and hard to wrap cleanly
// across versions).  We delegate to a child JsonRpcProvider per upstream.
// Callers that needed the ethers Provider surface get a thin facade in
// `asEthersProvider()`.  Heavy reads should call `send()` directly.
// ─────────────────────────────────────────────────────────────────────────────

import { JsonRpcProvider, AbstractProvider } from 'ethers';
import type { RpcPool } from './RpcPool';
import type { RpcCache } from './RpcCache';

export interface CachingProviderOptions {
  chainId: number;
  pool: RpcPool;
  cache: RpcCache;
  /** Per-upstream timeout in ms. */
  callTimeoutMs?: number;
  /** Max retries across upstreams if the pool returns transient failures. */
  maxRetries?: number;
}

export class CachingProvider {
  readonly chainId: number;
  private readonly pool: RpcPool;
  private readonly cache: RpcCache;
  private readonly callTimeoutMs: number;
  private readonly maxRetries: number;
  // Lazy JsonRpcProvider per upstream URL — built on first use.
  private readonly providerByUrl = new Map<string, JsonRpcProvider>();

  constructor(opts: CachingProviderOptions) {
    this.chainId = opts.chainId;
    this.pool = opts.pool;
    this.cache = opts.cache;
    this.callTimeoutMs = opts.callTimeoutMs ?? 4_000;
    this.maxRetries = opts.maxRetries ?? 3;
  }

  /**
   * Primary entry point — JSON-RPC method call with cache + dedup + pool
   * rotation.  Matches the ethers `Provider.send(method, params)` shape.
   */
  async send(method: string, params: unknown[] = []): Promise<unknown> {
    return this.cache.wrap(this.chainId, method, params, () => this.sendUncached(method, params));
  }

  /** Cache snapshot for /admin/rpc/cache. */
  poolSnapshot() { return this.pool.snapshot(); }

  /**
   * Returns a minimal AbstractProvider facade so legacy code that types
   * against `ethers.Provider` keeps working.  All `_perform` / `_send`
   * paths route back through `this.send` and inherit cache + dedup.
   *
   * The facade DOES NOT support `on()` / event subscriptions — those use a
   * dedicated polling path (see EventMonitor) where caching would be wrong.
   */
  asEthersProvider(): AbstractProvider {
    const self = this;
    // Use the first concrete provider as the "type stub" for ethers internals
    // (it needs Network details on construction).  We can't avoid building
    // one — but it never receives a request.
    // ethers v6 AbstractProvider._perform is generic with a `<T = any>`
    // return type.  We satisfy it by returning `any` (cast'd) — the runtime
    // shape is the same, the generic is just for caller-side ergonomics.
    class Facade extends AbstractProvider {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      override async _perform(req: { method: string; params?: unknown[] }): Promise<any> {
        return self.send(req.method, req.params ?? []);
      }
    }
    return new Facade(self.chainId);
  }

  // ── Internal: pool-aware uncached send with retry rotation ────────────────

  private async sendUncached(method: string, params: unknown[]): Promise<unknown> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < this.maxRetries; attempt += 1) {
      const sel = await this.pool.pickWaiting();
      if (!sel) {
        throw new Error(
          `RPC pool exhausted for chain ${this.chainId} (all upstreams in cooldown / rate-limited)`,
        );
      }
      const started = Date.now();
      try {
        const upstreamProvider = this.getOrCreateProvider(sel.upstream.url);
        const result = await this.withTimeout(
          upstreamProvider.send(method, params),
          this.callTimeoutMs,
          `RPC ${method} timeout on ${sel.upstream.url}`,
        );
        sel.reportSuccess(Date.now() - started);
        return result;
      } catch (err) {
        sel.reportFailure(err);
        lastErr = err;
        // Try next upstream
        continue;
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new Error(`RPC ${method} failed after ${this.maxRetries} attempts on chain ${this.chainId}`);
  }

  private getOrCreateProvider(url: string): JsonRpcProvider {
    const cached = this.providerByUrl.get(url);
    if (cached) return cached;
    const p = new JsonRpcProvider(url, this.chainId, { staticNetwork: true });
    this.providerByUrl.set(url, p);
    return p;
  }

  private async withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(msg)), ms);
      p.then(
        (v) => { clearTimeout(t); resolve(v); },
        (e) => { clearTimeout(t); reject(e); },
      );
    });
  }
}
