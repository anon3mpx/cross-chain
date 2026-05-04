// ─────────────────────────────────────────────────────────
// EMPX-Cross-Chain VPS — Quote Engine
// Generates full swap quotes including src swap + rail + dst swap.
// Results are cached 30s to minimise RPC calls.
// ─────────────────────────────────────────────────────────

import { AbiCoder, ZeroAddress, getAddress, keccak256 } from 'ethers';
import {
  DeliveryShape,
  ExecutionMode,
  OfferEconomics,
  OfferSet,
  ProviderAssetRef,
  QuoteRequest,
  QuoteResult,
  Rail,
  RailOfferType,
  RailOffer,
  Route,
  RouteType,
  SettlementToken,
} from '../types';
import { RouteBuilder } from './RouterBuilder';
import { AxelarAssetCatalog, type AxelarRouteOption } from './axelar/AxelarAssetCatalog';
import { CHAIN_CONFIGS, getChainConfig } from '../config/chains';
import { RAIL_SETTLEMENT_ASSET_ALLOWLISTS } from '../config/routeExecution';
import { getSettlementTokenAddress, getSwapPluginIdForChain } from '../config/contracts';
import {
  getDefaultAxelarDirectAssetsFromMetadata,
  getDefaultLayerZeroRouteFamiliesFromMetadata,
} from '../config/routeMetadata';
import { randomBytes } from 'crypto';
import { InMemoryQuoteCache, QuoteCache } from '../cache/QuoteCache';
import {
  THORChainQuoteWorker,
  type THORChainQuoteRequest,
  type THORChainQuoteResult,
} from './thorchain/THORChainQuoteWorker';
import {
  buildTHORChainQuoteRequestFromPair,
  buildTHORChainQuoteRequest,
  isQuoteCacheable,
  shouldCacheOfferSet,
  shouldReuseCachedOfferSet,
} from './thorchain/THORChainQuotePolicy';
import { StaticRouteAssetPolicy, type RouteAssetPolicy } from './RouteAssetPolicy';
import { StaticDestinationGasPolicy, type DestinationGasPolicy } from './DestinationGasPolicy';
import { LayerZeroRouteCatalog, type LayerZeroRouteOption } from './layerzero/LayerZeroRouteCatalog';
import {
  LayerZeroValueTransferApiQuoteWorker,
  type LayerZeroValueTransferApiQuoteResult,
} from './layerzero/LayerZeroValueTransferApiQuoteWorker';
import { RailSelector } from './RailSelector';
import {
  ZERO_PLUGIN_ID,
  getCctpDomain,
  getCctpMetadata,
  getRailConfig,
  isCctpFastPluginId,
} from '../rails/registry';

const CACHE_TTL_MS = 120_000; // Cache full quotes for 2 minutes. This is a tradeoff to reduce RPC calls while keeping quotes reasonably fresh.
const LOWER_HEX_ADDR_RE = /^0x[0-9a-f]{40}$/;
const ROUTER_MAX_FEE_BPS = 100; // RouterV1.MAX_FEE_BPS
const PROTOCOL_FEE_BPS = 30; // 0.30%
const QUOTE_SLIPPAGE_BPS = 10; // 0.1%
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
  offerType: RailOfferType;
  routeAsset: ProviderAssetRef;
  sourceSettlementAsset: ProviderAssetRef;
  destinationSettlementAsset: ProviderAssetRef;
  realizedProviderFeeUSD: number;
  protocolFeeUSD: number;
  outboundFeeUSD?: number;
  axelarDestinationTokenId?: string;
}

interface ResolvedRouteExecutionAsset {
  settlementToken: SettlementToken;
  offerType: RailOfferType;
  routeAsset: ProviderAssetRef;
  sourceSettlementAsset: ProviderAssetRef;
  destinationSettlementAsset: ProviderAssetRef;
  sourceRouteToken: string;
  destinationRouteToken: string;
  sourceRouteAssetId: string;
  destinationRouteAssetId: string;
  axelarDestinationTokenId?: string;
  layerZeroRouteOft?: string;
  layerZeroOptions?: string;
}

export interface OfferSelectionResult {
  offer: RailOffer | null;
  fallbackOfferSet: OfferSet | null;
  reason?: 'OFFER_SET_NOT_FOUND' | 'OFFER_SET_EXPIRED' | 'OFFER_UNAVAILABLE';
}

type QuoteFn = (tokenIn: string, tokenOut: string, amountIn: bigint) => Promise<bigint>;

export interface QuoteEngineDependencies {
  thorchainQuoteWorker?: Pick<THORChainQuoteWorker, 'quote'>;
  routeAssetPolicy?: RouteAssetPolicy;
  destinationGasPolicy?: DestinationGasPolicy;
  routeBuilder?: RouteBuilder;
  axelarAssetCatalog?: Pick<AxelarAssetCatalog, 'listRoutes'>;
  layerZeroRouteCatalog?: Pick<LayerZeroRouteCatalog, 'listRoutes'>;
  layerZeroValueTransferApiQuoteWorker?: Pick<LayerZeroValueTransferApiQuoteWorker, 'quoteLayerZeroValueTransferApi'>;
}

export class QuoteEngine {
  private readonly routeBuilder: RouteBuilder;
  private readonly cache: QuoteCache;
  private readonly offerCache = new Map<string, { value: OfferSet; expiresAt: number; reusable: boolean }>();
  private readonly offerSetById = new Map<string, { value: OfferSet; expiresAtMs: number }>();
  private readonly pendingOfferSets = new Map<string, Promise<OfferSet | null>>();
  private readonly dexQuoteFns = new Map<number, QuoteFn>();
  private readonly axelarAssetCatalog: Pick<AxelarAssetCatalog, 'listRoutes'>;
  private readonly layerZeroRouteCatalog: Pick<LayerZeroRouteCatalog, 'listRoutes'>;
  private readonly layerZeroValueTransferApiQuoteWorker?: Pick<LayerZeroValueTransferApiQuoteWorker, 'quoteLayerZeroValueTransferApi'>;
  private readonly thorchainQuoteWorker?: Pick<THORChainQuoteWorker, 'quote'>;
  private readonly routeAssetPolicy: RouteAssetPolicy;
  private readonly destinationGasPolicy: DestinationGasPolicy;

  constructor(
    cache: QuoteCache = new InMemoryQuoteCache(),
    deps: QuoteEngineDependencies = {},
  ) {
    this.cache = cache;
    this.routeAssetPolicy = deps.routeAssetPolicy ?? new StaticRouteAssetPolicy(RAIL_SETTLEMENT_ASSET_ALLOWLISTS);
    this.destinationGasPolicy = deps.destinationGasPolicy ?? new StaticDestinationGasPolicy();
    this.routeBuilder = deps.routeBuilder ?? new RouteBuilder(new RailSelector(this.routeAssetPolicy));
    this.axelarAssetCatalog = deps.axelarAssetCatalog ?? new AxelarAssetCatalog({
      defaultCanonicalAssetIds: this.routeAssetPolicy.allowedAssets(Rail.AXELAR),
      directCanonicalAssetIds: this._defaultAxelarDirectCanonicalAssetIds(),
    });
    this.layerZeroRouteCatalog = deps.layerZeroRouteCatalog ?? new LayerZeroRouteCatalog({
      defaultCanonicalAssetIds: this.routeAssetPolicy.allowedAssets(Rail.LAYERZERO),
      routeFamilyOverrides: this._defaultLayerZeroRouteFamilies(),
    });
    const hasExplicitLayerZeroValueTransferApiWorker = Object.prototype.hasOwnProperty.call(deps, 'layerZeroValueTransferApiQuoteWorker');
    this.layerZeroValueTransferApiQuoteWorker = hasExplicitLayerZeroValueTransferApiWorker
      ? deps.layerZeroValueTransferApiQuoteWorker
      : this._readBoolEnv('ENABLE_LAYERZERO_TRANSFER_API', false)
        ? new LayerZeroValueTransferApiQuoteWorker()
        : undefined;
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

    const indexed = this.offerSetById.get(offerSetId);
    if (indexed) {
      if (indexed.expiresAtMs > now && indexed.value.expiresAt > nowSeconds) {
        const validOffers = indexed.value.offers.filter((candidate) => candidate.expiresAt > nowSeconds);
        const selected = validOffers.find((candidate) => candidate.offerId === offerId) ?? null;
        if (selected) {
          return { offer: selected, fallbackOfferSet: null };
        }

        const fallbackOffers = validOffers.filter((candidate) => candidate.offerId !== offerId);
        if (fallbackOffers.length > 0) {
          return {
            offer: null,
            fallbackOfferSet: {
              offerSetId: indexed.value.offerSetId,
              expiresAt: fallbackOffers.reduce((min, candidate) => Math.min(min, candidate.expiresAt), fallbackOffers[0].expiresAt),
              offers: fallbackOffers,
              bestOfferId: fallbackOffers[0].offerId,
            },
            reason: 'OFFER_UNAVAILABLE',
          };
        }
      } else {
        this.offerSetById.delete(offerSetId);
      }
    }

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
    if (cached && isQuoteCacheable(cached)) return cached;

    const offerSet = await this.getOffers(req);
    if (!offerSet || offerSet.offers.length === 0) return null;

    const quote = this._materializeLegacyQuote(offerSet.offers[0]);
    if (isQuoteCacheable(quote)) {
      await this.cache.set(cacheKey, quote, CACHE_TTL_MS);
    }
    return quote;
  }

  private async _buildOffer(
    req: QuoteRequest,
    route: Route,
    amountUSD: number,
  ): Promise<RailOffer | null> {
    const builtQuote = await this._quoteForDirectRoute(req, route, amountUSD);
    if (!builtQuote) return null;

    const { quote: executionQuote } = builtQuote;

    const economics = this._buildOfferEconomics(route, builtQuote);
    const offer: RailOffer = {
      offerId: executionQuote.intentId,
      rail: executionQuote.rail,
      offerType: builtQuote.offerType,
      railType: executionQuote.railType,
      srcChainId: executionQuote.srcChainId,
      dstChainId: executionQuote.dstChainId,
      tokenIn: executionQuote.tokenIn,
      tokenOut: executionQuote.tokenOut,
      amountIn: executionQuote.amountIn,
      estimatedOut: executionQuote.estimatedOut,
      minAmountOut: executionQuote.minAmountOut,
      expiresAt: executionQuote.expiresAt,
      deliveryShape: this._deliveryShapeFor(executionQuote),
      executionMode: this._executionModeFor(executionQuote.rail),
      routeAsset: builtQuote.routeAsset,
      sourceSettlementAsset: builtQuote.sourceSettlementAsset,
      destinationSettlementAsset: builtQuote.destinationSettlementAsset,
      economics,
      execution: {
        quote: executionQuote,
        feeAmountToken: executionQuote.feeAmountToken,
        minSrcSwapOut: executionQuote.minSrcSwapOut,
        providerFeeUSD: builtQuote.realizedProviderFeeUSD,
        protocolFeeUSD: builtQuote.protocolFeeUSD,
        railPluginId: executionQuote.railPluginId,
        railData: executionQuote.railData,
        swapPluginIdSrc: executionQuote.swapPluginIdSrc,
        swapPluginIdDst: executionQuote.swapPluginIdDst,
        swapDataSrc: executionQuote.swapDataSrc,
        swapDataDst: executionQuote.swapDataDst,
        nativeDstAddress: executionQuote.nativeDstAddress,
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
    const routeAssetAlias = hop.routeAssetAlias;
    if (!this.routeAssetPolicy.isAllowed(hop.rail, routeAssetAlias)) return null;
    const settlementToken = this._settlementTokenFromRouteAssetAlias(routeAssetAlias);
    if (!settlementToken) return null;
    const srcSwapEnabled = route.routeType === RouteType.FULL_SWAP || route.routeType === RouteType.SRC_SWAP;
    const dstSwapEnabled = route.routeType === RouteType.FULL_SWAP || route.routeType === RouteType.DST_SWAP;
    const routeAsset = this._resolveRouteExecutionAsset(req, hop.rail, routeAssetAlias, false);
    if (!routeAsset) return null;
    const settlementAddrSrc = routeAsset.sourceRouteToken;
    if (!settlementAddrSrc) return null;

    const railFeeUSD = route.totalFeeUSD;
    const protocolFeeUSD = amountUSD * (PROTOCOL_FEE_BPS / 10_000);
    const totalFeeUSD = protocolFeeUSD;
    const feeRatioBps = BigInt(Math.min(PROTOCOL_FEE_BPS, ROUTER_MAX_FEE_BPS));
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
    } else if (hop.rail === Rail.LAYERZERO) {
      if (!routeAsset.layerZeroRouteOft) return null;
      railData = abiCoder.encode(
        ['uint8', 'address', 'bytes'],
        [
          this._layerZeroFamilyCode(routeAsset.offerType),
          routeAsset.layerZeroRouteOft,
          routeAsset.layerZeroOptions ?? '0x',
        ],
      );
    }

    // Get dst swap quote: settlementToken → tokenOut
    const settlementAddrDst = routeAsset.destinationRouteToken;
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
    const offerType = routeAsset.offerType === 'cctp_fast' || routeAsset.offerType === 'cctp_standard'
      ? (isCctpFastPluginId(railPluginId) ? 'cctp_fast' : 'cctp_standard')
      : (hop.rail === Rail.AXELAR
        ? (dstSwapPluginId !== ZERO_PLUGIN_ID ? 'axelar_dst_swap' : 'axelar_direct')
        : routeAsset.offerType);
    const dstGasLimit = this.destinationGasPolicy.gasLimit(hop.rail, offerType);

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
        settlementAssetId: routeAsset.sourceRouteAssetId,
        expectedDstSettlementToken: settlementAddrDst ?? ZeroAddress,
        expectedDstSettlementAssetId: routeAsset.destinationRouteAssetId,
        minSettlementAmount,
        dstGasLimit,
        etaSeconds:      isCctpFastPluginId(railPluginId) ? Math.min(route.totalEtaSeconds, 8) : route.totalEtaSeconds,
        expiresAt:       Math.floor(Date.now() / 1000) + 120,
        railPluginId,
        railData,
        swapPluginIdSrc: srcSwapPluginId,
        swapPluginIdDst: dstSwapPluginId,
        swapDataSrc:     '0x',
        swapDataDst:     '0x',
        nativeDstAddress: req.nativeDstAddress,
        routeAsset: routeAsset.routeAsset,
      },
      offerType,
      routeAsset: routeAsset.routeAsset,
      sourceSettlementAsset: routeAsset.sourceSettlementAsset,
      destinationSettlementAsset: routeAsset.destinationSettlementAsset,
      realizedProviderFeeUSD: realizedRailFeeUSD,
      protocolFeeUSD,
      outboundFeeUSD,
      axelarDestinationTokenId: routeAsset.axelarDestinationTokenId,
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
    if (route.hops[0].rail !== Rail.THORCHAIN) {
      return offer;
    }

    if (!this.thorchainQuoteWorker) {
      return null;
    }

    try {
      const quoteRequest = await this._buildThorchainQuoteRequest(req, route, offer);
      if (!quoteRequest) return null;
      const thorQuote = await this.thorchainQuoteWorker.quote(quoteRequest);
      if (!thorQuote) return null;
      return this._applyThorchainQuote(offer, thorQuote);
    } catch {
      // Provider-direct THOR offers are only valid when the provider returned
      // executable deposit instructions.
      return null;
    }
  }

  private _buildThorchainQuoteRequest(
    req: QuoteRequest,
    route: Route,
    offer: RailOffer,
  ): Promise<THORChainQuoteRequest | null> {
    const executionQuote = offer.execution.quote as QuoteResult | undefined;
    const settlementInputAmount =
      executionQuote?.minSettlementAmount && executionQuote.minSettlementAmount > 0n
        ? executionQuote.minSettlementAmount
        : offer.amountIn;
    return buildTHORChainQuoteRequest({
      amountIn: settlementInputAmount,
      srcChainId: req.srcChainId,
      dstChainId: req.dstChainId,
      tokenIn: req.tokenIn,
      tokenOut: req.tokenOut,
      destinationAddress: req.nativeDstAddress ?? req.userAddress,
      routeAssetAlias: route.hops[0].routeAssetAlias,
      sourceTokenAddress: offer.sourceSettlementAsset.tokenAddress,
      destinationTokenAddress: offer.destinationSettlementAsset.tokenAddress,
    });
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
      if (Date.now() < cached.expiresAt && cached.reusable && shouldReuseCachedOfferSet(cached.value)) {
        return cached.value;
      }
      if (Date.now() >= cached.expiresAt) {
        this.offerCache.delete(cacheKey);
      }
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
    if (!dstChain && !this.thorchainQuoteWorker) return null;

    const amountUSD = await this._estimateUSD(req.tokenIn, req.srcChainId, req.amountIn);
    const candidateRoutes = this.routeBuilder
      .buildRoutes(req.srcChainId, req.dstChainId, amountUSD, req.urgency ?? 'normal')
      .filter((route) => route.viable && route.hops.length === 1 && route.hops[0].rail !== Rail.THORCHAIN);

    const offers = (await Promise.all(
      candidateRoutes.map((route) => this._buildOffer(req, route, amountUSD)),
    )).filter((offer): offer is RailOffer => offer !== null);

    const thorOffer = await this._buildTHORChainProviderDirectOffer(req, amountUSD);
    if (thorOffer) {
      offers.push(thorOffer);
    }
    const layerZeroValueTransferApiOffer = await this._buildLayerZeroValueTransferApiProviderDirectOffer(req);
    if (layerZeroValueTransferApiOffer) {
      offers.push(layerZeroValueTransferApiOffer);
    }
    if (offers.length === 0) return null;

    const offerSet = this._toOfferSet(offers);
    this.offerSetById.set(offerSet.offerSetId, {
      value: offerSet,
      expiresAtMs: Date.now() + CACHE_TTL_MS,
    });
    this.offerCache.set(this._cacheKey(req), {
      value: offerSet,
      expiresAt: Date.now() + CACHE_TTL_MS,
      reusable: shouldCacheOfferSet(offerSet),
    });
    return offerSet;
  }

  private async _buildTHORChainProviderDirectOffer(
    req: QuoteRequest,
    amountUSD: number,
  ): Promise<RailOffer | null> {
    if (!this.thorchainQuoteWorker) return null;

    const config = getRailConfig(Rail.THORCHAIN);
    const railFeeUSD = config.fee;
    const protocolFeeUSD = amountUSD * (PROTOCOL_FEE_BPS / 10_000);
    const totalFeeUSD = protocolFeeUSD;
    const feeRatioBps = BigInt(Math.min(PROTOCOL_FEE_BPS, ROUTER_MAX_FEE_BPS));
    const feeAmountToken = (req.amountIn * feeRatioBps) / BPS_DENOMINATOR;
    if (feeAmountToken >= req.amountIn) return null;
    const amountAfterFee = req.amountIn - feeAmountToken;

    const quoteRequest = await buildTHORChainQuoteRequestFromPair({
      amountIn: amountAfterFee,
      srcChainId: req.srcChainId,
      dstChainId: req.dstChainId,
      tokenIn: req.tokenIn,
      tokenOut: req.tokenOut,
      destinationAddress: req.nativeDstAddress ?? req.userAddress,
    });
    if (!quoteRequest) return null;

    let thorQuote: THORChainQuoteResult | null;
    try {
      thorQuote = await this.thorchainQuoteWorker.quote(quoteRequest);
    } catch {
      return null;
    }
    if (!thorQuote) return null;

    const minThorOutput = this._parseBigInt(
      thorQuote.expectedAmountOut ?? thorQuote.quote.expected_amount_out,
    );
    if (!minThorOutput || minThorOutput <= 0n) return null;

    const thorAsset = quoteRequest.toAsset ?? thorQuote.quote.to_asset;
    const settlementToken = this._inferSettlementTokenFromThorAsset(thorAsset);
    const expectedDstSettlementToken = this._isAddress(req.tokenOut)
      ? req.tokenOut
      : ZeroAddress;
    const routeAsset = this._toTHORChainProviderAssetRef(
      req.srcChainId,
      req.dstChainId,
      thorAsset ?? thorQuote.quote.to_asset ?? 'THORCHAIN',
      settlementToken,
      quoteRequest.toAssetDecimals,
      req.tokenOut,
    );
    const quote: QuoteResult = {
      intentId: this._makeIntentId(),
      srcChainId: req.srcChainId,
      dstChainId: req.dstChainId,
      tokenIn: req.tokenIn,
      tokenOut: req.tokenOut,
      amountIn: req.amountIn,
      estimatedOut: minThorOutput,
      minAmountOut: this._applySlippage(minThorOutput, QUOTE_SLIPPAGE_BPS),
      minSrcSwapOut: 0n,
      feeAmountUSD: totalFeeUSD,
      feeAmountToken,
      rail: Rail.THORCHAIN,
      railType: config.railType,
      settlementToken,
      settlementAssetId: this._zeroBytes32(),
      expectedDstSettlementToken,
      expectedDstSettlementAssetId: this._zeroBytes32(),
      minSettlementAmount: amountAfterFee,
      dstGasLimit: 0,
      etaSeconds: thorQuote.settlementTimeSeconds ?? config.etaSeconds,
      expiresAt: this._resolveThorExpiry(thorQuote.quote.expiry),
      railPluginId: config.pluginId,
      railData: '0x',
      swapPluginIdSrc: ZERO_PLUGIN_ID,
      swapPluginIdDst: ZERO_PLUGIN_ID,
      swapDataSrc: '0x',
      swapDataDst: '0x',
      nativeDstAddress: req.nativeDstAddress,
      thorAsset: thorQuote.quote.to_asset ?? undefined,
      minThorOutput,
      routeAsset,
    };

    const economics: OfferEconomics = {
      providerFeeUSD: railFeeUSD,
      protocolFeeUSD,
      sourceGasUSD: 0,
      settlementTimeSeconds: thorQuote.settlementTimeSeconds ?? config.etaSeconds,
    };
    if (thorQuote.outboundFeeUSD !== undefined) economics.outboundFeeUSD = thorQuote.outboundFeeUSD;
    if (thorQuote.slippageBps !== undefined) economics.slippageBps = thorQuote.slippageBps;
    if (thorQuote.recommendedMinAmountIn) economics.minimumInput = thorQuote.recommendedMinAmountIn;

    return {
      offerId: quote.intentId,
      rail: Rail.THORCHAIN,
      offerType: 'thor_api_direct',
      railType: config.railType,
      srcChainId: req.srcChainId,
      dstChainId: req.dstChainId,
      tokenIn: req.tokenIn,
      tokenOut: req.tokenOut,
      amountIn: req.amountIn,
      estimatedOut: quote.estimatedOut,
      minAmountOut: quote.minAmountOut,
      expiresAt: quote.expiresAt,
      deliveryShape: this._deliveryShapeFor(quote),
      executionMode: 'provider_direct',
      routeAsset: quote.routeAsset,
      sourceSettlementAsset: quote.routeAsset!,
      destinationSettlementAsset: quote.routeAsset!,
      economics,
      execution: {
        provider: 'thorchain_api',
        quote,
        thorQuote: thorQuote.quote,
        thorAssetIdentifier: thorQuote.quote.to_asset,
        minThorOutput: thorQuote.expectedAmountOut ?? thorQuote.quote.expected_amount_out,
        router: thorQuote.quote.router,
        inboundAddress: thorQuote.quote.inbound_address,
        memo: thorQuote.quote.memo,
        thorchainExpiry: thorQuote.quote.expiry,
        feeAmountToken: quote.feeAmountToken,
        providerFeeUSD: railFeeUSD,
        protocolFeeUSD,
        railPluginId: quote.railPluginId,
        railData: quote.railData,
        swapPluginIdSrc: quote.swapPluginIdSrc,
        swapPluginIdDst: quote.swapPluginIdDst,
        swapDataSrc: quote.swapDataSrc,
        swapDataDst: quote.swapDataDst,
        nativeDstAddress: quote.nativeDstAddress,
      },
    };
  }

  private async _buildLayerZeroValueTransferApiProviderDirectOffer(
    req: QuoteRequest,
  ): Promise<RailOffer | null> {
    if (!this.layerZeroValueTransferApiQuoteWorker) return null;

    let result: LayerZeroValueTransferApiQuoteResult | null;
    try {
      result = await this.layerZeroValueTransferApiQuoteWorker.quoteLayerZeroValueTransferApi(req);
    } catch {
      return null;
    }
    if (!result) return null;

    const estimatedOut = this._parseBigInt(result.expectedAmountOut);
    const minAmountOut = this._parseBigInt(result.minAmountOut);
    if (!estimatedOut || estimatedOut <= 0n || !minAmountOut || minAmountOut <= 0n) {
      return null;
    }

    const settlementToken = this._inferSettlementTokenFromSymbol(result.destinationToken.symbol);
    const sourceAsset = this._toLayerZeroValueTransferApiAssetRef(result.sourceToken);
    const destinationAsset = this._toLayerZeroValueTransferApiAssetRef(result.destinationToken);
    const intentId = this._makeIntentId();
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiresAt = this._resolveLayerZeroValueTransferApiExpiry(result.quote.expiresAt, nowSeconds);

    const quote: QuoteResult = {
      intentId,
      srcChainId: req.srcChainId,
      dstChainId: req.dstChainId,
      tokenIn: req.tokenIn,
      tokenOut: req.tokenOut,
      amountIn: req.amountIn,
      estimatedOut,
      minAmountOut,
      minSrcSwapOut: 0n,
      feeAmountUSD: result.feeUsd,
      feeAmountToken: 0n,
      rail: Rail.LAYERZERO,
      railType: 'messaging',
      settlementToken,
      routeAsset: sourceAsset,
      settlementAssetId: this._zeroBytes32(),
      expectedDstSettlementToken: result.destinationToken.address,
      expectedDstSettlementAssetId: this._zeroBytes32(),
      minSettlementAmount: minAmountOut,
      dstGasLimit: 0,
      etaSeconds: result.settlementTimeSeconds,
      expiresAt,
      railPluginId: ZERO_PLUGIN_ID,
      railData: '0x',
      swapPluginIdSrc: ZERO_PLUGIN_ID,
      swapPluginIdDst: ZERO_PLUGIN_ID,
      swapDataSrc: '0x',
      swapDataDst: '0x',
      nativeDstAddress: req.nativeDstAddress,
      layerZeroValueTransferApiQuoteId: result.quote.id,
    };

    return {
      offerId: intentId,
      rail: Rail.LAYERZERO,
      offerType: 'lz_api_direct',
      railType: 'messaging',
      srcChainId: req.srcChainId,
      dstChainId: req.dstChainId,
      tokenIn: req.tokenIn,
      tokenOut: req.tokenOut,
      amountIn: req.amountIn,
      estimatedOut,
      minAmountOut,
      expiresAt,
      deliveryShape: 'direct',
      executionMode: 'provider_direct',
      routeAsset: sourceAsset,
      sourceSettlementAsset: sourceAsset,
      destinationSettlementAsset: destinationAsset,
      economics: {
        providerFeeUSD: result.feeUsd,
        protocolFeeUSD: 0,
        sourceGasUSD: 0,
        settlementTimeSeconds: result.settlementTimeSeconds,
      },
      execution: {
        provider: 'layerzero_value_transfer_api',
        quote,
        layerZeroValueTransferApiQuoteId: result.quote.id,
        layerZeroValueTransferApiQuote: result.quote,
        layerZeroValueTransferApiUserSteps: result.userSteps,
        layerZeroValueTransferApiRouteSteps: result.quote.routeSteps ?? [],
        feeUsd: result.feeUsd,
      },
    };
  }

  private _toProviderAssetRef(
    chainId: number,
    canonicalAssetId: string,
    settlementToken: SettlementToken,
    rail: Rail,
    tokenAddress?: string,
    destinationTokenAddress?: string,
    assetStandard?: ProviderAssetRef['assetStandard'],
  ): ProviderAssetRef {
    const resolvedTokenAddress = tokenAddress ?? getSettlementTokenAddress(chainId, settlementToken, rail);
    return {
      canonicalAssetId,
      providerAssetId: `${rail}:${chainId}:${canonicalAssetId.toLowerCase()}`,
      tokenAddress: resolvedTokenAddress,
      srcTokenAddress: resolvedTokenAddress,
      dstTokenAddress: destinationTokenAddress ?? resolvedTokenAddress,
      decimals: this._settlementTokenDecimals(settlementToken),
      assetKind: this._settlementAssetKind(settlementToken),
      assetStandard: assetStandard ?? this._assetStandardFor(rail, settlementToken),
    };
  }

  private _toLayerZeroValueTransferApiAssetRef(token: LayerZeroValueTransferApiQuoteResult['sourceToken']): ProviderAssetRef {
    const canonicalAssetId = token.symbol.trim().toUpperCase();
    return {
      canonicalAssetId,
      providerAssetId: `layerzero-api:${token.chainKey}:${token.address.toLowerCase()}`,
      tokenAddress: token.address,
      srcTokenAddress: token.address,
      dstTokenAddress: token.address,
      decimals: token.decimals,
      assetKind: canonicalAssetId === 'ETH' ? 'native' : 'erc20',
      assetStandard: canonicalAssetId === 'ETH' ? 'native' : 'erc20',
    };
  }

  private _toTHORChainProviderAssetRef(
    srcChainId: number,
    dstChainId: number,
    thorAsset: string,
    fallbackSettlementToken: SettlementToken,
    decimals?: number,
    tokenAddress?: string,
  ): ProviderAssetRef {
    const canonicalAssetId = this._normalizeTHORChainCanonicalAssetId(thorAsset);
    const tokenId = this._thorchainTokenId(canonicalAssetId);
    const normalizedTokenAddress = tokenAddress?.replace(/^0X/, '0x');
    const addressToken = this._isAddress(normalizedTokenAddress ?? '') ? getAddress(normalizedTokenAddress!) : undefined;
    const normalizedTokenId = tokenId?.replace(/^0X/, '0x');
    const resolvedTokenAddress = addressToken
      ?? (this._isAddress(normalizedTokenId ?? '') ? getAddress(normalizedTokenId!) : undefined);

    return {
      canonicalAssetId,
      providerAssetId: `THORCHAIN:${srcChainId}:${dstChainId}:${canonicalAssetId}`,
      tokenAddress: resolvedTokenAddress,
      srcTokenAddress: resolvedTokenAddress,
      dstTokenAddress: resolvedTokenAddress,
      decimals: decimals ?? this._thorchainAssetDecimals(canonicalAssetId, fallbackSettlementToken),
      assetKind: this._thorchainAssetKind(canonicalAssetId, fallbackSettlementToken),
      assetStandard: this._thorchainAssetStandard(canonicalAssetId, fallbackSettlementToken),
    };
  }

  private _settlementTokenFromRouteAssetAlias(routeAssetAlias: string): SettlementToken | null {
    switch (routeAssetAlias.trim().toUpperCase()) {
      case 'USDC':
        return SettlementToken.USDC;
      case 'USDT':
        return SettlementToken.USDT;
      case 'ETH':
      case 'WETH':
      case 'ETH.ETH':
      case 'DOGE':
      case 'DOGE.DOGE':
        return SettlementToken.ETH;
      case 'BTC':
      case 'BTC.BTC':
        return SettlementToken.BTC;
      case 'SOL':
      case 'SOL.SOL':
        return SettlementToken.SOL;
      default:
        return null;
    }
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

  private _assetStandardFor(
    rail: Rail,
    token: SettlementToken,
  ): ProviderAssetRef['assetStandard'] {
    if (rail === Rail.THORCHAIN) return token === SettlementToken.BTC || token === SettlementToken.SOL ? 'thor_native' : 'erc20';
    if (rail === Rail.LAYERZERO) {
      return token === SettlementToken.USDC ? 'stargate_pool' : 'oft';
    }
    return 'erc20';
  }

  private _executionModeFor(rail: Rail): ExecutionMode {
    return rail === Rail.THORCHAIN ? 'provider_direct' : 'router_intent';
  }

  private _deliveryShapeFor(quote: QuoteResult): DeliveryShape {
    const srcSwapRequired = quote.swapPluginIdSrc !== ZERO_PLUGIN_ID;
    const dstSwapRequired = quote.swapPluginIdDst !== ZERO_PLUGIN_ID;
    if (srcSwapRequired && dstSwapRequired) return 'src_and_dst_swap_required';
    if (srcSwapRequired) return 'src_swap_required';
    if (dstSwapRequired) return 'dst_swap_required';
    return 'direct';
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

  private _resolveRouteExecutionAsset(
    req: QuoteRequest,
    rail: Rail,
    routeAssetAlias: string,
    _dstSwapExpected: boolean,
  ): ResolvedRouteExecutionAsset | null {
    const canonicalAssetId = routeAssetAlias.trim().toUpperCase();
    const settlementToken = this._settlementTokenFromRouteAssetAlias(canonicalAssetId);
    if (!settlementToken) return null;

    if (rail === Rail.AXELAR) {
      const option = this.axelarAssetCatalog
        .listRoutes({ srcChainId: req.srcChainId, dstChainId: req.dstChainId, canonicalAssetIds: [canonicalAssetId] })[0];
      if (!option) return null;
      return {
        settlementToken,
        offerType: option.offerType,
        routeAsset: option.routeAsset,
        sourceSettlementAsset: option.routeAsset,
        destinationSettlementAsset: {
          ...option.routeAsset,
          tokenAddress: option.expectedDstToken,
          srcTokenAddress: option.routeAsset.srcTokenAddress,
          dstTokenAddress: option.expectedDstToken,
        },
        sourceRouteToken: option.routeAsset.srcTokenAddress ?? option.routeAsset.tokenAddress ?? '',
        destinationRouteToken: option.expectedDstToken,
        sourceRouteAssetId: this._settlementAssetId(
          req.srcChainId,
          option.routeAsset.srcTokenAddress ?? option.routeAsset.tokenAddress ?? '',
        ),
        destinationRouteAssetId: option.expectedDstAssetId,
        axelarDestinationTokenId: option.destinationTokenId,
      };
    }

    if (rail === Rail.LAYERZERO) {
      const option = this.layerZeroRouteCatalog
        .listRoutes({ srcChainId: req.srcChainId, dstChainId: req.dstChainId, canonicalAssetIds: [canonicalAssetId] })[0];
      if (!option) return null;
      return {
        settlementToken,
        offerType: option.offerType,
        routeAsset: option.routeAsset,
        sourceSettlementAsset: option.routeAsset,
        destinationSettlementAsset: {
          ...option.routeAsset,
          tokenAddress: option.expectedDstToken,
          srcTokenAddress: option.routeAsset.srcTokenAddress,
          dstTokenAddress: option.expectedDstToken,
        },
        sourceRouteToken: option.routeAsset.srcTokenAddress ?? option.routeAsset.tokenAddress ?? '',
        destinationRouteToken: option.expectedDstToken,
        sourceRouteAssetId: this._settlementAssetId(
          req.srcChainId,
          option.routeAsset.srcTokenAddress ?? option.routeAsset.tokenAddress ?? '',
        ),
        destinationRouteAssetId: option.expectedDstAssetId,
        layerZeroRouteOft: option.oftAddress,
        layerZeroOptions: option.extraOptions,
      };
    }

    const sourceRouteToken = getSettlementTokenAddress(req.srcChainId, settlementToken, rail);
    const destinationRouteToken = getSettlementTokenAddress(req.dstChainId, settlementToken, rail);
    if (!sourceRouteToken || !destinationRouteToken) return null;

    const assetStandard = rail === Rail.THORCHAIN && (settlementToken === SettlementToken.BTC || settlementToken === SettlementToken.SOL)
      ? 'thor_native'
      : this._assetStandardFor(rail, settlementToken);
    const routeAsset = this._toProviderAssetRef(
      req.srcChainId,
      canonicalAssetId,
      settlementToken,
      rail,
      sourceRouteToken,
      destinationRouteToken,
      assetStandard,
    );

    return {
      settlementToken,
      offerType: rail === Rail.THORCHAIN
        ? 'thor_api_direct'
        : rail === Rail.CCTP
          ? 'cctp_standard'
          : rail === Rail.VIA_LABS
            ? 'cctp_standard'
            : 'axelar_direct',
      routeAsset,
      sourceSettlementAsset: routeAsset,
      destinationSettlementAsset: {
        ...routeAsset,
        tokenAddress: destinationRouteToken,
        dstTokenAddress: destinationRouteToken,
      },
      sourceRouteToken,
      destinationRouteToken,
      sourceRouteAssetId: this._settlementAssetId(req.srcChainId, sourceRouteToken),
      destinationRouteAssetId: this._settlementAssetId(req.dstChainId, destinationRouteToken),
    };
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

  private _layerZeroFamilyCode(offerType: RailOfferType): number {
    switch (offerType) {
      case 'lz_oft':
        return 0;
      case 'lz_oft_adapter':
        return 1;
      case 'lz_stargate_pool':
        return 2;
      case 'lz_stargate_oft':
        return 3;
      default:
        throw new Error(`quote engine: unsupported LayerZero offer type ${offerType}`);
    }
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

  private _thorchainTokenId(asset: string): string | undefined {
    const dash = asset.indexOf('-');
    if (dash < 0 || dash === asset.length - 1) return undefined;
    return asset.slice(dash + 1);
  }

  private _normalizeTHORChainCanonicalAssetId(asset: string): string {
    const trimmed = asset.trim();
    const dash = trimmed.indexOf('-');
    if (dash < 0) return trimmed.toUpperCase();
    return `${trimmed.slice(0, dash).toUpperCase()}-${trimmed.slice(dash + 1)}`;
  }

  private _thorchainAssetDecimals(asset: string, fallbackSettlementToken: SettlementToken): number {
    const normalized = asset.trim().toUpperCase();
    if (normalized.includes('.USDC-') || normalized.endsWith('.USDC')) return 6;
    if (normalized.includes('.USDT-') || normalized.endsWith('.USDT')) return 6;
    if (normalized.startsWith('BTC.')) return 8;
    if (normalized.startsWith('DOGE.')) return 8;
    if (normalized.startsWith('LTC.')) return 8;
    if (normalized.startsWith('BCH.')) return 8;
    if (normalized.startsWith('SOL.')) return 9;
    return this._settlementTokenDecimals(fallbackSettlementToken);
  }

  private _thorchainAssetKind(
    asset: string,
    fallbackSettlementToken: SettlementToken,
  ): ProviderAssetRef['assetKind'] {
    const normalized = asset.trim().toUpperCase();
    if (normalized.startsWith('BTC.')) return 'btc';
    if (normalized.startsWith('SOL.')) return 'sol';
    if (normalized.startsWith('DOGE.')) return 'doge';
    if (normalized.startsWith('GAIA.') || normalized.startsWith('KUJI.') || normalized.startsWith('THOR.')) {
      return 'cosmos';
    }
    return this._settlementAssetKind(fallbackSettlementToken);
  }

  private _thorchainAssetStandard(
    asset: string,
    fallbackSettlementToken: SettlementToken,
  ): ProviderAssetRef['assetStandard'] {
    const normalized = asset.trim().toUpperCase();
    const [chain, ticker = ''] = normalized.split('.', 2);
    if (!ticker.includes('-') && chain && ticker && chain === ticker) return 'thor_native';
    if (fallbackSettlementToken === SettlementToken.BTC || fallbackSettlementToken === SettlementToken.SOL) {
      return 'thor_native';
    }
    if (ticker.includes('-')) return 'erc20';
    return 'native';
  }

  private _inferSettlementTokenFromThorAsset(asset: unknown): SettlementToken {
    const normalized = String(asset ?? '').trim().toUpperCase();
    if (normalized.startsWith('BTC.') || normalized.startsWith('BTC~') || normalized.startsWith('BTC-')) {
      return SettlementToken.BTC;
    }
    if (normalized.startsWith('SOL.') || normalized.startsWith('SOL~') || normalized.startsWith('SOL-')) {
      return SettlementToken.SOL;
    }
    if (normalized.includes('.USDT-') || normalized.endsWith('.USDT')) {
      return SettlementToken.USDT;
    }
    if (normalized.endsWith('.ETH') || normalized.includes('.WETH') || normalized.includes('.ETH-')) {
      return SettlementToken.ETH;
    }
    if (normalized.includes('.USDC-') || normalized.endsWith('.USDC')) {
      return SettlementToken.USDC;
    }
    return SettlementToken.USDC;
  }

  private _inferSettlementTokenFromSymbol(symbol: unknown): SettlementToken {
    const normalized = String(symbol ?? '').trim().toUpperCase();
    if (normalized === 'USDT') return SettlementToken.USDT;
    if (normalized === 'ETH' || normalized === 'WETH') return SettlementToken.ETH;
    if (normalized === 'SOL') return SettlementToken.SOL;
    if (normalized === 'BTC') return SettlementToken.BTC;
    return SettlementToken.USDC;
  }

  private _resolveThorExpiry(raw: unknown): number {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
    return Math.floor(Date.now() / 1000) + 120;
  }

  private _resolveLayerZeroValueTransferApiExpiry(raw: unknown, nowSeconds: number): number {
    if (typeof raw === 'string' && raw.trim().length > 0) {
      const parsed = Date.parse(raw);
      if (Number.isFinite(parsed) && parsed > Date.now()) {
        return Math.floor(parsed / 1000);
      }
    }
    return nowSeconds + 120;
  }

  private _defaultAxelarDirectCanonicalAssetIds(): string[] {
    const configured = this._readEnv('AXELAR_DIRECT_ROUTE_ASSETS');
    if (!configured) return getDefaultAxelarDirectAssetsFromMetadata();
    return configured.split(',').map((value) => value.trim().toUpperCase()).filter(Boolean);
  }

  private _defaultLayerZeroRouteFamilies(): Partial<Record<string, LayerZeroRouteOption['offerType']>> {
    const overrides: Partial<Record<string, LayerZeroRouteOption['offerType']>> =
      getDefaultLayerZeroRouteFamiliesFromMetadata();

    for (const assetAlias of this.routeAssetPolicy.allowedAssets(Rail.LAYERZERO)) {
      const normalized = assetAlias.trim().toUpperCase();
      const explicit = this._readEnv(`LAYERZERO_ROUTE_FAMILY_${normalized}`);
      if (!explicit) continue;
      if (this._isLayerZeroOfferType(explicit)) {
        overrides[normalized] = explicit;
      }
    }

    return overrides;
  }

  private _isLayerZeroOfferType(value: string): value is LayerZeroRouteOption['offerType'] {
    return value === 'lz_oft'
      || value === 'lz_oft_adapter'
      || value === 'lz_stargate_pool'
      || value === 'lz_stargate_oft';
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
