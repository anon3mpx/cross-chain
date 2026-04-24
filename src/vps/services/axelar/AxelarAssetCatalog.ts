import { AbiCoder, getAddress, keccak256 } from 'ethers';
import { getChainConfig } from '../../config/chains';
import { getSettlementTokenAddress } from '../../config/contracts';
import {
  getAxelarAssetAliases,
  getAxelarDestinationTokenIdEnvKeys,
} from '../../rails/registry';
import { Rail, SettlementToken } from '../../types';

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

export class AxelarAssetCatalog {
  private readonly abiCoder = AbiCoder.defaultAbiCoder();

  constructor(private readonly env: Record<string, string | undefined> = process.env) {}

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
