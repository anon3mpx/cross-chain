import { Rail } from '../../types';

export interface TeleSwapQuoteRequest {
  srcChainId: number;
  dstChainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  destinationAddress: string;
  refundAddress?: string;
}

export interface TeleSwapQuoteResult {
  depositAddress: string;
  expectedAmountOut: bigint;
  slipBps: number;
  etaSeconds: number;
  protocolFeeAmount: bigint;
  dexRouter: 'uniswap-v3-polygon' | 'pancakeswap-v2-bsc' | string;
  swapId?: string;
}

export interface TeleSwapQuoteWorker {
  quote(req: TeleSwapQuoteRequest): Promise<TeleSwapQuoteResult | null>;
}

function readEnv(key: string): string | undefined {
  const value = process.env[key];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class SdkTeleSwapQuoteWorker implements TeleSwapQuoteWorker {
  private readonly apiBaseUrl: string | undefined;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor() {
    this.apiBaseUrl = readEnv('TELESWAP_API_URL');
    const timeout = Number(readEnv('TELESWAP_TIMEOUT_MS') ?? '8000');
    this.timeoutMs = Number.isFinite(timeout) && timeout > 0 ? timeout : 8_000;
    const retries = Number(readEnv('TELESWAP_MAX_RETRIES') ?? '2');
    this.maxRetries = Number.isFinite(retries) && retries >= 0 ? retries : 2;
  }

  isConfigured(): boolean {
    return !!this.apiBaseUrl;
  }

  async quote(req: TeleSwapQuoteRequest): Promise<TeleSwapQuoteResult | null> {
    if (!this.apiBaseUrl) return null;

    const search = new URLSearchParams({
      src_chain: String(req.srcChainId),
      dst_chain: String(req.dstChainId),
      token_in: req.tokenIn,
      token_out: req.tokenOut,
      amount: req.amountIn.toString(),
      destination: req.destinationAddress,
    });
    if (req.refundAddress) search.set('refund', req.refundAddress);

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        const response = await fetch(`${this.apiBaseUrl.replace(/\/$/, '')}/quote?${search.toString()}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!response.ok) {
          if (response.status >= 400 && response.status < 500) return null;
          if (attempt === this.maxRetries) return null;
          await sleep(backoffMs(attempt));
          continue;
        }
        const json = await response.json() as {
          deposit_address?: string;
          expected_amount_out?: string;
          slip_bps?: number;
          eta_seconds?: number;
          protocol_fee_amount?: string;
          dex_router?: string;
          swap_id?: string;
        };
        if (!json.deposit_address) return null;
        return {
          depositAddress: json.deposit_address,
          expectedAmountOut: BigInt(json.expected_amount_out ?? '0'),
          slipBps: json.slip_bps ?? 0,
          etaSeconds: json.eta_seconds ?? 1800,
          protocolFeeAmount: BigInt(json.protocol_fee_amount ?? '0'),
          dexRouter: json.dex_router ?? 'uniswap-v3-polygon',
          swapId: json.swap_id,
        };
      } catch {
        if (attempt === this.maxRetries) return null;
        await sleep(backoffMs(attempt));
      }
    }

    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  return Math.min(250 * 2 ** attempt, 4_000);
}

export const TELESWAP_ACCESSIBLE_CHAIN_IDS = new Set<number>([
  0,
  137,
  56,
]);

export const TELESWAP_RAIL = Rail.TELESWAP;
