// ─────────────────────────────────────────────────────────
// EMPX Cross Chain VPS — Chain Registry
//
// Canonical source of truth for all chains the VPS knows about.
// hasAggregator=true → our on-chain aggregator (RouterV1) is deployed there,
//   meaning we can swap arbitrary tokens → settlement token on that chain.
// hasAggregator=false → we can only deliver/receive the settlement token.
// ─────────────────────────────────────────────────────────

import { ChainConfig, SettlementToken, CHAIN_ID } from '../types';

// Chains where our RouterV1 aggregator is deployed (16 at launch).
export const AGG_CHAIN_IDS = new Set<number>([
  CHAIN_ID.ETH,
  CHAIN_ID.ARB,
  CHAIN_ID.BASE,
  CHAIN_ID.OP,
  CHAIN_ID.POLYGON,
  CHAIN_ID.AVAX,
  CHAIN_ID.BSC,
  250,    // Fantom
  100,    // Gnosis
  1101,   // Polygon zkEVM
  59144,  // Linea
  5000,   // Mantle
  34443,  // Mode
  81457,  // Blast
  534352, // Scroll
  324,    // zkSync Era
]);

// Hub chains: well-connected chains used as intermediate hops when no direct rail
// exists. Must have many rails AND ideally have our aggregator for token conversion.
export const HUB_CHAIN_IDS: number[] = [
  CHAIN_ID.ARB,     // Most rails, high liquidity, has agg
  CHAIN_ID.ETH,     // Maximum rail coverage
  CHAIN_ID.BASE,    // CCTP-native, has agg
  CHAIN_ID.AVAX,    // THORChain confirmed, CCTP, has agg
  CHAIN_ID.OP,      // CCTP-native, has agg
  CHAIN_ID.BSC,     // THORChain confirmed, Axelar/LZ, has agg
  CHAIN_ID.POLYGON, // CCTP, Axelar, LZ, has agg
];

const cfg = (
  chainId: number,
  name: string,
  hasAggregator: boolean,
  nativeStable: SettlementToken = SettlementToken.USDC,
  blockTimeMs = 2000,
  isEVM = true,
): ChainConfig => ({
  chainId, name,
  rpcUrl: '',      // populated from env at runtime
  rpcFallback: '',
  hasAggregator,
  nativeStable,
  blockTimeMs,
  isEVM,
});

export const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  // ── Aggregator-deployed chains ────────────────────────────────────────────
  [CHAIN_ID.ETH]:     cfg(CHAIN_ID.ETH,     'ethereum',      true,  SettlementToken.USDC, 12000),
  [CHAIN_ID.ARB]:     cfg(CHAIN_ID.ARB,     'arbitrum',      true,  SettlementToken.USDC, 250),
  [CHAIN_ID.BASE]:    cfg(CHAIN_ID.BASE,    'base',          true,  SettlementToken.USDC, 2000),
  [CHAIN_ID.OP]:      cfg(CHAIN_ID.OP,      'optimism',      true,  SettlementToken.USDC, 2000),
  [CHAIN_ID.POLYGON]: cfg(CHAIN_ID.POLYGON, 'polygon',       true,  SettlementToken.USDC, 2000),
  [CHAIN_ID.AVAX]:    cfg(CHAIN_ID.AVAX,    'avalanche',     true,  SettlementToken.USDC, 2000),
  [CHAIN_ID.BSC]:     cfg(CHAIN_ID.BSC,     'bsc',           true,  SettlementToken.USDT, 3000), // USDT-dominant
  250:    cfg(250,    'fantom',             true,  SettlementToken.USDC, 1000),
  100:    cfg(100,    'gnosis',             true,  SettlementToken.USDC, 5000),
  1101:   cfg(1101,   'polygon-zkevm',      true,  SettlementToken.USDC, 3000),
  59144:  cfg(59144,  'linea',              true,  SettlementToken.USDC, 2000),
  5000:   cfg(5000,   'mantle',             true,  SettlementToken.USDC, 2000),
  34443:  cfg(34443,  'mode',               true,  SettlementToken.USDC, 2000),
  81457:  cfg(81457,  'blast',              true,  SettlementToken.ETH,  2000),  // ETH-dominant
  534352: cfg(534352, 'scroll',             true,  SettlementToken.USDC, 3000),
  324:    cfg(324,    'zksync-era',         true,  SettlementToken.USDC, 1000),
  // ── Settlement-only chains (no aggregator) ────────────────────────────────
  // These chains can receive/send settlement tokens but not do arbitrary swaps.
  7777777: cfg(7777777, 'zora',             false, SettlementToken.ETH, 2000),
  1284:    cfg(1284,    'moonbeam',         false, SettlementToken.USDC, 12000),
  1285:    cfg(1285,    'moonriver',        false, SettlementToken.USDC, 12000),
  42220:   cfg(42220,   'celo',             false, SettlementToken.USDC, 5000),
  // ── Non-EVM chains (THORChain / Wormhole delivery) ────────────────────────
  [CHAIN_ID.BTC]:    cfg(CHAIN_ID.BTC,    'bitcoin',    false, SettlementToken.BTC, 600000, false),
  [CHAIN_ID.SOL]:    cfg(CHAIN_ID.SOL,    'solana',     false, SettlementToken.SOL, 400,    false),
  [CHAIN_ID.DOGE]:   cfg(CHAIN_ID.DOGE,   'dogecoin',   false, SettlementToken.ETH, 60000,  false),
  [CHAIN_ID.LTC]:    cfg(CHAIN_ID.LTC,    'litecoin',   false, SettlementToken.ETH, 150000, false),
  [CHAIN_ID.BCH]:    cfg(CHAIN_ID.BCH,    'bitcoincash',false, SettlementToken.ETH, 600000, false),
  [CHAIN_ID.COSMOS]: cfg(CHAIN_ID.COSMOS, 'cosmos',     false, SettlementToken.USDC, 6000, false),
};

/** Returns the ChainConfig for a given chainId, or undefined if unknown. */
export function getChainConfig(chainId: number): ChainConfig | undefined {
  return CHAIN_CONFIGS[chainId];
}

/** true if our aggregator is deployed on this chain. */
export function hasAggregator(chainId: number): boolean {
  return AGG_CHAIN_IDS.has(chainId);
}
