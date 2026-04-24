// ─────────────────────────────────────────────────────────
// EMPX-Cross-Chain VPS — Quote Engine
// Generates full swap quotes including src swap + rail + dst swap.
// Results are cached 30s to minimise RPC calls.
// ─────────────────────────────────────────────────────────

import { AbiCoder, ZeroAddress, getAddress, keccak256 } from 'ethers';
import {
  OfferEconomics,
  OfferSet,
  ProviderAssetRef,
  QuoteRequest,
  QuoteResult,
  Rail,
  RailOffer,
  Route,
  RouteType,
  SettlementToken,
} from '../types';
import { RouteBuilder } from './RouterBuilder';
import { AxelarAssetCatalog, ResolvedAxelarAsset } from './axelar/AxelarAssetCatalog';
import { CHAIN_CONFIGS, getChainConfig } from '../config/chains';
import { getSettlementTokenAddress, getSwapPluginIdForChain } from '../config/contracts';
import { randomBytes } from 'crypto';
import { InMemoryQuoteCache, QuoteCache } from '../cache/QuoteCache';
import {
  THORChainQuoteWorker,
  type THORChainQuoteRequest,
  type THORChainQuoteResult,
} from './thorchain/THORChainQuoteWorker';
import {
  ZERO_PLUGIN_ID,
  getCctpDomain,
  getCctpMetadata,
  getRailConfig,
  isCctpFastPluginId,
} from '../rails/registry';

const CACHE_TTL_MS = 30_000;
const LOWER_HEX_ADDR_RE = /^0x[0-9a-f]{40}$/;
const ROUTER_MAX_FEE_BPS = 100; // RouterV1.MAX_FEE_BPS
const QUOTE_SLIPPAGE_BPS = 50; // 0.5%
const BPS_DENOMINATOR = 10_000n;
const USDC_MICRO_UNITS = 1_000_000n;
const abiCoder = AbiCoder.defaultAbiCoder();

interface CctpFeeRow {
  finalityThreshold: number;
  minimumFee: number; // bps
}

interface CctpPlan {
  railPluginId: string;
  railData: string;
  circleFeeToken: bigint;
}

interface BuiltDirectQuote {
  quote: QuoteResult;
  realizedProviderFeeUSD: number;
  protocolFeeUSD: number;
  outboundFeeUSD?: number;
  axelarDestinationTokenId?: string;
}

export interface OfferSelectionResult {
  offer: RailOffer | null;
  fallbackOfferSet: OfferSet | null;
  reason?: 'OFFER_SET_NOT_FOUND' | 'OFFER_SET_EXPIRED' | 'OFFER_UNAVAILABLE';
}

type QuoteFn = (tokenIn: string, tokenOut: string, amountIn: bigint) => Promise<bigint>;

export interface QuoteEngineDependencies {
  thorchainQuoteWorker?: Pick<THORChainQuoteWorker, 'quote'>;
}

export class QuoteEngine {
  private routeBuilder = new RouteBuilder();
  private readonly cache: QuoteCache;
  private readonly offerCache = new Map<string, { value: OfferSet; expiresAt: number }>();
  private readonly pendingOfferSets = new Map<string, Promise<OfferSet | null>>();
  private readonly dexQuoteFns = new Map<number, QuoteFn>();
  private readonly axelarAssetCatalog = new AxelarAssetCatalog();
  private readonly thorchainQuoteWorker?: Pick<THORChainQuoteWorker, 'quote'>;

  constructor(
    cache: QuoteCache = new InMemoryQuoteCache(),
    deps: QuoteEngineDependencies = {},
  ) {
    this.cache = cache;
    const hasExplicitThorchainWorker = Object.prototype.hasOwnProperty.call(deps, 'thorchainQuoteWorker');
    if (hasExplicitThorchainWorker) {
      this.thorchainQuoteWorker = deps.thorchainQuoteWorker;
      return;
    }
    this.thorchainQuoteWorker = this._readBoolEnv('ENABLE_THORCHAIN_QUOTE_WORKER', true)
      ? new THORChainQuoteWorker()
      : undefined;
  }

  async getOffers(req: QuoteRequest): Promise<OfferSet | null> {
    return this._getCachedOfferSet(req);
  }

  async selectOffer(offerSetId: string, offerId: string): Promise<OfferSelectionResult> {
    const now = Date.now();
    const nowSeconds = Math.floor(now / 1000);

    let matchedSet: OfferSet | null = null;
    for (const [cacheKey, cached] of this.offerCache.entries()) {
      if (cached.expiresAt <= now) {
        this.offerCache.delete(cacheKey);
        continue;
      }
      if (cached.value.offerSetId !== offerSetId) continue;
      matchedSet = cached.value;
      break;
    }
    if (!matchedSet) {
      return { offer: null, fallbackOfferSet: null, reason: 'OFFER_SET_NOT_FOUND' };
    }
    if (matchedSet.expiresAt <= nowSeconds) {
      return { offer: null, fallbackOfferSet: null, reason: 'OFFER_SET_EXPIRED' };
    }

    const validOffers = matchedSet.offers.filter((candidate) => candidate.expiresAt > nowSeconds);
    const selected = validOffers.find((candidate) => candidate.offerId === offerId) ?? null;
    if (selected) {
      return { offer: selected, fallbackOfferSet: null };
    }

    const fallbackOffers = validOffers.filter((candidate) => candidate.offerId !== offerId);
    if (fallbackOffers.length === 0) {
      return { offer: null, fallbackOfferSet: null, reason: 'OFFER_UNAVAILABLE' };
    }

    return {
      offer: null,
      fallbackOfferSet: {
        offerSetId: matchedSet.offerSetId,
        expiresAt: fallbackOffers.reduce((min, candidate) => Math.min(min, candidate.expiresAt), fallbackOffers[0].expiresAt),
        offers: fallbackOffers,
        bestOfferId: fallbackOffers[0].offerId,
      },
      reason: 'OFFER_UNAVAILABLE',
    };
  }

  async getOfferBySelection(offerSetId: string, offerId: string): Promise<RailOffer | null> {
    const selection = await this.selectOffer(offerSetId, offerId);
    return selection.offer;
  }

  async getQuote(req: QuoteRequest): Promise<QuoteResult | null> {
    const cacheKey = this._cacheKey(req);
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const offerSet = await this.getOffers(req);
    if (!offerSet || offerSet.offers.length === 0) return null;

    const quote = this._materializeLegacyQuote(offerSet.offers[0]);
    await this.cache.set(cacheKey, quote, CACHE_TTL_MS);
    return quote;
  }

  private async _buildOffer(
    req: QuoteRequest,
    route: Route,
    amountUSD: number,
  ): Promise<RailOffer | null> {
    const builtQuote = await this._quoteForDirectRoute(req, route, amountUSD);
    if (!builtQuote) return null;

    const { quote: legacyQuote } = builtQuote;

    const economics = this._buildOfferEconomics(route, builtQuote);
    const offer: RailOffer = {
      offerId: legacyQuote.intentId,
      rail: legacyQuote.rail,
      railType: legacyQuote.railType,
      srcChainId: legacyQuote.srcChainId,
      dstChainId: legacyQuote.dstChainId,
      tokenIn: legacyQuote.tokenIn,
      tokenOut: legacyQuote.tokenOut,
      amountIn: legacyQuote.amountIn,
      estimatedOut: legacyQuote.estimatedOut,
      minAmountOut: legacyQuote.minAmountOut,
      expiresAt: legacyQuote.expiresAt,
      sourceSettlementAsset: this._toProviderAssetRef(
        legacyQuote.srcChainId,
        legacyQuote.settlementToken,
        legacyQuote.rail,
      ),
      destinationSettlementAsset: this._toProviderAssetRef(
        legacyQuote.dstChainId,
        legacyQuote.settlementToken,
        legacyQuote.rail,
      ),
      economics,
      execution: {
        quote: legacyQuote,
        feeAmountToken: legacyQuote.feeAmountToken,
        minSrcSwapOut: legacyQuote.minSrcSwapOut,
        providerFeeUSD: builtQuote.realizedProviderFeeUSD,
        protocolFeeUSD: builtQuote.protocolFeeUSD,
        railPluginId: legacyQuote.railPluginId,
        railData: legacyQuote.railData,
        swapPluginIdSrc: legacyQuote.swapPluginIdSrc,
        swapPluginIdDst: legacyQuote.swapPluginIdDst,
        swapDataSrc: legacyQuote.swapDataSrc,
        swapDataDst: legacyQuote.swapDataDst,
        nativeDstAddress: legacyQuote.nativeDstAddress,
        axelarDestinationTokenId: builtQuote.axelarDestinationTokenId,
      },
    };

    return this._enrichThorchainOffer(req, route, offer);
  }

  private async _quoteForDirectRoute(
    req: QuoteRequest,
    route: Route,
    amountUSD: number,
  ): Promise<BuiltDirectQuote | null> {
    const hop = route.hops[0];
    const config = getRailConfig(hop.rail);
    const settlementToken = hop.settlementTokenOut;
    const srcSwapEnabled = route.routeType === RouteType.FULL_SWAP || route.routeType === RouteType.SRC_SWAP;
    const dstSwapEnabled = route.routeType === RouteType.FULL_SWAP || route.routeType === RouteType.DST_SWAP;
    const axelarAsset = this._resolveAxelarAsset(req, hop.rail, settlementToken);
    const settlementAddrSrc = axelarAsset?.sourceSettlementToken
      ?? getSettlementTokenAddress(req.srcChainId, settlementToken, hop.rail);
    if (!settlementAddrSrc) return null;

    const railFeeUSD = route.totalFeeUSD;
    const protocolFeeUSD = Math.max(0.50, amountUSD * 0.0005);
    const totalFeeUSD = railFeeUSD + protocolFeeUSD;
    const feeBpsUncapped = Math.max(0, Math.round((totalFeeUSD / Math.max(amountUSD, 1)) * 10_000));
    const feeRatioBps = BigInt(Math.min(feeBpsUncapped, ROUTER_MAX_FEE_BPS));
    const feeAmountToken = (req.amountIn * feeRatioBps) / BPS_DENOMINATOR;
    if (feeAmountToken >= req.amountIn) return null;
    const amountAfterFee = req.amountIn - feeAmountToken;

    // Get src swap quote: tokenIn → settlementToken
    let srcSwapAmount: bigint;
    const srcSwapNeeded = srcSwapEnabled && this._isAddress(req.tokenIn) &&
      req.tokenIn.toLowerCase() !== settlementAddrSrc.toLowerCase();
    if (!srcSwapEnabled) {
      // Source chain has no aggregator; user must provide settlement token directly.
      if (req.tokenIn.toLowerCase() !== settlementAddrSrc.toLowerCase()) return null;
      srcSwapAmount = amountAfterFee;
    } else if (!this._isAddress(req.tokenIn)) {
      return null;
    } else if (!srcSwapNeeded) {
      srcSwapAmount = amountAfterFee;
    } else {
      const quoted = await this._getSwapQuote(req.srcChainId, req.tokenIn, settlementAddrSrc, amountAfterFee);
      if (quoted === null) return null;
      srcSwapAmount = quoted;
    }
    const minSrcSwapOut = srcSwapNeeded ? (srcSwapAmount * 995n) / 1000n : 0n;

    let railPluginId = config.pluginId;
    let railData = '0x';
    let bridgeAmount = srcSwapAmount;
    let realizedRailFeeUSD = railFeeUSD;
    let outboundFeeUSD: number | undefined;
    if (hop.rail === Rail.CCTP) {
      const cctpPlan = await this._selectCctpPlan(req, srcSwapAmount, config.pluginId);
      railPluginId = cctpPlan.railPluginId;
      railData = cctpPlan.railData;
      if (cctpPlan.circleFeeToken >= srcSwapAmount) return null;
      outboundFeeUSD = this._settlementTokenToUSD(settlementToken, cctpPlan.circleFeeToken);
      realizedRailFeeUSD += outboundFeeUSD;
      bridgeAmount = srcSwapAmount - cctpPlan.circleFeeToken;
    }

    // Get dst swap quote: settlementToken → tokenOut
    const settlementAddrDst = axelarAsset?.expectedDstSettlementToken
      ?? getSettlementTokenAddress(req.dstChainId, settlementToken, hop.rail);
    let dstSwapAmount: bigint;
    const dstSwapNeeded = dstSwapEnabled && !!settlementAddrDst && this._isAddress(req.tokenOut) &&
      req.tokenOut.toLowerCase() !== settlementAddrDst.toLowerCase();
    if (!dstSwapEnabled) {
      // Destination chain has no aggregator; output is settlement token only.
      if (settlementAddrDst && req.tokenOut.toLowerCase() !== settlementAddrDst.toLowerCase()) return null;
      dstSwapAmount = bridgeAmount;
    } else if (!settlementAddrDst || !this._isAddress(req.tokenOut)) {
      return null;
    } else if (!dstSwapNeeded) {
      dstSwapAmount = bridgeAmount;
    } else {
      const quoted = await this._getSwapQuote(req.dstChainId, settlementAddrDst, req.tokenOut, bridgeAmount);
      if (quoted === null) return null;
      dstSwapAmount = quoted;
    }

    const srcSwapPluginId = srcSwapNeeded
      ? (getSwapPluginIdForChain(req.srcChainId) ?? ZERO_PLUGIN_ID)
      : ZERO_PLUGIN_ID;
    if (srcSwapNeeded && srcSwapPluginId === ZERO_PLUGIN_ID) return null;
    const dstSwapPluginId = dstSwapNeeded
      ? (getSwapPluginIdForChain(req.dstChainId) ?? ZERO_PLUGIN_ID)
      : ZERO_PLUGIN_ID;
    if (dstSwapNeeded && dstSwapPluginId === ZERO_PLUGIN_ID) return null;

    const minAmountOut = (dstSwapAmount * (BPS_DENOMINATOR - BigInt(QUOTE_SLIPPAGE_BPS))) / BPS_DENOMINATOR;
    const minSettlementAmount = this._applySlippage(bridgeAmount, QUOTE_SLIPPAGE_BPS);
    const settlementAssetId = axelarAsset?.sourceSettlementAssetId
      ?? this._settlementAssetId(req.srcChainId, settlementAddrSrc);
    const expectedDstSettlementAssetId = axelarAsset?.expectedDstSettlementAssetId
      ?? (settlementAddrDst
        ? this._settlementAssetId(req.dstChainId, settlementAddrDst)
        : this._zeroBytes32());

    return {
      quote: {
        intentId:        this._makeIntentId(),
        srcChainId:      req.srcChainId,
        dstChainId:      req.dstChainId,
        tokenIn:         req.tokenIn,
        tokenOut:        req.tokenOut,
        amountIn:        req.amountIn,
        estimatedOut:    dstSwapAmount,
        minAmountOut,
        minSrcSwapOut,
        feeAmountUSD:    totalFeeUSD,
        feeAmountToken,
        rail:            hop.rail,
        railType:        config.railType,
        settlementToken,
        settlementAssetId,
        expectedDstSettlementToken: settlementAddrDst ?? ZeroAddress,
        expectedDstSettlementAssetId,
        minSettlementAmount,
        etaSeconds:      isCctpFastPluginId(railPluginId) ? Math.min(route.totalEtaSeconds, 8) : route.totalEtaSeconds,
        expiresAt:       Math.floor(Date.now() / 1000) + 120,
        railPluginId,
        railData,
        swapPluginIdSrc: srcSwapPluginId,
        swapPluginIdDst: dstSwapPluginId,
        swapDataSrc:     '0x',
        swapDataDst:     '0x',
        nativeDstAddress: req.nativeDstAddress,
      },
      realizedProviderFeeUSD: realizedRailFeeUSD,
      protocolFeeUSD,
      outboundFeeUSD,
      axelarDestinationTokenId: axelarAsset?.destinationTokenId,
    };
  }

  private _buildOfferEconomics(
    route: Route,
    builtQuote: BuiltDirectQuote,
  ): OfferEconomics {
    const rail = route.hops[0].rail;
    const economics: OfferEconomics = {
      providerFeeUSD: builtQuote.realizedProviderFeeUSD,
      protocolFeeUSD: builtQuote.protocolFeeUSD,
      sourceGasUSD: 0,
      settlementTimeSeconds: builtQuote.quote.etaSeconds,
    };

    if (rail === Rail.CCTP && builtQuote.outboundFeeUSD !== undefined) {
      economics.outboundFeeUSD = builtQuote.outboundFeeUSD;
    }

    return economics;
  }

  private async _enrichThorchainOffer(
    req: QuoteRequest,
    route: Route,
    offer: RailOffer,
  ): Promise<RailOffer | null> {
    if (route.hops[0].rail !== Rail.THORCHAIN || !this.thorchainQuoteWorker) {
      return offer;
    }

    try {
      const thorQuote = await this.thorchainQuoteWorker.quote(
        this._buildThorchainQuoteRequest(req, offer),
      );
      if (!thorQuote) return null;
      return this._applyThorchainQuote(offer, thorQuote);
    } catch {
      // THOR quote enrichment is optional; fall back to base offer if unavailable.
      return offer;
    }
  }

  private _buildThorchainQuoteRequest(
    req: QuoteRequest,
    offer: RailOffer,
  ): THORChainQuoteRequest {
    const executionQuote = offer.execution.quote as QuoteResult | undefined;
    const settlementInputAmount =
      executionQuote?.minSettlementAmount && executionQuote.minSettlementAmount > 0n
        ? executionQuote.minSettlementAmount
        : offer.amountIn;
    const sourceSettlementToken = offer.sourceSettlementAsset.tokenAddress;
    const destinationSettlementToken = offer.destinationSettlementAsset.tokenAddress;
    return {
      amountIn: settlementInputAmount,
      srcChainId: req.srcChainId,
      dstChainId: req.dstChainId,
      tokenIn: req.tokenIn,
      tokenOut: req.tokenOut,
      destinationAddress: req.nativeDstAddress ?? req.userAddress,
      fromAsset: sourceSettlementToken ?? req.tokenIn,
      toAsset: this._isAddress(req.tokenOut)
        ? (destinationSettlementToken ?? req.tokenOut)
        : req.tokenOut,
    };
  }

  private _applyThorchainQuote(
    offer: RailOffer,
    thorQuote: THORChainQuoteResult,
  ): RailOffer {
    const economics: OfferEconomics = { ...offer.economics };
    if (thorQuote.slippageBps !== undefined) economics.slippageBps = thorQuote.slippageBps;
    if (thorQuote.outboundFeeUSD !== undefined) economics.outboundFeeUSD = thorQuote.outboundFeeUSD;
    if (thorQuote.settlementTimeSeconds !== undefined) {
      economics.settlementTimeSeconds = thorQuote.settlementTimeSeconds;
    }
    if (thorQuote.recommendedMinAmountIn) {
      economics.minimumInput = thorQuote.recommendedMinAmountIn;
    }

    const executionQuote = offer.execution.quote as QuoteResult | undefined;
    const minThorOutput = this._parseBigInt(
      thorQuote.expectedAmountOut ?? thorQuote.quote.expected_amount_out,
    );
    const enrichedQuote: QuoteResult | undefined = executionQuote
      ? {
        ...executionQuote,
        thorAsset: thorQuote.quote.to_asset ?? executionQuote.thorAsset,
        minThorOutput: minThorOutput ?? executionQuote.minThorOutput,
        estimatedOut: minThorOutput ?? executionQuote.estimatedOut,
      }
      : undefined;

    return {
      ...offer,
      estimatedOut: minThorOutput ?? offer.estimatedOut,
      minAmountOut: minThorOutput
        ? this._applySlippage(minThorOutput, QUOTE_SLIPPAGE_BPS)
        : offer.minAmountOut,
      economics,
      execution: {
        ...offer.execution,
        quote: enrichedQuote ?? offer.execution.quote,
        thorQuote: thorQuote.quote,
        thorAssetIdentifier: thorQuote.quote.to_asset,
        minThorOutput: thorQuote.expectedAmountOut ?? thorQuote.quote.expected_amount_out,
        router: thorQuote.quote.router,
        inboundAddress: thorQuote.quote.inbound_address,
        memo: thorQuote.quote.memo,
        thorchainExpiry: thorQuote.quote.expiry,
      },
    };
  }

  private _toOfferSet(offers: RailOffer[]): OfferSet {
    return {
      offerSetId: this._makeIntentId(),
      expiresAt: offers.reduce((min, offer) => Math.min(min, offer.expiresAt), offers[0].expiresAt),
      offers,
      bestOfferId: offers[0]?.offerId,
    };
  }

  private _materializeLegacyQuote(offer: RailOffer): QuoteResult {
    const executionQuote = offer.execution.quote;
    if (executionQuote && typeof executionQuote === 'object') {
      return executionQuote as QuoteResult;
    }

    throw new Error(`offer ${offer.offerId} missing compatibility quote payload`);
  }

  private async _getCachedOfferSet(req: QuoteRequest): Promise<OfferSet | null> {
    const cacheKey = this._cacheKey(req);
    const cached = this.offerCache.get(cacheKey);
    if (cached) {
      if (Date.now() < cached.expiresAt) return cached.value;
      this.offerCache.delete(cacheKey);
    }

    const pending = this.pendingOfferSets.get(cacheKey);
    if (pending) return pending;

    const buildPromise = this._computeOfferSet(req).finally(() => {
      this.pendingOfferSets.delete(cacheKey);
    });
    this.pendingOfferSets.set(cacheKey, buildPromise);
    return buildPromise;
  }

  private async _computeOfferSet(req: QuoteRequest): Promise<OfferSet | null> {
    const dstChain = getChainConfig(req.dstChainId);
    if (!dstChain) return null;

    const amountUSD = await this._estimateUSD(req.tokenIn, req.srcChainId, req.amountIn);
    const candidateRoutes = this.routeBuilder
      .buildRoutes(req.srcChainId, req.dstChainId, amountUSD, req.urgency ?? 'normal')
      .filter((route) => route.viable && route.hops.length === 1);
    if (candidateRoutes.length === 0) return null;

    const offers = (await Promise.all(
      candidateRoutes.map((route) => this._buildOffer(req, route, amountUSD)),
    )).filter((offer): offer is RailOffer => offer !== null);
    if (offers.length === 0) return null;

    const offerSet = this._toOfferSet(offers);
    this.offerCache.set(this._cacheKey(req), {
      value: offerSet,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return offerSet;
  }

  private _toProviderAssetRef(
    chainId: number,
    settlementToken: SettlementToken,
    rail: Rail,
  ): ProviderAssetRef {
    const tokenAddress = getSettlementTokenAddress(chainId, settlementToken, rail);
    return {
      canonicalAssetId: `${chainId}:${settlementToken}`,
      providerAssetId: `${rail}:${chainId}:${settlementToken}`,
      tokenAddress,
      decimals: this._settlementTokenDecimals(settlementToken),
      assetKind: this._settlementAssetKind(settlementToken),
    };
  }

  private _settlementTokenDecimals(token: SettlementToken): number {
    switch (token) {
      case SettlementToken.USDC:
      case SettlementToken.USDT:
        return 6;
      case SettlementToken.SOL:
        return 9;
      case SettlementToken.BTC:
        return 8;
      case SettlementToken.ETH:
      default:
        return 18;
    }
  }

  private _settlementAssetKind(token: SettlementToken): ProviderAssetRef['assetKind'] {
    switch (token) {
      case SettlementToken.BTC:
        return 'btc';
      case SettlementToken.SOL:
        return 'sol';
      default:
        return 'erc20';
    }
  }

  private async _getSwapQuote(
    chainId: number, tokenIn: string, tokenOut: string, amountIn: bigint
  ): Promise<bigint | null> {
    const quoteFn = this.dexQuoteFns.get(chainId);
    if (!quoteFn) return null;
    try {
      return await quoteFn(tokenIn, tokenOut, amountIn);
    } catch {
      return null;
    }
  }

  private async _selectCctpPlan(
    req: QuoteRequest,
    settlementAmount: bigint,
    fallbackPluginId: string,
  ): Promise<CctpPlan> {
    const fallback: CctpPlan = {
      railPluginId: fallbackPluginId,
      railData: '0x',
      circleFeeToken: 0n,
    };
    if (!this._readBoolEnv('ENABLE_CCTP_FAST', false)) return fallback;
    if ((req.urgency ?? 'normal') !== 'fast') return fallback;

    const cctp = getCctpMetadata();
    const srcDomain = getCctpDomain(req.srcChainId);
    const dstDomain = getCctpDomain(req.dstChainId);
    if (srcDomain === undefined || dstDomain === undefined) return fallback;

    const [fees, allowanceMicros] = await Promise.all([
      this._fetchCctpFees(srcDomain, dstDomain),
      this._fetchCctpAllowanceMicros(),
    ]);
    if (!fees || allowanceMicros === null) return fallback;

    // Safety fallback: if allowance is depleted, use standard finalized transfer.
    if (allowanceMicros < settlementAmount) return fallback;

    const fastFee = fees.find((f) => f.finalityThreshold <= cctp.fastFinalityThreshold);
    if (!fastFee) return fallback;

    const feeBps = BigInt(Math.max(0, Math.ceil(fastFee.minimumFee)));
    const feeAmount = this._ceilDiv(settlementAmount * feeBps, 10_000n);

    const bufferBps = BigInt(this._readIntEnv('CCTP_FAST_MAX_FEE_BUFFER_BPS', cctp.feeBufferBpsDefault));
    const maxFeeBps = feeBps + bufferBps;
    let maxFee = this._ceilDiv(settlementAmount * maxFeeBps, 10_000n);
    if (maxFee === 0n) maxFee = 1n;

    const fastPluginId = this._resolvePluginId('CCTP_FAST_PLUGIN_ID', cctp.fastPluginId);
    const railData = abiCoder.encode(['uint32', 'uint256'], [cctp.fastFinalityThreshold, maxFee]);

    return {
      railPluginId: fastPluginId,
      railData,
      circleFeeToken: feeAmount,
    };
  }

  private async _fetchCctpFees(srcDomain: number, dstDomain: number): Promise<CctpFeeRow[] | null> {
    const base = this._resolveCctpBaseUrl();
    const url = `${base}/v2/burn/USDC/fees/${srcDomain}/${dstDomain}`;
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data)) return null;

      const rows = data
        .map((row) => ({
          finalityThreshold: Number(row?.finalityThreshold),
          minimumFee: Number(row?.minimumFee),
        }))
        .filter((row) => Number.isFinite(row.finalityThreshold) && Number.isFinite(row.minimumFee));
      return rows.length > 0 ? rows : null;
    } catch {
      return null;
    }
  }

  private async _fetchCctpAllowanceMicros(): Promise<bigint | null> {
    const base = this._resolveCctpBaseUrl();
    const url = `${base}/v2/fastBurn/USDC/allowance`;
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return null;
      const data = await res.json() as { allowance?: string | number | null };
      return this._parseUsdcToMicros(data.allowance);
    } catch {
      return null;
    }
  }

  private _resolveCctpBaseUrl(): string {
    const configured = this._readEnv('CCTP_ATTESTATION_BASE_URL') ?? 'https://iris-api-sandbox.circle.com';
    const trimmed = configured.replace(/\/$/, '');
    const idx = trimmed.indexOf('/v2/');
    return idx >= 0 ? trimmed.slice(0, idx) : trimmed;
  }

  private _parseUsdcToMicros(value: unknown): bigint | null {
    if (value === null || value === undefined) return null;
    const raw = String(value).trim();
    if (!/^\d+(\.\d+)?$/.test(raw)) return null;

    const [whole, fracRaw = ''] = raw.split('.');
    const frac = `${fracRaw}000000`.slice(0, 6);
    return BigInt(whole) * USDC_MICRO_UNITS + BigInt(frac);
  }

  private _resolvePluginId(envKey: string, fallback: string): string {
    const value = this._readEnv(envKey);
    if (!value) return fallback;
    return /^0x[0-9a-fA-F]{64}$/.test(value) ? value.toLowerCase() : fallback;
  }

  private _ceilDiv(value: bigint, denominator: bigint): bigint {
    return (value + denominator - 1n) / denominator;
  }

  private async _estimateUSD(token: string, chainId: number, amount: bigint): Promise<number> {
    // Stub: use a price oracle or coingecko in production.
    const stableToken = this._resolveStableSettlementToken(token, chainId);
    if (stableToken === SettlementToken.USDC || stableToken === SettlementToken.USDT) {
      return this._bigintToDecimal(amount, 6);
    }
    const fallbackDecimals = this._isStableLike(token) ? 6 : 18;
    return this._bigintToDecimal(amount, fallbackDecimals);
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
    this.dexQuoteFns.set(chainId, fn);
  }

  resetDexQuoteFns(): void {
    this.dexQuoteFns.clear();
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

  private _resolveStableSettlementToken(token: string, chainId: number): SettlementToken | null {
    const normalized = token.toLowerCase();
    if (!this._isAddress(normalized)) return null;

    const currentChainMatch = this._matchStableSettlementToken(normalized, [chainId]);
    if (currentChainMatch) return currentChainMatch;

    return this._matchStableSettlementToken(normalized, Object.keys(CHAIN_CONFIGS).map(Number));
  }

  private _matchStableSettlementToken(token: string, chainIds: number[]): SettlementToken | null {
    for (const settlementToken of [SettlementToken.USDC, SettlementToken.USDT] as const) {
      for (const candidateChainId of chainIds) {
        const defaultAddr = getSettlementTokenAddress(candidateChainId, settlementToken);
        if (defaultAddr && defaultAddr.toLowerCase() === token) return settlementToken;

        for (const rail of Object.values(Rail)) {
          const railAddr = getSettlementTokenAddress(candidateChainId, settlementToken, rail);
          if (railAddr && railAddr.toLowerCase() === token) return settlementToken;
        }
      }
    }

    return null;
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

  private _settlementTokenToUSD(token: SettlementToken, amount: bigint): number {
    switch (token) {
      case SettlementToken.USDC:
      case SettlementToken.USDT:
        return this._bigintToDecimal(amount, 6);
      default:
        return 0;
    }
  }

  private _applySlippage(amount: bigint, bps: number): bigint {
    const bpsBigInt = BigInt(Math.max(0, Math.min(10_000, Math.floor(bps))));
    return (amount * (BPS_DENOMINATOR - bpsBigInt)) / BPS_DENOMINATOR;
  }

  private _settlementAssetId(chainId: number, tokenAddress: string): string {
    return keccak256(abiCoder.encode(['uint256', 'address'], [BigInt(chainId), getAddress(tokenAddress)]));
  }

  private _resolveAxelarAsset(
    req: QuoteRequest,
    rail: Rail,
    settlementToken: SettlementToken,
  ): ResolvedAxelarAsset | null {
    if (rail !== Rail.AXELAR) return null;
    const canonicalAssetId = `${req.srcChainId}:${settlementToken}`;
    try {
      return this.axelarAssetCatalog.resolve({
        srcChainId: req.srcChainId,
        dstChainId: req.dstChainId,
        canonicalAssetId,
      });
    } catch {
      return null;
    }
  }

  private _zeroBytes32(): string {
    return `0x${'0'.repeat(64)}`;
  }

  private _parseBigInt(value: unknown): bigint | undefined {
    if (value === null || value === undefined) return undefined;
    const raw = String(value).trim();
    if (!/^\d+$/.test(raw)) return undefined;
    return BigInt(raw);
  }

  private _readEnv(name: string): string | undefined {
    const raw = process.env[name];
    if (!raw) return undefined;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private _readIntEnv(name: string, fallback: number): number {
    const raw = this._readEnv(name);
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
  }

  private _readBoolEnv(name: string, fallback: boolean): boolean {
    const raw = this._readEnv(name);
    if (!raw) return fallback;
    const v = raw.toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'on';
  }
}
