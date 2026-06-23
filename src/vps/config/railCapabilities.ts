import { CHAIN_ID, Rail } from '../types';

export type RailCapabilitySource =
  | 'protocol_domain_map'
  | 'route_metadata'
  | 'provider_asset_catalog'
  | 'provider_route_catalog'
  | 'operator_config'
  | 'native_bridge_catalog';

export interface RailCapabilityEntry {
  rail: Rail;
  chainIds: readonly number[];
  source: RailCapabilitySource;
  note: string;
}

export interface ProviderAssetCatalogEntry {
  chainId: number;
  symbol: string;
  providerAssetId: string;
}

const MAINNET_BROAD_MESSAGING_CHAIN_IDS = [1, 10, 42161, 8453, 137, 43114, 56] as const;

export const CHAINFLIP_ASSET_CATALOG: readonly ProviderAssetCatalogEntry[] = [
  { chainId: 1, symbol: 'ETH', providerAssetId: 'ETH.ETH' },
  { chainId: 1, symbol: 'USDC', providerAssetId: 'ETH.USDC' },
  { chainId: 42161, symbol: 'ETH', providerAssetId: 'ARB.ETH' },
  { chainId: 42161, symbol: 'USDC', providerAssetId: 'ARB.USDC' },
  { chainId: CHAIN_ID.BTC, symbol: 'BTC', providerAssetId: 'BTC.BTC' },
  { chainId: CHAIN_ID.SOL, symbol: 'SOL', providerAssetId: 'SOL.SOL' },
  { chainId: CHAIN_ID.SOL, symbol: 'USDC', providerAssetId: 'SOL.USDC' },
  { chainId: CHAIN_ID.DOT, symbol: 'DOT', providerAssetId: 'DOT.DOT' },
] as const;

export const MAYA_ASSET_CATALOG: readonly ProviderAssetCatalogEntry[] = [
  { chainId: CHAIN_ID.BTC, symbol: 'BTC', providerAssetId: 'BTC.BTC' },
  { chainId: CHAIN_ID.DOGE, symbol: 'DOGE', providerAssetId: 'DOGE.DOGE' },
  { chainId: CHAIN_ID.KUJI, symbol: 'KUJI', providerAssetId: 'KUJI.KUJI' },
  { chainId: CHAIN_ID.DASH, symbol: 'DASH', providerAssetId: 'DASH.DASH' },
  { chainId: CHAIN_ID.ZEC, symbol: 'ZEC', providerAssetId: 'ZEC.ZEC' },
  { chainId: 1, symbol: 'ETH', providerAssetId: 'ETH.ETH' },
  { chainId: 1, symbol: 'USDC', providerAssetId: 'ETH.USDC' },
  { chainId: 1, symbol: 'USDT', providerAssetId: 'ETH.USDT' },
  { chainId: 42161, symbol: 'ETH', providerAssetId: 'ARB.ETH' },
  { chainId: 42161, symbol: 'USDC', providerAssetId: 'ARB.USDC' },
  { chainId: 56, symbol: 'BNB', providerAssetId: 'BSC.BNB' },
  { chainId: 56, symbol: 'USDT', providerAssetId: 'BSC.USDT' },
  { chainId: 43114, symbol: 'AVAX', providerAssetId: 'AVAX.AVAX' },
  { chainId: 43114, symbol: 'USDC', providerAssetId: 'AVAX.USDC' },
] as const;

export const TELESWAP_ROUTE_CHAIN_IDS = [CHAIN_ID.BTC, 137, 56] as const;

export const RAIL_CAPABILITY_CATALOG: readonly RailCapabilityEntry[] = [
  {
    rail: Rail.CCTP,
    chainIds: [1, 10, 42161, 8453, 137, 43114, 11155111, 421614, 84532, 11155420, 43113, 80002, CHAIN_ID.SOL],
    source: 'protocol_domain_map',
    note: 'Circle domain and token metadata; CCTP fast remains a quote variant.',
  },
  {
    rail: Rail.LAYERZERO,
    chainIds: [
      1, 10, 42161, 8453, 137, 43114, 56, 369, 143, 146, 1329, 80094, 30, 10001, 999,
      59144, 5000, 34443, 81457, 534352, 324, 1101, 7777777, 1284, 42220,
      11155111, 421614, 84532, 11155420, 43113, 80002, 97,
    ],
    source: 'route_metadata',
    note: 'Broad rail, but route availability still depends on OFT/Stargate metadata.',
  },
  {
    rail: Rail.AXELAR,
    chainIds: [421614, 84532, 11155420],
    source: 'route_metadata',
    note: 'Advertised only where dynamic destination asset support is configured.',
  },
  {
    rail: Rail.VIA_LABS,
    chainIds: MAINNET_BROAD_MESSAGING_CHAIN_IDS,
    source: 'operator_config',
    note: 'Registered/advertised only; provider-direct quote/watch support requires a concrete Via Labs API contract before implementation.',
  },
  {
    rail: Rail.THORCHAIN,
    chainIds: [1, 10, 42161, 8453, 137, 43114, 56, CHAIN_ID.BTC, CHAIN_ID.SOL, CHAIN_ID.DOGE, CHAIN_ID.LTC, CHAIN_ID.BCH, CHAIN_ID.COSMOS],
    source: 'provider_asset_catalog',
    note: 'Provider-owned liquidity network; not intended to be 100-chain coverage.',
  },
  {
    rail: Rail.HYPERLANE_NEXUS,
    chainIds: MAINNET_BROAD_MESSAGING_CHAIN_IDS,
    source: 'operator_config',
    note: 'Availability depends on configured warp routes and Hyperlane Nexus enablement.',
  },
  {
    rail: Rail.OPTIMISM_NATIVE_BRIDGE,
    chainIds: [1, 10],
    source: 'native_bridge_catalog',
    note: 'Ethereum and Optimism standard bridge only.',
  },
  {
    rail: Rail.CHAINFLIP,
    chainIds: uniqueChainIds(CHAINFLIP_ASSET_CATALOG),
    source: 'provider_asset_catalog',
    note: 'Chainflip broker asset IDs; small provider-supported set.',
  },
  {
    rail: Rail.MAYA,
    chainIds: uniqueChainIds(MAYA_ASSET_CATALOG),
    source: 'provider_asset_catalog',
    note: 'Maya/Mayanode asset IDs; small THORChain-like provider set.',
  },
  {
    rail: Rail.TELESWAP,
    chainIds: TELESWAP_ROUTE_CHAIN_IDS,
    source: 'provider_route_catalog',
    note: 'BTC-focused TeleSwap route set reviewed separately from broad rails.',
  },
] as const;

export function deriveChainRailsFromCapabilities(
  catalog: readonly RailCapabilityEntry[] = RAIL_CAPABILITY_CATALOG,
): Record<number, Rail[]> {
  const out: Record<number, Rail[]> = {};
  for (const entry of catalog) {
    for (const chainId of entry.chainIds) {
      const rails = out[chainId] ?? [];
      if (!rails.includes(entry.rail)) rails.push(entry.rail);
      out[chainId] = rails;
    }
  }
  return out;
}

export function toChainflipCatalogAsset(chainId: number, tokenSymbol: string): string | null {
  return lookupProviderAsset(CHAINFLIP_ASSET_CATALOG, chainId, tokenSymbol);
}

export function toMayaCatalogAsset(chainId: number, tokenSymbol: string): string | null {
  return lookupProviderAsset(MAYA_ASSET_CATALOG, chainId, tokenSymbol);
}

export function getProviderCatalogChainIds(catalog: readonly ProviderAssetCatalogEntry[]): Set<number> {
  return new Set(uniqueChainIds(catalog));
}

function lookupProviderAsset(
  catalog: readonly ProviderAssetCatalogEntry[],
  chainId: number,
  tokenSymbol: string,
): string | null {
  const normalized = tokenSymbol.trim().toUpperCase();
  return catalog.find((entry) =>
    entry.chainId === chainId
      && entry.symbol.toUpperCase() === normalized,
  )?.providerAssetId ?? null;
}

function uniqueChainIds(catalog: readonly ProviderAssetCatalogEntry[]): number[] {
  return [...new Set(catalog.map((entry) => entry.chainId))];
}
