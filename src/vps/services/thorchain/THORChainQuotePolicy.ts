import { getAddress } from 'ethers';
import { OfferSet, QuoteResult, Rail, SettlementToken, CHAIN_ID } from '../../types';
import { THORChainQuoteRequest } from './THORChainQuoteWorker';

const THORCHAIN_EVM_CHAIN_NAMES: Record<number, string> = {
  [CHAIN_ID.ETH]: 'ETH',
  [CHAIN_ID.BSC]: 'BSC',
  [CHAIN_ID.AVAX]: 'AVAX',
  [CHAIN_ID.BASE]: 'BASE',
  [CHAIN_ID.ARB]: 'ARB',
  [CHAIN_ID.OP]: 'OP',
  [CHAIN_ID.POLYGON]: 'MATIC',
};

const NON_EVM_CHAINS = new Set<number>([
  CHAIN_ID.BTC,
  CHAIN_ID.DOGE,
  CHAIN_ID.SOL,
  CHAIN_ID.LTC,
  CHAIN_ID.BCH,
  CHAIN_ID.COSMOS,
  CHAIN_ID.DOT,
]);

export interface BuildTHORChainQuoteRequestInput {
  amountIn: bigint;
  srcChainId: number;
  dstChainId: number;
  destinationAddress?: string;
  routeAssetAlias: string;
  sourceTokenAddress?: string;
  destinationTokenAddress?: string;
  tokenIn: string;
  tokenOut: string;
}

export function buildTHORChainQuoteRequest(
  input: BuildTHORChainQuoteRequestInput,
): THORChainQuoteRequest | null {
  const settlementToken = resolveSettlementToken(input.routeAssetAlias);
  if (!settlementToken) return null;

  const fromAsset = toTHORChainAsset({
    chainId: input.srcChainId,
    settlementToken,
    tokenAddress: input.sourceTokenAddress,
    fallbackToken: input.tokenIn,
  });
  if (!fromAsset) return null;

  const toAsset = toTHORChainAsset({
    chainId: input.dstChainId,
    settlementToken,
    tokenAddress: input.destinationTokenAddress,
    fallbackToken: input.tokenOut,
  });
  if (!toAsset) return null;

  return {
    amountIn: input.amountIn,
    srcChainId: input.srcChainId,
    dstChainId: input.dstChainId,
    tokenIn: input.tokenIn,
    tokenOut: input.tokenOut,
    fromAsset,
    toAsset,
    destinationAddress: normalizeDestinationAddress(input.dstChainId, input.destinationAddress),
  };
}

export function shouldCacheOfferSet(offerSet: OfferSet): boolean {
  return offerSet.offers.every((offer) => offer.rail !== Rail.THORCHAIN);
}

export function shouldReuseCachedOfferSet(offerSet: OfferSet): boolean {
  return shouldCacheOfferSet(offerSet);
}

export function isQuoteCacheable(quote: QuoteResult): boolean {
  return quote.rail !== Rail.THORCHAIN;
}

function resolveSettlementToken(routeAssetAlias: string): SettlementToken | null {
  switch (routeAssetAlias.trim().toUpperCase()) {
    case 'USDC':
      return SettlementToken.USDC;
    case 'USDT':
      return SettlementToken.USDT;
    case 'ETH':
    case 'WETH':
    case 'ETH.ETH':
      return SettlementToken.ETH;
    case 'BTC':
    case 'BTC.BTC':
      return SettlementToken.BTC;
    case 'SOL':
    case 'SOL.SOL':
      return SettlementToken.SOL;
    default:
      return null;
  }
}

interface ToTHORChainAssetInput {
  chainId: number;
  settlementToken: SettlementToken;
  tokenAddress?: string;
  fallbackToken?: string;
}

function toTHORChainAsset(input: ToTHORChainAssetInput): string | null {
  if (input.settlementToken === SettlementToken.BTC) return 'BTC.BTC';
  if (input.settlementToken === SettlementToken.SOL) return 'SOL.SOL';

  const chain = THORCHAIN_EVM_CHAIN_NAMES[input.chainId];
  if (!chain) {
    const fallbackNotation = normalizeNotation(input.fallbackToken);
    return fallbackNotation;
  }

  if (input.settlementToken === SettlementToken.ETH) return `${chain}.ETH`;

  if (input.settlementToken !== SettlementToken.USDC && input.settlementToken !== SettlementToken.USDT) {
    return null;
  }

  const address = normalizeEvmAddress(input.tokenAddress ?? input.fallbackToken);
  if (!address) return null;
  return `${chain}.${input.settlementToken}-${address.toUpperCase()}`;
}

function normalizeDestinationAddress(
  chainId: number,
  destinationAddress?: string,
): string | undefined {
  if (!destinationAddress) return undefined;
  const trimmed = destinationAddress.trim();
  if (!trimmed) return undefined;

  if (!isEvmChain(chainId)) return trimmed;

  try {
    return getAddress(trimmed);
  } catch {
    return undefined;
  }
}

function normalizeNotation(token?: string): string | null {
  if (!token) return null;
  const trimmed = token.trim();
  if (!trimmed || !trimmed.includes('.')) return null;
  return trimmed.toUpperCase();
}

function normalizeEvmAddress(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    return getAddress(value.trim());
  } catch {
    return undefined;
  }
}

function isEvmChain(chainId: number): boolean {
  return !NON_EVM_CHAINS.has(chainId);
}
