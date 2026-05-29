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
    defaultTokens: {
      [SettlementToken.USDC]: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      // [SettlementToken.USDT]: "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2",
      // [SettlementToken.WETH]: "0x4200000000000000000000000000000000000006",
    },
    rails: {
      [Rail.CCTP]: {
        tokens: { USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
      },
      [Rail.LAYERZERO]: {
        tokens: {
          USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          // USDT: "0x0000000000000000000000000000000000001004",
          // ETH: "0x0000000000000000000000000000000000001003",
          // WETH: "0x4200000000000000000000000000000000000006",
        },
        oft: {
          USDC: "0x27a16dc786820B16E5c9028b75B99F6f604b5d26",
          // USDT: "0x0000000000000000000000000000000000003002",
          // WETH: "0xdc181Bd607330aeeBEF6ea62e03e5e1Fb4B6F7C7",
          // WETH: "0x0000000000000000000000000000000000003003",
        },
      },
    },
    layerZero: {
      dstEid: 30184,
      extraOptions: {
        USDC: "0x00030100110100000000000000000000000000030d40010013030000000000000000000000000000000c3500",
      },
    },
  },
  42161: {
    defaultTokens: {
      [SettlementToken.USDC]: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      // [SettlementToken.USDT]: "0x0000000000000000000000000000000000002004",
      // [SettlementToken.WETH]: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    },
    rails: {
      [Rail.CCTP]: {
        tokens: { USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
      },
      // [Rail.AXELAR]: {
      //   tokens: {
      //     USDC: "0x0000000000000000000000000000000000002002",
      //     USDT: "0x0000000000000000000000000000000000002004",
      //     ETH: "0x0000000000000000000000000000000000002003",
      //     WETH: "0x0000000000000000000000000000000000002003",
      //   },
      // },
      [Rail.LAYERZERO]: {
        tokens: {
          USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          // USDT: "0x0000000000000000000000000000000000002004",
          // WETH: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
          // WETH: "0x0000000000000000000000000000000000002003",
        },
        oft: {
          USDC: "0xe8CDF27AcD73a434D661C84887215F7598e7d0d3",
          // WETH: "0xA45B5130f36CDcA45667738e2a258AB09f4A5f7F"
        },
      },
      // [Rail.THORCHAIN]: {
      //   tokens: {
      //     USDC: "0x0000000000000000000000000000000000002001",
      //     ETH: "0x0000000000000000000000000000000000002003",
      //   },
      // },
    },
    layerZero: {
      dstEid: 30110,
      extraOptions: {
        USDC: "0x00030100110100000000000000000000000000030d40010013030000000000000000000000000000000c3500",
      },
    },
  },
  10: {
    defaultTokens: {
      [SettlementToken.USDC]: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      // [SettlementToken.WETH]: "0x4200000000000000000000000000000000000006",
    },
    rails: {
      [Rail.CCTP]: {
        tokens: { USDC: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85" },
      },
      [Rail.LAYERZERO]: {
        tokens: {
          USDC: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          // WETH: "0x4200000000000000000000000000000000000006",
        },
        oft: {
          USDC: "0xcE8CcA271Ebc0533920C83d39F417ED6A0abB7D0",
          // WETH: "0xe8CDF27AcD73a434D661C84887215F7598e7d0d3"
        },
      },
    },
    layerZero: {
      dstEid: 30111,
      extraOptions: {
        USDC: "0x00030100110100000000000000000000000000030d40010013030000000000000000000000000000000c3500",
      },
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
