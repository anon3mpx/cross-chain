import { AbiCoder, getAddress, keccak256 } from 'ethers';
import { getChainConfig } from '../../config/chains';
import { getSettlementTokenAddress } from '../../config/contracts';
import {
  getLayerZeroAssetAliases,
  getLayerZeroDestinationEidEnvKeys,
  getLayerZeroExtraOptionsEnvKeys,
  getLayerZeroOftAddressEnvKeys,
} from '../../rails/registry';
import { Rail, SettlementToken } from '../../types';

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

export class LayerZeroRouteCatalog {
  private readonly abiCoder = AbiCoder.defaultAbiCoder();

  constructor(private readonly env: Record<string, string | undefined> = process.env) {}

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

    const oftAddressRaw = this._readFirst(getLayerZeroOftAddressEnvKeys(
      input.srcChainId,
      input.canonicalAssetId,
    ));
    if (!oftAddressRaw) {
      throw new Error(
        `layerzero route catalog: missing OFT address for chain ${input.srcChainId} and ${input.canonicalAssetId}`,
      );
    }

    const dstEidRaw = this._readFirst(getLayerZeroDestinationEidEnvKeys(input.dstChainId));
    if (!dstEidRaw) {
      throw new Error(
        `layerzero route catalog: missing destination eid for chain ${input.dstChainId}`,
      );
    }

    const extraOptionsRaw = this._readFirst(getLayerZeroExtraOptionsEnvKeys(
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
}
