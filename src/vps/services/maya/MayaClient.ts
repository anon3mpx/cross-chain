export interface MayaQuoteResponse {
  inboundAddress: string;
  memo: string;
  expectedAmountOut: bigint;
  slipBps: number;
  outboundFee: bigint;
  totalFeeAmount: bigint;
  streamingQuantity?: number;
  expiresAtUnix: number;
  etaSeconds: number;
}

export interface MayaActionStatus {
  txid: string;
  status: 'pending' | 'success' | 'refund' | 'failed' | string;
  inboundObserved?: boolean;
  outboundCompleted?: boolean;
  outboundTxHash?: string;
}

function readEnv(key: string, fallback?: string): string | undefined {
  const value = process.env[key];
  const trimmed = value && value.trim().length > 0 ? value.trim() : undefined;
  return trimmed ?? fallback;
}

function readEnvInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const MIDGARD_DEFAULT = 'https://midgard.mayachain.info';
const MAYANODE_DEFAULT = 'https://mayanode.mayachain.info';

export class MayaClient {
  private readonly midgardUrl: string;
  private readonly mayanodeUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor() {
    this.midgardUrl = readEnv('MAYA_MIDGARD_URL', MIDGARD_DEFAULT)!;
    this.mayanodeUrl = readEnv('MAYA_MAYANODE_URL', MAYANODE_DEFAULT)!;
    this.timeoutMs = readEnvInt('MAYA_QUOTE_TIMEOUT_MS', 8_000);
    this.maxRetries = readEnvInt('MAYA_QUOTE_MAX_RETRIES', 2);
  }

  isConfigured(): boolean {
    return true;
  }

  async getQuote(params: {
    fromAsset: string;
    toAsset: string;
    amount: bigint;
    destinationAddress: string;
    affiliateAddress?: string;
    affiliateBps?: number;
    minOutput?: bigint;
  }): Promise<MayaQuoteResponse | null> {
    const search = new URLSearchParams({
      from_asset: params.fromAsset,
      to_asset: params.toAsset,
      amount: params.amount.toString(),
      destination: params.destinationAddress,
    });
    if (params.affiliateAddress) search.set('affiliate', params.affiliateAddress);
    if (params.affiliateBps !== undefined) search.set('affiliate_bps', String(params.affiliateBps));
    if (params.minOutput !== undefined) search.set('min_output', params.minOutput.toString());

    const json = await this.requestWithRetry<{
      inbound_address: string;
      memo: string;
      expected_amount_out: string;
      slippage_bps: number;
      outbound_fee: string;
      fees?: { total?: string };
      streaming_quantity?: number;
      expiry?: number;
      total_swap_seconds?: number;
    }>(`${this.midgardUrl}/v2/quote/swap?${search.toString()}`);
    if (!json?.inbound_address || !json.memo) return null;

    return {
      inboundAddress: json.inbound_address,
      memo: json.memo,
      expectedAmountOut: BigInt(json.expected_amount_out ?? '0'),
      slipBps: json.slippage_bps ?? 0,
      outboundFee: BigInt(json.outbound_fee ?? '0'),
      totalFeeAmount: BigInt(json.fees?.total ?? '0'),
      streamingQuantity: json.streaming_quantity,
      expiresAtUnix: json.expiry ?? Math.floor(Date.now() / 1000) + 600,
      etaSeconds: json.total_swap_seconds ?? 90,
    };
  }

  async getActionStatus(sourceTxHash: string): Promise<MayaActionStatus | null> {
    const search = new URLSearchParams({ txid: sourceTxHash });
    const json = await this.requestWithRetry<{
      actions?: Array<{
        status?: string;
        in?: Array<{ txID?: string }>;
        out?: Array<{ txID?: string }>;
      }>;
    }>(`${this.midgardUrl}/v2/actions?${search.toString()}`);
    if (!json?.actions?.length) return null;

    const action = json.actions[0];
    const outboundTx = action.out?.find((candidate) => candidate.txID && candidate.txID.length > 0);
    return {
      txid: sourceTxHash,
      status: (action.status ?? 'pending') as MayaActionStatus['status'],
      inboundObserved: !!action.in?.length,
      outboundCompleted: action.status === 'success' && !!outboundTx,
      outboundTxHash: outboundTx?.txID,
    };
  }

  async getInboundAddresses(): Promise<Map<string, string>> {
    const json = await this.requestWithRetry<Array<{ chain: string; address: string; halted?: boolean }>>(
      `${this.mayanodeUrl}/mayachain/inbound_addresses`,
    );
    const out = new Map<string, string>();
    if (!Array.isArray(json)) return out;
    for (const entry of json) {
      if (entry.chain && entry.address && !entry.halted) out.set(entry.chain, entry.address);
    }
    return out;
  }

  private async requestWithRetry<T>(url: string): Promise<T | null> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        const response = await fetch(url, { signal: controller.signal });
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
