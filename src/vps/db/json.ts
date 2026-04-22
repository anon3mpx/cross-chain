import { Intent, QuoteResult } from '../types';

type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };
const NON_VALUE_STRINGS = new Set(['', 'undefined', 'null', 'nan', 'infinity', '+infinity', '-infinity']);

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function parseBigIntValue(value: unknown): bigint | undefined {
  if (typeof value === 'bigint') return value;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return undefined;
    return BigInt(Math.floor(value));
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (NON_VALUE_STRINGS.has(normalizeText(trimmed))) return undefined;
    try {
      return BigInt(trimmed);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function parseOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (NON_VALUE_STRINGS.has(normalizeText(trimmed))) return undefined;
  return trimmed;
}

export function toDbJson(value: unknown): JsonValue {
  if (value === undefined) return null;
  if (typeof value === 'bigint') return value.toString();
  if (value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(v => (v === undefined ? null : toDbJson(v)));
  if (typeof value === 'object') {
    const out: Record<string, JsonValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = toDbJson(v);
    }
    return out;
  }
  return null;
}

function toBigIntOrZero(value: unknown): bigint {
  return parseBigIntValue(value) ?? 0n;
}

function toOptionalBigInt(value: unknown): bigint | undefined {
  return parseBigIntValue(value);
}

export function reviveQuote(raw: any): QuoteResult {
  const q = raw as QuoteResult & Record<string, unknown>;
  return {
    ...q,
    railData: parseOptionalString(q.railData) ?? '0x',
    thorAsset: parseOptionalString(q.thorAsset),
    nativeDstAddress: parseOptionalString(q.nativeDstAddress),
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
