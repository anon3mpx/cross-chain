import { createClient } from 'redis';
import { QuoteResult } from '../types';

const BIGINT_FIELDS = new Set([
  'amountIn',
  'estimatedOut',
  'minAmountOut',
  'minSrcSwapOut',
  'feeAmountToken',
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
  constructor(private readonly client: any) {}

  async get(key: string): Promise<QuoteResult | null> {
    const raw = await this.client.get(key);
    if (!raw) return null;

    try {
      return decodeQuote(raw);
    } catch {
      return null;
    }
  }

  async set(key: string, value: QuoteResult, ttlMs: number): Promise<void> {
    const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
    await this.client.set(key, encodeQuote(value), { EX: ttlSeconds });
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
    return new RedisQuoteCache(client);
  } catch (err) {
    console.warn('[QuoteCache] Redis unavailable, falling back to memory cache:', err);
    return new InMemoryQuoteCache();
  }
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
  }) as QuoteResult & { railData?: string; minSrcSwapOut?: bigint };

  if (typeof parsed.railData !== 'string') {
    parsed.railData = '0x';
  }
  if (typeof parsed.minSrcSwapOut !== 'bigint') {
    parsed.minSrcSwapOut = 0n;
  }
  return parsed as QuoteResult;
}
