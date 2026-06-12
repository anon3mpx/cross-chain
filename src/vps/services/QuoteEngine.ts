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
  GasZipOfferComposition,
  ProviderAssetRef,
  QuoteAmountView,
  QuoteAmountsBreakdown,
  QuoteLegView,
  QuoteLegsBreakdown,
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
import {
  getEmpsealRouterAddressForChain,
  getSettlementTokenAddress,
  getSwapPluginIdForChain,
  getSwapPluginKindForChain,
} from '../config/contracts';
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
import {
  HyperlaneNexusQuoteWorker,
  type HyperlaneNexusQuoteResult,
  inferHyperlaneAssetSymbol,
} from './hyperlane/HyperlaneNexusQuoteWorker';
import {
  BrokerChainflipQuoteWorker,
  type ChainflipQuoteResult,
  type ChainflipQuoteWorker,
  toChainflipAsset,
} from './chainflip/ChainflipQuoteWorker';
import {
  MidgardMayaQuoteWorker,
  type MayaQuoteResult,
  type MayaQuoteWorker,
  toMayaAsset,
} from './maya/MayaQuoteWorker';
import {
  GasZipQuoteWorker,
  type GasZipQuoteResult,
} from './gaszip/GasZipQuoteWorker';
import {
  SdkTeleSwapQuoteWorker,
  type TeleSwapQuoteResult,
  type TeleSwapQuoteWorker,
} from './teleswap/TeleSwapQuoteWorker';
import {
  EmpsealQuoteWorker,
  type EmpsealQuoteWorkerLike,
} from './empseal/EmpsealQuoteWorker';
import { RailSelector } from './RailSelector';
import {
  ZERO_PLUGIN_ID,
  getCctpDomain,
  getCctpMetadata,
  getRailConfig,
  isCctpFastPluginId,
} from '../rails/registry';
import {
  OPTIMISM_DEFAULT_MIN_GAS_LIMIT,
  OPTIMISM_DEPOSIT_ETA_SECONDS,
  OPTIMISM_L1_BRIDGE_IFACE,
  OPTIMISM_L1_STANDARD_BRIDGE,
  OPTIMISM_L2_BRIDGE_IFACE,
  OPTIMISM_L2_STANDARD_BRIDGE,
  OPTIMISM_NATIVE_BRIDGE_RAIL_PROVIDER,
  OPTIMISM_NATIVE_TOKEN_SENTINEL,
  resolveOptimismNativeBridgeRoute,
} from './nativebridge/optimism';

const CACHE_TTL_MS = 120_000; // Cache full quotes for 2 minutes. This is a tradeoff to reduce RPC calls while keeping quotes reasonably fresh.
const LOWER_HEX_ADDR_RE = /^0x[0-9a-f]{40}$/;
const ROUTER_MAX_FEE_BPS = 100; // RouterV1.MAX_FEE_BPS
const PROTOCOL_FEE_BPS = 15; // 0.15%
const QUOTE_SLIPPAGE_BPS = 10; // 0.1%
const LAYERZERO_STARGATE_POOL_SLIPPAGE_BPS = 50; // 0.5%
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
  hyperlaneNexusQuoteWorker?: Pick<HyperlaneNexusQuoteWorker, 'quote'>;
  gasZipQuoteWorker?: Pick<GasZipQuoteWorker, 'quoteDirectDeposit'>;
  chainflipQuoteWorker?: Pick<ChainflipQuoteWorker, 'quote'>;
  mayaQuoteWorker?: Pick<MayaQuoteWorker, 'quote'>;
  teleSwapQuoteWorker?: Pick<TeleSwapQuoteWorker, 'quote'>;
  empsealQuoteWorker?: EmpsealQuoteWorkerLike;
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
  private readonly hyperlaneNexusQuoteWorker?: Pick<HyperlaneNexusQuoteWorker, 'quote'>;
  private readonly gasZipQuoteWorker?: Pick<GasZipQuoteWorker, 'quoteDirectDeposit'>;
  private readonly chainflipQuoteWorker?: Pick<ChainflipQuoteWorker, 'quote'>;
  private readonly mayaQuoteWorker?: Pick<MayaQuoteWorker, 'quote'>;
  private readonly teleSwapQuoteWorker?: Pick<TeleSwapQuoteWorker, 'quote'>;
  private readonly empsealQuoteWorker?: EmpsealQuoteWorkerLike;
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
    const hasExplicitHyperlaneNexusWorker = Object.prototype.hasOwnProperty.call(deps, 'hyperlaneNexusQuoteWorker');
    this.hyperlaneNexusQuoteWorker = hasExplicitHyperlaneNexusWorker
      ? deps.hyperlaneNexusQuoteWorker
      : this._readBoolEnv('ENABLE_HYPERLANE_NEXUS', false)
        ? new HyperlaneNexusQuoteWorker()
        : undefined;
    const hasExplicitGasZipWorker = Object.prototype.hasOwnProperty.call(deps, 'gasZipQuoteWorker');
    this.gasZipQuoteWorker = hasExplicitGasZipWorker
      ? deps.gasZipQuoteWorker
      : this._readBoolEnv('ENABLE_GASZIP_DIRECT_DEPOSIT', false)
        ? new GasZipQuoteWorker()
        : undefined;
    const hasExplicitChainflipWorker = Object.prototype.hasOwnProperty.call(deps, 'chainflipQuoteWorker');
    this.chainflipQuoteWorker = hasExplicitChainflipWorker
      ? deps.chainflipQuoteWorker
      : process.env.CHAINFLIP_BROKER_URL
        ? new BrokerChainflipQuoteWorker()
        : undefined;
    const hasExplicitMayaWorker = Object.prototype.hasOwnProperty.call(deps, 'mayaQuoteWorker');
    this.mayaQuoteWorker = hasExplicitMayaWorker
      ? deps.mayaQuoteWorker
      : this._readBoolEnv('ENABLE_MAYA', false)
        ? new MidgardMayaQuoteWorker()
        : undefined;
    const hasExplicitTeleSwapWorker = Object.prototype.hasOwnProperty.call(deps, 'teleSwapQuoteWorker');
    this.teleSwapQuoteWorker = hasExplicitTeleSwapWorker
      ? deps.teleSwapQuoteWorker
      : process.env.TELESWAP_API_URL
        ? new SdkTeleSwapQuoteWorker()
        : undefined;
    this.empsealQuoteWorker = deps.empsealQuoteWorker ?? new EmpsealQuoteWorker();
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

  buildGasZipComposition(
    req: QuoteRequest,
    offerSet: OfferSet,
  ): GasZipOfferComposition | null {
    if (!req.destinationGas || req.destinationGas.length === 0) return null;

    const gasZipDestinationGasOffer = offerSet.offers.find((offer) =>
      offer.rail === Rail.GASZIP && offer.offerType === 'gaszip_api_direct',
    );
    if (!gasZipDestinationGasOffer) return null;

    const preferredPrimary = offerSet.bestOfferId
      ? offerSet.offers.find((offer) => offer.offerId === offerSet.bestOfferId && offer.rail !== Rail.GASZIP)
      : undefined;
    const primaryTransferOffer = preferredPrimary
      ?? offerSet.offers.find((offer) => offer.rail !== Rail.GASZIP);
    if (!primaryTransferOffer) return null;

    return {
      kind: 'primary_transfer_with_gaszip_destination_gas',
      primaryTransferOfferId: primaryTransferOffer.offerId,
      gasZipDestinationGasOfferId: gasZipDestinationGasOffer.offerId,
      primaryTransferOffer,
      gasZipDestinationGasOffer,
      executionPlan: [
        {
          step: 1,
          offerId: primaryTransferOffer.offerId,
          rail: primaryTransferOffer.rail,
          executionMode: primaryTransferOffer.executionMode,
          label: 'primary_transfer',
        },
        {
          step: 2,
          offerId: gasZipDestinationGasOffer.offerId,
          rail: gasZipDestinationGasOffer.rail,
          executionMode: gasZipDestinationGasOffer.executionMode,
          label: 'gaszip_destination_gas',
        },
      ],
      uxHints: {
        destinationGasProvider: 'gaszip',
        destinationGasIncluded: true,
        recommendedExecution: 'primary_then_gas',
        atomic: false,
      },
    };
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
      amounts: executionQuote.amounts,
      legs: executionQuote.legs,
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

    const feeRatioBps = BigInt(Math.min(PROTOCOL_FEE_BPS, ROUTER_MAX_FEE_BPS));
    const feeAmountToken = (req.amountIn * feeRatioBps) / BPS_DENOMINATOR;
    if (feeAmountToken >= req.amountIn) return null;
    const protocolFeeUSD = this._protocolFeeUSD(req.tokenIn, req.srcChainId, feeAmountToken, amountUSD);
    const totalFeeUSD = protocolFeeUSD;
    const amountAfterFee = req.amountIn - feeAmountToken;

    // Get src swap quote: tokenIn → settlementToken
    let srcSwapAmount: bigint;
    let swapDataSrc = '0x';
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
      const srcPlan = await this._buildSwapPlan(req.srcChainId, req.tokenIn, settlementAddrSrc, amountAfterFee);
      if (!srcPlan) return null;
      srcSwapAmount = srcPlan.amountOut;
      swapDataSrc = srcPlan.data;
    }
    const minSrcSwapOut = srcSwapNeeded ? (srcSwapAmount * 995n) / 1000n : 0n;

    let railPluginId = config.pluginId;
    let railData = '0x';
    let bridgeAmount = srcSwapAmount;
    let realizedRailFeeUSD = 0;
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
    let swapDataDst = '0x';
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
      const dstPlan = await this._buildSwapPlan(req.dstChainId, settlementAddrDst, req.tokenOut, bridgeAmount);
      if (!dstPlan) return null;
      dstSwapAmount = dstPlan.amountOut;
      swapDataDst = dstPlan.data;
    }

    const srcSwapPluginId = srcSwapNeeded
      ? (getSwapPluginIdForChain(req.srcChainId) ?? ZERO_PLUGIN_ID)
      : ZERO_PLUGIN_ID;
    if (srcSwapNeeded && srcSwapPluginId === ZERO_PLUGIN_ID) return null;
    const dstSwapPluginId = dstSwapNeeded
      ? (getSwapPluginIdForChain(req.dstChainId) ?? ZERO_PLUGIN_ID)
      : ZERO_PLUGIN_ID;
    if (dstSwapNeeded && dstSwapPluginId === ZERO_PLUGIN_ID) return null;

    const executionSlippageBps = this._quoteSlippageBps(hop.rail, routeAsset.offerType);
    const minAmountOut = this._applySlippage(dstSwapAmount, executionSlippageBps);
    const minSettlementAmount = this._applySlippage(bridgeAmount, executionSlippageBps);
    const settlementTokenAddress = settlementAddrDst ?? settlementAddrSrc;
    const amounts = this._buildBreakdownAmounts({
      input: this._tokenAmount(req.srcChainId, req.tokenIn, req.amountIn, routeAsset.routeAsset, routeAsset.sourceSettlementAsset),
      bridgeSettlement: this._tokenAmount(
        req.dstChainId,
        settlementTokenAddress,
        bridgeAmount,
        routeAsset.destinationSettlementAsset,
        routeAsset.routeAsset,
      ),
      minimumBridgeSettlement: this._tokenAmount(
        req.dstChainId,
        settlementTokenAddress,
        minSettlementAmount,
        routeAsset.destinationSettlementAsset,
        routeAsset.routeAsset,
      ),
      output: this._tokenAmount(req.dstChainId, req.tokenOut, dstSwapAmount, routeAsset.destinationSettlementAsset),
      minimumOutput: this._tokenAmount(req.dstChainId, req.tokenOut, minAmountOut, routeAsset.destinationSettlementAsset),
    });
    const legs = this._buildLegBreakdown({
      srcSwap: srcSwapNeeded
        ? this._legView(
          req.srcChainId,
          req.tokenIn,
          settlementAddrSrc,
          amountAfterFee,
          srcSwapAmount,
          minSrcSwapOut,
          routeAsset.routeAsset,
          routeAsset.sourceSettlementAsset,
        )
        : undefined,
      bridge: this._legView(
        req.srcChainId,
        settlementAddrSrc,
        settlementTokenAddress,
        srcSwapAmount,
        bridgeAmount,
        minSettlementAmount,
        routeAsset.sourceSettlementAsset,
        routeAsset.destinationSettlementAsset,
      ),
      dstSwap: dstSwapNeeded
        ? this._legView(
          req.dstChainId,
          settlementTokenAddress,
          req.tokenOut,
          bridgeAmount,
          dstSwapAmount,
          minAmountOut,
          routeAsset.destinationSettlementAsset,
          routeAsset.routeAsset,
        )
        : undefined,
    });
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
        amounts,
        legs,
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
        swapDataSrc,
        swapDataDst,
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
      refundAddress: this._defaultRefundAddress(req),
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
    if (!dstChain
      && !this.thorchainQuoteWorker
      && !this.chainflipQuoteWorker
      && !this.mayaQuoteWorker
      && !this.teleSwapQuoteWorker) {
      return null;
    }

    const amountUSD = await this._estimateUSD(req.tokenIn, req.srcChainId, req.amountIn);
    const candidateRoutes = this.routeBuilder
      .buildRoutes(req.srcChainId, req.dstChainId, amountUSD, req.urgency ?? 'normal')
      .filter((route) =>
        route.viable
          && route.hops.length === 1
          && route.hops[0].rail !== Rail.THORCHAIN
          && route.hops[0].rail !== Rail.CHAINFLIP
          && route.hops[0].rail !== Rail.MAYA
          && route.hops[0].rail !== Rail.TELESWAP
          && route.hops[0].rail !== Rail.HYPERLANE_NEXUS
          && route.hops[0].rail !== Rail.OPTIMISM_NATIVE_BRIDGE,
      );

    const [
      routeOffers,
      thorOffer,
      chainflipOffer,
      mayaOffer,
      teleSwapOffer,
      layerZeroValueTransferApiOffer,
      hyperlaneNexusOffer,
      optimismNativeBridgeOffer,
      gasZipOffer,
    ] = await Promise.all([
      Promise.all(candidateRoutes.map(async (route) => {
        try {
          return await this._buildOffer(req, route, amountUSD);
        } catch {
          return null;
        }
      })),
      this._buildTHORChainProviderDirectOffer(req, amountUSD),
      this._buildChainflipProviderDirectOffer(req),
      this._buildMayaProviderDirectOffer(req),
      this._buildTeleSwapProviderDirectOffer(req),
      this._buildLayerZeroValueTransferApiProviderDirectOffer(req),
      this._buildHyperlaneNexusProviderDirectOffer(req),
      this._buildOptimismNativeBridgeProviderDirectOffer(req),
      this._buildGasZipProviderDirectOffer(req),
    ]);

    const offers = routeOffers.filter((offer): offer is RailOffer => offer !== null);
    if (thorOffer) offers.push(thorOffer);
    if (chainflipOffer) offers.push(chainflipOffer);
    if (mayaOffer) offers.push(mayaOffer);
    if (teleSwapOffer) offers.push(teleSwapOffer);
    if (layerZeroValueTransferApiOffer) offers.push(layerZeroValueTransferApiOffer);
    if (hyperlaneNexusOffer) offers.push(hyperlaneNexusOffer);
    if (optimismNativeBridgeOffer) offers.push(optimismNativeBridgeOffer);
    if (gasZipOffer) offers.push(gasZipOffer);
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
    const feeRatioBps = BigInt(Math.min(PROTOCOL_FEE_BPS, ROUTER_MAX_FEE_BPS));
    const feeAmountToken = (req.amountIn * feeRatioBps) / BPS_DENOMINATOR;
    if (feeAmountToken >= req.amountIn) return null;
    const protocolFeeUSD = this._protocolFeeUSD(req.tokenIn, req.srcChainId, feeAmountToken, amountUSD);
    const totalFeeUSD = protocolFeeUSD;
    const amountAfterFee = req.amountIn - feeAmountToken;

    const quoteRequest = await buildTHORChainQuoteRequestFromPair({
      amountIn: amountAfterFee,
      srcChainId: req.srcChainId,
      dstChainId: req.dstChainId,
      tokenIn: req.tokenIn,
      tokenOut: req.tokenOut,
      destinationAddress: req.nativeDstAddress ?? req.userAddress,
      refundAddress: this._defaultRefundAddress(req),
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
    const minAmountOut = this._applySlippage(minThorOutput, QUOTE_SLIPPAGE_BPS);
    const amounts = this._buildBreakdownAmounts({
      input: this._tokenAmount(req.srcChainId, req.tokenIn, req.amountIn),
      output: this._tokenAmount(req.dstChainId, req.tokenOut, minThorOutput, routeAsset),
      minimumOutput: this._tokenAmount(req.dstChainId, req.tokenOut, minAmountOut, routeAsset),
    });
    const quote: QuoteResult = {
      intentId: this._makeIntentId(),
      srcChainId: req.srcChainId,
      dstChainId: req.dstChainId,
      tokenIn: req.tokenIn,
      tokenOut: req.tokenOut,
      amountIn: req.amountIn,
      estimatedOut: minThorOutput,
      minAmountOut,
      minSrcSwapOut: 0n,
      amounts,
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
      refundAddress: this._defaultRefundAddress(req),
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
      amounts: quote.amounts,
      legs: quote.legs,
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
        refundAddress: quote.refundAddress,
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

  private async _buildChainflipProviderDirectOffer(
    req: QuoteRequest,
  ): Promise<RailOffer | null> {
    if (!this.chainflipQuoteWorker) return null;

    const destinationAddress = req.nativeDstAddress ?? req.userAddress;
    let result: ChainflipQuoteResult | null;
    try {
      result = await this.chainflipQuoteWorker.quote({
        srcChainId: req.srcChainId,
        dstChainId: req.dstChainId,
        tokenIn: req.tokenIn,
        tokenOut: req.tokenOut,
        amountIn: req.amountIn,
        destinationAddress,
        refundAddress: this._defaultRefundAddress(req),
      });
    } catch {
      return null;
    }
    if (!result || result.expectedAmountOut <= 0n) return null;

    const config = getRailConfig(Rail.CHAINFLIP);
    const intentId = this._makeIntentId();
    const dstAssetId = toChainflipAsset(req.dstChainId, this._directRailSymbol(req.tokenOut));
    const settlementToken = this._inferChainflipSettlementToken(req.dstChainId, dstAssetId);
    const routeAsset = this._toTHORChainProviderAssetRef(
      req.srcChainId,
      req.dstChainId,
      toChainflipAsset(req.srcChainId, this._directRailSymbol(req.tokenIn)) ?? 'CHAINFLIP',
      this._inferChainflipSettlementToken(req.srcChainId, toChainflipAsset(req.srcChainId, this._directRailSymbol(req.tokenIn))),
      undefined,
      req.tokenIn,
    );
    const destinationSettlementAsset = this._toTHORChainProviderAssetRef(
      req.srcChainId,
      req.dstChainId,
      dstAssetId ?? 'CHAINFLIP',
      settlementToken,
      undefined,
      req.tokenOut,
    );
    const minAmountOut = this._applySlippage(result.expectedAmountOut, QUOTE_SLIPPAGE_BPS);
    const amounts = this._buildBreakdownAmounts({
      input: this._tokenAmount(req.srcChainId, req.tokenIn, req.amountIn, routeAsset),
      output: this._tokenAmount(req.dstChainId, req.tokenOut, result.expectedAmountOut, destinationSettlementAsset),
      minimumOutput: this._tokenAmount(req.dstChainId, req.tokenOut, minAmountOut, destinationSettlementAsset),
    });

    const quote: QuoteResult = {
      intentId,
      srcChainId: req.srcChainId,
      dstChainId: req.dstChainId,
      tokenIn: req.tokenIn,
      tokenOut: req.tokenOut,
      amountIn: req.amountIn,
      estimatedOut: result.expectedAmountOut,
      minAmountOut,
      minSrcSwapOut: 0n,
      amounts,
      feeAmountUSD: 0,
      feeAmountToken: 0n,
      rail: Rail.CHAINFLIP,
      railType: config.railType,
      settlementToken,
      routeAsset,
      settlementAssetId: this._zeroBytes32(),
      expectedDstSettlementToken: req.tokenOut,
      expectedDstSettlementAssetId: this._zeroBytes32(),
      minSettlementAmount: result.expectedAmountOut,
      dstGasLimit: 0,
      etaSeconds: result.etaSeconds,
      expiresAt: result.expiresAtUnix,
      railPluginId: ZERO_PLUGIN_ID,
      railData: '0x',
      swapPluginIdSrc: ZERO_PLUGIN_ID,
      swapPluginIdDst: ZERO_PLUGIN_ID,
      swapDataSrc: '0x',
      swapDataDst: '0x',
      nativeDstAddress: req.nativeDstAddress,
      refundAddress: this._defaultRefundAddress(req),
      chainflipChannelId: result.channelId,
    };

    return {
      offerId: intentId,
      rail: Rail.CHAINFLIP,
      offerType: 'chainflip_broker_direct',
      railType: config.railType,
      srcChainId: req.srcChainId,
      dstChainId: req.dstChainId,
      tokenIn: req.tokenIn,
      tokenOut: req.tokenOut,
      amountIn: req.amountIn,
      estimatedOut: result.expectedAmountOut,
      minAmountOut,
      expiresAt: result.expiresAtUnix,
      deliveryShape: 'direct',
      executionMode: 'provider_direct',
      routeAsset,
      amounts: quote.amounts,
      legs: quote.legs,
      sourceSettlementAsset: routeAsset,
      destinationSettlementAsset,
      economics: {
        providerFeeUSD: 0,
        protocolFeeUSD: 0,
        sourceGasUSD: 0,
        settlementTimeSeconds: result.etaSeconds,
      },
      execution: {
        provider: 'chainflip_broker',
        quote,
        depositAddress: result.depositAddress,
        channelId: result.channelId,
        expectedAmountOut: result.expectedAmountOut.toString(),
        effectiveRateBps: result.effectiveRateBps,
        brokerFeeAmount: result.brokerFeeAmount.toString(),
        sourceFee: result.networkFees.sourceFee.toString(),
        destinationFee: result.networkFees.destinationFee.toString(),
        refundAddress: quote.refundAddress,
      },
    };
  }

  private async _buildMayaProviderDirectOffer(
    req: QuoteRequest,
  ): Promise<RailOffer | null> {
    if (!this.mayaQuoteWorker) return null;

    const destinationAddress = req.nativeDstAddress ?? req.userAddress;
    let result: MayaQuoteResult | null;
    try {
      result = await this.mayaQuoteWorker.quote({
        srcChainId: req.srcChainId,
        dstChainId: req.dstChainId,
        tokenIn: req.tokenIn,
        tokenOut: req.tokenOut,
        amountIn: req.amountIn,
        destinationAddress,
      });
    } catch {
      return null;
    }
    if (!result || result.expectedAmountOut <= 0n) return null;

    const config = getRailConfig(Rail.MAYA);
    const intentId = this._makeIntentId();
    const destinationAssetId = toMayaAsset(req.dstChainId, this._directRailSymbol(req.tokenOut));
    const settlementToken = this._inferMayaSettlementToken(req.dstChainId, destinationAssetId);
    const routeAsset = this._toTHORChainProviderAssetRef(
      req.srcChainId,
      req.dstChainId,
      toMayaAsset(req.srcChainId, this._directRailSymbol(req.tokenIn)) ?? 'MAYA',
      this._inferMayaSettlementToken(req.srcChainId, toMayaAsset(req.srcChainId, this._directRailSymbol(req.tokenIn))),
      undefined,
      req.tokenIn,
    );
    const destinationSettlementAsset = this._toTHORChainProviderAssetRef(
      req.srcChainId,
      req.dstChainId,
      destinationAssetId ?? 'MAYA',
      settlementToken,
      undefined,
      req.tokenOut,
    );
    const minAmountOut = this._applySlippage(result.expectedAmountOut, Math.max(QUOTE_SLIPPAGE_BPS, result.slipBps));
    const amounts = this._buildBreakdownAmounts({
      input: this._tokenAmount(req.srcChainId, req.tokenIn, req.amountIn, routeAsset),
      output: this._tokenAmount(req.dstChainId, req.tokenOut, result.expectedAmountOut, destinationSettlementAsset),
      minimumOutput: this._tokenAmount(req.dstChainId, req.tokenOut, minAmountOut, destinationSettlementAsset),
    });

    const quote: QuoteResult = {
      intentId,
      srcChainId: req.srcChainId,
      dstChainId: req.dstChainId,
      tokenIn: req.tokenIn,
      tokenOut: req.tokenOut,
      amountIn: req.amountIn,
      estimatedOut: result.expectedAmountOut,
      minAmountOut,
      minSrcSwapOut: 0n,
      amounts,
      feeAmountUSD: 0,
      feeAmountToken: 0n,
      rail: Rail.MAYA,
      railType: config.railType,
      settlementToken,
      routeAsset,
      settlementAssetId: this._zeroBytes32(),
      expectedDstSettlementToken: req.tokenOut,
      expectedDstSettlementAssetId: this._zeroBytes32(),
      minSettlementAmount: result.expectedAmountOut,
      dstGasLimit: 0,
      etaSeconds: result.etaSeconds,
      expiresAt: result.expiresAtUnix,
      railPluginId: ZERO_PLUGIN_ID,
      railData: '0x',
      swapPluginIdSrc: ZERO_PLUGIN_ID,
      swapPluginIdDst: ZERO_PLUGIN_ID,
      swapDataSrc: '0x',
      swapDataDst: '0x',
      nativeDstAddress: req.nativeDstAddress,
      refundAddress: this._defaultRefundAddress(req),
    };

    return {
      offerId: intentId,
      rail: Rail.MAYA,
      offerType: 'maya_direct',
      railType: config.railType,
      srcChainId: req.srcChainId,
      dstChainId: req.dstChainId,
      tokenIn: req.tokenIn,
      tokenOut: req.tokenOut,
      amountIn: req.amountIn,
      estimatedOut: result.expectedAmountOut,
      minAmountOut,
      expiresAt: result.expiresAtUnix,
      deliveryShape: 'direct',
      executionMode: 'provider_direct',
      routeAsset,
      amounts: quote.amounts,
      legs: quote.legs,
      sourceSettlementAsset: routeAsset,
      destinationSettlementAsset,
      economics: {
        providerFeeUSD: 0,
        protocolFeeUSD: 0,
        sourceGasUSD: 0,
        slippageBps: result.slipBps,
        settlementTimeSeconds: result.etaSeconds,
      },
      execution: {
        provider: 'maya_midgard',
        quote,
        vaultAddress: result.vaultAddress,
        depositAddress: result.vaultAddress,
        memo: result.memo,
        expectedAmountOut: result.expectedAmountOut.toString(),
        expiresAt: result.expiresAtUnix,
        refundAddress: quote.refundAddress,
      },
    };
  }

  private async _buildTeleSwapProviderDirectOffer(
    req: QuoteRequest,
  ): Promise<RailOffer | null> {
    if (!this.teleSwapQuoteWorker) return null;

    let result: TeleSwapQuoteResult | null;
    try {
      result = await this.teleSwapQuoteWorker.quote({
        srcChainId: req.srcChainId,
        dstChainId: req.dstChainId,
        tokenIn: req.tokenIn,
        tokenOut: req.tokenOut,
        amountIn: req.amountIn,
        destinationAddress: req.nativeDstAddress ?? req.userAddress,
        refundAddress: this._defaultRefundAddress(req),
      });
    } catch {
      return null;
    }
    if (!result || result.expectedAmountOut <= 0n) return null;

    const config = getRailConfig(Rail.TELESWAP);
    const intentId = this._makeIntentId();
    const settlementToken = this._inferTeleSwapSettlementToken(req.dstChainId);
    const routeAsset = this._toTHORChainProviderAssetRef(
      req.srcChainId,
      req.dstChainId,
      req.srcChainId === 0 ? 'BTC.BTC' : 'TELESWAP',
      req.srcChainId === 0 ? SettlementToken.BTC : SettlementToken.USDC,
      undefined,
      req.tokenIn,
    );
    const destinationSettlementAsset = this._toTHORChainProviderAssetRef(
      req.srcChainId,
      req.dstChainId,
      req.dstChainId === 0 ? 'BTC.BTC' : 'TELESWAP',
      settlementToken,
      undefined,
      req.tokenOut,
    );
    const minAmountOut = this._applySlippage(result.expectedAmountOut, Math.max(QUOTE_SLIPPAGE_BPS, result.slipBps));
    const amounts = this._buildBreakdownAmounts({
      input: this._tokenAmount(req.srcChainId, req.tokenIn, req.amountIn, routeAsset),
      output: this._tokenAmount(req.dstChainId, req.tokenOut, result.expectedAmountOut, destinationSettlementAsset),
      minimumOutput: this._tokenAmount(req.dstChainId, req.tokenOut, minAmountOut, destinationSettlementAsset),
    });

    const quote: QuoteResult = {
      intentId,
      srcChainId: req.srcChainId,
      dstChainId: req.dstChainId,
      tokenIn: req.tokenIn,
      tokenOut: req.tokenOut,
      amountIn: req.amountIn,
      estimatedOut: result.expectedAmountOut,
      minAmountOut,
      minSrcSwapOut: 0n,
      amounts,
      feeAmountUSD: 0,
      feeAmountToken: 0n,
      rail: Rail.TELESWAP,
      railType: config.railType,
      settlementToken,
      routeAsset,
      settlementAssetId: this._zeroBytes32(),
      expectedDstSettlementToken: req.tokenOut,
      expectedDstSettlementAssetId: this._zeroBytes32(),
      minSettlementAmount: result.expectedAmountOut,
      dstGasLimit: 0,
      etaSeconds: result.etaSeconds,
      expiresAt: Math.floor(Date.now() / 1000) + 600,
      railPluginId: ZERO_PLUGIN_ID,
      railData: '0x',
      swapPluginIdSrc: ZERO_PLUGIN_ID,
      swapPluginIdDst: ZERO_PLUGIN_ID,
      swapDataSrc: '0x',
      swapDataDst: '0x',
      nativeDstAddress: req.nativeDstAddress,
      refundAddress: this._defaultRefundAddress(req),
      teleSwapSwapId: result.swapId,
    };

    return {
      offerId: intentId,
      rail: Rail.TELESWAP,
      offerType: 'teleswap_direct',
      railType: config.railType,
      srcChainId: req.srcChainId,
      dstChainId: req.dstChainId,
      tokenIn: req.tokenIn,
      tokenOut: req.tokenOut,
      amountIn: req.amountIn,
      estimatedOut: result.expectedAmountOut,
      minAmountOut,
      expiresAt: quote.expiresAt,
      deliveryShape: 'direct',
      executionMode: 'provider_direct',
      routeAsset,
      amounts: quote.amounts,
      legs: quote.legs,
      sourceSettlementAsset: routeAsset,
      destinationSettlementAsset,
      economics: {
        providerFeeUSD: 0,
        protocolFeeUSD: 0,
        sourceGasUSD: 0,
        slippageBps: result.slipBps,
        settlementTimeSeconds: result.etaSeconds,
      },
      execution: {
        provider: 'teleswap_api',
        quote,
        depositAddress: result.depositAddress,
        expectedAmountOut: result.expectedAmountOut.toString(),
        protocolFeeAmount: result.protocolFeeAmount.toString(),
        dexRouter: result.dexRouter,
        swapId: result.swapId,
        refundAddress: quote.refundAddress,
      },
    };
  }

  private async _buildOptimismNativeBridgeProviderDirectOffer(
    req: QuoteRequest,
  ): Promise<RailOffer | null> {
    const route = resolveOptimismNativeBridgeRoute(
      req.srcChainId,
      req.dstChainId,
      req.tokenIn,
      req.tokenOut,
    );
    if (!route) return null;
    if (route.requiresPatient && req.urgency !== 'patient') return null;

    const config = getRailConfig(Rail.OPTIMISM_NATIVE_BRIDGE);
    const intentId = this._makeIntentId();
    const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;
    const recipient = getAddress(req.userAddress);
    const settlementToken = route.settlementSymbol === 'USDC'
      ? SettlementToken.USDC
      : route.settlementSymbol === 'USDT'
        ? SettlementToken.USDT
        : SettlementToken.ETH;
    const sourceAsset = route.settlementKind === 'native'
      ? this._buildOptimismNativeBridgeAssetRef(req.srcChainId, OPTIMISM_NATIVE_TOKEN_SENTINEL, route.settlementSymbol, route.decimals, 'native')
      : this._buildOptimismNativeBridgeAssetRef(req.srcChainId, req.tokenIn, route.settlementSymbol, route.decimals, 'erc20');
    const destinationAsset = route.settlementKind === 'native'
      ? this._buildOptimismNativeBridgeAssetRef(req.dstChainId, OPTIMISM_NATIVE_TOKEN_SENTINEL, route.settlementSymbol, route.decimals, 'native')
      : this._buildOptimismNativeBridgeAssetRef(req.dstChainId, req.tokenOut, route.settlementSymbol, route.decimals, 'erc20');
    const amounts = this._buildBreakdownAmounts({
      input: this._tokenAmount(req.srcChainId, req.tokenIn, req.amountIn, sourceAsset),
      bridgeSettlement: this._tokenAmount(req.dstChainId, req.tokenOut, req.amountIn, destinationAsset),
      minimumBridgeSettlement: this._tokenAmount(req.dstChainId, req.tokenOut, req.amountIn, destinationAsset),
      output: this._tokenAmount(req.dstChainId, req.tokenOut, req.amountIn, destinationAsset),
      minimumOutput: this._tokenAmount(req.dstChainId, req.tokenOut, req.amountIn, destinationAsset),
    });

    const tx = route.direction === 'deposit'
      ? route.settlementKind === 'native'
        ? {
          to: OPTIMISM_L1_STANDARD_BRIDGE,
          data: OPTIMISM_L1_BRIDGE_IFACE.encodeFunctionData('depositETHTo', [
            recipient,
            OPTIMISM_DEFAULT_MIN_GAS_LIMIT,
            '0x',
          ]),
          value: req.amountIn.toString(),
          chainId: req.srcChainId,
        }
        : {
          to: OPTIMISM_L1_STANDARD_BRIDGE,
          data: OPTIMISM_L1_BRIDGE_IFACE.encodeFunctionData('depositERC20To', [
            route.l1Token,
            route.l2Token,
            recipient,
            req.amountIn,
            OPTIMISM_DEFAULT_MIN_GAS_LIMIT,
            '0x',
          ]),
          value: '0',
          chainId: req.srcChainId,
        }
      : route.settlementKind === 'native'
        ? {
          to: OPTIMISM_L2_STANDARD_BRIDGE,
          data: OPTIMISM_L2_BRIDGE_IFACE.encodeFunctionData('bridgeETHTo', [
            recipient,
            OPTIMISM_DEFAULT_MIN_GAS_LIMIT,
            '0x',
          ]),
          value: req.amountIn.toString(),
          chainId: req.srcChainId,
        }
        : {
          to: OPTIMISM_L2_STANDARD_BRIDGE,
          data: OPTIMISM_L2_BRIDGE_IFACE.encodeFunctionData('bridgeERC20To', [
            route.l2Token,
            route.l1Token,
            recipient,
            req.amountIn,
            OPTIMISM_DEFAULT_MIN_GAS_LIMIT,
            '0x',
          ]),
          value: '0',
          chainId: req.srcChainId,
        };
    const approvals = route.settlementKind === 'erc20'
      ? [{
        token: req.tokenIn,
        spender: tx.to,
        amount: req.amountIn.toString(),
      }]
      : undefined;

    const quote: QuoteResult = {
      intentId,
      srcChainId: req.srcChainId,
      dstChainId: req.dstChainId,
      tokenIn: req.tokenIn,
      tokenOut: req.tokenOut,
      amountIn: req.amountIn,
      estimatedOut: req.amountIn,
      minAmountOut: req.amountIn,
      minSrcSwapOut: 0n,
      amounts,
      feeAmountUSD: 0,
      feeAmountToken: 0n,
      rail: Rail.OPTIMISM_NATIVE_BRIDGE,
      railType: config.railType,
      settlementToken,
      routeAsset: sourceAsset,
      settlementAssetId: route.settlementKind === 'erc20'
        ? this._settlementAssetId(req.srcChainId, req.tokenIn)
        : this._zeroBytes32(),
      expectedDstSettlementToken: req.tokenOut,
      expectedDstSettlementAssetId: route.settlementKind === 'erc20'
        ? this._settlementAssetId(req.dstChainId, req.tokenOut)
        : this._zeroBytes32(),
      minSettlementAmount: req.amountIn,
      dstGasLimit: 0,
      etaSeconds: route.etaSeconds,
      expiresAt,
      railPluginId: ZERO_PLUGIN_ID,
      railData: '0x',
      swapPluginIdSrc: ZERO_PLUGIN_ID,
      swapPluginIdDst: ZERO_PLUGIN_ID,
      swapDataSrc: '0x',
      swapDataDst: '0x',
      offerType: 'optimism_native_bridge_direct',
      executionMode: 'provider_direct',
    };

    return {
      offerId: intentId,
      rail: Rail.OPTIMISM_NATIVE_BRIDGE,
      offerType: 'optimism_native_bridge_direct',
      railType: config.railType,
      srcChainId: req.srcChainId,
      dstChainId: req.dstChainId,
      tokenIn: req.tokenIn,
      tokenOut: req.tokenOut,
      amountIn: req.amountIn,
      estimatedOut: req.amountIn,
      minAmountOut: req.amountIn,
      expiresAt,
      deliveryShape: 'direct',
      executionMode: 'provider_direct',
      routeAsset: sourceAsset,
      amounts: quote.amounts,
      legs: quote.legs,
      sourceSettlementAsset: sourceAsset,
      destinationSettlementAsset: destinationAsset,
      economics: {
        providerFeeUSD: 0,
        protocolFeeUSD: 0,
        sourceGasUSD: 0,
        settlementTimeSeconds: route.etaSeconds,
      },
      execution: {
        provider: OPTIMISM_NATIVE_BRIDGE_RAIL_PROVIDER,
        quote,
        direction: route.direction,
        settlementKind: route.settlementKind,
        challengePeriodSeconds: route.requiresPatient ? route.etaSeconds : undefined,
        requiresPatient: route.requiresPatient,
        tx,
        approvals,
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
    const amounts = this._buildBreakdownAmounts({
      input: this._tokenAmount(req.srcChainId, req.tokenIn, req.amountIn, sourceAsset),
      bridgeSettlement: this._tokenAmount(req.dstChainId, result.destinationToken.address, estimatedOut, destinationAsset),
      minimumBridgeSettlement: this._tokenAmount(req.dstChainId, result.destinationToken.address, minAmountOut, destinationAsset),
      output: this._tokenAmount(req.dstChainId, req.tokenOut, estimatedOut, destinationAsset),
      minimumOutput: this._tokenAmount(req.dstChainId, req.tokenOut, minAmountOut, destinationAsset),
    });

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
      amounts,
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
      layerZeroValueTransferApiRouteSteps: result.quote.routeSteps ?? [],
      layerZeroValueTransferApiUserSteps: result.userSteps,
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
      amounts: quote.amounts,
      legs: quote.legs,
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

  private async _buildGasZipProviderDirectOffer(
    req: QuoteRequest,
  ): Promise<RailOffer | null> {
    if (!this.gasZipQuoteWorker) return null;

    let result: GasZipQuoteResult | null;
    try {
      result = await this.gasZipQuoteWorker.quoteDirectDeposit(req);
    } catch {
      return null;
    }
    if (!result) return null;

    const amountIn = this._parseBigInt(result.sourceValueWei);
    const estimatedOut = this._parseBigInt(result.expectedAmountWei);
    if (!amountIn || amountIn <= 0n || !estimatedOut || estimatedOut <= 0n) return null;

    const intentId = this._makeIntentId();
    const nativePlaceholder = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const settlementToken = this._inferSettlementTokenFromSymbol(result.destinationSymbol);
    const sourceAsset = this._toGasZipProviderAssetRef(result.srcChainId, result.sourceSymbol);
    const destinationAsset = this._toGasZipProviderAssetRef(result.dstChainId, result.destinationSymbol);
    const amounts = this._buildBreakdownAmounts({
      input: this._tokenAmount(req.srcChainId, nativePlaceholder, amountIn, sourceAsset),
      bridgeSettlement: this._tokenAmount(req.dstChainId, nativePlaceholder, estimatedOut, destinationAsset),
      minimumBridgeSettlement: this._tokenAmount(req.dstChainId, nativePlaceholder, estimatedOut, destinationAsset),
      output: this._tokenAmount(req.dstChainId, nativePlaceholder, estimatedOut, destinationAsset),
      minimumOutput: this._tokenAmount(req.dstChainId, nativePlaceholder, estimatedOut, destinationAsset),
    });

    const quote: QuoteResult = {
      intentId,
      srcChainId: req.srcChainId,
      dstChainId: req.dstChainId,
      tokenIn: nativePlaceholder,
      tokenOut: nativePlaceholder,
      amountIn,
      estimatedOut,
      minAmountOut: estimatedOut,
      minSrcSwapOut: 0n,
      amounts,
      feeAmountUSD: result.providerFeeUsd,
      feeAmountToken: 0n,
      rail: Rail.GASZIP,
      railType: 'messaging',
      settlementToken,
      routeAsset: sourceAsset,
      settlementAssetId: this._zeroBytes32(),
      expectedDstSettlementToken: nativePlaceholder,
      expectedDstSettlementAssetId: this._zeroBytes32(),
      minSettlementAmount: estimatedOut,
      dstGasLimit: 0,
      etaSeconds: result.settlementTimeSeconds,
      expiresAt: result.expiresAt,
      railPluginId: ZERO_PLUGIN_ID,
      railData: '0x',
      swapPluginIdSrc: ZERO_PLUGIN_ID,
      swapPluginIdDst: ZERO_PLUGIN_ID,
      swapDataSrc: '0x',
      swapDataDst: '0x',
      nativeDstAddress: result.recipient,
    };

    return {
      offerId: intentId,
      rail: Rail.GASZIP,
      offerType: 'gaszip_api_direct',
      railType: 'messaging',
      srcChainId: req.srcChainId,
      dstChainId: req.dstChainId,
      tokenIn: quote.tokenIn,
      tokenOut: quote.tokenOut,
      amountIn,
      estimatedOut,
      minAmountOut: estimatedOut,
      expiresAt: result.expiresAt,
      deliveryShape: 'direct',
      executionMode: 'provider_direct',
      routeAsset: sourceAsset,
      amounts: quote.amounts,
      legs: quote.legs,
      sourceSettlementAsset: sourceAsset,
      destinationSettlementAsset: destinationAsset,
      economics: {
        providerFeeUSD: result.providerFeeUsd,
        protocolFeeUSD: 0,
        sourceGasUSD: 0,
        settlementTimeSeconds: result.settlementTimeSeconds,
      },
      execution: {
        provider: 'gaszip',
        quote,
        directDepositAddress: result.directDepositAddress,
        calldata: result.calldata,
        requestedAmountWei: result.requestedAmountWei,
        expectedAmountWei: result.expectedAmountWei,
        sourceValueWei: result.sourceValueWei,
        tx: {
          to: result.directDepositAddress,
          data: result.calldata,
          value: result.sourceValueWei,
          chainId: result.srcChainId,
        },
      },
    };
  }

  private async _buildHyperlaneNexusProviderDirectOffer(
    req: QuoteRequest,
  ): Promise<RailOffer | null> {
    if (!this.hyperlaneNexusQuoteWorker) return null;

    const settlementToken = this._inferHyperlaneSettlementToken(req);
    const assetSymbol = inferHyperlaneAssetSymbol(settlementToken);
    if (!assetSymbol) return null;

    let result: HyperlaneNexusQuoteResult | null;
    try {
      result = await this.hyperlaneNexusQuoteWorker.quote({
        srcChainId: req.srcChainId,
        dstChainId: req.dstChainId,
        tokenIn: req.tokenIn,
        assetSymbol,
        amountIn: req.amountIn,
        destinationAddress: req.userAddress,
      });
    } catch {
      return null;
    }
    if (!result || result.expectedAmountOut <= 0n) return null;

    const intentId = this._makeIntentId();
    const sourceAsset = this._toProviderAssetRef(
      req.srcChainId,
      assetSymbol,
      settlementToken,
      Rail.HYPERLANE_NEXUS,
      req.tokenIn,
      req.tokenOut,
      'erc20',
    );
    const destinationAsset = {
      ...sourceAsset,
      tokenAddress: req.tokenOut,
      dstTokenAddress: req.tokenOut,
    };
    const expiresAt = Math.floor(Date.now() / 1000) + 120;
    const amounts = this._buildBreakdownAmounts({
      input: this._tokenAmount(req.srcChainId, req.tokenIn, req.amountIn, sourceAsset),
      bridgeSettlement: this._tokenAmount(req.dstChainId, req.tokenOut, result.expectedAmountOut, destinationAsset),
      minimumBridgeSettlement: this._tokenAmount(req.dstChainId, req.tokenOut, result.expectedAmountOut, destinationAsset),
      output: this._tokenAmount(req.dstChainId, req.tokenOut, result.expectedAmountOut, destinationAsset),
      minimumOutput: this._tokenAmount(req.dstChainId, req.tokenOut, result.expectedAmountOut, destinationAsset),
    });

    const sourceAssetId = this._isAddress(req.tokenIn)
      ? this._settlementAssetId(req.srcChainId, req.tokenIn)
      : this._zeroBytes32();
    const destinationAssetId = this._isAddress(req.tokenOut)
      ? this._settlementAssetId(req.dstChainId, req.tokenOut)
      : this._zeroBytes32();

    const quote: QuoteResult = {
      intentId,
      srcChainId: req.srcChainId,
      dstChainId: req.dstChainId,
      tokenIn: req.tokenIn,
      tokenOut: req.tokenOut,
      amountIn: req.amountIn,
      estimatedOut: result.expectedAmountOut,
      minAmountOut: result.expectedAmountOut,
      minSrcSwapOut: 0n,
      amounts,
      feeAmountUSD: 0,
      feeAmountToken: 0n,
      rail: Rail.HYPERLANE_NEXUS,
      railType: 'messaging',
      settlementToken,
      routeAsset: sourceAsset,
      settlementAssetId: sourceAssetId,
      expectedDstSettlementToken: req.tokenOut,
      expectedDstSettlementAssetId: destinationAssetId,
      minSettlementAmount: result.expectedAmountOut,
      dstGasLimit: 0,
      etaSeconds: result.etaSeconds,
      expiresAt,
      railPluginId: ZERO_PLUGIN_ID,
      railData: '0x',
      swapPluginIdSrc: ZERO_PLUGIN_ID,
      swapPluginIdDst: ZERO_PLUGIN_ID,
      swapDataSrc: '0x',
      swapDataDst: '0x',
    };

    return {
      offerId: intentId,
      rail: Rail.HYPERLANE_NEXUS,
      offerType: 'hyperlane_nexus_direct',
      railType: 'messaging',
      srcChainId: req.srcChainId,
      dstChainId: req.dstChainId,
      tokenIn: req.tokenIn,
      tokenOut: req.tokenOut,
      amountIn: req.amountIn,
      estimatedOut: result.expectedAmountOut,
      minAmountOut: result.expectedAmountOut,
      expiresAt,
      deliveryShape: 'direct',
      executionMode: 'provider_direct',
      routeAsset: sourceAsset,
      amounts,
      sourceSettlementAsset: sourceAsset,
      destinationSettlementAsset: destinationAsset,
      economics: {
        providerFeeUSD: 0,
        protocolFeeUSD: 0,
        sourceGasUSD: 0,
        settlementTimeSeconds: result.etaSeconds,
      },
      execution: {
        provider: 'hyperlane_explorer',
        quote,
        warpRouteAddress: result.warpRouteAddress,
        destinationDomain: result.destinationDomain,
        interchainGasFee: result.interchainGasFee.toString(),
      },
    };
  }

  private _defaultRefundAddress(req: QuoteRequest): string | undefined {
    const configured = req.refundAddress?.trim();
    if (configured) return configured;

    const srcChain = getChainConfig(req.srcChainId);
    return srcChain && !srcChain.isEVM ? req.userAddress : undefined;
  }

  private _buildOptimismNativeBridgeAssetRef(
    chainId: number,
    token: string,
    canonicalAssetId: string,
    decimals: number,
    kind: 'native' | 'erc20',
  ): ProviderAssetRef {
    return {
      canonicalAssetId,
      providerAssetId: `optimism-native-bridge:${chainId}:${kind === 'native' ? 'native' : token.toLowerCase()}`,
      tokenAddress: kind === 'erc20' ? token : undefined,
      srcTokenAddress: kind === 'erc20' ? token : undefined,
      dstTokenAddress: kind === 'erc20' ? token : undefined,
      decimals,
      assetKind: kind,
      assetStandard: kind,
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

  private _toGasZipProviderAssetRef(chainId: number, symbol: string): ProviderAssetRef {
    const canonicalAssetId = symbol.trim().toUpperCase();
    return {
      canonicalAssetId,
      providerAssetId: `gaszip:${chainId}:native`,
      tokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      srcTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      dstTokenAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      decimals: 18,
      assetKind: 'native',
      assetStandard: 'native',
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
    return rail === Rail.THORCHAIN
      || rail === Rail.GASZIP
      || rail === Rail.CHAINFLIP
      || rail === Rail.MAYA
      || rail === Rail.TELESWAP
      ? 'provider_direct'
      : 'router_intent';
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

  private async _buildSwapPlan(
    chainId: number,
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
  ): Promise<{ amountOut: bigint; data: string } | null> {
    if (this._isEmpsealSwapChain(chainId)) {
      const plan = await this.empsealQuoteWorker?.buildSwapPlan({
        chainId,
        tokenIn,
        tokenOut,
        amountIn,
      });
      if (!plan) return null;
      return {
        amountOut: plan.amountOut,
        data: plan.data,
      };
    }

    const quoted = await this._getSwapQuote(chainId, tokenIn, tokenOut, amountIn);
    if (quoted === null) return null;
    return { amountOut: quoted, data: '0x' };
  }

  private _buildBreakdownAmounts(input: {
    input: QuoteAmountView;
    bridgeSettlement?: QuoteAmountView;
    minimumBridgeSettlement?: QuoteAmountView;
    output: QuoteAmountView;
    minimumOutput: QuoteAmountView;
  }): QuoteAmountsBreakdown {
    return {
      input: input.input,
      ...(input.bridgeSettlement ? { bridgeSettlement: input.bridgeSettlement } : {}),
      ...(input.minimumBridgeSettlement ? { minimumBridgeSettlement: input.minimumBridgeSettlement } : {}),
      output: input.output,
      minimumOutput: input.minimumOutput,
    };
  }

  private _buildLegBreakdown(input: {
    srcSwap?: QuoteLegView;
    bridge?: QuoteLegView;
    dstSwap?: QuoteLegView;
  }): QuoteLegsBreakdown | undefined {
    if (!input.srcSwap && !input.bridge && !input.dstSwap) return undefined;
    return {
      ...(input.srcSwap ? { sourceSwap: input.srcSwap } : {}),
      ...(input.bridge ? { bridge: input.bridge } : {}),
      ...(input.dstSwap ? { destinationSwap: input.dstSwap } : {}),
    };
  }

  private _legView(
    chainId: number,
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    amountOut: bigint,
    minimumAmountOut: bigint,
    tokenInRef?: ProviderAssetRef,
    tokenOutRef?: ProviderAssetRef,
  ): QuoteLegView {
    const tokenInAmount = this._tokenAmount(chainId, tokenIn, amountIn, tokenInRef);
    const tokenOutAmount = this._tokenAmount(chainId, tokenOut, amountOut, tokenOutRef);
    return {
      tokenIn,
      tokenOut,
      amountIn,
      amountOut,
      minimumAmountOut,
      ...(tokenInAmount.decimals !== undefined ? { tokenInDecimals: tokenInAmount.decimals } : {}),
      ...(tokenOutAmount.decimals !== undefined ? { tokenOutDecimals: tokenOutAmount.decimals } : {}),
      ...(tokenInAmount.symbol ? { tokenInSymbol: tokenInAmount.symbol } : {}),
      ...(tokenOutAmount.symbol ? { tokenOutSymbol: tokenOutAmount.symbol } : {}),
    };
  }

  private _tokenAmount(
    chainId: number,
    token: string,
    amount: bigint,
    ...refs: Array<ProviderAssetRef | undefined>
  ): QuoteAmountView {
    const matched = refs.find((ref) => this._providerAssetMatchesToken(ref, token));
    if (matched) {
      return {
        token,
        amount,
        decimals: matched.decimals,
        symbol: matched.canonicalAssetId,
      };
    }

    const settlementToken = this._resolveStableSettlementToken(token, chainId);
    if (settlementToken) {
      return {
        token,
        amount,
        decimals: this._settlementTokenDecimals(settlementToken),
        symbol: settlementToken,
      };
    }

    return { token, amount };
  }

  private _providerAssetMatchesToken(ref: ProviderAssetRef | undefined, token: string): boolean {
    if (!ref || !this._isAddress(token)) return false;
    const normalized = token.toLowerCase();
    return [ref.tokenAddress, ref.srcTokenAddress, ref.dstTokenAddress]
      .filter((value): value is string => typeof value === 'string' && this._isAddress(value))
      .some((value) => value.toLowerCase() === normalized);
  }

  private _isEmpsealSwapChain(chainId: number): boolean {
    return getSwapPluginKindForChain(chainId) === 'EMPSEAL'
      && !!getEmpsealRouterAddressForChain(chainId);
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

  private _quoteSlippageBps(rail: Rail, offerType: RailOfferType): number {
    if (rail === Rail.LAYERZERO && offerType === 'lz_stargate_pool') {
      return LAYERZERO_STARGATE_POOL_SLIPPAGE_BPS;
    }

    return QUOTE_SLIPPAGE_BPS;
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
      JSON.stringify(
        (req.destinationGas ?? []).map((item) => ({
          provider: item.provider ?? '',
          chainId: item.chainId,
          amountWei: item.amountWei,
          recipient: item.recipient?.toLowerCase() ?? '',
        })),
      ),
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

  private _protocolFeeUSD(
    token: string,
    chainId: number,
    feeAmountToken: bigint,
    fallbackAmountUSD: number,
  ): number {
    const settlementToken = this._resolveStableSettlementToken(token, chainId);
    if (settlementToken === SettlementToken.USDC || settlementToken === SettlementToken.USDT) {
      return this._settlementTokenToUSD(settlementToken, feeAmountToken);
    }
    return fallbackAmountUSD * (PROTOCOL_FEE_BPS / 10_000);
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

  private _inferHyperlaneSettlementToken(req: QuoteRequest): SettlementToken | null {
    const sourceToken = this._resolveStableSettlementToken(req.tokenIn, req.srcChainId);
    if (sourceToken === SettlementToken.USDC || sourceToken === SettlementToken.USDT) return sourceToken;

    const destinationToken = this._resolveStableSettlementToken(req.tokenOut, req.dstChainId);
    if (destinationToken === SettlementToken.USDC || destinationToken === SettlementToken.USDT) return destinationToken;

    return this._isStableLike(req.tokenIn) || this._isStableLike(req.tokenOut)
      ? SettlementToken.USDC
      : null;
  }

  private _directRailSymbol(token: string): string {
    const normalized = token.trim().toUpperCase();
    if (['BTC', 'ETH', 'SOL', 'DOT', 'USDC', 'USDT', 'DOGE', 'DASH', 'ZEC', 'KUJI', 'BNB', 'AVAX'].includes(normalized)) {
      return normalized;
    }
    const stable = this._resolveStableSettlementToken(token, 1);
    if (stable) return stable;
    return this._isAddress(token) ? 'USDC' : normalized || 'USDC';
  }

  private _inferChainflipSettlementToken(dstChainId: number, assetId: string | null): SettlementToken {
    if (dstChainId === 0 || assetId?.startsWith('BTC.')) return SettlementToken.BTC;
    if (dstChainId === 99 || assetId?.startsWith('SOL.')) return SettlementToken.SOL;
    if (assetId?.endsWith('.ETH')) return SettlementToken.ETH;
    return SettlementToken.USDC;
  }

  private _inferMayaSettlementToken(dstChainId: number, assetId: string | null): SettlementToken {
    if (dstChainId === 0 || assetId?.startsWith('BTC.')) return SettlementToken.BTC;
    if (assetId?.endsWith('.USDT')) return SettlementToken.USDT;
    if (assetId?.endsWith('.ETH') || assetId?.endsWith('.AVAX') || assetId?.endsWith('.BNB')) return SettlementToken.ETH;
    return SettlementToken.USDC;
  }

  private _inferTeleSwapSettlementToken(dstChainId: number): SettlementToken {
    return dstChainId === 0 ? SettlementToken.BTC : SettlementToken.USDC;
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
