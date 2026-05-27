export type LayerZeroValueTransferApiChainType = 'EVM' | 'SOLANA' | 'STARKNET' | string;

export interface LayerZeroValueTransferApiPagination {
  nextToken?: string;
}

export interface LayerZeroValueTransferApiToken {
  isSupported?: boolean;
  chainKey: string;
  address: string;
  decimals: number;
  symbol: string;
  name: string;
  logoUrl?: string;
  price?: { usd?: number };
}

export interface LayerZeroValueTransferApiChain {
  name: string;
  shortName: string;
  chainKey: string;
  nativeCurrency?: LayerZeroValueTransferApiToken;
  chainType: LayerZeroValueTransferApiChainType;
  chainId?: number;
}

export interface LayerZeroValueTransferApiUserStep {
  type: 'TRANSACTION' | 'SIGNATURE' | string;
  description?: string;
  chainKey: string;
  chainType: LayerZeroValueTransferApiChainType;
  signerAddress: string;
  transaction?: {
    encoded?: {
      to?: string;
      data?: string;
      value?: string;
      chainId?: number;
      from?: string;
      gasLimit?: string;
      encoding?: string;
    };
  };
  signature?: unknown;
}

export interface LayerZeroValueTransferApiRouteStep {
  type: string;
  srcChainKey?: string;
  description?: string;
}

export interface LayerZeroValueTransferApiFee {
  chainKey: string;
  type: string;
  description?: string;
  amount: string;
  address: string;
}

export interface LayerZeroValueTransferApiQuote {
  id: string;
  routeSteps?: LayerZeroValueTransferApiRouteStep[];
  fees?: LayerZeroValueTransferApiFee[];
  duration?: { estimated?: string | null };
  feeUsd?: string;
  feePercent?: string;
  srcAmount: string;
  dstAmount: string;
  dstAmountMin?: string;
  srcAmountUsd?: string;
  dstAmountUsd?: string;
  userSteps?: LayerZeroValueTransferApiUserStep[];
  options?: Record<string, unknown>;
  expiresAt?: string;
}

export interface LayerZeroValueTransferApiQuoteRequest {
  srcChainKey: string;
  dstChainKey: string;
  srcTokenAddress: string;
  dstTokenAddress: string;
  srcWalletAddress: string;
  dstWalletAddress: string;
  amount: string;
  options?: {
    amountType?: 'EXACT_SRC_AMOUNT';
    feeTolerance?: { type: 'PERCENT'; amount: number };
    dstNativeDropAmount?: string;
  };
}

export interface LayerZeroValueTransferApiQuoteResponse {
  error?: unknown;
  quotes: LayerZeroValueTransferApiQuote[];
  rejectedQuotes?: unknown[];
  tokens: LayerZeroValueTransferApiToken[];
  pagination?: LayerZeroValueTransferApiPagination;
}

export interface LayerZeroValueTransferApiChainsResponse {
  chains: LayerZeroValueTransferApiChain[];
  pagination?: LayerZeroValueTransferApiPagination;
}

export interface LayerZeroValueTransferApiTokensRequest {
  transferrableFromChainKey?: string;
  transferrableFromTokenAddress?: string;
  nextToken?: string;
}

export interface LayerZeroValueTransferApiTokensResponse {
  tokens: LayerZeroValueTransferApiToken[];
  pagination?: LayerZeroValueTransferApiPagination;
}

export interface LayerZeroValueTransferApiDeployment {
  address: string;
}

export interface LayerZeroValueTransferApiChainMetadata {
  deployments: {
    multicall?: LayerZeroValueTransferApiDeployment;
    transferDelegate?: LayerZeroValueTransferApiDeployment;
    [name: string]: LayerZeroValueTransferApiDeployment | undefined;
  };
}

export type LayerZeroValueTransferApiMetadataResponse = Record<string, LayerZeroValueTransferApiChainMetadata>;

export interface LayerZeroValueTransferApiBuildUserStepsRequest {
  quoteId: string;
}

export interface LayerZeroValueTransferApiBuildUserStepsResponse {
  userSteps: LayerZeroValueTransferApiUserStep[];
}

export interface LayerZeroValueTransferApiSubmitSignatureRequest {
  quoteId: string;
  signatures: string[];
}

export interface LayerZeroValueTransferApiStatusResponse {
  status: string;
  explorerUrl?: string;
  executionHistory?: Array<{
    event: string;
    transaction?: {
      chainKey?: string;
      hash?: string;
      timestamp?: number;
    };
  }>;
}

export interface LayerZeroValueTransferApiClientOptions {
  baseUrl?: string;
  apiKey?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_BASE_URL = 'https://transfer.layerzero-api.com/v1';
const DEFAULT_TIMEOUT_MS = 5_000;

export class LayerZeroValueTransferApiClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: LayerZeroValueTransferApiClientOptions = {}) {
    this.baseUrl = this._normalizeBaseUrl(
      options.baseUrl ?? process.env.LAYERZERO_TRANSFER_API_BASE_URL ?? DEFAULT_BASE_URL,
    );
    this.apiKey = options.apiKey ?? process.env.LAYERZERO_TRANSFER_API_KEY;
    this.fetchFn = options.fetchFn ?? fetch;
    this.timeoutMs = options.timeoutMs ?? this._readIntEnv('LAYERZERO_TRANSFER_API_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);
  }

  async listLayerZeroValueTransferApiChains(
    pagination: LayerZeroValueTransferApiPagination = {},
  ): Promise<LayerZeroValueTransferApiChainsResponse> {
    return this._request<LayerZeroValueTransferApiChainsResponse>(
      `/chains${this._paginationQuery(pagination)}`,
      { method: 'GET' },
      { requiresApiKey: false },
    );
  }

  async listLayerZeroValueTransferApiTokens(
    request: LayerZeroValueTransferApiTokensRequest = {},
  ): Promise<LayerZeroValueTransferApiTokensResponse> {
    const params = new URLSearchParams();
    if (request.transferrableFromChainKey) {
      params.set('transferrableFromChainKey', request.transferrableFromChainKey);
    }
    if (request.transferrableFromTokenAddress) {
      params.set('transferrableFromTokenAddress', request.transferrableFromTokenAddress);
    }
    if (request.nextToken) {
      params.set('pagination[nextToken]', request.nextToken);
    }
    const query = params.toString();
    return this._request<LayerZeroValueTransferApiTokensResponse>(
      `/tokens${query ? `?${query}` : ''}`,
      { method: 'GET' },
      { requiresApiKey: false },
    );
  }

  async getLayerZeroValueTransferApiMetadata(): Promise<LayerZeroValueTransferApiMetadataResponse> {
    return this._request<LayerZeroValueTransferApiMetadataResponse>(
      '/metadata',
      { method: 'GET' },
      { requiresApiKey: false },
    );
  }

  async requestLayerZeroValueTransferApiQuotes(
    request: LayerZeroValueTransferApiQuoteRequest,
  ): Promise<LayerZeroValueTransferApiQuoteResponse> {
    this._assertNonEmpty(request.srcChainKey, 'srcChainKey');
    this._assertNonEmpty(request.dstChainKey, 'dstChainKey');
    this._assertNonEmpty(request.srcTokenAddress, 'srcTokenAddress');
    this._assertNonEmpty(request.dstTokenAddress, 'dstTokenAddress');
    this._assertNonEmpty(request.srcWalletAddress, 'srcWalletAddress');
    this._assertNonEmpty(request.dstWalletAddress, 'dstWalletAddress');
    this._assertUnsignedIntegerString(request.amount, 'amount');

    return this._request<LayerZeroValueTransferApiQuoteResponse>('/quotes', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async buildLayerZeroValueTransferApiUserSteps(
    request: LayerZeroValueTransferApiBuildUserStepsRequest,
  ): Promise<LayerZeroValueTransferApiBuildUserStepsResponse> {
    this._assertNonEmpty(request.quoteId, 'quoteId');
    return this._request<LayerZeroValueTransferApiBuildUserStepsResponse>('/build-user-steps', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async submitLayerZeroValueTransferApiSignature(
    request: LayerZeroValueTransferApiSubmitSignatureRequest,
  ): Promise<Record<string, never>> {
    this._assertNonEmpty(request.quoteId, 'quoteId');
    if (!Array.isArray(request.signatures) || request.signatures.length === 0) {
      throw new Error('LayerZero Value Transfer API signatures must be a non-empty array');
    }
    for (const signature of request.signatures) {
      this._assertNonEmpty(signature, 'signature');
    }

    return this._request<Record<string, never>>('/submit-signature', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getLayerZeroValueTransferApiStatus(
    quoteId: string,
    txHash?: string,
  ): Promise<LayerZeroValueTransferApiStatusResponse> {
    this._assertNonEmpty(quoteId, 'quoteId');
    const normalizedTxHash = txHash?.trim();
    const query = normalizedTxHash ? `?${new URLSearchParams({ txHash: normalizedTxHash }).toString()}` : '';
    return this._request<LayerZeroValueTransferApiStatusResponse>(
      `/status/${encodeURIComponent(quoteId.trim())}${query}`,
      { method: 'GET' },
    );
  }

  private async _request<T>(
    path: string,
    init: RequestInit,
    options: { requiresApiKey?: boolean } = {},
  ): Promise<T> {
    const requiresApiKey = options.requiresApiKey ?? true;
    if (requiresApiKey && !this.apiKey) {
      throw new Error('LayerZero Value Transfer API key is required');
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...this._contentTypeHeader(init),
      ...(init.headers as Record<string, string> | undefined ?? {}),
    };
    if (requiresApiKey && this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.timeoutMs);
    const response = await this.fetchFn(`${this.baseUrl}${path}`, {
      ...init,
      headers,
      signal: abortController.signal,
    }).finally(() => clearTimeout(timeout));

    const text = await response.text();
    const data = (text ? this._parseJson(text) : {}) as { error?: { message?: unknown } | string };
    if (!response.ok) {
      const message = this._errorMessage(data, response.status);
      throw new Error(message);
    }
    return data as T;
  }

  private _errorMessage(data: { error?: { message?: unknown } | string }, status: number): string {
    if (typeof data.error === 'string') return data.error;
    if (typeof data.error?.message === 'string') return data.error.message;
    return `LayerZero Value Transfer API request failed with ${status}`;
  }

  private _paginationQuery(pagination: LayerZeroValueTransferApiPagination): string {
    if (!pagination.nextToken) return '';
    return `?${new URLSearchParams({ 'pagination[nextToken]': pagination.nextToken }).toString()}`;
  }

  private _contentTypeHeader(init: RequestInit): Record<string, string> {
    return init.body === undefined ? {} : { 'Content-Type': 'application/json' };
  }

  private _parseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('LayerZero Value Transfer API returned invalid JSON');
    }
  }

  private _assertNonEmpty(value: unknown, name: string): void {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`LayerZero Value Transfer API ${name} is required`);
    }
  }

  private _assertUnsignedIntegerString(value: unknown, name: string): void {
    this._assertNonEmpty(value, name);
    if (!/^\d+$/.test(String(value).trim())) {
      throw new Error(`LayerZero Value Transfer API ${name} must be an unsigned integer string`);
    }
  }

  private _normalizeBaseUrl(raw: string): string {
    const trimmed = raw.trim().replace(/\/$/, '');
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('LayerZero Value Transfer API base URL must be http(s)');
    }
    return trimmed;
  }

  private _readIntEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  }
}
