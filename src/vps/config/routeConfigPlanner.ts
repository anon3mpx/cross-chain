import { getChainConfig } from './chains';
import {
  getReceiverAdapterAddressFromDeploymentRegistry,
  getRailPluginAddressFromDeploymentRegistry,
} from './deploymentRegistry';
import {
  getAxelarChainNameFromMetadata,
  getDefaultAxelarDirectAssetsFromMetadata,
  getDefaultLayerZeroRouteFamiliesFromMetadata,
  getLayerZeroDestinationEidFromMetadata,
} from './routeMetadata';
import { ROUTE_ASSET_ALLOWLISTS } from './routeExecution';
import { AxelarAssetCatalog } from '../services/axelar/AxelarAssetCatalog';
import { LayerZeroRouteCatalog } from '../services/layerzero/LayerZeroRouteCatalog';
import { Rail, RailOfferType } from '../types';

type LayerZeroFamily = Extract<RailOfferType, 'lz_oft' | 'lz_oft_adapter' | 'lz_stargate_pool' | 'lz_stargate_oft'>;

export interface BuildMessagingRouteConfigPlanInput {
  srcChainId: number;
  dstChainId: number;
  assetAliases?: string[];
}

export interface AxelarSourceRoutePlan {
  dstChainId: number;
  chainName: string;
  assetAliases: string[];
}

export interface AxelarDestinationTrustPlan {
  canonicalAssetId: string;
  destinationTokenId: string;
  destinationToken: string;
  sourceChainName: string;
}

export interface LayerZeroSourceFamilyPlan {
  dstChainId: number;
  dstEid: number;
  family: LayerZeroFamily;
  defaultOptions: string;
  assetAliases: string[];
}

export interface LayerZeroDestinationAssetPlan {
  canonicalAssetId: string;
  family: LayerZeroFamily;
  settlementToken: string;
  settlementAssetId: string;
  composeSender: string;
  srcEid: number;
}

export interface MessagingRouteConfigPlan {
  srcChainId: number;
  dstChainId: number;
  axelar?: {
    sourceRoute: AxelarSourceRoutePlan;
    destinationTrusts: AxelarDestinationTrustPlan[];
  };
  layerZero?: {
    sourceEid: number;
    sourceFamilies: LayerZeroSourceFamilyPlan[];
    destinationAssets: LayerZeroDestinationAssetPlan[];
  };
  warnings: string[];
}

export function buildMessagingRouteConfigPlan(
  input: BuildMessagingRouteConfigPlanInput,
): MessagingRouteConfigPlan {
  const srcChain = getChainConfig(input.srcChainId);
  const dstChain = getChainConfig(input.dstChainId);
  if (!srcChain) throw new Error(`unknown source chain ${input.srcChainId}`);
  if (!dstChain) throw new Error(`unknown destination chain ${input.dstChainId}`);

  const warnings: string[] = [];
  const assetAliases = normalizeAssetAliases(
    input.assetAliases ?? [...new Set([
      ...(ROUTE_ASSET_ALLOWLISTS.AXELAR ?? []),
      ...(ROUTE_ASSET_ALLOWLISTS.LAYERZERO ?? []),
    ])],
  );

  const axelarCatalog = new AxelarAssetCatalog({
    defaultCanonicalAssetIds: assetAliases,
    directCanonicalAssetIds: getDefaultAxelarDirectAssetsFromMetadata(),
  });
  const axelarRoutes = axelarCatalog.listRoutes({
    srcChainId: input.srcChainId,
    dstChainId: input.dstChainId,
    canonicalAssetIds: assetAliases,
  });

  const layerZeroCatalog = new LayerZeroRouteCatalog({
    defaultCanonicalAssetIds: assetAliases,
    routeFamilyOverrides: getDefaultLayerZeroRouteFamiliesFromMetadata(),
  });
  const layerZeroRoutes = layerZeroCatalog.listRoutes({
    srcChainId: input.srcChainId,
    dstChainId: input.dstChainId,
    canonicalAssetIds: assetAliases,
  });

  const axelar = buildAxelarPlan(
    input.srcChainId,
    input.dstChainId,
    axelarRoutes,
    warnings,
  );
  const layerZero = buildLayerZeroPlan(
    input.srcChainId,
    input.dstChainId,
    layerZeroRoutes,
    warnings,
  );

  return {
    srcChainId: input.srcChainId,
    dstChainId: input.dstChainId,
    ...(axelar ? { axelar } : {}),
    ...(layerZero ? { layerZero } : {}),
    warnings,
  };
}

function buildAxelarPlan(
  srcChainId: number,
  dstChainId: number,
  routes: ReturnType<AxelarAssetCatalog['listRoutes']>,
  warnings: string[],
): MessagingRouteConfigPlan['axelar'] {
  if (routes.length === 0) return undefined;

  const sourceChainName = getAxelarChainNameFromMetadata(srcChainId) ?? getChainConfig(srcChainId)?.name;
  const destinationChainName = getAxelarChainNameFromMetadata(dstChainId) ?? getChainConfig(dstChainId)?.name;
  if (!sourceChainName) {
    warnings.push(`Axelar source chain name missing for chain ${srcChainId}`);
    return undefined;
  }
  if (!destinationChainName) {
    warnings.push(`Axelar destination chain name missing for chain ${dstChainId}`);
    return undefined;
  }

  return {
    sourceRoute: {
      dstChainId,
      chainName: destinationChainName,
      assetAliases: routes.map((route) => route.routeAsset.canonicalAssetId.trim().toUpperCase()),
    },
    destinationTrusts: routes.map((route) => ({
      canonicalAssetId: route.routeAsset.canonicalAssetId.trim().toUpperCase(),
      destinationTokenId: route.destinationTokenId,
      destinationToken: route.expectedDstToken,
      sourceChainName,
    })),
  };
}

function buildLayerZeroPlan(
  srcChainId: number,
  dstChainId: number,
  routes: ReturnType<LayerZeroRouteCatalog['listRoutes']>,
  warnings: string[],
): MessagingRouteConfigPlan['layerZero'] {
  if (routes.length === 0) return undefined;
  const sourceEid = getLayerZeroSourceEid(srcChainId);
  if (sourceEid === null) {
    warnings.push(`LayerZero source eid missing for chain ${srcChainId}`);
    return undefined;
  }

  const familyMap = new Map<LayerZeroFamily, { dstEid: number; options: Set<string>; assetAliases: string[] }>();
  for (const route of routes) {
    const family = route.offerType;
    const existing = familyMap.get(family);
    if (existing) {
      existing.options.add(route.extraOptions);
      existing.assetAliases.push(route.routeAsset.canonicalAssetId.trim().toUpperCase());
      continue;
    }
    familyMap.set(family, {
      dstEid: route.dstEid,
      options: new Set([route.extraOptions]),
      assetAliases: [route.routeAsset.canonicalAssetId.trim().toUpperCase()],
    });
  }

  const sourceFamilies = [...familyMap.entries()].map(([family, data]) => {
    if (data.options.size > 1) {
      warnings.push(
        `LayerZero family ${family} has multiple asset-specific options for ${srcChainId}->${dstChainId}; ` +
        'on-chain default will use 0x and quotes will carry per-asset overrides',
      );
    }

    return {
      dstChainId,
      dstEid: data.dstEid,
      family,
      defaultOptions: data.options.size === 1 ? [...data.options][0] : '0x',
      assetAliases: data.assetAliases,
    };
  });

  const destinationAssets = routes.map((route) => ({
    canonicalAssetId: route.routeAsset.canonicalAssetId.trim().toUpperCase(),
    family: route.offerType,
    settlementToken: route.expectedDstToken,
    settlementAssetId: route.expectedDstAssetId,
    composeSender: route.oftAddress,
    srcEid: sourceEid,
  }));

  return {
    sourceEid,
    sourceFamilies,
    destinationAssets,
  };
}

function getLayerZeroSourceEid(chainId: number): number | null {
  const eid = getLayerZeroDestinationEidFromMetadata(chainId);
  return typeof eid === 'number' ? eid : null;
}

function normalizeAssetAliases(values: string[]): string[] {
  const normalized = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) continue;
    normalized.add(trimmed);
  }
  return [...normalized];
}

export function renderMessagingRouteConfigPlan(plan: MessagingRouteConfigPlan): string {
  const lines: string[] = [];

  lines.push(`# Route config plan for ${plan.srcChainId} -> ${plan.dstChainId}`);

  if (plan.axelar) {
    lines.push('');
    lines.push('## Axelar source-chain pair config');
      lines.push(`AXELAR_SET_ROUTE=true`);
      lines.push(`AXELAR_ROUTE_CHAIN_ID=${plan.axelar.sourceRoute.dstChainId}`);
      lines.push(`AXELAR_ROUTE_NAME=${plan.axelar.sourceRoute.chainName}`);
      lines.push(
        `AXELAR_ROUTE_RECEIVER=${getReceiverAdapterAddressFromDeploymentRegistry(plan.dstChainId, 'axelar') ?? '<DESTINATION_AXELAR_ADAPTER>'}`,
      );
    lines.push(`# assets: ${plan.axelar.sourceRoute.assetAliases.join(', ')}`);

    lines.push('');
    lines.push('## Axelar destination-chain trusted tokens');
    lines.push(`# repeat once per asset on the destination chain`);
    for (const asset of plan.axelar.destinationTrusts) {
      lines.push('');
      lines.push(`# ${asset.canonicalAssetId}`);
      lines.push(`AXELAR_ADAPTER_SET_TRUSTED_SOURCE=true`);
      lines.push(`AXELAR_SOURCE_CHAIN=${asset.sourceChainName}`);
      lines.push(
        `AXELAR_SOURCE_ADDRESS=${getRailPluginAddressFromDeploymentRegistry(plan.srcChainId, Rail.AXELAR) ?? '<SOURCE_AXELAR_PLUGIN>'}`,
      );
      lines.push(`AXELAR_TRUSTED_TOKEN_ID=${asset.destinationTokenId}`);
      lines.push(`AXELAR_TRUSTED_TOKEN=${asset.destinationToken}`);
    }
  }

  if (plan.layerZero) {
    lines.push('');
    lines.push('## LayerZero source-chain family config');
    lines.push(`# repeat once per family on the source chain`);
    for (const family of plan.layerZero.sourceFamilies) {
      lines.push('');
      lines.push(`# ${family.family} assets: ${family.assetAliases.join(', ')}`);
      lines.push(`LZ_SET_ROUTE=true`);
      lines.push(`LZ_ROUTE_CHAIN_ID=${family.dstChainId}`);
      lines.push(`LZ_ROUTE_EID=${family.dstEid}`);
      lines.push(
        `LZ_ROUTE_RECEIVER=${getReceiverAdapterAddressFromDeploymentRegistry(plan.dstChainId, 'layerzero') ?? '<DESTINATION_LAYERZERO_ADAPTER>'}`,
      );
      lines.push(`LZ_ROUTE_FAMILY=${family.family}`);
      lines.push(`LZ_ROUTE_OPTIONS=${family.defaultOptions}`);
    }

    lines.push('');
    lines.push('## LayerZero destination-chain trusted peer');
    lines.push(`LZ_ADAPTER_SET_TRUSTED_PEER=true`);
    lines.push(`LZ_SOURCE_EID=${plan.layerZero.sourceEid}`);
    lines.push(
      `LZ_SOURCE_PEER_ADDRESS=${getReceiverAdapterAddressFromDeploymentRegistry(plan.srcChainId, 'layerzero') ?? '<SOURCE_LAYERZERO_ADAPTER>'}`,
    );

    lines.push('');
    lines.push('## LayerZero destination-chain asset registry');
    lines.push(`# repeat once per asset on the destination chain`);
    for (const asset of plan.layerZero.destinationAssets) {
      lines.push('');
      lines.push(`# ${asset.canonicalAssetId} via ${asset.family}`);
      lines.push(`LZ_ADAPTER_SET_ASSET=true`);
      lines.push(`LZ_SOURCE_EID=${asset.srcEid}`);
      lines.push(`LZ_SETTLEMENT_TOKEN=${asset.settlementToken}`);
      lines.push(`LZ_COMPOSE_SENDER=${asset.composeSender}`);
      lines.push(`# derived routeAssetId=${asset.settlementAssetId}`);
    }
  }

  if (plan.warnings.length > 0) {
    lines.push('');
    lines.push('## Warnings');
    for (const warning of plan.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return `${lines.join('\n')}\n`;
}
