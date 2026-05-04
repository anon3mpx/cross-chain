import { Rail, RailOfferType, SettlementToken } from '../types';

type RouteAssetAlias = 'USDC' | 'USDT' | 'ETH' | 'WETH';
type MessagingRail = Rail.CCTP | Rail.AXELAR | Rail.LAYERZERO | Rail.VIA_LABS | Rail.THORCHAIN;
type LayerZeroOfferFamily = Extract<RailOfferType, 'lz_oft' | 'lz_oft_adapter' | 'lz_stargate_pool' | 'lz_stargate_oft'>;

export interface RailRouteMetadata {
  tokens?: Partial<Record<RouteAssetAlias, string>>;
  oft?: Partial<Record<RouteAssetAlias, string>>;
}

export interface ChainRouteMetadataEntry {
  axelarChainName?: string;
  defaultTokens?: Partial<Record<SettlementToken, string>>;
  rails: Partial<Record<MessagingRail, RailRouteMetadata>>;
  axelarTokenIds?: Partial<Record<RouteAssetAlias, string>>;
  layerZero?: {
    dstEid?: number;
    extraOptions?: Partial<Record<RouteAssetAlias, string>>;
  };
}

export interface RouteMetadataDefaults {
  axelarDirectAssets: string[];
  layerZeroRouteFamilies: Partial<Record<string, LayerZeroOfferFamily>>;
}

export const ROUTE_METADATA_DEFAULTS: RouteMetadataDefaults = {
  axelarDirectAssets: ['WETH'],
  layerZeroRouteFamilies: {
    USDC: 'lz_stargate_pool',
    USDT: 'lz_oft_adapter',
    WETH: 'lz_oft',
  },
};

export const ROUTE_METADATA_BY_CHAIN: Record<number, ChainRouteMetadataEntry> = {
  8453: {
    axelarChainName: "base",
    defaultTokens: {
      [SettlementToken.USDC]: "0x0000000000000000000000000000000000001001",
      [SettlementToken.USDT]: "0x0000000000000000000000000000000000001004",
      [SettlementToken.ETH]: "0x0000000000000000000000000000000000001003",
    },
    rails: {
      [Rail.CCTP]: {
        tokens: { USDC: "0x0000000000000000000000000000000000001001" },
      },
      [Rail.AXELAR]: {
        tokens: {
          USDC: "0x0000000000000000000000000000000000001002",
          USDT: "0x0000000000000000000000000000000000001004",
          ETH: "0x0000000000000000000000000000000000001003",
          WETH: "0x0000000000000000000000000000000000001003",
        },
      },
      [Rail.LAYERZERO]: {
        tokens: {
          USDC: "0x0000000000000000000000000000000000001001",
          USDT: "0x0000000000000000000000000000000000001004",
          ETH: "0x0000000000000000000000000000000000001003",
          WETH: "0x0000000000000000000000000000000000001003",
        },
        oft: {
          USDC: "0x0000000000000000000000000000000000003001",
          USDT: "0x0000000000000000000000000000000000003002",
          ETH: "0x0000000000000000000000000000000000003003",
          WETH: "0x0000000000000000000000000000000000003003",
        },
      },
      [Rail.THORCHAIN]: {
        tokens: {
          USDC: "0x0000000000000000000000000000000000001001",
          USDT: "0x0000000000000000000000000000000000001004",
          ETH: "0x0000000000000000000000000000000000001003",
          WETH: "0x0000000000000000000000000000000000001003",
        },
      },
    },
    layerZero: {
      dstEid: 30184,
    },
  },
  42161: {
    axelarChainName: "arbitrum",
    defaultTokens: {
      [SettlementToken.USDC]: "0x0000000000000000000000000000000000002001",
      [SettlementToken.USDT]: "0x0000000000000000000000000000000000002004",
      [SettlementToken.ETH]: "0x0000000000000000000000000000000000002003",
    },
    rails: {
      [Rail.CCTP]: {
        tokens: { USDC: "0x0000000000000000000000000000000000002001" },
      },
      [Rail.AXELAR]: {
        tokens: {
          USDC: "0x0000000000000000000000000000000000002002",
          USDT: "0x0000000000000000000000000000000000002004",
          ETH: "0x0000000000000000000000000000000000002003",
          WETH: "0x0000000000000000000000000000000000002003",
        },
      },
      [Rail.LAYERZERO]: {
        tokens: {
          USDC: "0x0000000000000000000000000000000000002001",
          USDT: "0x0000000000000000000000000000000000002004",
          ETH: "0x0000000000000000000000000000000000002003",
          WETH: "0x0000000000000000000000000000000000002003",
        },
      },
      [Rail.THORCHAIN]: {
        tokens: {
          USDC: "0x0000000000000000000000000000000000002001",
          ETH: "0x0000000000000000000000000000000000002003",
        },
      },
    },
    axelarTokenIds: {
      USDC: "0x1111111111111111111111111111111111111111111111111111111111111111",
      USDT: "0x2222222222222222222222222222222222222222222222222222222222222222",
      ETH: "0x3333333333333333333333333333333333333333333333333333333333333333",
      WETH: "0x3333333333333333333333333333333333333333333333333333333333333333",
    },
    layerZero: {
      dstEid: 30110,
    },
  },
  84532: {
    axelarChainName: "base-sepolia",
    defaultTokens: {
      [SettlementToken.USDC]: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    },
    rails: {
      [Rail.CCTP]: {
        tokens: { USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" },
      },
      [Rail.AXELAR]: {
        tokens: { USDC: "0x2f2A9DbFd8c503a0aC56413B774e39030df85331" },
      },
      [Rail.LAYERZERO]: {
        tokens: { USDC: "0x1500116D88B6583E63E2Fa9D4199f2edDf72149b" },
        oft: { USDC: "0x1500116D88B6583E63E2Fa9D4199f2edDf72149b" },
      },
    },
    layerZero: {
      dstEid: 40245,
    },
  },
  421614: {
    axelarChainName: "arbitrum-sepolia",
    defaultTokens: {
      [SettlementToken.USDC]: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    },
    rails: {
      [Rail.CCTP]: {
        tokens: { USDC: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" },
      },
      [Rail.AXELAR]: {
        tokens: { USDC: "0xA2Ba06a76eC793d1Faf23Cc8220A887402b27331" },
      },
      [Rail.LAYERZERO]: {
        tokens: { USDC: "0x3253a335E7bFfB4790Aa4C25C4250d206E9b9773" },
        oft: { USDC: "0x543BdA7c6cA4384FE90B1F5929bb851F52888983" },
      },
    },
    axelarTokenIds: {
      USDC: "0x8351ce1d9b08b0ec2add9de7e893e4a216235576cd4074bbacb0b9fb9b8f68c6",
    },
    layerZero: {
      dstEid: 40231,
    },
  },
  11155420: {
    axelarChainName: "optimism-sepolia",
    defaultTokens: {
      [SettlementToken.USDC]: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
    },
    rails: {
      [Rail.CCTP]: {
        tokens: { USDC: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7" },
      },
      [Rail.AXELAR]: {
        tokens: { USDC: "0x2f2A9DbFd8c503a0aC56413B774e39030df85331" },
      },
      [Rail.LAYERZERO]: {
        tokens: { USDC: "0xC1d9A1f64291CF47e703eab6b27fA0660cAE7324" },
        oft: { USDC: "0xC1d9A1f64291CF47e703eab6b27fA0660cAE7324" },
      },
    },
    axelarTokenIds: {
      USDC: "0x4d2fdc120be87ecf5661b7a75144d5d4b507b525eeb8c9c85c346a255e3b9663",
    },
    layerZero: {
      dstEid: 40232,
    },
  },
};

function assetAliases(value: string): RouteAssetAlias[] {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'ETH' || normalized === 'WETH') return ['WETH', 'ETH'];
  if (normalized === 'USDC') return ['USDC'];
  if (normalized === 'USDT') return ['USDT'];
  return [];
}

function settlementTokenAliases(token: SettlementToken): RouteAssetAlias[] {
  switch (token) {
    case SettlementToken.USDC:
      return ['USDC'];
    case SettlementToken.USDT:
      return ['USDT'];
    case SettlementToken.ETH:
      return ['WETH', 'ETH'];
    default:
      return [];
  }
}

function firstAliasMatch<T>(record: Partial<Record<RouteAssetAlias, T>> | undefined, aliases: RouteAssetAlias[]): T | undefined {
  if (!record) return undefined;
  for (const alias of aliases) {
    const value = record[alias];
    if (value !== undefined) return value;
  }
  return undefined;
}

export function getRouteMetadataEntry(chainId: number): ChainRouteMetadataEntry | undefined {
  return ROUTE_METADATA_BY_CHAIN[chainId];
}

export function getAxelarChainNameFromMetadata(chainId: number): string | undefined {
  return getRouteMetadataEntry(chainId)?.axelarChainName;
}

export function getRouteMetadataTokenAddress(
  chainId: number,
  rail: Rail,
  token: SettlementToken,
): string | undefined {
  const entry = getRouteMetadataEntry(chainId);
  if (!entry) return undefined;

  const aliases = settlementTokenAliases(token);
  return firstAliasMatch(entry.rails[rail]?.tokens, aliases);
}

export function getDefaultRouteTokenAddress(
  chainId: number,
  token: SettlementToken,
): string | undefined {
  return getRouteMetadataEntry(chainId)?.defaultTokens?.[token];
}

export function getAxelarDestinationTokenIdFromMetadata(
  chainId: number,
  canonicalAssetId: string,
): string | undefined {
  return firstAliasMatch(getRouteMetadataEntry(chainId)?.axelarTokenIds, assetAliases(canonicalAssetId));
}

export function getLayerZeroOftAddressFromMetadata(
  chainId: number,
  canonicalAssetId: string,
): string | undefined {
  return firstAliasMatch(
    getRouteMetadataEntry(chainId)?.rails[Rail.LAYERZERO]?.oft,
    assetAliases(canonicalAssetId),
  );
}

export function getLayerZeroDestinationEidFromMetadata(chainId: number): number | undefined {
  return getRouteMetadataEntry(chainId)?.layerZero?.dstEid;
}

export function getLayerZeroExtraOptionsFromMetadata(
  chainId: number,
  canonicalAssetId: string,
): string | undefined {
  return firstAliasMatch(
    getRouteMetadataEntry(chainId)?.layerZero?.extraOptions,
    assetAliases(canonicalAssetId),
  );
}

export function getDefaultAxelarDirectAssetsFromMetadata(): string[] {
  return [...ROUTE_METADATA_DEFAULTS.axelarDirectAssets];
}

export function getDefaultLayerZeroRouteFamiliesFromMetadata():
  Partial<Record<string, LayerZeroOfferFamily>> {
  return { ...ROUTE_METADATA_DEFAULTS.layerZeroRouteFamilies };
}
