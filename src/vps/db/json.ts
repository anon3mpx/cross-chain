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

function reviveAmountView(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const token = parseOptionalString(raw.token);
  if (!token) return undefined;
  return {
    token,
    amount: toBigIntOrZero(raw.amount),
    ...(typeof raw.decimals === 'number' && Number.isFinite(raw.decimals) ? { decimals: raw.decimals } : {}),
    ...(parseOptionalString(raw.symbol) ? { symbol: parseOptionalString(raw.symbol)! } : {}),
  };
}

function reviveLegView(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const tokenIn = parseOptionalString(raw.tokenIn);
  const tokenOut = parseOptionalString(raw.tokenOut);
  if (!tokenIn || !tokenOut) return undefined;
  return {
    tokenIn,
    tokenOut,
    amountIn: toBigIntOrZero(raw.amountIn),
    amountOut: toBigIntOrZero(raw.amountOut),
    ...(parseBigIntValue(raw.minimumAmountOut) !== undefined ? { minimumAmountOut: toBigIntOrZero(raw.minimumAmountOut) } : {}),
    ...(typeof raw.tokenInDecimals === 'number' && Number.isFinite(raw.tokenInDecimals) ? { tokenInDecimals: raw.tokenInDecimals } : {}),
    ...(typeof raw.tokenOutDecimals === 'number' && Number.isFinite(raw.tokenOutDecimals) ? { tokenOutDecimals: raw.tokenOutDecimals } : {}),
    ...(parseOptionalString(raw.tokenInSymbol) ? { tokenInSymbol: parseOptionalString(raw.tokenInSymbol)! } : {}),
    ...(parseOptionalString(raw.tokenOutSymbol) ? { tokenOutSymbol: parseOptionalString(raw.tokenOutSymbol)! } : {}),
  };
}

export function reviveQuote(raw: any): QuoteResult {
  const q = raw as QuoteResult & Record<string, unknown>;
  const amountsRaw = q.amounts as Record<string, unknown> | undefined;
  const legsRaw = q.legs as Record<string, unknown> | undefined;
  return {
    ...q,
    railData: parseOptionalString(q.railData) ?? '0x',
    thorAsset: parseOptionalString(q.thorAsset),
    nativeDstAddress: parseOptionalString(q.nativeDstAddress),
    amountIn: toBigIntOrZero(q.amountIn),
    estimatedOut: toBigIntOrZero(q.estimatedOut),
    minAmountOut: toBigIntOrZero(q.minAmountOut),
    minSrcSwapOut: toBigIntOrZero(q.minSrcSwapOut),
    minSettlementAmount: toBigIntOrZero(q.minSettlementAmount),
    dstGasLimit: typeof q.dstGasLimit === 'number' && Number.isFinite(q.dstGasLimit) ? q.dstGasLimit : 0,
    feeAmountToken: toBigIntOrZero(q.feeAmountToken),
    minThorOutput: toOptionalBigInt(q.minThorOutput),
    settlementAssetId: parseOptionalString(q.settlementAssetId) ?? `0x${'0'.repeat(64)}`,
    expectedDstSettlementToken: parseOptionalString(q.expectedDstSettlementToken) ?? '0x0000000000000000000000000000000000000000',
    expectedDstSettlementAssetId: parseOptionalString(q.expectedDstSettlementAssetId) ?? `0x${'0'.repeat(64)}`,
    ...(amountsRaw ? {
      amounts: {
        input: reviveAmountView(amountsRaw.input) ?? { token: '', amount: 0n },
        ...(reviveAmountView(amountsRaw.bridgeSettlement) ? { bridgeSettlement: reviveAmountView(amountsRaw.bridgeSettlement)! } : {}),
        ...(reviveAmountView(amountsRaw.minimumBridgeSettlement) ? { minimumBridgeSettlement: reviveAmountView(amountsRaw.minimumBridgeSettlement)! } : {}),
        output: reviveAmountView(amountsRaw.output) ?? { token: '', amount: 0n },
        minimumOutput: reviveAmountView(amountsRaw.minimumOutput) ?? { token: '', amount: 0n },
      },
    } : {}),
    ...(legsRaw ? {
      legs: {
        ...(reviveLegView(legsRaw.sourceSwap) ? { sourceSwap: reviveLegView(legsRaw.sourceSwap)! } : {}),
        ...(reviveLegView(legsRaw.bridge) ? { bridge: reviveLegView(legsRaw.bridge)! } : {}),
        ...(reviveLegView(legsRaw.destinationSwap) ? { destinationSwap: reviveLegView(legsRaw.destinationSwap)! } : {}),
      },
    } : {}),
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
