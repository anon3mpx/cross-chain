// ─────────────────────────────────────────────────────────────────────────────
// swapAdapter — bridges the published `empx-swap-sdk-beta` (single-chain DEX
// router, calldata-only) into the cross-bridge runtime.
//
// Why this exists:
//   The beta SDK already does a great job at single-chain swaps across the 14
//   EMPX-native chains.  We DON'T want to duplicate it — we want to call it
//   when the source and destination chain are the same (or after a rail has
//   delivered tokens to the destination chain and we need the final hop).
//
// What this module adds on top of the beta SDK:
//   1. Routes the beta SDK's RPC calls through our `CachingProvider`, so a
//      single-chain swap quote benefits from the same 3-tier pool + cache +
//      in-flight dedup as cross-chain quotes.
//   2. Picks `createRouter` vs `createAffiliateRouter` based on
//      `ctx.integratorId` + the chain's affiliate support so revenue
//      attribution flows ALL the way to calldata level.
//   3. Surfaces the beta SDK's `EmpxError` / `ERROR_CODES` shape so the
//      cross-bridge can adopt the same agent-friendly error contract.
// ─────────────────────────────────────────────────────────────────────────────

import {
  createRouter,
  createAffiliateRouter,
  CHAIN_IDS,
  getSupportedChainIds,
  type EmpxRouter,
  type EmpxAffiliateRouter,
  type SwapResult,
  type TradeInfo,
} from 'empx-swap-sdk-beta';

import type { Provider } from 'ethers';
import type { ExecutionContext } from '../core/ExecutionContext';
import type { RpcProviderRegistry } from '../services/RpcProviderRegistry';

/**
 * Chains where the on-chain integrator/affiliate router variant is deployed.
 * Source of truth: README of empx-swap-sdk-beta v1.0.2 — PulseChain, Sonic,
 * Base, Monad.  When more chains gain the affiliate router on-chain, extend
 * this set (and we'll fall back automatically when an integratorId is set
 * for a chain that doesn't yet support affiliate routing).
 */
const AFFILIATE_SUPPORTED_CHAINS: ReadonlySet<number> = new Set<number>([
  CHAIN_IDS.PULSECHAIN,
  CHAIN_IDS.SONIC,
  CHAIN_IDS.BASE,
  CHAIN_IDS.MONAD,
]);

export function isSwapSdkChain(chainId: number): boolean {
  // empx-swap-sdk-beta exports getSupportedChainIds() at runtime; cache it.
  return CACHED_SUPPORTED_IDS.has(chainId);
}
const CACHED_SUPPORTED_IDS = new Set<number>(getSupportedChainIds());

export interface SwapAdapterOptions {
  registry: RpcProviderRegistry;
}

export interface SingleChainQuoteRequest {
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string | bigint;
  recipient: string;
  maxSteps?: number;
  slippageBps?: number;
}

/**
 * SwapAdapter — call surface used by the UnifiedExecute dispatcher.
 *
 * Every method here:
 *   • Builds a per-call ethers Provider that points at our CachingProvider
 *     (so reads hit the shared cache + 3-tier RPC pool).
 *   • Selects createAffiliateRouter when ctx.integratorId is present AND the
 *     chain supports affiliate routing on-chain; otherwise plain createRouter.
 *   • Caches the per-(chainId, mode) router instance per process to amortise
 *     instantiation, but never caches across distinct integratorIds.
 */
export class SwapAdapter {
  private readonly registry: RpcProviderRegistry;
  private readonly routerCache = new Map<string, EmpxRouter | EmpxAffiliateRouter>();

  constructor(opts: SwapAdapterOptions) {
    this.registry = opts.registry;
  }

  /**
   * Get a router scoped to (chain, integratorId).  Returns an
   * EmpxAffiliateRouter if the integrator is set and the chain supports it,
   * otherwise EmpxRouter.  Both share the swap surface used below.
   */
  getRouter(chainId: number, ctx?: ExecutionContext): EmpxRouter | EmpxAffiliateRouter {
    if (!isSwapSdkChain(chainId)) {
      throw new Error(
        `SwapAdapter: chain ${chainId} not supported by empx-swap-sdk-beta. ` +
        `Use the cross-chain rail layer instead.`,
      );
    }

    const useAffiliate =
      !!ctx?.integratorId && AFFILIATE_SUPPORTED_CHAINS.has(chainId);
    const cacheKey = useAffiliate
      ? `aff:${chainId}:${ctx!.integratorId}`
      : `plain:${chainId}`;
    const hit = this.routerCache.get(cacheKey);
    if (hit) return hit;

    // Build the ethers Provider that hands every read to our cache + pool.
    // CachingProvider.asEthersProvider() returns a Provider that internally
    // routes _perform() through the pool.
    const provider = this.buildEthersProvider(chainId, ctx);

    const router = useAffiliate
      ? createAffiliateRouter(chainId, ctx!.integratorId!, provider)
      : createRouter(chainId, provider);

    this.routerCache.set(cacheKey, router);
    return router;
  }

  /** Get a trade quote — same-chain swap. */
  async quote(req: SingleChainQuoteRequest, ctx?: ExecutionContext): Promise<TradeInfo> {
    const router = this.getRouter(req.chainId, ctx);
    return router.getTradeInfo(
      req.amountIn,
      req.tokenIn,
      req.tokenOut,
      req.maxSteps ?? 3,
      req.slippageBps ?? 50, // 0.5% default — tighter than the beta SDK's 200
    );
  }

  /** Build the full swap payload (tradeInfo + calldata + swapType). */
  async swap(req: SingleChainQuoteRequest, ctx?: ExecutionContext): Promise<SwapResult> {
    const router = this.getRouter(req.chainId, ctx);
    return router.swap(
      req.amountIn,
      req.tokenIn,
      req.tokenOut,
      req.recipient,
      req.maxSteps ?? 3,
      req.slippageBps ?? 50,
    );
  }

  /** Approval helper — common pre-swap check exposed for parity. */
  async checkAllowance(
    chainId: number,
    tokenAddress: string,
    ownerAddress: string,
    requiredAmount: string | bigint,
    ctx?: ExecutionContext,
  ) {
    return this.getRouter(chainId, ctx).checkAllowance(tokenAddress, ownerAddress, requiredAmount);
  }

  private buildEthersProvider(chainId: number, ctx?: ExecutionContext): Provider {
    // Use the cached, pool-backed provider for this chain.  If ctx supplies
    // BYO RPC endpoints they are layered on at the top tier by the registry.
    return this.registry.getProvider(chainId, ctx).asEthersProvider() as unknown as Provider;
  }
}
