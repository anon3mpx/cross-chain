import { Intent, QuoteResult } from '../types';

type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

export function toDbJson(value: unknown): JsonValue {
  if (typeof value === 'bigint') return value.toString();
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(v => toDbJson(v));
  if (typeof value === 'object') {
    const out: Record<string, JsonValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = toDbJson(v);
    return out;
  }
  return String(value);
}

function toBigIntOrZero(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.floor(value));
  if (typeof value === 'string' && value.trim().length > 0) return BigInt(value);
  return 0n;
}

function toOptionalBigInt(value: unknown): bigint | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return toBigIntOrZero(value);
}

export function reviveQuote(raw: any): QuoteResult {
  const q = raw as QuoteResult & Record<string, unknown>;
  return {
    ...q,
    railData: typeof q.railData === 'string' ? q.railData : '0x',
    amountIn: toBigIntOrZero(q.amountIn),
    estimatedOut: toBigIntOrZero(q.estimatedOut),
    minAmountOut: toBigIntOrZero(q.minAmountOut),
    minSrcSwapOut: toBigIntOrZero(q.minSrcSwapOut),
    feeAmountToken: toBigIntOrZero(q.feeAmountToken),
    minThorOutput: toOptionalBigInt(q.minThorOutput),
  };
}

export function toIntentRow(intent: Intent) {
  return {
    intent_id: intent.intentId,
    status: intent.status,
    user_address: intent.userAddress,
    src_chain_id: intent.quote.srcChainId,
    dst_chain_id: intent.quote.dstChainId,
    rail: intent.quote.rail,
    fallback_rail: intent.fallbackRail ?? null,
    quote: toDbJson(intent.quote),
    src_tx_hash: intent.srcTxHash ?? null,
    rail_tx_id: intent.railTxId ?? null,
    dst_tx_hash: intent.dstTxHash ?? null,
    retry_count: intent.retryCount,
    error_message: intent.errorMessage ?? null,
    partner_api_key: intent.partnerApiKey ?? null,
    created_at: new Date(intent.createdAt),
    updated_at: new Date(intent.updatedAt),
  };
}
