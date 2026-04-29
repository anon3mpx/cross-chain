export interface THORChainClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  clientId?: string;
}

export interface THORChainSwapQuoteResponse {
  recommended_min_amount_in?: string;
  expected_amount_out?: string;
  to_asset?: string;
  router?: string;
  inbound_address?: string;
  memo?: string;
  expiry?: string | number;
  total_swap_seconds?: string | number;
  inbound_confirmation_seconds?: string | number;
  fees?: {
    slippage_bps?: string | number;
    outboundUsd?: string | number;
    outbound_usd?: string | number;
  };
  [key: string]: unknown;
}

export type THORChainInboundAddress = Record<string, unknown>;

export interface THORChainTxStatusResponse {
  status?: string;
  out_txs?: Array<{ txID?: string; txid?: string }>;
  outbound_txs?: Array<{ txID?: string; txid?: string }>;
  stages?: {
    outbound_signed?: { completed?: boolean };
    swap_status?: { completed?: boolean };
  };
  [key: string]: unknown;
}

export class THORChainClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly clientId?: string;

  constructor(options: THORChainClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.THORCHAIN_BASE_URL ?? 'https://thornode.thorchain.network').replace(/\/$/, '');
    this.fetchFn = options.fetchFn ?? fetch;
    this.timeoutMs = options.timeoutMs ?? this._readIntEnv('THORCHAIN_API_TIMEOUT_MS', 5_000);
    this.maxRetries = options.maxRetries ?? this._readNonNegativeIntEnv('THORCHAIN_API_MAX_RETRIES', 2);
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? this._readNonNegativeIntEnv('THORCHAIN_API_RETRY_BASE_DELAY_MS', 200);
    this.clientId = options.clientId ?? process.env.THORCHAIN_CLIENT_ID;
  }

  async quoteSwap(params: URLSearchParams): Promise<THORChainSwapQuoteResponse> {
    return this._getJson<THORChainSwapQuoteResponse>(`/thorchain/quote/swap?${params.toString()}`);
  }

  async inboundAddresses(): Promise<THORChainInboundAddress[]> {
    return this._getJson<THORChainInboundAddress[]>('/thorchain/inbound_addresses');
  }

  async txStatus(txHash: string): Promise<THORChainTxStatusResponse> {
    const normalized = txHash.trim();
    if (normalized.length === 0) {
      throw new Error('THORChain tx status requires tx hash');
    }
    return this._getJson<THORChainTxStatusResponse>(`/thorchain/tx/status/${encodeURIComponent(normalized)}`);
  }

  private async _getJson<T>(path: string): Promise<T> {
    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt <= this.maxRetries) {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), this.timeoutMs);
      try {
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (this.clientId) {
          headers['x-client-id'] = this.clientId;
        }
        const response = await this.fetchFn(`${this.baseUrl}${path}`, {
          method: 'GET',
          headers,
          signal: abortController.signal,
        });
        if (!response.ok) {
          if (this._shouldRetryStatus(response.status) && attempt < this.maxRetries) {
            await this._sleep(this.retryBaseDelayMs * (2 ** attempt));
            attempt += 1;
            continue;
          }
          throw new Error(`THORChain API ${response.status} for ${path}`);
        }
        return response.json() as Promise<T>;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt >= this.maxRetries) break;
        await this._sleep(this.retryBaseDelayMs * (2 ** attempt));
        attempt += 1;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new Error(`THORChain API request failed for ${path}`);
  }

  private _readIntEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
  }

  private _readNonNegativeIntEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return Math.floor(parsed);
  }

  private _shouldRetryStatus(status: number): boolean {
    return status === 429 || status === 503;
  }

  private async _sleep(ms: number): Promise<void> {
    if (ms <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
