import { QuoteRequest, QuoteResult } from '../types';

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function parseAmountIn(raw: unknown): bigint {
  if (typeof raw === 'bigint') {
    if (raw <= 0n) throw new Error('amountIn must be > 0');
    return raw;
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || !Number.isInteger(raw) || raw <= 0) {
      throw new Error('amountIn must be a positive integer');
    }
    return BigInt(raw);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) throw new Error('amountIn required');
    const value = BigInt(trimmed);
    if (value <= 0n) throw new Error('amountIn must be > 0');
    return value;
  }
  throw new Error('amountIn required');
}

export function parseQuoteRequest(input: any, defaultUrgency: 'fast' | 'normal' = 'normal'): QuoteRequest {
  if (!input || typeof input !== 'object') throw new Error('Invalid payload');

  const urgency = input.urgency === 'fast' ? 'fast' : 'normal';

  return {
    tokenIn: String(input.tokenIn ?? ''),
    tokenOut: String(input.tokenOut ?? ''),
    amountIn: parseAmountIn(input.amountIn),
    srcChainId: Number(input.srcChainId),
    dstChainId: Number(input.dstChainId),
    userAddress: String(input.userAddress ?? ''),
    nativeDstAddress: input.nativeDstAddress ? String(input.nativeDstAddress) : undefined,
    urgency: input.urgency ? urgency : defaultUrgency,
  };
}

export function serializeQuote(quote: QuoteResult): Json {
  return toJSONSafe(quote);
}

export function toJSONSafe(value: unknown): Json {
  if (typeof value === 'bigint') return value.toString();
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) return value.map(v => toJSONSafe(v));
  if (typeof value === 'object') {
    const out: Record<string, Json> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = toJSONSafe(v);
    }
    return out;
  }
  return String(value);
}
