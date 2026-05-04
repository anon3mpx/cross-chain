import { getAddress } from 'ethers';
import { getChainConfig } from '../../config/chains';
import { QuoteRequest } from '../../types';
import {
  LayerZeroValueTransferApiClient,
  LayerZeroValueTransferApiQuote,
  LayerZeroValueTransferApiQuoteRequest,
  LayerZeroValueTransferApiToken,
  LayerZeroValueTransferApiUserStep,
} from './LayerZeroValueTransferApiClient';

const DEFAULT_ALLOWED_ASSETS = ['USDC', 'USDT', 'WETH', 'ETH'];

export interface LayerZeroValueTransferApiQuoteClient {
  requestLayerZeroValueTransferApiQuotes(request: LayerZeroValueTransferApiQuoteRequest): Promise<{
    quotes: LayerZeroValueTransferApiQuote[];
    tokens: LayerZeroValueTransferApiToken[];
  }>;
}

export interface LayerZeroValueTransferApiQuoteResult {
  quote: LayerZeroValueTransferApiQuote;
  sourceToken: LayerZeroValueTransferApiToken;
  destinationToken: LayerZeroValueTransferApiToken;
  expectedAmountOut: string;
  minAmountOut: string;
  feeUsd: number;
  settlementTimeSeconds: number;
  userSteps: LayerZeroValueTransferApiUserStep[];
}

export interface LayerZeroValueTransferApiQuoteWorkerOptions {
  enabled?: boolean;
  allowedAssetSymbols?: string[];
}

export class LayerZeroValueTransferApiQuoteWorker {
  private readonly client: LayerZeroValueTransferApiQuoteClient;
  private readonly enabled: boolean;
  private readonly allowedAssetSymbols: Set<string>;

  constructor(
    client: LayerZeroValueTransferApiQuoteClient = new LayerZeroValueTransferApiClient(),
    options: LayerZeroValueTransferApiQuoteWorkerOptions = {},
  ) {
    this.client = client;
    this.enabled = options.enabled ?? this._readBoolEnv('ENABLE_LAYERZERO_TRANSFER_API', false);
    this.allowedAssetSymbols = new Set(
      (options.allowedAssetSymbols ?? this._readAllowedAssetsFromEnv())
        .map((asset) => asset.trim().toUpperCase())
        .filter(Boolean),
    );
  }

  async quoteLayerZeroValueTransferApi(input: QuoteRequest): Promise<LayerZeroValueTransferApiQuoteResult | null> {
    if (!this.enabled) return null;

    const srcChainKey = this._chainKey(input.srcChainId);
    const dstChainKey = this._chainKey(input.dstChainId);
    if (!srcChainKey || !dstChainKey) return null;

    const request: LayerZeroValueTransferApiQuoteRequest = {
      srcChainKey,
      dstChainKey,
      srcTokenAddress: input.tokenIn,
      dstTokenAddress: input.tokenOut,
      srcWalletAddress: input.userAddress,
      dstWalletAddress: input.nativeDstAddress ?? input.userAddress,
      amount: input.amountIn.toString(),
    };

    const response = await this.client.requestLayerZeroValueTransferApiQuotes(request);
    const quote = response.quotes[0];
    if (!quote) return null;

    const sourceToken = this._findToken(response.tokens, srcChainKey, input.tokenIn);
    const destinationToken = this._findToken(response.tokens, dstChainKey, input.tokenOut);
    if (!sourceToken || !destinationToken) return null;
    if (!this._isAllowedAsset(sourceToken.symbol) || !this._isAllowedAsset(destinationToken.symbol)) {
      return null;
    }

    const expectedAmountOut = this._digits(quote.dstAmount);
    if (!expectedAmountOut) return null;
    const minAmountOut = this._digits(quote.dstAmountMin) ?? expectedAmountOut;

    return {
      quote,
      sourceToken,
      destinationToken,
      expectedAmountOut,
      minAmountOut,
      feeUsd: this._parseNumber(quote.feeUsd) ?? 0,
      settlementTimeSeconds: this._durationSeconds(quote.duration?.estimated),
      userSteps: quote.userSteps ?? [],
    };
  }

  private _chainKey(chainId: number): string | null {
    const configured = this._readEnv(`LAYERZERO_TRANSFER_CHAIN_KEY_${chainId}`)
      ?? this._readEnv(`CHAIN_${chainId}_LAYERZERO_TRANSFER_CHAIN_KEY`);
    if (configured) return configured;
    return getChainConfig(chainId)?.name ?? null;
  }

  private _findToken(
    tokens: LayerZeroValueTransferApiToken[],
    chainKey: string,
    address: string,
  ): LayerZeroValueTransferApiToken | null {
    const normalizedAddress = this._normalizeAddressLike(address);
    return tokens.find((token) =>
      token.chainKey.trim().toLowerCase() === chainKey.trim().toLowerCase()
        && this._normalizeAddressLike(token.address) === normalizedAddress
    ) ?? null;
  }

  private _normalizeAddressLike(value: string): string {
    try {
      return getAddress(value).toLowerCase();
    } catch {
      return value.trim().toLowerCase();
    }
  }

  private _isAllowedAsset(symbol: string): boolean {
    if (this.allowedAssetSymbols.size === 0) return false;
    return this.allowedAssetSymbols.has(symbol.trim().toUpperCase());
  }

  private _digits(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    const raw = String(value).trim();
    return /^\d+$/.test(raw) ? raw : null;
  }

  private _parseNumber(value: unknown): number | undefined {
    if (value === null || value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private _durationSeconds(value: unknown): number {
    const parsed = this._parseNumber(value);
    if (parsed === undefined || parsed < 0) return 300;
    return Math.max(1, Math.ceil(parsed / 1000));
  }

  private _readAllowedAssetsFromEnv(): string[] {
    const raw = this._readEnv('LAYERZERO_TRANSFER_ALLOWED_ASSETS');
    if (!raw) return DEFAULT_ALLOWED_ASSETS;
    return raw.split(',').map((asset) => asset.trim()).filter(Boolean);
  }

  private _readBoolEnv(name: string, fallback: boolean): boolean {
    const raw = this._readEnv(name);
    if (!raw) return fallback;
    const normalized = raw.toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
  }

  private _readEnv(name: string): string | undefined {
    const value = process.env[name];
    if (!value) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
}
