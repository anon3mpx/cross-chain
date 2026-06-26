import { Rail, SettlementToken } from '../../types';
import {
  CHAINFLIP_ASSET_CATALOG,
  getProviderCatalogChainIds,
  toChainflipCatalogAsset,
} from '../../config/railCapabilities';
import { ChainflipBrokerClient } from './ChainflipBrokerClient';

export interface ChainflipQuoteRequest {
  srcChainId: number;
  dstChainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  destinationAddress: string;
  refundAddress?: string;
  brokerCommissionBps?: number;
}

export interface ChainflipQuoteResult {
  depositAddress: string;
  channelId: string;
  expectedAmountOut: bigint;
  effectiveRateBps: number;
  expiresAtUnix: number;
  etaSeconds: number;
  networkFees: {
    sourceFee: bigint;
    destinationFee: bigint;
  };
  brokerFeeAmount: bigint;
}

export interface ChainflipQuoteWorker {
  quote(req: ChainflipQuoteRequest): Promise<ChainflipQuoteResult | null>;
}

export class BrokerChainflipQuoteWorker implements ChainflipQuoteWorker {
  constructor(
    private readonly client: Pick<ChainflipBrokerClient, 'isConfigured' | 'getIndicativeQuote' | 'requestSwapDepositAddress'> = new ChainflipBrokerClient(),
  ) {}

  async quote(req: ChainflipQuoteRequest): Promise<ChainflipQuoteResult | null> {
    if (!this.client.isConfigured()) return null;

    const srcAsset = toChainflipAsset(req.srcChainId, deriveSymbol(req.tokenIn));
    const dstAsset = toChainflipAsset(req.dstChainId, deriveSymbol(req.tokenOut));
    if (!srcAsset || !dstAsset) return null;

    const [indicative, channel] = await Promise.all([
      this.client.getIndicativeQuote({
        srcAsset,
        dstAsset,
        amountIn: req.amountIn,
      }),
      this.client.requestSwapDepositAddress({
        srcAsset,
        dstAsset,
        destinationAddress: req.destinationAddress,
        refundAddress: req.refundAddress,
        brokerCommissionBpsOverride: req.brokerCommissionBps,
      }),
    ]);
    if (!indicative || !channel) return null;

    return {
      depositAddress: channel.depositAddress,
      channelId: channel.channelId,
      expectedAmountOut: indicative.expectedAmountOut,
      effectiveRateBps: indicative.effectiveRateBps,
      expiresAtUnix: channel.expiryTimeUnix ?? Math.floor(Date.now() / 1000) + 15 * 60,
      etaSeconds: indicative.etaSeconds,
      networkFees: {
        sourceFee: indicative.sourceFee,
        destinationFee: indicative.destinationFee,
      },
      brokerFeeAmount: indicative.brokerFeeAmount,
    };
  }
}

function deriveSymbol(tokenAddressOrSymbol: string): SettlementToken | string {
  const value = tokenAddressOrSymbol.trim().toUpperCase();
  if (['BTC', 'ETH', 'SOL', 'DOT', 'USDC', 'USDT'].includes(value)) return value;
  return 'USDC';
}

export function toChainflipAsset(
  chainId: number,
  tokenSymbol: SettlementToken | string,
): string | null {
  return toChainflipCatalogAsset(chainId, String(tokenSymbol));
}

export const CHAINFLIP_ACCESSIBLE_CHAIN_IDS = getProviderCatalogChainIds(CHAINFLIP_ASSET_CATALOG);

export const CHAINFLIP_RAIL = Rail.CHAINFLIP;
