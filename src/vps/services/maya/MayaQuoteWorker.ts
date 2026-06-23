import { Rail } from '../../types';
import {
  MAYA_ASSET_CATALOG,
  getProviderCatalogChainIds,
  toMayaCatalogAsset,
} from '../../config/railCapabilities';
import { MayaClient } from './MayaClient';

export interface MayaQuoteRequest {
  srcChainId: number;
  dstChainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  destinationAddress: string;
  minOutput?: bigint;
}

export interface MayaQuoteResult {
  vaultAddress: string;
  memo: string;
  expectedAmountOut: bigint;
  slipBps: number;
  outboundFee: bigint;
  expiresAtUnix: number;
  etaSeconds: number;
}

export interface MayaQuoteWorker {
  quote(req: MayaQuoteRequest): Promise<MayaQuoteResult | null>;
}

export class MidgardMayaQuoteWorker implements MayaQuoteWorker {
  constructor(
    private readonly client: Pick<MayaClient, 'getQuote'> = new MayaClient(),
  ) {}

  async quote(req: MayaQuoteRequest): Promise<MayaQuoteResult | null> {
    const fromAsset = toMayaAsset(req.srcChainId, deriveTokenSymbol(req.tokenIn));
    const toAsset = toMayaAsset(req.dstChainId, deriveTokenSymbol(req.tokenOut));
    if (!fromAsset || !toAsset) return null;

    const json = await this.client.getQuote({
      fromAsset,
      toAsset,
      amount: req.amountIn,
      destinationAddress: req.destinationAddress,
      minOutput: req.minOutput,
    });
    if (!json) return null;

    return {
      vaultAddress: json.inboundAddress,
      memo: json.memo,
      expectedAmountOut: json.expectedAmountOut,
      slipBps: json.slipBps,
      outboundFee: json.outboundFee,
      expiresAtUnix: json.expiresAtUnix,
      etaSeconds: json.etaSeconds,
    };
  }
}

function deriveTokenSymbol(addressOrSymbol: string): string {
  const value = addressOrSymbol.trim().toUpperCase();
  if (['BTC', 'ETH', 'USDC', 'USDT', 'DOGE', 'DASH', 'ZEC', 'KUJI', 'BNB', 'AVAX'].includes(value)) {
    return value;
  }
  return 'USDC';
}

export function toMayaAsset(
  chainId: number,
  tokenAddressOrSymbol: string,
): string | null {
  return toMayaCatalogAsset(chainId, tokenAddressOrSymbol);
}

export const MAYA_ACCESSIBLE_CHAIN_IDS = getProviderCatalogChainIds(MAYA_ASSET_CATALOG);

export const MAYA_RAIL = Rail.MAYA;
