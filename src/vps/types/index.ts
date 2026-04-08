// ─────────────────────────────────────────────────────────
// EMPX Cross Chain VPS — Shared Types
// ─────────────────────────────────────────────────────────

export enum SettlementToken {
  USDC = 'USDC',
  USDT = 'USDT',
  ETH  = 'ETH',
  BTC  = 'BTC',  // THORChain / Chainflip native BTC delivery
  SOL  = 'SOL',  // THORChain / Chainflip / CCTP(USDC) Solana delivery
}

export enum Rail {
  // ── Messaging rails (bridge-based, ReceiverV1 on destination) ─────────────
  CCTP      = 'CCTP',       // Free, native USDC, ~25s. EVM + Solana.
  AXELAR    = 'AXELAR',     // $0.50, 60+ chains, GMP + tokens
  LAYERZERO = 'LAYERZERO',  // $0.35, 80+ chains, configurable DVN
  VIA_LABS  = 'VIA_LABS',   // $0.25, 30+ chains, API-first
  WORMHOLE  = 'WORMHOLE',   // EVM↔SVM SPL tokens + NTT, 30+ chains

  // ── Liquidity rail (AMM-based, direct native delivery, no ReceiverV1) ─────
  THORCHAIN = 'THORCHAIN',  // Free+slip, native BTC/ETH/SOL/DOGE/AVAX/BSC/BASE
}

// ── Rail category helpers ──────────────────────────────────────────────────────
export const LIQUIDITY_RAILS = new Set([Rail.THORCHAIN]);
export const MESSAGING_RAILS = new Set([Rail.CCTP, Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS, Rail.WORMHOLE]);

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
} as const;

export type ChainId = typeof CHAIN_ID[keyof typeof CHAIN_ID];

export enum IntentStatus {
  CREATED              = 'CREATED',
  QUOTED               = 'QUOTED',
  SUBMITTED            = 'SUBMITTED',
  IN_TRANSIT           = 'IN_TRANSIT',
  DESTINATION_RECEIVED = 'DESTINATION_RECEIVED',
  SETTLED              = 'SETTLED',
  STUCK                = 'STUCK',
  RECOVERING           = 'RECOVERING',
  FAILED               = 'FAILED',
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
  urgency?:     'fast' | 'normal';
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
  feeAmountUSD:      number;
  feeAmountToken:    bigint;
  rail:              Rail;
  railType:          'messaging' | 'liquidity';
  settlementToken:   SettlementToken;
  etaSeconds:        number;
  expiresAt:         number;
  railPluginId:      string;
  swapPluginIdSrc:   string;
  swapPluginIdDst:   string;
  swapDataSrc:       string;
  swapDataDst:       string;
  // THORChain-specific
  thorAsset?:        string;    // e.g. "BTC.BTC", "SOL.SOL"
  minThorOutput?:    bigint;    // 8-decimal THORChain units
  nativeDstAddress?: string;    // User's BTC/SOL/DOGE address
}

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
}

export interface RailScore {
  rail:              Rail;
  config:            RailConfig;
  score:             number;
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
