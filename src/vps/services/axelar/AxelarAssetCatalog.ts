import { AbiCoder, getAddress, keccak256 } from 'ethers';
import { getChainConfig } from '../../config/chains';
import { getSettlementTokenAddress } from '../../config/contracts';
import {
  getAxelarAssetAliases,
  getAxelarDestinationTokenIdEnvKeys,
} from '../../rails/registry';
import { Rail, RouteAssetRef, SettlementToken } from '../../types';

export interface ResolveAxelarAssetInput {
  srcChainId: number;
  dstChainId: number;
  canonicalAssetId: string;
}

export interface ResolvedAxelarAsset {
  settlementToken: SettlementToken;
  sourceSettlementToken: string;
  sourceSettlementAssetId: string;
  destinationTokenId: string;
  expectedDstSettlementToken: string;
  expectedDstSettlementAssetId: string;
}

export interface AxelarRouteOption {
  offerType: 'axelar_direct' | 'axelar_dst_swap';
  routeAsset: RouteAssetRef;
  expectedDstToken: string;
  expectedDstAssetId: string;
  destinationTokenId: string;
}

export interface AxelarAssetCatalogOptions {
  env?: Record<string, string | undefined>;
  defaultCanonicalAssetIds?: string[];
  directCanonicalAssetIds?: string[];
}

export class AxelarAssetCatalog {
  private readonly abiCoder = AbiCoder.defaultAbiCoder();
  private readonly env: Record<string, string | undefined>;
  private readonly defaultCanonicalAssetIds: string[];
  private readonly directCanonicalAssetIds: Set<string>;

  constructor(options: AxelarAssetCatalogOptions | Record<string, string | undefined> = process.env) {
    if ('env' in options || 'defaultCanonicalAssetIds' in options || 'directCanonicalAssetIds' in options) {
      const typed = options as AxelarAssetCatalogOptions;
      this.env = typed.env ?? process.env;
      this.defaultCanonicalAssetIds = typed.defaultCanonicalAssetIds ?? [];
      this.directCanonicalAssetIds = new Set(
        (typed.directCanonicalAssetIds ?? []).map((value) => value.trim().toUpperCase()),
      );
      return;
    }

    this.env = options;
    this.defaultCanonicalAssetIds = [];
    this.directCanonicalAssetIds = new Set();
  }

  listRoutes(input: { srcChainId: number; dstChainId: number; canonicalAssetIds?: string[] }): AxelarRouteOption[] {
    const canonicalAssetIds = input.canonicalAssetIds ?? this.defaultCanonicalAssetIds;
    const routes: AxelarRouteOption[] = [];

    for (const canonicalAssetId of canonicalAssetIds) {
      try {
        const resolved = this.resolve({
          srcChainId: input.srcChainId,
          dstChainId: input.dstChainId,
          canonicalAssetId,
        });
        const normalized = canonicalAssetId.trim().toUpperCase();
        routes.push({
          offerType: this.directCanonicalAssetIds.has(normalized) ? 'axelar_direct' : 'axelar_dst_swap',
          routeAsset: {
            canonicalAssetId,
            providerAssetId: `axelar:${normalized.toLowerCase()}`,
            tokenAddress: resolved.sourceSettlementToken,
            srcTokenAddress: resolved.sourceSettlementToken,
            dstTokenAddress: resolved.expectedDstSettlementToken,
            decimals: resolved.settlementToken === SettlementToken.USDC || resolved.settlementToken === SettlementToken.USDT ? 6 : 18,
            assetKind: 'erc20',
            assetStandard: 'erc20',
          },
          expectedDstToken: resolved.expectedDstSettlementToken,
          expectedDstAssetId: resolved.expectedDstSettlementAssetId,
          destinationTokenId: resolved.destinationTokenId,
        });
      } catch {
        continue;
      }
    }

    return routes;
  }

  resolve(input: ResolveAxelarAssetInput): ResolvedAxelarAsset {
    if (!getChainConfig(input.srcChainId)) {
      throw new Error(`axelar asset catalog: unknown source chain ${input.srcChainId}`);
    }

    if (!getChainConfig(input.dstChainId)) {
      throw new Error(`axelar asset catalog: unknown destination chain ${input.dstChainId}`);
    }

    const settlementToken = this._resolveSettlementToken(input.canonicalAssetId);
    const sourceSettlementToken = getSettlementTokenAddress(
      input.srcChainId,
      settlementToken,
      Rail.AXELAR,
    );
    if (!sourceSettlementToken) {
      throw new Error(
        `axelar asset catalog: missing source settlement token for chain ${input.srcChainId} and ${settlementToken}`,
      );
    }

    const expectedDstSettlementToken = getSettlementTokenAddress(
      input.dstChainId,
      settlementToken,
      Rail.AXELAR,
    );
    if (!expectedDstSettlementToken) {
      throw new Error(
        `axelar asset catalog: missing destination settlement token for chain ${input.dstChainId} and ${settlementToken}`,
      );
    }

    const destinationTokenIdRaw = this._readFirst(getAxelarDestinationTokenIdEnvKeys(
      input.dstChainId,
      input.canonicalAssetId,
    ));
    if (!destinationTokenIdRaw) {
      throw new Error(
        `axelar asset catalog: missing destination token id for chain ${input.dstChainId} and ${input.canonicalAssetId}`,
      );
    }
    const destinationTokenId = this._normalizeBytes32(destinationTokenIdRaw, 'destinationTokenId');

    return {
      settlementToken,
      sourceSettlementToken,
      sourceSettlementAssetId: this._settlementAssetId(input.srcChainId, sourceSettlementToken),
      destinationTokenId,
      expectedDstSettlementToken,
      expectedDstSettlementAssetId: this._settlementAssetId(
        input.dstChainId,
        expectedDstSettlementToken,
      ),
    };
  }

  private _resolveSettlementToken(canonicalAssetId: string): SettlementToken {
    const aliases = getAxelarAssetAliases(canonicalAssetId);
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

    throw new Error(`axelar asset catalog: unsupported canonical asset ${canonicalAssetId}`);
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

  private _normalizeBytes32(value: string, field: string): string {
    const trimmed = value.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
      throw new Error(`axelar asset catalog: invalid ${field}`);
    }
    return trimmed.toLowerCase();
  }

  private _settlementAssetId(chainId: number, tokenAddress: string): string {
    return keccak256(
      this.abiCoder.encode(
        ['uint256', 'address'],
        [BigInt(chainId), getAddress(tokenAddress)],
      ),
    );
  }
}
