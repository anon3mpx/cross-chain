import { DestinationGasRequest, OfferSet, QuoteRequest, QuoteResult } from '../types';

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
const EMPTY_TEXT_VALUES = new Set(['', 'undefined', 'null']);

function parseOptionalText(raw: unknown): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  const value = String(raw).trim();
  if (EMPTY_TEXT_VALUES.has(value.toLowerCase())) return undefined;
  return value;
}

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
    nativeDstAddress: parseOptionalText(input.nativeDstAddress),
    destinationGas: parseDestinationGasRequests(input.destinationGas),
    urgency: input.urgency ? urgency : defaultUrgency,
  };
}

function parseDestinationGasRequests(raw: unknown): DestinationGasRequest[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const parsed = raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Record<string, unknown>;
    const amountWei = parseOptionalText(item.amountWei);
    const recipient = parseOptionalText(item.recipient);
    const provider = parseOptionalText(item.provider);
    const chainId = Number(item.chainId);

    if (!Number.isFinite(chainId) || !amountWei) return [];

    return [{
      chainId,
      amountWei,
      recipient,
      provider: provider === 'gaszip' ? 'gaszip' : undefined,
    } satisfies DestinationGasRequest];
  });

  return parsed.length > 0 ? parsed : undefined;
}

export function serializeQuote(quote: QuoteResult): Json {
  return toJSONSafe(quote);
}

export function serializeOfferSet(offerSet: OfferSet): Json {
  return toJSONSafe(offerSet);
}

export function parseOfferSelection(input: any): { offerSetId: string; offerId: string } {
  if (!input || typeof input !== 'object') throw new Error('Invalid payload');

  const offerSetId = parseOptionalText(input.offerSetId);
  const offerId = parseOptionalText(input.offerId ?? input.selectedOfferId);

  if (!offerSetId) throw new Error('offerSetId required');
  if (!offerId) throw new Error('offerId required');

  return { offerSetId, offerId };
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
