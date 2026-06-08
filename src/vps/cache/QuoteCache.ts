import crypto from 'crypto';
import { createClient } from 'redis';
import { QuoteResult } from '../types';

const BIGINT_FIELDS = new Set([
  'amountIn',
  'amountOut',
  'amount',
  'estimatedOut',
  'minAmountOut',
  'minimumAmountOut',
  'minSrcSwapOut',
  'feeAmountToken',
  'minSettlementAmount',
  'minThorOutput',
]);

export interface QuoteCache {
  get(key: string): Promise<QuoteResult | null>;
  set(key: string, value: QuoteResult, ttlMs: number): Promise<void>;
  close(): Promise<void>;
}

export class InMemoryQuoteCache implements QuoteCache {
  private readonly map = new Map<string, { value: QuoteResult; expiresAt: number }>();

  async get(key: string): Promise<QuoteResult | null> {
    const hit = this.map.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return hit.value;
  }

  async set(key: string, value: QuoteResult, ttlMs: number): Promise<void> {
    this.map.set(key, { value, expiresAt: Date.now() + Math.max(ttlMs, 1000) });
  }

  async close(): Promise<void> {
    this.map.clear();
  }
}

class RedisQuoteCache implements QuoteCache {
  constructor(
    private readonly client: any,
    private readonly hmacSecret?: string,
  ) {}

  async get(key: string): Promise<QuoteResult | null> {
    const raw = await this.client.get(key);
    if (!raw) return null;

    try {
      const verified = verifyEncodedQuote(raw, this.hmacSecret);
      if (verified === null) return null;
      return decodeQuote(verified);
    } catch {
      return null;
    }
  }

  async set(key: string, value: QuoteResult, ttlMs: number): Promise<void> {
    const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
    await this.client.set(key, signEncodedQuote(encodeQuote(value), this.hmacSecret), { EX: ttlSeconds });
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}

export async function createQuoteCacheFromEnv(
  env: Record<string, string | undefined> = process.env,
): Promise<QuoteCache> {
  const enabled = (env.REDIS_ENABLED ?? '').toLowerCase() === 'true' || !!env.REDIS_URL;
  if (!enabled) return new InMemoryQuoteCache();

  const url = env.REDIS_URL ?? 'redis://127.0.0.1:6379';
  const client = createClient({ url });
  client.on('error', (err) => {
    console.warn('[QuoteCache] Redis error, cache calls may fail:', err);
  });

  try {
    await client.connect();
    return new RedisQuoteCache(client, env.REDIS_QUOTE_CACHE_HMAC_SECRET);
  } catch (err) {
    console.warn('[QuoteCache] Redis unavailable, falling back to memory cache:', err);
    return new InMemoryQuoteCache();
  }
}

export function signEncodedQuote(raw: string, hmacSecret?: string): string {
  if (!hmacSecret) return raw;
  const signature = crypto.createHmac('sha256', hmacSecret).update(raw).digest('hex');
  return `${signature}:${raw}`;
}

export function verifyEncodedQuote(raw: string, hmacSecret?: string): string | null {
  if (!hmacSecret) return raw;
  const separator = raw.indexOf(':');
  if (separator <= 0) return null;

  const signature = raw.slice(0, separator);
  const payload = raw.slice(separator + 1);
  const expected = crypto.createHmac('sha256', hmacSecret).update(payload).digest('hex');
  const actual = Buffer.from(signature, 'hex');
  const expectedBytes = Buffer.from(expected, 'hex');
  if (actual.length !== expectedBytes.length) return null;
  return crypto.timingSafeEqual(actual, expectedBytes) ? payload : null;
}

function encodeQuote(value: QuoteResult): string {
  return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
}

function decodeQuote(raw: string): QuoteResult {
  const parsed = JSON.parse(raw, (k, v) => {
    if (!BIGINT_FIELDS.has(k)) return v;
    if (typeof v === 'string' && /^-?\d+$/.test(v)) return BigInt(v);
    if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.trunc(v));
    return 0n;
  }) as QuoteResult & {
    railData?: string;
    minSrcSwapOut?: bigint;
    settlementAssetId?: string;
    expectedDstSettlementToken?: string;
    expectedDstSettlementAssetId?: string;
    minSettlementAmount?: bigint;
    dstGasLimit?: number;
  };

  if (typeof parsed.railData !== 'string') {
    parsed.railData = '0x';
  }
  if (typeof parsed.minSrcSwapOut !== 'bigint') {
    parsed.minSrcSwapOut = 0n;
  }
  if (typeof parsed.settlementAssetId !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(parsed.settlementAssetId)) {
    parsed.settlementAssetId = '0x' + '0'.repeat(64);
  }
  if (typeof parsed.expectedDstSettlementToken !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(parsed.expectedDstSettlementToken)) {
    parsed.expectedDstSettlementToken = '0x0000000000000000000000000000000000000000';
  }
  if (
    typeof parsed.expectedDstSettlementAssetId !== 'string' ||
    !/^0x[0-9a-fA-F]{64}$/.test(parsed.expectedDstSettlementAssetId)
  ) {
    parsed.expectedDstSettlementAssetId = '0x' + '0'.repeat(64);
  }
  if (typeof parsed.minSettlementAmount !== 'bigint') {
    parsed.minSettlementAmount = 0n;
  }
  if (typeof parsed.dstGasLimit !== 'number' || !Number.isFinite(parsed.dstGasLimit)) {
    parsed.dstGasLimit = 0;
  }
  if (parsed.amounts && typeof parsed.amounts === 'object') {
    const amounts = parsed.amounts as Record<string, unknown>;
    if (amounts.input && typeof amounts.input === 'object') {
      const input = amounts.input as Record<string, unknown>;
      if (typeof input.amount === 'string' && /^-?\d+$/.test(input.amount)) input.amount = BigInt(input.amount);
    }
    if (amounts.bridgeSettlement && typeof amounts.bridgeSettlement === 'object') {
      const bridgeSettlement = amounts.bridgeSettlement as Record<string, unknown>;
      if (typeof bridgeSettlement.amount === 'string' && /^-?\d+$/.test(bridgeSettlement.amount)) bridgeSettlement.amount = BigInt(bridgeSettlement.amount);
    }
    if (amounts.minimumBridgeSettlement && typeof amounts.minimumBridgeSettlement === 'object') {
      const minimumBridgeSettlement = amounts.minimumBridgeSettlement as Record<string, unknown>;
      if (typeof minimumBridgeSettlement.amount === 'string' && /^-?\d+$/.test(minimumBridgeSettlement.amount)) minimumBridgeSettlement.amount = BigInt(minimumBridgeSettlement.amount);
    }
    if (amounts.output && typeof amounts.output === 'object') {
      const output = amounts.output as Record<string, unknown>;
      if (typeof output.amount === 'string' && /^-?\d+$/.test(output.amount)) output.amount = BigInt(output.amount);
    }
    if (amounts.minimumOutput && typeof amounts.minimumOutput === 'object') {
      const minimumOutput = amounts.minimumOutput as Record<string, unknown>;
      if (typeof minimumOutput.amount === 'string' && /^-?\d+$/.test(minimumOutput.amount)) minimumOutput.amount = BigInt(minimumOutput.amount);
    }
  }
  if (parsed.legs && typeof parsed.legs === 'object') {
    const legs = parsed.legs as Record<string, unknown>;
    for (const key of ['sourceSwap', 'bridge', 'destinationSwap'] as const) {
      const leg = legs[key];
      if (!leg || typeof leg !== 'object') continue;
      const view = leg as Record<string, unknown>;
      if (typeof view.amountIn === 'string' && /^-?\d+$/.test(view.amountIn)) view.amountIn = BigInt(view.amountIn);
      if (typeof view.amountOut === 'string' && /^-?\d+$/.test(view.amountOut)) view.amountOut = BigInt(view.amountOut);
      if (typeof view.minimumAmountOut === 'string' && /^-?\d+$/.test(view.minimumAmountOut)) view.minimumAmountOut = BigInt(view.minimumAmountOut);
    }
  }
  return parsed as QuoteResult;
}
