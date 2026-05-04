import { AbiCoder, getAddress, keccak256 } from 'ethers';
import { getChainConfig } from '../../config/chains';
import { getSettlementTokenAddress } from '../../config/contracts';
import {
  getLayerZeroDestinationEidFromMetadata,
  getLayerZeroExtraOptionsFromMetadata,
  getLayerZeroOftAddressFromMetadata,
} from '../../config/routeMetadata';
import {
  getLayerZeroAssetAliases,
  getLayerZeroDestinationEidEnvKeys,
  getLayerZeroExtraOptionsEnvKeys,
  getLayerZeroOftAddressEnvKeys,
} from '../../rails/registry';
import { Rail, RailOfferType, RouteAssetRef, SettlementToken } from '../../types';

export interface ResolveLayerZeroRouteInput {
  srcChainId: number;
  dstChainId: number;
  canonicalAssetId: string;
}

export interface ResolvedLayerZeroRoute {
  settlementToken: SettlementToken;
  sourceSettlementToken: string;
  sourceSettlementAssetId: string;
  oftAddress: string;
  expectedDstSettlementToken: string;
  expectedDstSettlementAssetId: string;
  dstEid: number;
  extraOptions: string;
}

export interface LayerZeroRouteOption {
  offerType: Extract<RailOfferType, 'lz_oft' | 'lz_oft_adapter' | 'lz_stargate_pool' | 'lz_stargate_oft'>;
  routeAsset: RouteAssetRef;
  oftAddress: string;
  expectedDstToken: string;
  expectedDstAssetId: string;
  dstEid: number;
  extraOptions: string;
}

export interface LayerZeroRouteCatalogOptions {
  env?: Record<string, string | undefined>;
  defaultCanonicalAssetIds?: string[];
  routeFamilyOverrides?: Partial<Record<string, LayerZeroRouteOption['offerType']>>;
}

export class LayerZeroRouteCatalog {
  private readonly abiCoder = AbiCoder.defaultAbiCoder();
  private readonly env: Record<string, string | undefined>;
  private readonly defaultCanonicalAssetIds: string[];
  private readonly routeFamilyOverrides: Partial<Record<string, LayerZeroRouteOption['offerType']>>;

  constructor(options: LayerZeroRouteCatalogOptions | Record<string, string | undefined> = process.env) {
    if ('env' in options || 'defaultCanonicalAssetIds' in options || 'routeFamilyOverrides' in options) {
      const typed = options as LayerZeroRouteCatalogOptions;
      this.env = typed.env ?? process.env;
      this.defaultCanonicalAssetIds = typed.defaultCanonicalAssetIds ?? [];
      this.routeFamilyOverrides = Object.fromEntries(
        Object.entries(typed.routeFamilyOverrides ?? {}).map(([key, value]) => [key.trim().toUpperCase(), value]),
      );
      return;
    }

    this.env = options;
    this.defaultCanonicalAssetIds = [];
    this.routeFamilyOverrides = {};
  }

  listRoutes(input: { srcChainId: number; dstChainId: number; canonicalAssetIds?: string[] }): LayerZeroRouteOption[] {
    const canonicalAssetIds = input.canonicalAssetIds ?? this.defaultCanonicalAssetIds;
    const routes: LayerZeroRouteOption[] = [];

    for (const canonicalAssetId of canonicalAssetIds) {
      try {
        const resolved = this.resolve({
          srcChainId: input.srcChainId,
          dstChainId: input.dstChainId,
          canonicalAssetId,
        });
        const normalized = canonicalAssetId.trim().toUpperCase();
        routes.push({
          offerType: this.routeFamilyOverrides[normalized] ?? 'lz_oft',
          routeAsset: {
            canonicalAssetId,
            providerAssetId: `layerzero:${normalized.toLowerCase()}`,
            tokenAddress: resolved.sourceSettlementToken,
            srcTokenAddress: resolved.sourceSettlementToken,
            dstTokenAddress: resolved.expectedDstSettlementToken,
            decimals: resolved.settlementToken === SettlementToken.USDC || resolved.settlementToken === SettlementToken.USDT ? 6 : 18,
            assetKind: 'erc20',
            assetStandard: this._assetStandardFor(normalized),
          },
          oftAddress: resolved.oftAddress,
          expectedDstToken: resolved.expectedDstSettlementToken,
          expectedDstAssetId: resolved.expectedDstSettlementAssetId,
          dstEid: resolved.dstEid,
          extraOptions: resolved.extraOptions,
        });
      } catch {
        continue;
      }
    }

    return routes;
  }

  resolve(input: ResolveLayerZeroRouteInput): ResolvedLayerZeroRoute {
    if (!getChainConfig(input.srcChainId)) {
      throw new Error(`layerzero route catalog: unknown source chain ${input.srcChainId}`);
    }

    if (!getChainConfig(input.dstChainId)) {
      throw new Error(`layerzero route catalog: unknown destination chain ${input.dstChainId}`);
    }

    const settlementToken = this._resolveSettlementToken(input.canonicalAssetId);
    const sourceSettlementToken = getSettlementTokenAddress(
      input.srcChainId,
      settlementToken,
      Rail.LAYERZERO,
    );
    if (!sourceSettlementToken) {
      throw new Error(
        `layerzero route catalog: missing source settlement token for chain ${input.srcChainId} and ${settlementToken}`,
      );
    }

    const expectedDstSettlementToken = getSettlementTokenAddress(
      input.dstChainId,
      settlementToken,
      Rail.LAYERZERO,
    );
    if (!expectedDstSettlementToken) {
      throw new Error(
        `layerzero route catalog: missing destination settlement token for chain ${input.dstChainId} and ${settlementToken}`,
      );
    }

    const oftAddressRaw = getLayerZeroOftAddressFromMetadata(
      input.srcChainId,
      input.canonicalAssetId,
    ) ?? this._readFirst(getLayerZeroOftAddressEnvKeys(
      input.srcChainId,
      input.canonicalAssetId,
    ));
    if (!oftAddressRaw) {
      throw new Error(
        `layerzero route catalog: missing OFT address for chain ${input.srcChainId} and ${input.canonicalAssetId}`,
      );
    }

    const dstEidRaw = String(
      getLayerZeroDestinationEidFromMetadata(input.dstChainId)
      ?? this._readFirst(getLayerZeroDestinationEidEnvKeys(input.dstChainId))
      ?? '',
    );
    if (!dstEidRaw) {
      throw new Error(
        `layerzero route catalog: missing destination eid for chain ${input.dstChainId}`,
      );
    }

    const extraOptionsRaw = getLayerZeroExtraOptionsFromMetadata(
      input.dstChainId,
      input.canonicalAssetId,
    ) ?? this._readFirst(getLayerZeroExtraOptionsEnvKeys(
      input.dstChainId,
      input.canonicalAssetId,
    ));

    return {
      settlementToken,
      sourceSettlementToken,
      sourceSettlementAssetId: this._settlementAssetId(input.srcChainId, sourceSettlementToken),
      oftAddress: this._normalizeAddress(oftAddressRaw, 'oftAddress'),
      expectedDstSettlementToken,
      expectedDstSettlementAssetId: this._settlementAssetId(
        input.dstChainId,
        expectedDstSettlementToken,
      ),
      dstEid: this._normalizeUint32(dstEidRaw, 'dstEid'),
      extraOptions: extraOptionsRaw
        ? this._normalizeBytes(extraOptionsRaw, 'extraOptions')
        : '0x',
    };
  }

  private _resolveSettlementToken(canonicalAssetId: string): SettlementToken {
    const aliases = getLayerZeroAssetAliases(canonicalAssetId);
    for (const alias of aliases) {
      switch (alias) {
        case 'USDC':
          return SettlementToken.USDC;
        case 'USDT':
          return SettlementToken.USDT;
        case 'ETH':
        case 'WETH':
          return SettlementToken.ETH;
        default:
          break;
      }
    }

    throw new Error(`layerzero route catalog: unsupported canonical asset ${canonicalAssetId}`);
  }

  private _readFirst(keys: string[]): string | undefined {
    for (const key of keys) {
      const raw = this.env[key];
      if (!raw) continue;

      const trimmed = raw.trim();
      if (trimmed.length !== 0) return trimmed;
    }

    return undefined;
  }

  private _normalizeAddress(value: string, field: string): string {
    try {
      return getAddress(value);
    } catch {
      throw new Error(`layerzero route catalog: invalid ${field}`);
    }
  }

  private _normalizeBytes(value: string, field: string): string {
    const trimmed = value.trim();
    if (!/^0x[0-9a-fA-F]*$/.test(trimmed) || trimmed.length % 2 !== 0) {
      throw new Error(`layerzero route catalog: invalid ${field}`);
    }
    return trimmed.toLowerCase();
  }

  private _normalizeUint32(value: string, field: string): number {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      throw new Error(`layerzero route catalog: invalid ${field}`);
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 0xffff_ffff) {
      throw new Error(`layerzero route catalog: invalid ${field}`);
    }

    return parsed;
  }

  private _settlementAssetId(chainId: number, tokenAddress: string): string {
    return keccak256(
      this.abiCoder.encode(
        ['uint256', 'address'],
        [BigInt(chainId), getAddress(tokenAddress)],
      ),
    );
  }

  private _assetStandardFor(
    canonicalAssetId: string,
  ): RouteAssetRef['assetStandard'] {
    const override = this.routeFamilyOverrides[canonicalAssetId];
    switch (override) {
      case 'lz_oft_adapter':
        return 'oft_adapter';
      case 'lz_stargate_pool':
        return 'stargate_pool';
      case 'lz_stargate_oft':
        return 'stargate_oft';
      default:
        return 'oft';
    }
  }
}
