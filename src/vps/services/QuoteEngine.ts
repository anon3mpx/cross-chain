// ─────────────────────────────────────────────────────────
// EMPX-Cross-Chain VPS — Quote Engine
// Generates full swap quotes including src swap + rail + dst swap.
// Results are cached 30s to minimise RPC calls.
// ─────────────────────────────────────────────────────────

import { QuoteRequest, QuoteResult, RouteType } from '../types';
import { RAIL_CONFIGS } from './RailSelector';
import { RouteBuilder } from './RouterBuilder';
import { getChainConfig } from '../config/chains';
import { getSettlementTokenAddress, getSwapPluginIdForChain } from '../config/contracts';
import { randomBytes } from 'crypto';

// Simple in-memory cache (replace with Redis at Tier 3+)
interface CacheEntry { result: QuoteResult; expiresAt: number; }
const quoteCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000;
const ZERO_PLUGIN_ID = '0x' + '0'.repeat(64);
const LOWER_HEX_ADDR_RE = /^0x[0-9a-f]{40}$/;

// DEX quote sources per chain (extend as you add aggregators)
type QuoteFn = (tokenIn: string, tokenOut: string, amountIn: bigint) => Promise<bigint>;
const DEX_QUOTE_FNS: Record<number, QuoteFn> = {
  // Populated at startup by DexAdapters — left as stubs here
};

export class QuoteEngine {
  private routeBuilder = new RouteBuilder();

  async getQuote(req: QuoteRequest): Promise<QuoteResult | null> {
    const cacheKey = this._cacheKey(req);
    const cached = quoteCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) return cached.result;

    const result = await this._buildQuote(req);
    if (!result) return null;

    quoteCache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  }

  private async _buildQuote(req: QuoteRequest): Promise<QuoteResult | null> {
    // Resolve destination chain config (would come from a chain registry in production)
    const dstChain = getChainConfig(req.dstChainId);
    if (!dstChain) return null;

    // Build ranked routes and pick the best currently executable route.
    // Note: multi-hop routes need staged intent execution and are not yet
    // encoded by buildRouterCalldata(); skip them here.
    const amountUSD = await this._estimateUSD(req.tokenIn, req.srcChainId, req.amountIn);
    const bestRoute = this.routeBuilder
      .buildRoutes(req.srcChainId, req.dstChainId, amountUSD, req.urgency ?? 'normal')
      .find(r => r.viable && r.hops.length === 1);
    if (!bestRoute) return null;

    const bestHop = bestRoute.hops[0];
    const bestConfig = RAIL_CONFIGS[bestHop.rail];
    const settlementToken = bestHop.settlementTokenOut;
    const srcSwapEnabled = bestRoute.routeType === RouteType.FULL_SWAP || bestRoute.routeType === RouteType.SRC_SWAP;
    const dstSwapEnabled = bestRoute.routeType === RouteType.FULL_SWAP || bestRoute.routeType === RouteType.DST_SWAP;
    const settlementAddrSrc = getSettlementTokenAddress(req.srcChainId, settlementToken);
    if (!settlementAddrSrc) return null;

    // Get src swap quote: tokenIn → settlementToken
    let srcSwapAmount: bigint;
    const srcSwapNeeded = srcSwapEnabled && this._isAddress(req.tokenIn) &&
      req.tokenIn.toLowerCase() !== settlementAddrSrc.toLowerCase();
    if (!srcSwapEnabled) {
      // Source chain has no aggregator; user must provide settlement token directly.
      if (req.tokenIn.toLowerCase() !== settlementAddrSrc.toLowerCase()) return null;
      srcSwapAmount = req.amountIn;
    } else if (!this._isAddress(req.tokenIn)) {
      return null;
    } else if (!srcSwapNeeded) {
      srcSwapAmount = req.amountIn;
    } else {
      const quoted = await this._getSwapQuote(req.srcChainId, req.tokenIn, settlementAddrSrc, req.amountIn);
      if (quoted === null) return null;
      srcSwapAmount = quoted;
    }

    // Get dst swap quote: settlementToken → tokenOut
    const settlementAddrDst = getSettlementTokenAddress(req.dstChainId, settlementToken);
    let dstSwapAmount: bigint;
    const dstSwapNeeded = dstSwapEnabled && !!settlementAddrDst && this._isAddress(req.tokenOut) &&
      req.tokenOut.toLowerCase() !== settlementAddrDst.toLowerCase();
    if (!dstSwapEnabled) {
      // Destination chain has no aggregator; output is settlement token only.
      if (settlementAddrDst && req.tokenOut.toLowerCase() !== settlementAddrDst.toLowerCase()) return null;
      dstSwapAmount = srcSwapAmount;
    } else if (!settlementAddrDst || !this._isAddress(req.tokenOut)) {
      return null;
    } else if (!dstSwapNeeded) {
      dstSwapAmount = srcSwapAmount;
    } else {
      const quoted = await this._getSwapQuote(req.dstChainId, settlementAddrDst, req.tokenOut, srcSwapAmount);
      if (quoted === null) return null;
      dstSwapAmount = quoted;
    }

    // Fee calculation
    const railFeeUSD = bestRoute.totalFeeUSD;
    const protocolFeeUSD = Math.max(0.50, amountUSD * 0.0005);
    const totalFeeUSD = railFeeUSD + protocolFeeUSD;
    const feeRatioBps = BigInt(Math.max(0, Math.round((totalFeeUSD / Math.max(amountUSD, 1)) * 10_000)));
    const feeAmountToken = (req.amountIn * feeRatioBps) / 10_000n;

    const srcSwapPluginId = srcSwapNeeded
      ? (getSwapPluginIdForChain(req.srcChainId) ?? ZERO_PLUGIN_ID)
      : ZERO_PLUGIN_ID;
    if (srcSwapNeeded && srcSwapPluginId === ZERO_PLUGIN_ID) return null;
    const dstSwapPluginId = dstSwapNeeded
      ? (getSwapPluginIdForChain(req.dstChainId) ?? ZERO_PLUGIN_ID)
      : ZERO_PLUGIN_ID;
    if (dstSwapNeeded && dstSwapPluginId === ZERO_PLUGIN_ID) return null;

    // Apply slippage tolerance (0.5%)
    const minAmountOut = (dstSwapAmount * 995n) / 1000n;

    return {
      intentId:        this._makeIntentId(),
      srcChainId:      req.srcChainId,
      dstChainId:      req.dstChainId,
      tokenIn:         req.tokenIn,
      tokenOut:        req.tokenOut,
      amountIn:        req.amountIn,
      estimatedOut:    dstSwapAmount,
      minAmountOut,
      feeAmountUSD:    totalFeeUSD,
      feeAmountToken,
      rail:            bestHop.rail,
      railType:        bestConfig.railType,
      settlementToken,
      etaSeconds:      bestRoute.totalEtaSeconds,
      expiresAt:       Math.floor(Date.now() / 1000) + 30,
      railPluginId:    bestConfig.pluginId,
      swapPluginIdSrc: srcSwapPluginId,
      swapPluginIdDst: dstSwapPluginId,
      swapDataSrc:     srcSwapEnabled ? '0x' : '0x',
      swapDataDst:     dstSwapEnabled ? '0x' : '0x',
      nativeDstAddress: req.nativeDstAddress,
    };
  }

  private async _getSwapQuote(
    chainId: number, tokenIn: string, tokenOut: string, amountIn: bigint
  ): Promise<bigint | null> {
    const quoteFn = DEX_QUOTE_FNS[chainId];
    if (!quoteFn) return null;
    try {
      return await quoteFn(tokenIn, tokenOut, amountIn);
    } catch {
      return null;
    }
  }

  private async _estimateUSD(token: string, _chainId: number, amount: bigint): Promise<number> {
    // Stub: use a price oracle or coingecko in production.
    // Heuristic decimals only for rough route scoring.
    const decimals = this._isStableLike(token) ? 6 : 18;
    return this._bigintToDecimal(amount, decimals);
  }

  private _cacheKey(req: QuoteRequest): string {
    return [
      req.srcChainId,
      req.dstChainId,
      req.tokenIn.toLowerCase(),
      req.tokenOut.toLowerCase(),
      req.amountIn.toString(),
      req.userAddress.toLowerCase(),
      req.nativeDstAddress?.toLowerCase() ?? '',
      req.urgency ?? 'normal',
    ].join(':');
  }

  registerDexQuoteFn(chainId: number, fn: QuoteFn): void {
    DEX_QUOTE_FNS[chainId] = fn;
  }

  private _makeIntentId(): string {
    return `0x${randomBytes(32).toString('hex')}`;
  }

  private _isAddress(value: string): boolean {
    return LOWER_HEX_ADDR_RE.test(value.toLowerCase());
  }

  private _isStableLike(token: string): boolean {
    const t = token.toLowerCase();
    return t.includes('usdc') || t.includes('usdt');
  }

  private _bigintToDecimal(amount: bigint, decimals: number): number {
    const base = 10n ** BigInt(decimals);
    const whole = amount / base;
    const frac = amount % base;
    const clampedWhole = whole > BigInt(Number.MAX_SAFE_INTEGER)
      ? Number.MAX_SAFE_INTEGER
      : Number(whole);
    return clampedWhole + Number(frac) / 10 ** decimals;
  }
}
