import { RailOffer, QuoteResult } from '../types';
import { buildRouterIntegration, type RouterIntegration } from './IntentCalldataBuilder';
import { Interface, ZeroAddress, isAddress } from 'ethers';

const THOR_ROUTER_IFACE = new Interface([
  'function depositWithExpiry(address payable vault,address asset,uint256 amount,string memo,uint256 expiration)',
]);

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
    tx?: {
      to: string;
      data: string;
      value: string;
      chainId: number;
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
    const executionQuote = offer.execution.quote as Record<string, unknown>;
    const thorQuote = (offer.execution as Record<string, unknown>).thorQuote as Record<string, unknown> | undefined;
    const source = thorQuote && typeof thorQuote === 'object' ? thorQuote : executionQuote;
    const depositAddress = String(source.inbound_address ?? '');
    const memo = String(source.memo ?? '');
    const expiresAt = Number(source.expiry ?? 0);
    const expectedAmountOut = String(source.expected_amount_out ?? '');

    const router = String(
      (source.router ?? (offer.execution as Record<string, unknown>).router ?? '') ?? '',
    );
    const amountInRaw = executionQuote.amountIn;
    const amountIn = typeof amountInRaw === 'bigint'
      ? amountInRaw
      : (() => {
        const raw = String(amountInRaw ?? '').trim();
        return /^\d+$/.test(raw) ? BigInt(raw) : null;
      })();
    const tokenInRaw = String(executionQuote.tokenIn ?? '').trim();
    const tokenInIsAddress = isAddress(tokenInRaw);
    const asset = tokenInIsAddress ? tokenInRaw : ZeroAddress;
    const canBuildTx = isAddress(router) && isAddress(depositAddress) && amountIn !== null && expiresAt > 0 && memo.length > 0;

    return {
      mode: 'provider_direct',
      action: {
        kind: 'thorchain_swap',
        depositAddress,
        memo,
        expiresAt,
        expectedAmountOut,
      },
      ...(canBuildTx
        ? {
          tx: {
            to: router,
            data: THOR_ROUTER_IFACE.encodeFunctionData('depositWithExpiry', [
              depositAddress,
              asset,
              amountIn,
              memo,
              expiresAt,
            ]),
            value: asset === ZeroAddress ? amountIn.toString() : '0',
            chainId: Number(executionQuote.srcChainId ?? 0),
          },
        }
        : {}),
    };
  }

  throw new Error(`Unsupported provider direct integration for offer ${offer.offerId}`);
}
