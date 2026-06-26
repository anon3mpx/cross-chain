import {
  THORChainClient,
  THORChainSwapQuoteResponse,
} from './THORChainClient';

const DEFAULT_THORCHAIN_CANARY_ALLOWLIST = [
  '8453:1:BASE.ETH:ETH.ETH',
  '8453:0:BASE.ETH:BTC.BTC',
];

export interface THORChainQuoteRequest {
  amountIn: bigint;
  srcChainId: number;
  dstChainId: number;
  tokenIn: string;
  tokenOut: string;
  destinationAddress?: string;
  refundAddress?: string;
  fromAsset?: string;
  toAsset?: string;
  amountInThorchain?: bigint;
  fromAssetDecimals?: number;
  toAssetDecimals?: number;
  toleranceBps?: number;
  affiliateAddress?: string;
  affiliateBps?: number;
}

export interface THORChainQuoteResult {
  quote: THORChainSwapQuoteResponse;
  recommendedMinAmountIn?: string;
  expectedAmountOut?: string;
  slippageBps?: number;
  outboundFeeUSD?: number;
  settlementTimeSeconds?: number;
}

export interface THORChainQuoteClient {
  quoteSwap(params: URLSearchParams): Promise<THORChainSwapQuoteResponse>;
}

export interface THORChainQuoteWorkerOptions {
  enableCanaryGuardrails?: boolean;
  canaryAllowlist?: Iterable<string>;
}

export class THORChainQuoteWorker {
  private readonly client: THORChainQuoteClient;
  private readonly enableCanaryGuardrails: boolean;
  private readonly canaryAllowlist: Set<string>;

  constructor(
    client: THORChainQuoteClient = new THORChainClient(),
    options: THORChainQuoteWorkerOptions = {},
  ) {
    this.client = client;
    this.enableCanaryGuardrails = options.enableCanaryGuardrails
      ?? this._readBoolEnv('ENABLE_THORCHAIN_CANARY', false);

    const configuredAllowlist = options.canaryAllowlist
      ? [...options.canaryAllowlist]
      : this._readAllowlistFromEnv();
    const normalizedAllowlist = configuredAllowlist
      .map((entry) => this._normalizeAllowlistKey(entry))
      .filter((entry) => entry.length > 0);

    if (this.enableCanaryGuardrails && normalizedAllowlist.length === 0) {
      this.canaryAllowlist = new Set(
        DEFAULT_THORCHAIN_CANARY_ALLOWLIST.map((entry) => this._normalizeAllowlistKey(entry)),
      );
    } else {
      this.canaryAllowlist = new Set(normalizedAllowlist);
    }
  }

  async quote(input: THORChainQuoteRequest): Promise<THORChainQuoteResult | null> {
    if (this.enableCanaryGuardrails && !this._isCanaryPairAllowed(input)) {
      return null;
    }

    const params = this._buildQuoteParams(input);
    const quote = await this.client.quoteSwap(params);

    const minimumIn = this._parseBigInt(quote.recommended_min_amount_in);
    if (minimumIn !== null && input.amountIn < minimumIn) {
      return null;
    }

    return {
      quote,
      recommendedMinAmountIn: quote.recommended_min_amount_in,
      expectedAmountOut: this._toOptionalString(quote.expected_amount_out),
      slippageBps: this._parseNumber(quote.fees?.slippage_bps),
      outboundFeeUSD: this._parseNumber(quote.fees?.outboundUsd ?? quote.fees?.outbound_usd),
      settlementTimeSeconds: this._parseNumber(
        quote.total_swap_seconds ?? quote.inbound_confirmation_seconds,
      ),
    };
  }

  private _buildQuoteParams(input: THORChainQuoteRequest): URLSearchParams {
    const params = new URLSearchParams();
    params.set('from_asset', input.fromAsset ?? input.tokenIn);
    params.set('to_asset', input.toAsset ?? input.tokenOut);
    params.set('amount', (input.amountInThorchain ?? input.amountIn).toString());

    if (input.destinationAddress) {
      params.set('destination', input.destinationAddress);
    }
    if (input.refundAddress) {
      params.set('refund_address', input.refundAddress);
    }
    if (input.toleranceBps !== undefined) {
      params.set('tolerance_bps', String(Math.max(0, Math.floor(input.toleranceBps))));
    }
    if (input.affiliateAddress) {
      params.set('affiliate', input.affiliateAddress);
    }
    if (input.affiliateBps !== undefined) {
      params.set('affiliate_bps', String(Math.max(0, Math.floor(input.affiliateBps))));
    }
    return params;
  }

  private _toOptionalString(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined;
    const raw = String(value).trim();
    return raw.length > 0 ? raw : undefined;
  }

  private _parseBigInt(value: unknown): bigint | null {
    const raw = this._toOptionalString(value);
    if (!raw || !/^\d+$/.test(raw)) return null;
    return BigInt(raw);
  }

  private _parseNumber(value: unknown): number | undefined {
    const raw = this._toOptionalString(value);
    if (!raw) return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private _isCanaryPairAllowed(input: THORChainQuoteRequest): boolean {
    if (this.canaryAllowlist.size === 0) return false;
    const key = this._buildCanaryKey(input);
    return this.canaryAllowlist.has(key);
  }

  private _buildCanaryKey(input: THORChainQuoteRequest): string {
    const fromAsset = input.fromAsset ?? input.tokenIn;
    const toAsset = input.toAsset ?? input.tokenOut;
    return `${input.srcChainId}:${input.dstChainId}:${this._normalizeAsset(fromAsset)}:${this._normalizeAsset(toAsset)}`;
  }

  private _normalizeAllowlistKey(value: string): string {
    const raw = value.trim();
    if (!raw) return '';
    const parts = raw.split(':');
    if (parts.length !== 4) return raw.toUpperCase();
    const [srcChainId, dstChainId, fromAsset, toAsset] = parts;
    return `${srcChainId.trim()}:${dstChainId.trim()}:${this._normalizeAsset(fromAsset)}:${this._normalizeAsset(toAsset)}`;
  }

  private _normalizeAsset(asset: string): string {
    return asset.trim().toUpperCase();
  }

  private _readAllowlistFromEnv(): string[] {
    const raw = process.env.THORCHAIN_CANARY_ALLOWLIST;
    if (!raw) return [];
    return raw.split(',').map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  }

  private _readBoolEnv(name: string, fallback: boolean): boolean {
    const raw = process.env[name];
    if (!raw) return fallback;
    const normalized = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
  }
}
