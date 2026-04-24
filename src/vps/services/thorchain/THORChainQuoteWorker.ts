import {
  THORChainClient,
  THORChainSwapQuoteResponse,
} from './THORChainClient';

export interface THORChainQuoteRequest {
  amountIn: bigint;
  srcChainId: number;
  dstChainId: number;
  tokenIn: string;
  tokenOut: string;
  destinationAddress?: string;
  fromAsset?: string;
  toAsset?: string;
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

export class THORChainQuoteWorker {
  private readonly client: THORChainQuoteClient;

  constructor(client: THORChainQuoteClient = new THORChainClient()) {
    this.client = client;
  }

  async quote(input: THORChainQuoteRequest): Promise<THORChainQuoteResult | null> {
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
    params.set('amount', input.amountIn.toString());

    if (input.destinationAddress) {
      params.set('destination', input.destinationAddress);
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
}
