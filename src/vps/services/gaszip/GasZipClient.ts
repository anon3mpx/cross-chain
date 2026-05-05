export interface GasZipChain {
  name: string;
  chain: number;
  short: number;
  gas: string;
  gwei: string;
  bal: string;
  rpcs: string[];
  symbol: string;
  price: number;
}

export interface GasZipChainsResponse {
  chains: GasZipChain[];
}

export interface GasZipQuoteReverseResponse {
  chain: number;
  required: number;
  gas: number;
  speed: number;
  usd: number;
}

export interface GasZipCalldataQuote {
  chain: number;
  expected: string;
  gas: string;
  speed: number;
  usd: number;
}

export interface GasZipCalldataResponse {
  calldata: string;
  quotes: GasZipCalldataQuote[];
}

export interface GasZipCalldataParams {
  to: string;
  from?: string;
}

export type GasZipSearchStatus =
  | 'SEEN'
  | 'PENDING'
  | 'CONFIRMED'
  | 'PRIORITY'
  | 'CANCELLED';

export interface GasZipSearchDeposit {
  block: number;
  chain: number;
  hash: string;
  log: number;
  sender: string;
  shorts: number[];
  status: GasZipSearchStatus;
  time: number;
  to: string;
  usd: number;
  value: string;
}

export interface GasZipSearchTransaction {
  chain: number;
  hash: string;
  nonce: number;
  refund: boolean;
  cancelled: boolean;
  signer: string;
  status: GasZipSearchStatus;
  time: number;
  to: string;
  usd: number;
  value: number;
}

export interface GasZipSearchResponse {
  deposit: GasZipSearchDeposit;
  txs: GasZipSearchTransaction[];
}

export interface GasZipClientLike {
  listChains(): Promise<GasZipChainsResponse>;
  getQuoteReverse(
    depositChain: number,
    outboundWei: string,
    outboundChain: number,
  ): Promise<GasZipQuoteReverseResponse>;
  getCalldataQuote(
    depositChain: number,
    depositWei: string,
    outboundChains: number[],
    params: GasZipCalldataParams,
  ): Promise<GasZipCalldataResponse>;
  searchTransaction(hash: string): Promise<GasZipSearchResponse | null>;
}

export interface GasZipClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
}

const DEFAULT_BASE_URL = 'https://backend.gas.zip/v2';

export class GasZipClient implements GasZipClientLike {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: GasZipClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.GASZIP_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async listChains(): Promise<GasZipChainsResponse> {
    return this._request<GasZipChainsResponse>('/chains');
  }

  async getQuoteReverse(
    depositChain: number,
    outboundWei: string,
    outboundChain: number,
  ): Promise<GasZipQuoteReverseResponse> {
    return this._request<GasZipQuoteReverseResponse>(
      `/quoteReverse/${depositChain}/${outboundWei}/${outboundChain}`,
    );
  }

  async getCalldataQuote(
    depositChain: number,
    depositWei: string,
    outboundChains: number[],
    params: GasZipCalldataParams,
  ): Promise<GasZipCalldataResponse> {
    const query = new URLSearchParams();
    query.set('to', params.to);
    if (params.from) query.set('from', params.from);
    return this._request<GasZipCalldataResponse>(
      `/quotes/${depositChain}/${depositWei}/${outboundChains.join(',')}?${query.toString()}`,
    );
  }

  async searchTransaction(hash: string): Promise<GasZipSearchResponse | null> {
    const response = await this.fetchFn(`${this.baseUrl}/search/${hash}`);
    if (!response.ok) {
      throw new Error(`GasZipClient request failed: ${response.status}`);
    }
    const payload = await response.json() as GasZipSearchResponse | { error?: string };
    if (payload && typeof payload === 'object' && 'error' in payload) {
      const error = typeof payload.error === 'string' ? payload.error : 'Unknown Gas.zip search error';
      if (error.toLowerCase().includes('no data found')) return null;
      throw new Error(`GasZipClient search failed: ${error}`);
    }
    return payload as GasZipSearchResponse;
  }

  private async _request<T>(path: string): Promise<T> {
    const response = await this.fetchFn(`${this.baseUrl}${path}`);
    if (!response.ok) {
      throw new Error(`GasZipClient request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }
}
