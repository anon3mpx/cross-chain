import { HYPERLANE_NEXUS_ROUTE_CHAINS } from '../../config/hyperlaneNexusRoutes';

export type HyperlaneNexusAssetSymbol = 'USDC' | 'USDT';

export interface HyperlaneNexusRouteConnectionConfig {
  protocol?: string;
  chainName: string;
  warpRouteAddress?: string;
}

export interface HyperlaneNexusAssetRouteConfig {
  warpRouteAddress?: string;
  collateralTokenAddress?: string;
  tokenType?: string;
  cctpVersion?: string;
  connections?: HyperlaneNexusRouteConnectionConfig[];
  interchainGasFee?: bigint | number | string;
  etaSeconds?: number;
  disabled?: boolean;
}

export interface HyperlaneNexusChainRouteConfig {
  chainId: number;
  domain: number;
  registryChainName?: string;
  disabled?: boolean;
  assets?: Partial<Record<HyperlaneNexusAssetSymbol, HyperlaneNexusAssetRouteConfig>>;
}

export interface HyperlaneNexusResolvedRoute {
  srcChainId: number;
  dstChainId: number;
  assetSymbol: HyperlaneNexusAssetSymbol;
  warpRouteAddress: string;
  destinationDomain: number;
  interchainGasFee: bigint;
  etaSeconds: number;
}

export interface HyperlaneNexusRouteCatalogOptions {
  chains?: HyperlaneNexusChainRouteConfig[];
  env?: Record<string, string | undefined>;
  defaultInterchainGasFee?: bigint;
  defaultEtaSeconds?: number;
}

export const DEFAULT_HYPERLANE_NEXUS_CHAINS: HyperlaneNexusChainRouteConfig[] = HYPERLANE_NEXUS_ROUTE_CHAINS;

export const HYPERLANE_DOMAIN_BY_CHAIN_ID: Record<number, number> = Object.fromEntries(
  DEFAULT_HYPERLANE_NEXUS_CHAINS.map((chain) => [chain.chainId, chain.domain]),
) as Record<number, number>;

export const HYPERLANE_NEXUS_ACCESSIBLE_CHAIN_IDS = new Set<number>(
  DEFAULT_HYPERLANE_NEXUS_CHAINS.map((chain) => chain.chainId),
);

function readEnv(env: Record<string, string | undefined>, key: string): string | undefined {
  const value = env[key];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseBigIntSafe(value: bigint | number | string | undefined, fallback: bigint): bigint {
  if (value === undefined) return fallback;
  if (typeof value === 'bigint') return value;
  try {
    return BigInt(value);
  } catch {
    return fallback;
  }
}

function parsePositiveInt(value: number | string | undefined, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function normalizeAddress(value: string | undefined): string | null {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) return null;
  return value;
}

function normalizeAssetSymbol(assetSymbol: string): HyperlaneNexusAssetSymbol | null {
  const normalized = assetSymbol.trim().toUpperCase();
  if (normalized === 'USDC' || normalized === 'USDT') return normalized;
  return null;
}

export class HyperlaneNexusRouteCatalog {
  private readonly chainsById: Map<number, HyperlaneNexusChainRouteConfig>;
  private readonly env: Record<string, string | undefined>;
  private readonly defaultInterchainGasFee: bigint;
  private readonly defaultEtaSeconds: number;

  constructor(options: HyperlaneNexusRouteCatalogOptions | Record<string, string | undefined> = {}) {
    if (
      'chains' in options
      || 'env' in options
      || 'defaultInterchainGasFee' in options
      || 'defaultEtaSeconds' in options
    ) {
      const typed = options as HyperlaneNexusRouteCatalogOptions;
      this.env = typed.env ?? process.env;
      this.defaultInterchainGasFee = typed.defaultInterchainGasFee
        ?? parseBigIntSafe(readEnv(this.env, 'HYPERLANE_IGP_FEE_DEFAULT'), 0n);
      this.defaultEtaSeconds = typed.defaultEtaSeconds
        ?? parsePositiveInt(readEnv(this.env, 'HYPERLANE_ETA_DEFAULT'), 60);
      this.chainsById = this.buildChainMap(typed.chains ?? DEFAULT_HYPERLANE_NEXUS_CHAINS);
      return;
    }

    this.env = options;
    this.defaultInterchainGasFee = parseBigIntSafe(readEnv(this.env, 'HYPERLANE_IGP_FEE_DEFAULT'), 0n);
    this.defaultEtaSeconds = parsePositiveInt(readEnv(this.env, 'HYPERLANE_ETA_DEFAULT'), 60);
    this.chainsById = this.buildChainMap(DEFAULT_HYPERLANE_NEXUS_CHAINS);
  }

  findRoute(input: {
    srcChainId: number;
    dstChainId: number;
    assetSymbol: string;
  }): HyperlaneNexusResolvedRoute | null {
    const assetSymbol = normalizeAssetSymbol(input.assetSymbol);
    if (!assetSymbol || input.srcChainId === input.dstChainId) return null;

    const destinationDomain = this.domainFor(input.dstChainId);
    if (destinationDomain === null || this.isDisabled(input.srcChainId) || this.isDisabled(input.dstChainId)) {
      return null;
    }

    const catalogRoute = this.catalogRouteFor(input.srcChainId, assetSymbol, destinationDomain, input.dstChainId);
    if (catalogRoute) return catalogRoute;

    return null;
  }

  private buildChainMap(chains: HyperlaneNexusChainRouteConfig[]): Map<number, HyperlaneNexusChainRouteConfig> {
    return new Map(chains.map((chain) => [chain.chainId, chain]));
  }

  private domainFor(chainId: number): number | null {
    const chain = this.chainsById.get(chainId);
    if (chain) return chain.disabled ? null : chain.domain;
    return HYPERLANE_DOMAIN_BY_CHAIN_ID[chainId] ?? null;
  }

  private isDisabled(chainId: number): boolean {
    return this.chainsById.get(chainId)?.disabled === true;
  }

  private catalogRouteFor(
    srcChainId: number,
    assetSymbol: HyperlaneNexusAssetSymbol,
    destinationDomain: number,
    dstChainId: number,
  ): HyperlaneNexusResolvedRoute | null {
    const sourceChain = this.chainsById.get(srcChainId);
    const asset = sourceChain?.assets?.[assetSymbol];
    if (!asset || asset.disabled) return null;

    const warpRouteAddress = normalizeAddress(asset.warpRouteAddress);
    if (!warpRouteAddress) return null;
    if (!this.hasDestinationConnection(asset, dstChainId)) return null;

    return {
      srcChainId,
      dstChainId,
      assetSymbol,
      warpRouteAddress,
      destinationDomain,
      interchainGasFee: parseBigIntSafe(asset.interchainGasFee, this.defaultInterchainGasFee),
      etaSeconds: parsePositiveInt(asset.etaSeconds, this.defaultEtaSeconds),
    };
  }

  private hasDestinationConnection(asset: HyperlaneNexusAssetRouteConfig, dstChainId: number): boolean {
    if (!asset.connections || asset.connections.length === 0) return true;

    const destinationChainName = this.chainsById.get(dstChainId)?.registryChainName?.trim().toLowerCase();
    if (!destinationChainName) return false;

    return asset.connections.some((connection) =>
      connection.chainName.trim().toLowerCase() === destinationChainName
      && normalizeAddress(connection.warpRouteAddress) !== null,
    );
  }

}
