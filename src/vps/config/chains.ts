// ─────────────────────────────────────────────────────────
// EMPX Cross Chain VPS — Chain Registry
//
// Canonical source of truth for all chains the VPS knows about.
// hasAggregator=true → our on-chain aggregator (RouterV1) is deployed there,
//   meaning we can swap arbitrary tokens → settlement token on that chain.
// hasAggregator=false → we can only deliver/receive the settlement token.
// ─────────────────────────────────────────────────────────

import { ChainConfig, SettlementToken, CHAIN_ID } from '../types';

function env(key: string): string | undefined {
  const value = process.env[key];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function routerV1Abi(chainId: number): 'legacy' | 'current' {
  const raw = (env(`CHAIN_${chainId}_ROUTER_V1_ABI`) ?? env('ROUTER_V1_ABI') ?? 'legacy').toLowerCase();
  if (['current', 'v2', 'new'].includes(raw)) return 'current';
  if (['legacy', 'v1', 'old'].includes(raw)) return 'legacy';
  throw new Error(`invalid CHAIN_${chainId}_ROUTER_V1_ABI: ${raw}`);
}

const cfg = (
  chainId: number,
  name: string,
  defaultHasAggregator: boolean,
  nativeStable: SettlementToken = SettlementToken.USDC,
  blockTimeMs = 2000,
  isEVM = true,
): ChainConfig => ({
  ...(() => {
    const override = env(`CHAIN_${chainId}_HAS_AGGREGATOR`);
    const hasAggregator = override
      ? ['1', 'true', 'yes', 'on'].includes(override.toLowerCase())
      : defaultHasAggregator;
    return { hasAggregator };
  })(),
  chainId, name,
  rpcUrl: env(`CHAIN_${chainId}_RPC_URL`) ?? '',
  rpcFallback: env(`CHAIN_${chainId}_RPC_FALLBACK`) ?? env(`CHAIN_${chainId}_RPC_URL`) ?? '',
  routerV1: env(`CHAIN_${chainId}_ROUTER_V1`),
  routerV1Abi: routerV1Abi(chainId),
  receiverV1: env(`CHAIN_${chainId}_RECEIVER_V1`),
  nativeStable,
  blockTimeMs,
  isEVM,
});

export const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  // ── Aggregator-deployed chains ────────────────────────────────────────────
  [CHAIN_ID.PULSE]:    cfg(CHAIN_ID.PULSE,    'pulsechain', true, SettlementToken.USDC, 3000),
  [CHAIN_ID.BSC]:      cfg(CHAIN_ID.BSC,      'bsc',        true, SettlementToken.USDT, 3000), // USDT-dominant
  [CHAIN_ID.ARB]:      cfg(CHAIN_ID.ARB,      'arbitrum',   true, SettlementToken.USDC, 250),
  [CHAIN_ID.BASE]:     cfg(CHAIN_ID.BASE,     'base',       true, SettlementToken.USDC, 2000),
  [CHAIN_ID.POLYGON]:  cfg(CHAIN_ID.POLYGON,  'polygon',    true, SettlementToken.USDC, 2000),
  [CHAIN_ID.AVAX]:     cfg(CHAIN_ID.AVAX,     'avalanche',  true, SettlementToken.USDC, 2000),
  [CHAIN_ID.OP]:       cfg(CHAIN_ID.OP,       'optimism',   true, SettlementToken.USDC, 2000),
  [CHAIN_ID.MONAD]:    cfg(CHAIN_ID.MONAD,    'monad',      true, SettlementToken.USDC, 1000),
  [CHAIN_ID.SONIC]:    cfg(CHAIN_ID.SONIC,    'sonic',      true, SettlementToken.USDC, 1000),
  [CHAIN_ID.SEI]:      cfg(CHAIN_ID.SEI,      'sei',        true, SettlementToken.USDC, 500),
  [CHAIN_ID.BERACHAIN]:cfg(CHAIN_ID.BERACHAIN,'berachain',  true, SettlementToken.USDC, 2000),
  [CHAIN_ID.ROOTSTOCK]:cfg(CHAIN_ID.ROOTSTOCK,'rootstock',  true, SettlementToken.USDC, 30000),
  [CHAIN_ID.ETHPOW]:   cfg(CHAIN_ID.ETHPOW,   'ethpow',     true, SettlementToken.USDC, 13000),
  [CHAIN_ID.HYPEREVM]: cfg(CHAIN_ID.HYPEREVM, 'hyperevm',   true, SettlementToken.USDC, 2000),

  // Optional high-liquidity hubs / existing infra chain configs
  [CHAIN_ID.ETH]:      cfg(CHAIN_ID.ETH,      'ethereum',   false, SettlementToken.USDC, 12000),
  1101:                cfg(1101,              'polygon-zkevm', false, SettlementToken.USDC, 3000),
  59144:               cfg(59144,             'linea',      false, SettlementToken.USDC, 2000),
  5000:                cfg(5000,              'mantle',     false, SettlementToken.USDC, 2000),
  34443:               cfg(34443,             'mode',       false, SettlementToken.USDC, 2000),
  81457:               cfg(81457,             'blast',      false, SettlementToken.ETH,  2000),
  534352:              cfg(534352,            'scroll',     false, SettlementToken.USDC, 3000),
  324:                 cfg(324,               'zksync-era', false, SettlementToken.USDC, 1000),

  // ── Testnets for staging + integration testing ────────────────────────────
  11155111:            cfg(11155111,          'ethereum-sepolia',  false, SettlementToken.USDC, 12_000),
  421614:              cfg(421614,            'arbitrum-sepolia',  false, SettlementToken.USDC, 300),
  84532:               cfg(84532,             'base-sepolia',      false, SettlementToken.USDC, 2000),
  11155420:            cfg(11155420,          'optimism-sepolia',  false, SettlementToken.USDC, 2000),
  43113:               cfg(43113,             'avalanche-fuji',    false, SettlementToken.USDC, 2000),
  80002:               cfg(80002,             'polygon-amoy',      false, SettlementToken.USDC, 2000),
  97:                  cfg(97,                'bsc-testnet',       false, SettlementToken.USDT, 3000),

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

// Chains where our RouterV1/aggregator is deployed.
// Derived from CHAIN_CONFIGS to avoid drift.
export const AGG_CHAIN_IDS = new Set<number>(
  Object.values(CHAIN_CONFIGS).filter(c => c.hasAggregator).map(c => c.chainId),
);

// Hub chains: well-connected chains used as intermediate hops when no direct rail exists.
// Keep hubs biased toward high-liquidity chains that are likely to have deep rail coverage.
export const HUB_CHAIN_IDS: number[] = [
  CHAIN_ID.ARB,
  CHAIN_ID.BASE,
  CHAIN_ID.AVAX,
  CHAIN_ID.OP,
  CHAIN_ID.BSC,
  CHAIN_ID.POLYGON,
  CHAIN_ID.ETH,
];

/** Returns the ChainConfig for a given chainId, or undefined if unknown. */
export function getChainConfig(chainId: number): ChainConfig | undefined {
  return CHAIN_CONFIGS[chainId];
}

/** true if our aggregator is deployed on this chain. */
export function hasAggregator(chainId: number): boolean {
  return CHAIN_CONFIGS[chainId]?.hasAggregator ?? false;
}
