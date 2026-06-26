export interface ChainflipDepositChannel {
  depositAddress: string;
  channelId: string;
  expiryBlock: number;
  expiryTimeUnix?: number;
}

export interface ChainflipIndicativeQuote {
  expectedAmountOut: bigint;
  effectiveRateBps: number;
  sourceFee: bigint;
  destinationFee: bigint;
  brokerFeeAmount: bigint;
  etaSeconds: number;
}

export interface ChainflipSwapStatus {
  channelId: string;
  state: string;
  depositTxHash?: string;
  destinationTxHash?: string;
  failureReason?: string;
}

function readEnv(key: string): string | undefined {
  const value = process.env[key];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readEnvInt(key: string, fallback: number): number {
  const raw = readEnv(key);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export class ChainflipBrokerClient {
  private readonly baseUrl: string | undefined;
  private readonly commissionBps: number;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor() {
    this.baseUrl = readEnv('CHAINFLIP_BROKER_URL');
    this.commissionBps = readEnvInt('CHAINFLIP_BROKER_COMMISSION_BPS', 10);
    this.timeoutMs = readEnvInt('CHAINFLIP_QUOTE_TIMEOUT_MS', 8_000);
    this.maxRetries = readEnvInt('CHAINFLIP_QUOTE_MAX_RETRIES', 2);
  }

  isConfigured(): boolean {
    return !!this.baseUrl;
  }

  async requestSwapDepositAddress(params: {
    srcAsset: string;
    dstAsset: string;
    destinationAddress: string;
    refundAddress?: string;
    minimumPriceX128?: string;
    brokerCommissionBpsOverride?: number;
  }): Promise<ChainflipDepositChannel | null> {
    if (!this.baseUrl) return null;
    const body = {
      source_asset: params.srcAsset,
      destination_asset: params.dstAsset,
      destination_address: params.destinationAddress,
      broker_commission_bps: params.brokerCommissionBpsOverride ?? this.commissionBps,
      refund_address: params.refundAddress,
      minimum_price_x128: params.minimumPriceX128,
    };
    const json = await this.request<{
      address: string;
      channel_id: string;
      expiry_block: number;
      expiry_time_unix?: number;
    }>('/broker/request_swap_deposit_address', { method: 'POST', body });
    if (!json) return null;
    return {
      depositAddress: json.address,
      channelId: json.channel_id,
      expiryBlock: json.expiry_block,
      expiryTimeUnix: json.expiry_time_unix,
    };
  }

  async getIndicativeQuote(params: {
    srcAsset: string;
    dstAsset: string;
    amountIn: bigint;
  }): Promise<ChainflipIndicativeQuote | null> {
    if (!this.baseUrl) return null;
    const search = new URLSearchParams({
      src_asset: params.srcAsset,
      dst_asset: params.dstAsset,
      amount: params.amountIn.toString(),
      broker_commission_bps: String(this.commissionBps),
    });
    const json = await this.request<{
      egress_amount: string;
      effective_rate?: string;
      source_fee?: string;
      destination_fee?: string;
      broker_fee?: string;
      estimated_duration_seconds?: number;
    }>(`/v2/quote?${search.toString()}`, { method: 'GET' });
    if (!json?.egress_amount) return null;
    return {
      expectedAmountOut: BigInt(json.egress_amount),
      effectiveRateBps: Number(json.effective_rate ?? '0') * 10_000,
      sourceFee: BigInt(json.source_fee ?? '0'),
      destinationFee: BigInt(json.destination_fee ?? '0'),
      brokerFeeAmount: BigInt(json.broker_fee ?? '0'),
      etaSeconds: json.estimated_duration_seconds ?? 45,
    };
  }

  async getSwapStatus(channelId: string): Promise<ChainflipSwapStatus | null> {
    if (!this.baseUrl) return null;
    const json = await this.request<{
      state: string;
      deposit_tx_hash?: string;
      destination_tx_hash?: string;
      failure_reason?: string;
    }>(`/broker/swap_info/${encodeURIComponent(channelId)}`, { method: 'GET' });
    if (!json?.state) return null;
    return {
      channelId,
      state: json.state,
      depositTxHash: json.deposit_tx_hash,
      destinationTxHash: json.destination_tx_hash,
      failureReason: json.failure_reason,
    };
  }

  private async request<T>(
    path: string,
    init: { method: 'GET' | 'POST'; body?: unknown },
  ): Promise<T | null> {
    if (!this.baseUrl) return null;
    const url = `${this.baseUrl.replace(/\/$/, '')}${path}`;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        const response = await fetch(url, {
          method: init.method,
          headers: { 'content-type': 'application/json' },
          body: init.body ? JSON.stringify(init.body) : undefined,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!response.ok) {
          if (response.status >= 400 && response.status < 500) return null;
          if (attempt === this.maxRetries) return null;
          await sleep(backoffMs(attempt));
          continue;
        }
        return await response.json() as T;
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
