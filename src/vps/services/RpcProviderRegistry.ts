import { JsonRpcProvider } from 'ethers';

import { isRetryableInfraError } from '../app/infraErrors';
import {
  getChainRpcRuntimeConfig,
  resolveChainRpcUrls,
  type RpcWorkload,
} from '../config/chainRuntime';
import type { ExecutionContext, RpcProviderOverrides } from '../core/ExecutionContext';
import { RpcUpstream } from '../core/RpcUpstream';
import { RpcPool } from '../core/RpcPool';
import { RpcCache } from '../core/RpcCache';
import { CachingProvider } from '../core/CachingProvider';
import { getDefaultFreeRpcs } from '../core/defaultFreeRpcs';

type ProviderFactory = (rpcUrl: string, chainId: number) => JsonRpcProvider;

interface RpcProviderRegistryOptions {
  env?: Record<string, string | undefined>;
  now?: () => number;
  providerFactory?: ProviderFactory;
  /** Shared cache for all chains.  Created lazily if omitted. */
  cache?: RpcCache;
  /** Set `true` to skip baking in default free public RPCs (for tests / strict envs). */
  disableFreeRpcs?: boolean;
}

/**
 * RpcProviderRegistry — assembles a 3-tier pool per chain:
 *
 *    [byo]       caller-supplied via ExecutionContext.rpcProviders     ← cycled FIRST
 *    [premium]   env: CHAIN_<id>_RPC_1..5  (QuickNode etc.)            ← main path
 *    [free]      defaultFreeRpcs.ts        (DRPC/LlamaRPC/PublicNode…)  ← fallback rotation
 *
 * The base pool (premium + free) is built once per chain and cached as a
 * long-lived CachingProvider.  When a request carries BYO endpoints, we build
 * a fresh ephemeral CachingProvider whose pool has the BYO upstreams at the
 * top of the tier order — but the SAME RpcCache instance is shared, so cache
 * hits flow freely between BYO and platform requests.
 *
 * Two outcomes:
 *   • Massive cache-hit ratio across a quote burst.
 *   • Premium-first, free-fallback rotation. No single endpoint ever owns the
 *     workload.
 */
export class RpcProviderRegistry {
  private readonly env: Record<string, string | undefined>;
  private readonly now: () => number;
  private readonly providerFactory: ProviderFactory;
  private readonly disableFreeRpcs: boolean;

  /** One per chain, lazily built. */
  private readonly baseProviders = new Map<number, CachingProvider>();
  /** Shared across every provider so dedup / cache hits cross-pollinate. */
  private readonly cache: RpcCache;

  /** Cooldown state for legacy `getPollingRpcUrl` workload selection. */
  private readonly endpointState = new Map<string, { cooldownUntil: number }>();

  constructor(options: RpcProviderRegistryOptions = {}) {
    this.env = options.env ?? process.env;
    this.now = options.now ?? (() => Date.now());
    this.providerFactory = options.providerFactory
      ?? ((rpcUrl, chainId) => new JsonRpcProvider(rpcUrl, chainId, { staticNetwork: true }));
    this.cache = options.cache ?? new RpcCache();
    this.disableFreeRpcs =
      options.disableFreeRpcs ?? this.env.DISABLE_FREE_RPCS === '1';
  }

  /** Diagnostic — used by /admin/rpc/snapshot. */
  snapshot(chainId: number): {
    pool: ReturnType<RpcPool['snapshot']>;
    cacheSize: number;
    inflight: number;
  } {
    const cp = this.getBaseProvider(chainId);
    return {
      pool: cp.poolSnapshot(),
      cacheSize: this.cache.size(),
      inflight: this.cache.inflightSize(),
    };
  }

  /** Shared cache accessor — services can hint cache invalidation here. */
  getCache(): RpcCache { return this.cache; }

  // ── Public surface ────────────────────────────────────────────────────────

  /**
   * Primary entry point — returns a chain-scoped provider that performs
   * caching, dedup, and pool rotation transparently.
   *
   * If `ctx.rpcProviders[chainId]` is set, the returned provider has those
   * endpoints layered on top as the `byo` tier and is ephemeral to the call.
   * Otherwise we return the long-lived base provider for the chain.
   */
  getProvider(chainId: number, ctx?: ExecutionContext): CachingProvider {
    const byoEndpoints = collectByoEndpoints(ctx?.rpcProviders, chainId);
    if (byoEndpoints.length === 0) {
      return this.getBaseProvider(chainId);
    }
    return this.buildEphemeralProvider(chainId, byoEndpoints);
  }

  /**
   * Legacy adapter — many services type-against ethers `JsonRpcProvider`.
   * For now they keep working via a direct ethers provider on the first
   * resolved upstream; over time those call-sites migrate to `getProvider()`
   * + `CachingProvider.send()` for cache benefits.
   *
   * @deprecated prefer `getProvider(chainId, ctx).send(...)`.
   */
  getReadProvider(chainId: number, ctx?: ExecutionContext): JsonRpcProvider {
    const override = pickEthersOverride(ctx?.rpcProviders, chainId);
    if (override) {
      return typeof override === 'string'
        ? this.providerFactory(override, chainId)
        : override;
    }
    const rpcUrl = this.selectRpcUrl(chainId, 'read');
    return this.providerFactory(rpcUrl, chainId);
  }

  getRpcUrls(chainId: number, workload: RpcWorkload): string[] {
    return resolveChainRpcUrls(chainId, workload, this.env);
  }

  /**
   * Polling endpoints are intentionally NOT context-overridable: indexers /
   * EventMonitor must read the platform's chosen endpoint so cache + offset
   * tracking stays consistent across workers.
   */
  getPollingRpcUrl(chainId: number): string {
    return this.selectRpcUrl(chainId, 'poll');
  }

  /** Legacy cooldown reporting kept for `getReadProvider` callers. */
  reportFailure(chainId: number, workload: RpcWorkload, rpcUrl: string, err: unknown): void {
    if (!isRetryableInfraError(err)) return;
    const cooldownMs = getChainRpcRuntimeConfig(chainId)?.cooldownMs ?? 30_000;
    this.endpointState.set(this.key(chainId, workload, rpcUrl), {
      cooldownUntil: this.now() + cooldownMs,
    });
  }

  // ── Internal: pool/provider construction ──────────────────────────────────

  private getBaseProvider(chainId: number): CachingProvider {
    let cp = this.baseProviders.get(chainId);
    if (cp) return cp;
    const pool = this.buildBasePool(chainId);
    cp = new CachingProvider({ chainId, pool, cache: this.cache });
    this.baseProviders.set(chainId, cp);
    return cp;
  }

  private buildBasePool(chainId: number): RpcPool {
    const upstreams: RpcUpstream[] = [];
    // Premium tier — env-configured (QuickNode, Alchemy, custom)
    const premium = resolveChainRpcUrls(chainId, 'read', this.env);
    premium.forEach((url, idx) => {
      upstreams.push(new RpcUpstream({
        url, chainId, tier: 'premium', priority: idx,
        cooldownMs: getChainRpcRuntimeConfig(chainId)?.cooldownMs,
        now: this.now,
      }));
    });
    // Free tier — defaults baked in
    if (!this.disableFreeRpcs) {
      const free = getDefaultFreeRpcs(chainId);
      const seen = new Set(premium);
      free.forEach((url, idx) => {
        if (seen.has(url)) return;
        upstreams.push(new RpcUpstream({
          url, chainId, tier: 'free', priority: idx,
          now: this.now,
        }));
      });
    }
    if (upstreams.length === 0) {
      // Late, loud error — surfaces misconfig instead of silently 0-URL pool.
      throw new Error(
        `RpcProviderRegistry: no RPC endpoints for chain ${chainId}. ` +
        `Configure CHAIN_${chainId}_RPC_1 in .env or leave free-rpc defaults enabled.`,
      );
    }
    return new RpcPool({ chainId, upstreams });
  }

  /** Per-call provider when ctx.rpcProviders supplied BYO endpoints. */
  private buildEphemeralProvider(chainId: number, byoUrls: string[]): CachingProvider {
    const base = this.buildBasePool(chainId);
    const byo = byoUrls.map((url, idx) => new RpcUpstream({
      url, chainId, tier: 'byo', priority: idx, now: this.now,
    }));
    const pool = new RpcPool({ chainId, upstreams: [...byo, ...base.list()] });
    return new CachingProvider({ chainId, pool, cache: this.cache });
  }

  private selectRpcUrl(chainId: number, workload: RpcWorkload): string {
    const urls = this.getRpcUrls(chainId, workload);
    if (urls.length === 0) {
      throw new Error(`No RPC URLs configured for chain ${chainId} workload ${workload}`);
    }
    const now = this.now();
    for (const rpcUrl of urls) {
      const state = this.endpointState.get(this.key(chainId, workload, rpcUrl));
      if (!state || state.cooldownUntil <= now) return rpcUrl;
    }
    return urls[0];
  }

  private key(chainId: number, workload: RpcWorkload, rpcUrl: string): string {
    return `${chainId}:${workload}:${rpcUrl}`;
  }
}

function collectByoEndpoints(
  overrides: RpcProviderOverrides | undefined,
  chainId: number,
): string[] {
  if (!overrides) return [];
  const v = overrides[chainId];
  if (!v) return [];
  if (typeof v === 'string') return [v];
  // Pre-built ethers provider given — extract its URL via the standard getter.
  // Not all transports expose a URL (websocket, custom).  If we can't read
  // one, the BYO endpoint is treated as platform-tier via getReadProvider().
  try {
    const conn = (v as unknown as { _getConnection?: () => { url: string } })._getConnection?.();
    return conn?.url ? [conn.url] : [];
  } catch {
    return [];
  }
}

function pickEthersOverride(
  overrides: RpcProviderOverrides | undefined,
  chainId: number,
): string | JsonRpcProvider | undefined {
  if (!overrides) return undefined;
  return overrides[chainId];
}
