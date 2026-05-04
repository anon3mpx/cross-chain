import {
  CHAIN_ID,
  Intent,
  IntentStatus,
  Rail,
  RailConfig,
  RefundCustodyLocation,
  SettlementToken,
} from '../types';

export interface CctpRailMetadata {
  standardPluginId: string;
  fastPluginId: string;
  domainByChainId: Record<number, number>;
  fastFinalityThreshold: number;
  feeBufferBpsDefault: number;
}

export interface DynamicAssetSupportMetadata {
  routeAssetKey: 'settlementAssetId';
  destinationTokenIdEnvPrefixes: string[];
  expectedDestinationAssetId: 'keccak256(abi.encode(chainId,tokenAddress))';
}

export interface LayerZeroRouteSupportMetadata {
  routeAssetKey: 'settlementAssetId';
  oftAddressEnvPrefixes: string[];
  dstEidEnvPrefixes: string[];
  extraOptionsEnvPrefixes: string[];
  expectedDestinationAssetId: 'keccak256(abi.encode(chainId,tokenAddress))';
}

export interface RailProviderDefinition {
  rail: Rail;
  enumValue: number;
  aliases: string[];
  config: RailConfig;
  fallbackRails: Rail[];
  refundCustodyLocation: RefundCustodyLocation;
  receiverCustodyLocation?: RefundCustodyLocation;
  cctp?: CctpRailMetadata;
  dynamicAssetSupport?: DynamicAssetSupportMetadata;
  layerZeroRouteSupport?: LayerZeroRouteSupportMetadata;
}

export const ZERO_PLUGIN_ID = '0x' + '0'.repeat(64);
export type RailVariantLabel =
  | 'CCTP_STANDARD'
  | 'CCTP_FAST'
  | 'AXELAR'
  | 'LAYERZERO'
  | 'VIA_LABS'
  | 'WORMHOLE'
  | 'THORCHAIN';

export const PLUGIN_ID = {
  CCTP_V2: '0xb148ea5f936a28661e11743b1650193f1b14a2322b9541503bf6815a84a1a6e9',
  CCTP_V2_FAST: '0x9181644edfd36b07ccd623494a3681a4a6b9cd5d52611accda20264cd09259ac',
  AXELAR_V1: '0xdee0b34b74b60e53553685c32477090103c2b806eb925a8cd000efa92bef3e8b',
  LZ_V2: '0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc',
  VIA_LABS_V1: '0x3c09500df72dbac855e61899e0dd4420addc8367cb7a5f60906b5450d7a71687',
  WORMHOLE_V2: '0xfdd3e68657787c00343d96c11d1cd189fa4dfe5f52999861b06e9f8e99ea902f',
  THORCHAIN_V1: '0x390774707b6ae71a0ce31d10394e70b6ac75b3b62ec4db96c9672cafd1b516c9',
} as const;

const CCTP_METADATA: CctpRailMetadata = {
  standardPluginId: PLUGIN_ID.CCTP_V2,
  fastPluginId: PLUGIN_ID.CCTP_V2_FAST,
  fastFinalityThreshold: 1000,
  feeBufferBpsDefault: 2,
  domainByChainId: {
    1: 0,
    11155111: 0,
    43114: 1,
    43113: 1,
    10: 2,
    11155420: 2,
    42161: 3,
    421614: 3,
    8453: 6,
    84532: 6,
    137: 7,
    80002: 7,
  },
};

const AXELAR_DYNAMIC_ASSET_SUPPORT: DynamicAssetSupportMetadata = {
  routeAssetKey: 'settlementAssetId',
  destinationTokenIdEnvPrefixes: [
    'AXELAR_TOKEN_ID',
    'AXELAR_ASSET_ID',
    'TOKEN_ID_AXELAR',
  ],
  expectedDestinationAssetId: 'keccak256(abi.encode(chainId,tokenAddress))',
};

const LAYERZERO_ROUTE_SUPPORT: LayerZeroRouteSupportMetadata = {
  routeAssetKey: 'settlementAssetId',
  oftAddressEnvPrefixes: [
    'LAYERZERO_OFT',
    'LZ_OFT',
    'OFT_LAYERZERO',
  ],
  dstEidEnvPrefixes: [
    'LAYERZERO_DST_EID',
    'LZ_DST_EID',
    'DST_EID_LAYERZERO',
  ],
  extraOptionsEnvPrefixes: [
    'LAYERZERO_EXTRA_OPTIONS',
    'LZ_EXTRA_OPTIONS',
    'EXTRA_OPTIONS_LAYERZERO',
  ],
  expectedDestinationAssetId: 'keccak256(abi.encode(chainId,tokenAddress))',
};

export const RAIL_PROVIDERS: Record<Rail, RailProviderDefinition> = {
  [Rail.CCTP]: {
    rail: Rail.CCTP,
    enumValue: 0,
    aliases: [Rail.CCTP],
    config: {
      rail: Rail.CCTP,
      railType: 'messaging',
      fee: 0,
      etaSeconds: 1200,
      supportsUSDC: true,
      supportsUSDT: false,
      supportsETH: false,
      supportsBTC: false,
      supportsSOL: false,
      nativeUSDC: true,
      reliabilityScore: 0.997,
      pluginId: PLUGIN_ID.CCTP_V2,
      requiresNativeAddr: false,
    },
    fallbackRails: [Rail.VIA_LABS, Rail.AXELAR, Rail.LAYERZERO],
    refundCustodyLocation: RefundCustodyLocation.CCTP_PROTOCOL,
    cctp: CCTP_METADATA,
  },
  [Rail.AXELAR]: {
    rail: Rail.AXELAR,
    enumValue: 1,
    aliases: [Rail.AXELAR],
    config: {
      rail: Rail.AXELAR,
      railType: 'messaging',
      fee: 0.5,
      etaSeconds: 1800,
      supportsUSDC: true,
      supportsUSDT: true,
      supportsETH: true,
      supportsBTC: false,
      supportsSOL: false,
      nativeUSDC: false,
      reliabilityScore: 0.992,
      pluginId: PLUGIN_ID.AXELAR_V1,
      requiresNativeAddr: false,
    },
    fallbackRails: [Rail.LAYERZERO, Rail.VIA_LABS, Rail.CCTP],
    refundCustodyLocation: RefundCustodyLocation.AXELAR_PROTOCOL,
    receiverCustodyLocation: RefundCustodyLocation.RECEIVER,
    dynamicAssetSupport: AXELAR_DYNAMIC_ASSET_SUPPORT,
  },
  [Rail.LAYERZERO]: {
    rail: Rail.LAYERZERO,
    enumValue: 2,
    aliases: [Rail.LAYERZERO, 'LZ'],
    config: {
      rail: Rail.LAYERZERO,
      railType: 'messaging',
      fee: 0.35,
      etaSeconds: 300,
      supportsUSDC: true,
      supportsUSDT: true,
      supportsETH: true,
      supportsBTC: false,
      supportsSOL: false,
      nativeUSDC: false,
      reliabilityScore: 0.99,
      pluginId: PLUGIN_ID.LZ_V2,
      requiresNativeAddr: false,
    },
    fallbackRails: [Rail.AXELAR, Rail.VIA_LABS, Rail.CCTP],
    refundCustodyLocation: RefundCustodyLocation.LAYERZERO_PROTOCOL,
    receiverCustodyLocation: RefundCustodyLocation.RECEIVER,
    layerZeroRouteSupport: LAYERZERO_ROUTE_SUPPORT,
  },
  [Rail.VIA_LABS]: {
    rail: Rail.VIA_LABS,
    enumValue: 3,
    aliases: [Rail.VIA_LABS],
    config: {
      rail: Rail.VIA_LABS,
      railType: 'messaging',
      fee: 0.25,
      etaSeconds: 180,
      supportsUSDC: true,
      supportsUSDT: true,
      supportsETH: true,
      supportsBTC: false,
      supportsSOL: false,
      nativeUSDC: true,
      reliabilityScore: 0.985,
      pluginId: PLUGIN_ID.VIA_LABS_V1,
      requiresNativeAddr: false,
    },
    fallbackRails: [Rail.AXELAR, Rail.LAYERZERO, Rail.CCTP],
    refundCustodyLocation: RefundCustodyLocation.EXTERNAL_PROTOCOL,
  },
  [Rail.WORMHOLE]: {
    rail: Rail.WORMHOLE,
    enumValue: 4,
    aliases: [Rail.WORMHOLE],
    config: {
      rail: Rail.WORMHOLE,
      railType: 'messaging',
      fee: 0.4,
      etaSeconds: 60,
      supportsUSDC: true,
      supportsUSDT: false,
      supportsETH: true,
      supportsBTC: false,
      supportsSOL: true,
      nativeUSDC: false,
      reliabilityScore: 0.988,
      pluginId: PLUGIN_ID.WORMHOLE_V2,
      requiresNativeAddr: false,
    },
    fallbackRails: [Rail.AXELAR, Rail.LAYERZERO],
    refundCustodyLocation: RefundCustodyLocation.EXTERNAL_PROTOCOL,
  },
  [Rail.THORCHAIN]: {
    rail: Rail.THORCHAIN,
    enumValue: 5,
    aliases: [Rail.THORCHAIN],
    config: {
      rail: Rail.THORCHAIN,
      railType: 'liquidity',
      fee: 0,
      feeSlippagePct: 0.2,
      etaSeconds: 60,
      supportsUSDC: true,
      supportsUSDT: true,
      supportsETH: true,
      supportsBTC: true,
      supportsSOL: true,
      nativeUSDC: false,
      reliabilityScore: 0.975,
      pluginId: PLUGIN_ID.THORCHAIN_V1,
      requiresNativeAddr: true,
    },
    fallbackRails: [],
    refundCustodyLocation: RefundCustodyLocation.THORCHAIN_ROUTER,
  },
};

export const CHAIN_RAILS: Record<number, Rail[]> = {
  1: [Rail.CCTP, Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS, Rail.THORCHAIN],
  10: [Rail.CCTP, Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS, Rail.THORCHAIN],
  42161: [Rail.CCTP, Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS, Rail.THORCHAIN],
  8453: [Rail.CCTP, Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS, Rail.THORCHAIN],
  137: [Rail.CCTP, Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],
  43114: [Rail.CCTP, Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS, Rail.THORCHAIN],
  56: [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS, Rail.THORCHAIN],
  369: [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],
  143: [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],
  146: [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],
  1329: [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],
  80094: [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],
  30: [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],
  10001: [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],
  999: [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],
  59144: [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],
  5000: [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],
  34443: [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],
  81457: [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],
  534352: [Rail.LAYERZERO, Rail.VIA_LABS],
  324: [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],
  1101: [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],
  7777777: [Rail.LAYERZERO, Rail.VIA_LABS],
  1284: [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],
  42220: [Rail.AXELAR, Rail.LAYERZERO, Rail.VIA_LABS],
  11155111: [Rail.CCTP, Rail.AXELAR, Rail.LAYERZERO],
  421614: [Rail.CCTP, Rail.AXELAR, Rail.LAYERZERO],
  84532: [Rail.CCTP, Rail.AXELAR, Rail.LAYERZERO],
  11155420: [Rail.CCTP, Rail.AXELAR, Rail.LAYERZERO],
  43113: [Rail.CCTP, Rail.AXELAR, Rail.LAYERZERO],
  80002: [Rail.CCTP, Rail.AXELAR, Rail.LAYERZERO],
  97: [Rail.AXELAR, Rail.LAYERZERO],
  [CHAIN_ID.BTC]: [Rail.THORCHAIN],
  [CHAIN_ID.SOL]: [Rail.THORCHAIN, Rail.WORMHOLE, Rail.CCTP],
  [CHAIN_ID.DOGE]: [Rail.THORCHAIN],
  [CHAIN_ID.LTC]: [Rail.THORCHAIN],
  [CHAIN_ID.BCH]: [Rail.THORCHAIN],
  [CHAIN_ID.COSMOS]: [Rail.THORCHAIN, Rail.AXELAR],
};

export function getRailProvider(rail: Rail): RailProviderDefinition {
  return RAIL_PROVIDERS[rail];
}

export function getRailConfig(rail: Rail): RailConfig {
  return getRailProvider(rail).config;
}

export function getRailPluginId(rail: Rail): string {
  return getRailConfig(rail).pluginId;
}

export function getRailEnumValue(rail: Rail): number {
  return getRailProvider(rail).enumValue;
}

export function getRailEnvAliases(rail: Rail): string[] {
  return getRailProvider(rail)?.aliases ?? [];
}

export function getFallbackRails(rail: Rail): Rail[] {
  return [...getRailProvider(rail).fallbackRails];
}

export function getChainRails(chainId: number): Rail[] {
  return CHAIN_RAILS[chainId] ?? [];
}

export function getCctpMetadata(): CctpRailMetadata {
  const cctp = getRailProvider(Rail.CCTP).cctp;
  if (!cctp) throw new Error('CCTP metadata not configured');
  return cctp;
}

export function getAxelarDynamicAssetSupport(): DynamicAssetSupportMetadata {
  const dynamicAssetSupport = getRailProvider(Rail.AXELAR).dynamicAssetSupport;
  if (!dynamicAssetSupport) throw new Error('Axelar dynamic asset support not configured');
  return dynamicAssetSupport;
}

export function getLayerZeroRouteSupport(): LayerZeroRouteSupportMetadata {
  const routeSupport = getRailProvider(Rail.LAYERZERO).layerZeroRouteSupport;
  if (!routeSupport) throw new Error('LayerZero route support not configured');
  return routeSupport;
}

function getCanonicalAssetAliases(canonicalAssetId: string): string[] {
  const trimmed = canonicalAssetId.trim();
  if (trimmed.length === 0) return [];

  const rawSegment = trimmed.split(/[:/]/).filter(Boolean).pop() ?? trimmed;
  const normalized = rawSegment.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase();
  const aliases: string[] = [];

  const push = (value: string) => {
    if (value.length !== 0 && !aliases.includes(value)) aliases.push(value);
  };

  push(normalized);
  if (normalized.startsWith('AXELAR_')) push(normalized.slice('AXELAR_'.length));
  if (normalized.startsWith('AXL')) push(normalized.slice(3));
  if (normalized.startsWith('W')) push(normalized.slice(1));

  return aliases;
}

export function getAxelarAssetAliases(canonicalAssetId: string): string[] {
  return getCanonicalAssetAliases(canonicalAssetId);
}

export function getAxelarDestinationTokenIdEnvKeys(
  chainId: number,
  canonicalAssetId: string,
): string[] {
  const assetAliases = getAxelarAssetAliases(canonicalAssetId);
  return assetAliases.flatMap((alias) =>
    getAxelarDynamicAssetSupport().destinationTokenIdEnvPrefixes.map(
      (prefix) => `CHAIN_${chainId}_${prefix}_${alias}`,
    ),
  );
}

export function getLayerZeroAssetAliases(canonicalAssetId: string): string[] {
  return getCanonicalAssetAliases(canonicalAssetId);
}

export function getLayerZeroOftAddressEnvKeys(
  chainId: number,
  canonicalAssetId: string,
): string[] {
  const assetAliases = getLayerZeroAssetAliases(canonicalAssetId);
  return assetAliases.flatMap((alias) =>
    getLayerZeroRouteSupport().oftAddressEnvPrefixes.map(
      (prefix) => `CHAIN_${chainId}_${prefix}_${alias}`,
    ),
  );
}

export function getLayerZeroDestinationEidEnvKeys(chainId: number): string[] {
  return getLayerZeroRouteSupport().dstEidEnvPrefixes.map(
    (prefix) => `CHAIN_${chainId}_${prefix}`,
  );
}

export function getLayerZeroExtraOptionsEnvKeys(
  chainId: number,
  canonicalAssetId: string,
): string[] {
  const routeSupport = getLayerZeroRouteSupport();
  const assetAliases = getLayerZeroAssetAliases(canonicalAssetId);

  return [
    ...assetAliases.flatMap((alias) =>
      routeSupport.extraOptionsEnvPrefixes.map(
        (prefix) => `CHAIN_${chainId}_${prefix}_${alias}`,
      ),
    ),
    ...routeSupport.extraOptionsEnvPrefixes.map(
      (prefix) => `CHAIN_${chainId}_${prefix}`,
    ),
  ];
}

export function getCctpDomain(chainId: number): number | undefined {
  return getCctpMetadata().domainByChainId[chainId];
}

export function isCctpFastPluginId(pluginId: string): boolean {
  return pluginId.toLowerCase() === getCctpMetadata().fastPluginId.toLowerCase();
}

export function getRailVariantLabel(rail: Rail, railPluginId?: string): RailVariantLabel {
  if (rail === Rail.CCTP) {
    return railPluginId && isCctpFastPluginId(railPluginId) ? 'CCTP_FAST' : 'CCTP_STANDARD';
  }

  switch (rail) {
    case Rail.AXELAR:
      return 'AXELAR';
    case Rail.LAYERZERO:
      return 'LAYERZERO';
    case Rail.VIA_LABS:
      return 'VIA_LABS';
    case Rail.WORMHOLE:
      return 'WORMHOLE';
    case Rail.THORCHAIN:
      return 'THORCHAIN';
    default:
      return 'CCTP_STANDARD';
  }
}

export function inferRefundCustodyLocation(intent: Intent): RefundCustodyLocation {
  const provider = getRailProvider(intent.quote.rail);
  if (
    intent.status === IntentStatus.DESTINATION_RECEIVED &&
    provider.receiverCustodyLocation
  ) {
    return provider.receiverCustodyLocation;
  }
  return provider.refundCustodyLocation;
}
