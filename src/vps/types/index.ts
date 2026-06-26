// ─────────────────────────────────────────────────────────
// EMPX Cross Chain VPS — Shared Types
// ─────────────────────────────────────────────────────────

export enum SettlementToken {
  USDC = 'USDC',
  USDT = 'USDT',
  WETH = 'WETH',
  ETH  = 'ETH',
  BTC  = 'BTC',  // THORChain / Chainflip native BTC delivery
  SOL  = 'SOL',  // THORChain / Chainflip / CCTP(USDC) Solana delivery
}

export enum Rail {
  // ── Messaging rails (bridge-based, ReceiverV1 on destination) ─────────────
  CCTP      = 'CCTP',       // Free, native USDC, ~25s. EVM + Solana.
  CCTP_FAST = 'CCTP_FAST',  // $5-10, native USDC, ~15s. EVM only, CCTP fast liquidity pool.
  AXELAR    = 'AXELAR',     // $0.50, 60+ chains, GMP + tokens
  LAYERZERO = 'LAYERZERO',  // $0.35, 80+ chains, configurable DVN
  VIA_LABS  = 'VIA_LABS',   // $0.25, 30+ chains, API-first
  WORMHOLE  = 'WORMHOLE',   // EVM↔SVM SPL tokens + NTT, 30+ chains
  GASZIP    = 'GASZIP',     // Provider-direct destination native gas delivery via Gas.zip API
  HYPERLANE_NEXUS = 'HYPERLANE_NEXUS', // Provider-direct stablecoin warp routes via Hyperlane Nexus
  OPTIMISM_NATIVE_BRIDGE = 'OPTIMISM_NATIVE_BRIDGE', // Official Standard Bridge rollout for ETH <-> Optimism

  // ── Liquidity rail (AMM-based, direct native delivery, no ReceiverV1) ─────
  THORCHAIN = 'THORCHAIN',  // Free+slip, native BTC/ETH/SOL/DOGE/AVAX/BSC/BASE
  CHAINFLIP = 'CHAINFLIP',  // Broker-direct JIT AMM rail for BTC/ETH/USDC/SOL/DOT
  MAYA = 'MAYA',            // THORChain-style vault rail with KUJI/DASH/ZEC coverage
  TELESWAP = 'TELESWAP',    // BTC <-> Polygon/BSC specialist rail via TeleportDAO
}

// ── Rail category helpers ──────────────────────────────────────────────────────
export const LIQUIDITY_RAILS = new Set([Rail.THORCHAIN, Rail.CHAINFLIP, Rail.MAYA, Rail.TELESWAP]);
export const MESSAGING_RAILS = new Set([
  Rail.CCTP,
  Rail.CCTP_FAST,
  Rail.AXELAR,
  Rail.LAYERZERO,
  Rail.VIA_LABS,
  Rail.WORMHOLE,
  Rail.GASZIP,
  Rail.HYPERLANE_NEXUS,
  Rail.OPTIMISM_NATIVE_BRIDGE,
]);

// ── Non-EVM pseudo chain IDs (used internally, never on-chain) ────────────────
export const CHAIN_ID = {
  ETH:     1,
  OP:      10,
  ROOTSTOCK: 30,
  BSC:     56,
  POLYGON: 137,
  MONAD:   143,
  SONIC:   146,
  HYPEREVM: 999,
  SEI:     1329,
  BERACHAIN: 80094,
  ETHPOW:  10001,
  PULSE:   369,
  AVAX:    43114,
  ARB:     42161,
  BASE:    8453,
  // Non-EVM — THORChain / Chainflip pseudo-IDs
  BTC:     0,
  DOGE:    98,
  SOL:     99,
  LTC:     100,
  BCH:     101,
  COSMOS:  102,
  DOT:     103,
  KUJI:    104,
  DASH:    105,
  ZEC:     106,
} as const;

export type ChainId = typeof CHAIN_ID[keyof typeof CHAIN_ID];

export enum IntentStatus {
  CREATED              = 'CREATED',
  QUOTED               = 'QUOTED',
  CANCELLED            = 'CANCELLED',
  SUBMITTED            = 'SUBMITTED',
  IN_TRANSIT           = 'IN_TRANSIT',
  DESTINATION_RECEIVED = 'DESTINATION_RECEIVED',
  SETTLED              = 'SETTLED',
  STUCK                = 'STUCK',
  RECOVERING           = 'RECOVERING',
  FAILED               = 'FAILED',
}

export enum RefundCaseStatus {
  REQUESTED    = 'REQUESTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED     = 'APPROVED',
  REJECTED     = 'REJECTED',
  PROCESSING   = 'PROCESSING',
  COMPLETED    = 'COMPLETED',
}

export enum RefundResolutionKind {
  ONCHAIN_RESCUE       = 'ONCHAIN_RESCUE',
  OFFCHAIN_COMPENSATION = 'OFFCHAIN_COMPENSATION',
  PROTOCOL_RECOVERY    = 'PROTOCOL_RECOVERY',
}

export enum RefundCustodyLocation {
  UNKNOWN            = 'UNKNOWN',
  ROUTER             = 'ROUTER',
  RECEIVER           = 'RECEIVER',
  AXELAR_ADAPTER     = 'AXELAR_ADAPTER',
  LAYERZERO_ADAPTER  = 'LAYERZERO_ADAPTER',
  THORCHAIN_ROUTER   = 'THORCHAIN_ROUTER',
  CCTP_PROTOCOL      = 'CCTP_PROTOCOL',
  AXELAR_PROTOCOL    = 'AXELAR_PROTOCOL',
  LAYERZERO_PROTOCOL = 'LAYERZERO_PROTOCOL',
  EXTERNAL_PROTOCOL  = 'EXTERNAL_PROTOCOL',
}

export interface ChainConfig {
  chainId:       number;
  name:          string;
  rpcUrl:        string;
  rpcFallback:   string;
  routerV1?:     string;    // RouterV1 contract address (EVM only)
  receiverV1?:   string;    // ReceiverV1 contract address (EVM only, messaging rails only)
  hasAggregator: boolean;
  nativeStable:  SettlementToken;
  blockTimeMs:   number;
  isEVM:         boolean;   // false for BTC, SOL, DOGE etc.
}

export interface RailConfig {
  rail:              Rail;
  railType:          'messaging' | 'liquidity';
  fee:               number;      // USD flat fee (messaging) or 0 (liquidity — slippage-based)
  feeSlippagePct?:   number;      // For liquidity rails: typical AMM slip %
  etaSeconds:        number;
  supportsUSDC:      boolean;
  supportsUSDT:      boolean;
  supportsETH:       boolean;
  supportsBTC:       boolean;     // native BTC delivery
  supportsSOL:       boolean;     // native SOL delivery
  nativeUSDC:        boolean;
  reliabilityScore:  number;
  pluginId:          string;
  requiresNativeAddr: boolean;    // true = destination needs native chain address (BTC, SOL)
}

export interface QuoteRequest {
  tokenIn:      string;
  tokenOut:     string;
  amountIn:     bigint;
  srcChainId:   number;
  dstChainId:   number;
  userAddress:  string;
  nativeDstAddress?: string;  // Required for BTC/SOL destinations
  refundAddress?: string;     // Required for provider-direct non-EVM source flows
  destinationGas?: DestinationGasRequest[];
  autoFundDestinationGas?: AutoFundDestinationGasRequest;
  urgency?:     'fast' | 'normal' | 'patient';
}

export interface DestinationGasRequest {
  provider?: 'gaszip';
  chainId: number;
  amountWei: string;
  recipient?: string;
}

export interface AutoFundDestinationGasRequest {
  thresholdUsd?: number;
  topUpUsd?: number;
  recipient?: string;
}

export type DestinationGasDecisionOutcome =
  | 'auto_attached'
  | 'explicit_destination_gas'
  | 'feature_disabled'
  | 'kill_switch'
  | 'no_opt_in'
  | 'same_chain'
  | 'source_token_native'
  | 'balance_sufficient'
  | 'balance_check_failed'
  | 'unknown_native_price'
  | 'zero_top_up';

export interface DestinationGasDecision {
  provider: 'gaszip';
  requested: boolean;
  outcome: DestinationGasDecisionOutcome;
  recipient?: string;
  thresholdUsd?: number;
  requestedTopUpUsd?: number;
  appliedTopUpUsd?: number;
  nativeUsd?: number;
  balanceUsd?: number;
  effectiveDestinationGas: DestinationGasRequest[];
  autoAdded: DestinationGasRequest[];
}

export interface QuoteAmountView {
  token: string;
  amount: bigint;
  decimals?: number;
  symbol?: string;
}

export interface QuoteLegView {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  amountOut: bigint;
  minimumAmountOut?: bigint;
  tokenInDecimals?: number;
  tokenOutDecimals?: number;
  tokenInSymbol?: string;
  tokenOutSymbol?: string;
}

export interface QuoteAmountsBreakdown {
  input: QuoteAmountView;
  bridgeSettlement?: QuoteAmountView;
  minimumBridgeSettlement?: QuoteAmountView;
  output: QuoteAmountView;
  minimumOutput: QuoteAmountView;
}

export interface QuoteLegsBreakdown {
  sourceSwap?: QuoteLegView;
  bridge?: QuoteLegView;
  destinationSwap?: QuoteLegView;
}

export interface QuoteResult {
  intentId:          string;
  srcChainId:        number;
  dstChainId:        number;
  tokenIn:           string;
  tokenOut:          string;
  amountIn:          bigint;
  estimatedOut:      bigint;
  minAmountOut:      bigint;
  minSrcSwapOut:     bigint;
  feeAmountUSD:      number;
  feeAmountToken:    bigint;
  rail:              Rail;
  railType:          'messaging' | 'liquidity';
  settlementToken:   SettlementToken;
  routeAsset?:       RouteAssetRef;
  amounts?:          QuoteAmountsBreakdown;
  legs?:             QuoteLegsBreakdown;
  settlementAssetId: string;    // bytes32-like provider/canonical asset id for source settlement
  expectedDstSettlementToken: string; // destination settlement token expected by ReceiverV1
  expectedDstSettlementAssetId: string; // bytes32-like expected destination settlement asset id
  minSettlementAmount: bigint;  // min settlement amount required before destination execution
  dstGasLimit:        number;   // destination execution gas budget for messaging rails
  etaSeconds:        number;
  expiresAt:         number;
  railPluginId:      string;
  railData:          string;    // ABI-encoded rail params (e.g. CCTP fast maxFee/finality)
  swapPluginIdSrc:   string;
  swapPluginIdDst:   string;
  swapDataSrc:       string;
  swapDataDst:       string;
  // THORChain-specific
  thorAsset?:        string;    // e.g. "BTC.BTC", "SOL.SOL"
  minThorOutput?:    bigint;    // 8-decimal THORChain units
  layerZeroValueTransferApiQuoteId?: string; // LayerZero Value Transfer API quote/transfer id
  layerZeroValueTransferApiRouteSteps?: unknown[];
  layerZeroValueTransferApiUserSteps?: unknown[];
  chainflipChannelId?: string;
  teleSwapSwapId?: string;
  nativeDstAddress?: string;    // User's BTC/SOL/DOGE address
  refundAddress?: string;       // Source-chain refund address for provider-direct flows
  selectedByUser?:   boolean;   // true when intent came from explicit offer selection
  offerType?:        RailOfferType;
  executionMode?:    ExecutionMode;
}

export interface ProviderAssetRef {
  canonicalAssetId: string;
  providerAssetId: string;
  tokenAddress?: string;
  srcTokenAddress?: string;
  dstTokenAddress?: string;
  decimals: number;
  assetKind: 'erc20' | 'native' | 'btc' | 'sol' | 'doge' | 'cosmos';
  assetStandard?: 'erc20' | 'native' | 'oft' | 'oft_adapter' | 'stargate_pool' | 'stargate_oft' | 'thor_native';
}

export type RailOfferType =
  | 'cctp_standard'
  | 'cctp_fast'
  | 'axelar_direct'
  | 'axelar_dst_swap'
  | 'lz_oft'
  | 'lz_oft_adapter'
  | 'lz_stargate_pool'
  | 'lz_stargate_oft'
  | 'lz_api_direct'
  | 'gaszip_api_direct'
  | 'thor_api_direct'
  | 'hyperlane_nexus_direct'
  | 'optimism_native_bridge_direct'
  | 'chainflip_broker_direct'
  | 'maya_direct'
  | 'teleswap_direct';

export type DeliveryShape =
  | 'direct'
  | 'src_swap_required'
  | 'dst_swap_required'
  | 'src_and_dst_swap_required';

export type ExecutionMode = 'router_intent' | 'provider_direct';

export type RouteAssetRef = ProviderAssetRef;

export interface OfferEconomics {
  providerFeeUSD: number;
  protocolFeeUSD: number;
  sourceGasUSD: number;
  destinationGasUSD?: number;
  outboundFeeUSD?: number;
  slippageBps?: number;
  priceImpactPct?: number;
  settlementTimeSeconds: number;
  minimumInput?: string;
}

export interface RailOffer {
  offerId: string;
  rail: Rail;
  offerType?: RailOfferType;
  railType: 'messaging' | 'liquidity';
  srcChainId: number;
  dstChainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  estimatedOut: bigint;
  minAmountOut: bigint;
  expiresAt: number;
  deliveryShape?: DeliveryShape;
  executionMode?: ExecutionMode;
  routeAsset?: RouteAssetRef;
  amounts?: QuoteAmountsBreakdown;
  legs?: QuoteLegsBreakdown;
  sourceSettlementAsset: ProviderAssetRef;
  destinationSettlementAsset: ProviderAssetRef;
  economics: OfferEconomics;
  execution: Record<string, unknown>;
}

export interface OfferSet {
  offerSetId: string;
  expiresAt: number;
  offers: RailOffer[];
  bestOfferId?: string;
}

export interface GasZipCompositionStep {
  step: number;
  offerId: string;
  rail: Rail;
  executionMode?: ExecutionMode;
  label: 'primary_transfer' | 'gaszip_destination_gas';
}

export interface GasZipOfferComposition {
  kind: 'primary_transfer_with_gaszip_destination_gas';
  primaryTransferOfferId: string;
  gasZipDestinationGasOfferId: string;
  primaryTransferOffer: RailOffer;
  gasZipDestinationGasOffer: RailOffer;
  executionPlan: GasZipCompositionStep[];
  uxHints: {
    destinationGasProvider: 'gaszip';
    destinationGasIncluded: true;
    recommendedExecution: 'primary_then_gas';
    atomic: false;
  };
}

export type ComposedIntentStatus =
  | 'QUOTED'
  | 'SUBMITTED'
  | 'IN_TRANSIT'
  | 'PARTIALLY_SETTLED'
  | 'SETTLED'
  | 'STUCK'
  | 'RECOVERING'
  | 'PARTIALLY_FAILED'
  | 'FAILED'
  | 'CANCELLED';

export interface Intent {
  intentId:         string;
  status:           IntentStatus;
  quote:            QuoteResult;
  userAddress:      string;
  srcTxHash?:       string;
  railTxId?:        string;
  dstTxHash?:       string;
  createdAt:        number;
  updatedAt:        number;
  retryCount:       number;
  fallbackRail?:    Rail;
  errorMessage?:    string;
  partnerApiKey?:   string;
  partnerId?:       string;
  integratorId?:    string;
  agentId?:         string;
  routeSource?:     'partner-api' | 'ui' | 'agent-sdk' | 'external-solver' | 'internal';
  parentBasketId?:  string;
  solverId?:        string;
  actualOut?:       bigint;
  actualFeeUsd?:    number;
}

export interface IntentRefundCase {
  intentId: string;
  status: RefundCaseStatus;
  reason: string;
  requestedBy?: string;
  requestedAt: number;
  updatedAt: number;
  reviewedBy?: string;
  reviewedAt?: number;
  reviewNotes?: string;
  adminNotes?: string;
  custodyLocation: RefundCustodyLocation;
  resolutionKind?: RefundResolutionKind;
  rescueContract?: string;
  rescueToken?: string;
  rescueAmount?: string;
  rescueTxHash?: string;
  payoutAddress?: string;
  payoutTxHash?: string;
}

export type ProviderTransferProvider =
  | 'layerzero_value_transfer_api'
  | 'thorchain_api'
  | 'hyperlane_explorer'
  | 'chainflip_broker'
  | 'maya_midgard'
  | 'teleswap_api';

export type ProviderTransferStatus =
  | 'CREATED'
  | 'USER_STEPS_BUILT'
  | 'SUBMITTED'
  | 'IN_TRANSIT'
  | 'SETTLED'
  | 'FAILED'
  | 'EXPIRED';

export interface ProviderTransfer {
  intentId: string;
  provider: ProviderTransferProvider;
  providerQuoteId: string;
  status: ProviderTransferStatus;
  sourceTxHash?: string;
  sourceSignature?: string;
  destinationTxHash?: string;
  latestProviderStatus?: string;
  routeStepTypes: string[];
  metadata: Record<string, unknown>;
  rawErrorPayload?: unknown;
  lastPolledAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type ProviderTransferUpsert = Omit<Partial<ProviderTransfer>, 'intentId' | 'provider' | 'providerQuoteId' | 'createdAt' | 'updatedAt'> & {
  intentId: string;
  provider: ProviderTransferProvider;
  providerQuoteId: string;
  status: ProviderTransferStatus;
};

export interface RailScore {
  rail:              Rail;
  config:            RailConfig;
  score:             number;
  routeAssetAlias:   string;
  settlementToken:   SettlementToken;
  requiresTokenHop:  boolean;
}

// ── Aggregator-aware routing types ────────────────────────────────────────────

/**
 * Encodes whether our on-chain aggregator exists on each side of the swap.
 *
 * FULL_SWAP    — agg on src AND dst  → arbitrary tokenIn → arbitrary tokenOut
 * SRC_SWAP     — agg on src only     → swap to settlement token, deliver as-is
 * DST_SWAP     — agg on dst only     → receive settlement token, swap to tokenOut
 * BRIDGE_ONLY  — no agg on either    → user provides/receives settlement token only
 */
export enum RouteType {
  FULL_SWAP   = 'FULL_SWAP',
  SRC_SWAP    = 'SRC_SWAP',
  DST_SWAP    = 'DST_SWAP',
  BRIDGE_ONLY = 'BRIDGE_ONLY',
}

/** One bridge leg in a potentially multi-hop route. */
export interface Hop {
  rail:               Rail;
  srcChainId:         number;
  dstChainId:         number;
  routeAssetAlias:    string;
  /** Settlement token entering this bridge leg (output of prior hop or src swap). */
  settlementTokenIn:  SettlementToken;
  /** Settlement token exiting this bridge leg (may differ if hub has aggregator). */
  settlementTokenOut: SettlementToken;
  /**
   * true when this hop lands on a hub chain that must swap
   * settlementTokenIn → settlementTokenOut before the next hop departs.
   * Requires hasAggregator=true on the hub chain.
   */
  hubSwapNeeded:      boolean;
}

/** A fully described route: one or two hops, with aggregator-aware metadata. */
export interface Route {
  /** How many bridge legs. 1 = direct, 2 = via hub. */
  hops:            Hop[];
  routeType:       RouteType;
  /** Aggregator detected on source chain — can swap tokenIn → settlement token. */
  srcSwap:         boolean;
  /** Aggregator detected on destination chain — can swap settlement token → tokenOut. */
  dstSwap:         boolean;
  /** Sum of flat USD fees across all hops. */
  totalFeeUSD:     number;
  /** Sum of ETAs across all hops (seconds). */
  totalEtaSeconds: number;
  /** Composite score (higher = better). */
  score:           number;
  /** false when a required hub aggregator is missing, making the route non-executable. */
  viable:          boolean;
  /** Human-readable reason when viable=false. */
  reason?:         string;
}
