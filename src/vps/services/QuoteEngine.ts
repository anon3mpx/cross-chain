// ─────────────────────────────────────────────────────────
// EMPX-Cross-Chain VPS — Quote Engine
// Generates full swap quotes including src swap + rail + dst swap.
// Results are cached 30s to minimise RPC calls.
// ─────────────────────────────────────────────────────────

import { QuoteRequest, QuoteResult, Rail, SettlementToken, RailScore } from '../types';
import { RailSelector, RAIL_CONFIGS } from './RailSelector';
import { randomUUID } from 'crypto';

// Simple in-memory cache (replace with Redis at Tier 3+)
interface CacheEntry { result: QuoteResult; expiresAt: number; }
const quoteCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000;

// DEX quote sources per chain (extend as you add aggregators)
type QuoteFn = (tokenIn: string, tokenOut: string, amountIn: bigint) => Promise<bigint>;
const DEX_QUOTE_FNS: Record<number, QuoteFn> = {
  // Populated at startup by DexAdapters — left as stubs here
};

export class QuoteEngine {
  private railSelector = new RailSelector();

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

    // Select best rail
    const amountUSD = await this._estimateUSD(req.tokenIn, req.srcChainId, req.amountIn);
    const ranked = this.railSelector.selectRail(
      req.srcChainId, req.dstChainId, dstChain, amountUSD, req.urgency
    );
    if (ranked.length === 0) return null;
    const best: RailScore = ranked[0];

    // Get src swap quote: tokenIn → settlementToken
    const settlementAddrSrc = getTokenAddress(best.settlementToken, req.srcChainId);
    const srcSwapAmount = req.tokenIn.toLowerCase() === settlementAddrSrc.toLowerCase()
      ? req.amountIn
      : await this._getSwapQuote(req.srcChainId, req.tokenIn, settlementAddrSrc, req.amountIn);

    // Get dst swap quote: settlementToken → tokenOut
    const settlementAddrDst = getTokenAddress(best.settlementToken, req.dstChainId);
    const dstSwapAmount = req.tokenOut.toLowerCase() === settlementAddrDst.toLowerCase()
      ? srcSwapAmount
      : await this._getSwapQuote(req.dstChainId, settlementAddrDst, req.tokenOut, srcSwapAmount);

    // Fee calculation
    const railFeeUSD = RAIL_CONFIGS[best.rail].fee;
    const protocolFeeUSD = Math.max(0.50, amountUSD * 0.0005);
    const totalFeeUSD = railFeeUSD + protocolFeeUSD;
    const feeAmountToken = BigInt(Math.round(Number(req.amountIn) * totalFeeUSD / amountUSD));

    // Apply slippage tolerance (0.5%)
    const minAmountOut = (dstSwapAmount * 995n) / 1000n;

    return {
      intentId:        randomUUID(),
      srcChainId:      req.srcChainId,
      dstChainId:      req.dstChainId,
      tokenIn:         req.tokenIn,
      tokenOut:        req.tokenOut,
      amountIn:        req.amountIn,
      estimatedOut:    dstSwapAmount,
      minAmountOut,
      feeAmountUSD:    totalFeeUSD,
      feeAmountToken,
      rail:            best.rail,
      settlementToken: best.settlementToken,
      etaSeconds:      best.config.etaSeconds,
      expiresAt:       Math.floor(Date.now() / 1000) + 30,
      railPluginId:    best.config.pluginId,
      swapPluginIdSrc: getSwapPluginId(req.srcChainId),
      swapPluginIdDst: getSwapPluginId(req.dstChainId),
      swapDataSrc:     '0x', // Populated by DEX adapter in production
      swapDataDst:     '0x',
    };
  }

  private async _getSwapQuote(
    chainId: number, tokenIn: string, tokenOut: string, amountIn: bigint
  ): Promise<bigint> {
    const quoteFn = DEX_QUOTE_FNS[chainId];
    if (!quoteFn) throw new Error(`No DEX quote function for chain ${chainId}`);
    return quoteFn(tokenIn, tokenOut, amountIn);
  }

  private async _estimateUSD(token: string, chainId: number, amount: bigint): Promise<number> {
    // Stub: use a price oracle or coingecko in production
    return Number(amount) / 1e6; // Assume USDC-like 6 decimals for now
  }

  private _cacheKey(req: QuoteRequest): string {
    return `${req.srcChainId}:${req.dstChainId}:${req.tokenIn}:${req.tokenOut}:${req.amountIn}`;
  }

  registerDexQuoteFn(chainId: number, fn: QuoteFn): void {
    DEX_QUOTE_FNS[chainId] = fn;
  }
}

// ── Stubs — replace with your chain/token registry ───────────────────────────
function getChainConfig(chainId: number) {
  // Return chain config from your registry
  return null as any;
}
function getTokenAddress(token: SettlementToken, chainId: number): string {
  // Return token contract address for this chain
  return '0x0';
}
function getSwapPluginId(chainId: number): string {
  return '0x0';
}
