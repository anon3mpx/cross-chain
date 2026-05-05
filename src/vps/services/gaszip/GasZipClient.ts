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

  private async _request<T>(path: string): Promise<T> {
    const response = await this.fetchFn(`${this.baseUrl}${path}`);
    if (!response.ok) {
      throw new Error(`GasZipClient request failed: ${response.status}`);
    }
    return response.json() as Promise<T>;
  }
}
