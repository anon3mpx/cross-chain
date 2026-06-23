import {
  CHAINFLIP_ASSET_CATALOG,
  MAYA_ASSET_CATALOG,
  RAIL_CAPABILITY_CATALOG,
  TELESWAP_ROUTE_CHAIN_IDS,
} from '../config/railCapabilities';
import { Rail } from '../types';
import { MayaClient } from './maya/MayaClient';

export type RailCapabilityHealthStatus = 'ok' | 'warning' | 'skipped';

export interface RailCapabilityHealthReport {
  rail: Rail;
  status: RailCapabilityHealthStatus;
  message: string;
  catalogChainIds: number[];
  providerChainIds?: number[];
  missingProviderChainIds?: number[];
}

export interface RailCapabilityHealthOptions {
  enabled?: Partial<Record<Rail, boolean>>;
  mayaClient?: Pick<MayaClient, 'getInboundAddresses'>;
}

const MAYA_CHAIN_CODE_TO_CHAIN_ID: Record<string, number> = {
  BTC: 0,
  DOGE: 98,
  KUJI: 104,
  DASH: 105,
  ZEC: 106,
  ETH: 1,
  ARB: 42161,
  BSC: 56,
  AVAX: 43114,
};

export async function checkProviderLimitedRailCapabilities(
  options: RailCapabilityHealthOptions = {},
): Promise<RailCapabilityHealthReport[]> {
  const enabled = options.enabled ?? {};
  const reports: RailCapabilityHealthReport[] = [
    validateStaticCatalog(Rail.CHAINFLIP, enabled[Rail.CHAINFLIP] ?? false, chainIdsFromAssetCatalog(CHAINFLIP_ASSET_CATALOG), 'Chainflip broker does not expose live asset discovery through the current client.'),
    validateStaticCatalog(Rail.TELESWAP, enabled[Rail.TELESWAP] ?? false, [...TELESWAP_ROUTE_CHAIN_IDS], 'TeleSwap route discovery is not exposed through the current SDK worker.'),
  ];

  reports.push(await validateMayaCatalog(enabled[Rail.MAYA] ?? false, options.mayaClient));
  return reports;
}

function validateStaticCatalog(
  rail: Rail,
  enabled: boolean,
  catalogChainIds: number[],
  providerDiscoveryMessage: string,
): RailCapabilityHealthReport {
  const capabilityChainIds = capabilityEntryChainIds(rail);
  const missingCapabilityChainIds = catalogChainIds.filter((chainId) => !capabilityChainIds.includes(chainId));
  if (missingCapabilityChainIds.length > 0) {
    return {
      rail,
      status: 'warning',
      message: `Catalog chains are not fully represented in RAIL_CAPABILITY_CATALOG: ${missingCapabilityChainIds.join(', ')}`,
      catalogChainIds,
      missingProviderChainIds: missingCapabilityChainIds,
    };
  }

  return {
    rail,
    status: enabled ? 'skipped' : 'ok',
    message: enabled
      ? providerDiscoveryMessage
      : 'Static catalog is internally consistent; live provider discovery skipped because rail is disabled.',
    catalogChainIds,
  };
}

async function validateMayaCatalog(
  enabled: boolean,
  client: Pick<MayaClient, 'getInboundAddresses'> | undefined,
): Promise<RailCapabilityHealthReport> {
  const catalogChainIds = chainIdsFromAssetCatalog(MAYA_ASSET_CATALOG);
  const capabilityChainIds = capabilityEntryChainIds(Rail.MAYA);
  const missingCapabilityChainIds = catalogChainIds.filter((chainId) => !capabilityChainIds.includes(chainId));
  if (missingCapabilityChainIds.length > 0) {
    return {
      rail: Rail.MAYA,
      status: 'warning',
      message: `Maya catalog chains are not fully represented in RAIL_CAPABILITY_CATALOG: ${missingCapabilityChainIds.join(', ')}`,
      catalogChainIds,
      missingProviderChainIds: missingCapabilityChainIds,
    };
  }

  if (!enabled) {
    return {
      rail: Rail.MAYA,
      status: 'ok',
      message: 'Static catalog is internally consistent; live Mayanode inbound-address validation skipped because Maya is disabled.',
      catalogChainIds,
    };
  }

  if (!client) {
    return {
      rail: Rail.MAYA,
      status: 'skipped',
      message: 'Maya is enabled, but no Mayanode client was provided for live inbound-address validation.',
      catalogChainIds,
    };
  }

  try {
    const inbound = await client.getInboundAddresses();
    const providerChainIds = [...new Set(
      [...inbound.keys()]
        .map((chainCode) => MAYA_CHAIN_CODE_TO_CHAIN_ID[chainCode.trim().toUpperCase()])
        .filter((chainId): chainId is number => typeof chainId === 'number'),
    )].sort((a, b) => a - b);
    const missingProviderChainIds = catalogChainIds.filter((chainId) => !providerChainIds.includes(chainId));

    return {
      rail: Rail.MAYA,
      status: missingProviderChainIds.length > 0 ? 'warning' : 'ok',
      message: missingProviderChainIds.length > 0
        ? `Mayanode inbound addresses do not currently advertise catalog chains: ${missingProviderChainIds.join(', ')}`
        : 'Mayanode inbound addresses cover every Maya catalog chain.',
      catalogChainIds,
      providerChainIds,
      missingProviderChainIds,
    };
  } catch (err) {
    return {
      rail: Rail.MAYA,
      status: 'warning',
      message: `Maya live capability check failed: ${err instanceof Error ? err.message : String(err)}`,
      catalogChainIds,
    };
  }
}

function capabilityEntryChainIds(rail: Rail): number[] {
  return [...(RAIL_CAPABILITY_CATALOG.find((entry) => entry.rail === rail)?.chainIds ?? [])];
}

function chainIdsFromAssetCatalog(catalog: readonly { chainId: number }[]): number[] {
  return [...new Set(catalog.map((entry) => entry.chainId))].sort((a, b) => a - b);
}
