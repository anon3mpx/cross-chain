// ─────────────────────────────────────────────────────────────────────────────
// defaultFreeRpcs — well-known public RPC endpoints per chain, used as
// fallback tier when env-configured premium upstreams are unavailable.
//
// Conservative starter list — only providers with broad uptime and explicit
// "free for public use" policies.  Operators can:
//   • Add more via env (CHAIN_<id>_RPC_1..5) — those will be tier='premium'.
//   • Disable the free tier per-chain via env DISABLE_FREE_RPCS=1.
//
// Sources cross-checked (2026-02): chainlist.org, EthereumMagicians, vendor
// docs.  Public free RPCs change; revisit quarterly.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_FREE_RPCS: Record<number, string[]> = {
  // Ethereum
  1: [
    'https://eth.llamarpc.com',
    'https://ethereum-rpc.publicnode.com',
    'https://rpc.ankr.com/eth',
    'https://eth.drpc.org',
  ],
  // Optimism
  10: [
    'https://optimism.llamarpc.com',
    'https://optimism-rpc.publicnode.com',
    'https://rpc.ankr.com/optimism',
    'https://optimism.drpc.org',
  ],
  // BSC
  56: [
    'https://bsc-rpc.publicnode.com',
    'https://binance.llamarpc.com',
    'https://bsc.drpc.org',
    'https://rpc.ankr.com/bsc',
  ],
  // Polygon
  137: [
    'https://polygon-rpc.com',
    'https://polygon-bor-rpc.publicnode.com',
    'https://polygon.llamarpc.com',
    'https://polygon.drpc.org',
  ],
  // Base
  8453: [
    'https://base.llamarpc.com',
    'https://base-rpc.publicnode.com',
    'https://base.drpc.org',
    'https://mainnet.base.org',
  ],
  // Arbitrum One
  42161: [
    'https://arbitrum.llamarpc.com',
    'https://arbitrum-one-rpc.publicnode.com',
    'https://arb1.arbitrum.io/rpc',
    'https://arbitrum.drpc.org',
  ],
  // Avalanche C-Chain
  43114: [
    'https://avalanche-c-chain-rpc.publicnode.com',
    'https://rpc.ankr.com/avalanche',
    'https://avalanche.drpc.org',
  ],
  // Scroll
  534352: [
    'https://rpc.scroll.io',
    'https://scroll.drpc.org',
    'https://scroll-rpc.publicnode.com',
  ],
  // zkSync Era
  324: [
    'https://mainnet.era.zksync.io',
    'https://zksync.drpc.org',
  ],
  // Linea
  59144: [
    'https://rpc.linea.build',
    'https://linea-rpc.publicnode.com',
  ],
  // Polygon zkEVM
  1101: [
    'https://zkevm-rpc.com',
    'https://polygon-zkevm.drpc.org',
  ],
  // Mantle
  5000: [
    'https://rpc.mantle.xyz',
    'https://mantle.drpc.org',
  ],
  // Mode
  34443: [
    'https://mainnet.mode.network',
    'https://mode.drpc.org',
  ],
  // Blast
  81457: [
    'https://rpc.blast.io',
    'https://blast.drpc.org',
  ],
  // Celo
  42220: [
    'https://forno.celo.org',
    'https://celo.drpc.org',
  ],
  // Moonbeam / Moonriver (small footprint here)
  1284: ['https://rpc.api.moonbeam.network'],
  1285: ['https://rpc.api.moonriver.moonbeam.network'],

  // ── Testnets ─────────────────────────────────────────────────────────────
  11155111: [ // Sepolia
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://sepolia.drpc.org',
    'https://rpc.sepolia.org',
  ],
  421614: [   // Arbitrum Sepolia
    'https://sepolia-rollup.arbitrum.io/rpc',
    'https://arbitrum-sepolia.drpc.org',
  ],
  84532: [    // Base Sepolia
    'https://sepolia.base.org',
    'https://base-sepolia.drpc.org',
  ],
  11155420: [ // Optimism Sepolia
    'https://sepolia.optimism.io',
    'https://optimism-sepolia.drpc.org',
  ],
  43113: [    // Avalanche Fuji
    'https://api.avax-test.network/ext/bc/C/rpc',
    'https://avalanche-fuji-c-chain-rpc.publicnode.com',
  ],
  80002: [    // Polygon Amoy
    'https://rpc-amoy.polygon.technology',
    'https://polygon-amoy.drpc.org',
  ],
  97: [       // BSC Testnet
    'https://data-seed-prebsc-1-s1.binance.org:8545',
    'https://bsc-testnet-rpc.publicnode.com',
  ],
};

export function getDefaultFreeRpcs(chainId: number): string[] {
  return DEFAULT_FREE_RPCS[chainId] ?? [];
}
