import { Rail } from '../../types';
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
  const key = `${chainId}:${tokenAddressOrSymbol.toUpperCase()}`;
  const table: Record<string, string> = {
    '0:BTC': 'BTC.BTC',
    '98:DOGE': 'DOGE.DOGE',
    '104:KUJI': 'KUJI.KUJI',
    '105:DASH': 'DASH.DASH',
    '106:ZEC': 'ZEC.ZEC',
    '1:ETH': 'ETH.ETH',
    '1:USDC': 'ETH.USDC',
    '1:USDT': 'ETH.USDT',
    '42161:ETH': 'ARB.ETH',
    '42161:USDC': 'ARB.USDC',
    '56:BNB': 'BSC.BNB',
    '56:USDT': 'BSC.USDT',
    '43114:AVAX': 'AVAX.AVAX',
    '43114:USDC': 'AVAX.USDC',
  };
  return table[key] ?? null;
}

export const MAYA_ACCESSIBLE_CHAIN_IDS = new Set<number>([
  1,
  42161,
  56,
  43114,
  0,
  98,
  104,
  105,
  106,
]);

export const MAYA_RAIL = Rail.MAYA;
