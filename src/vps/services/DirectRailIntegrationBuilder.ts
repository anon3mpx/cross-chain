import { RailOffer, QuoteResult } from '../types';
import { buildRouterIntegration, type RouterIntegration } from './IntentCalldataBuilder';

export type SelectedOfferIntegration =
  | { mode: 'router_intent'; integration: RouterIntegration }
  | {
    mode: 'provider_direct';
    action: {
      kind: 'thorchain_swap';
      depositAddress: string;
      memo: string;
      expiresAt: number;
      expectedAmountOut: string;
    };
  };

function materializeSelectedOfferQuote(offer: RailOffer): QuoteResult {
  const executionQuote = offer.execution?.quote;
  if (!executionQuote || typeof executionQuote !== 'object') {
    throw new Error(`Selected offer ${offer.offerId} is missing execution quote payload`);
  }

  return executionQuote as QuoteResult;
}

function isThorchainProviderDirectOffer(offer: RailOffer): boolean {
  const provider = typeof offer.execution?.provider === 'string'
    ? offer.execution.provider.toLowerCase()
    : '';
  if (provider === 'thorchain' || provider === 'thorchain_api') return true;
  if (offer.rail === 'THORCHAIN') return true;
  return offer.offerType === 'thor_api_direct';
}

export async function buildSelectedOfferIntegration(
  intentId: string,
  offer: RailOffer,
  userAddress: string,
): Promise<SelectedOfferIntegration> {
  if (offer.executionMode !== 'provider_direct') {
    const quote = materializeSelectedOfferQuote(offer);
    return {
      mode: 'router_intent',
      integration: await buildRouterIntegration(intentId, quote, userAddress),
    };
  }

  if (isThorchainProviderDirectOffer(offer)) {
    const quote = offer.execution.quote as Record<string, unknown>;
    return {
      mode: 'provider_direct',
      action: {
        kind: 'thorchain_swap',
        depositAddress: String(quote.inbound_address ?? ''),
        memo: String(quote.memo ?? ''),
        expiresAt: Number(quote.expiry ?? 0),
        expectedAmountOut: String(quote.expected_amount_out ?? ''),
      },
    };
  }

  throw new Error(`Unsupported provider direct integration for offer ${offer.offerId}`);
}
