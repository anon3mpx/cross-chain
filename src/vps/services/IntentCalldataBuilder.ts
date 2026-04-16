import { Interface, ZeroAddress, getAddress, isAddress, toUtf8Bytes } from 'ethers';
import { getChainConfig } from '../config/chains';
import { QuoteResult, Rail, SettlementToken } from '../types';

const ROUTER_V1_IFACE = new Interface([
  'function initiateSwap((address user,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 minSrcSwapOut,uint32 dstChainId,uint8 rail,uint8 settlementToken,uint256 feeAmount,bytes swapDataSrc,bytes swapDataDst,bytes32 swapPluginIdSrc,bytes32 dstSwapPluginId,bytes32 railPluginId,bytes railData,address dstReceiver,bytes nativeDstAddress,string thorAssetIdentifier,uint256 minThorOutput,bytes32 intentId,uint256 deadline) intent)',
]);

const RAIL_ENUM_VALUE: Record<string, number> = {
  [Rail.CCTP]: 0,
  [Rail.AXELAR]: 1,
  [Rail.LAYERZERO]: 2,
  [Rail.VIA_LABS]: 3,
  // Forward-compatible placeholders for newer rails if Router enum extends.
  [Rail.WORMHOLE]: 4,
  [Rail.THORCHAIN]: 5,
};

const SETTLEMENT_ENUM_VALUE: Partial<Record<SettlementToken, number>> = {
  [SettlementToken.USDC]: 0,
  [SettlementToken.USDT]: 1,
  [SettlementToken.ETH]: 2,
};

export interface RouterIntegration {
  contractAddress: string;
  calldata: string;
  value: string;
  expiresAt: number;
}

export function getRouterAddress(chainId: number): string {
  return getChainConfig(chainId)?.routerV1 ?? ZeroAddress;
}

export function buildRouterIntegration(
  intentId: string,
  quote: QuoteResult,
  userAddress: string,
): RouterIntegration {
  const contractAddress = getRouterAddress(quote.srcChainId);
  if (contractAddress === ZeroAddress) {
    throw new Error(`calldata: RouterV1 missing for source chain ${quote.srcChainId}`);
  }

  return {
    contractAddress,
    calldata: buildRouterCalldata(intentId, quote, userAddress),
    value: estimateNativeGas(quote),
    expiresAt: quote.expiresAt,
  };
}

export function buildRouterCalldata(
  intentId: string,
  quote: QuoteResult,
  userAddress: string,
): string {
  const dstCfg = getChainConfig(quote.dstChainId);
  if (!dstCfg) throw new Error(`calldata: unknown destination chain ${quote.dstChainId}`);

  const railValue = RAIL_ENUM_VALUE[quote.rail];
  if (railValue === undefined) throw new Error(`calldata: unsupported rail ${quote.rail}`);

  const settlementValue = SETTLEMENT_ENUM_VALUE[quote.settlementToken];
  if (settlementValue === undefined) {
    throw new Error(`calldata: unsupported settlement token ${quote.settlementToken}`);
  }

  const dstReceiver = (quote.railType === 'messaging')
    ? normalizeAddress(dstCfg.receiverV1, 'destination receiverV1')
    : ZeroAddress;

  const payload = {
    user: normalizeAddress(userAddress, 'userAddress'),
    tokenIn: normalizeAddress(quote.tokenIn, 'tokenIn'),
    tokenOut: normalizeAddress(quote.tokenOut, 'tokenOut'),
    amountIn: toBigIntStrict(quote.amountIn, 'amountIn'),
    minAmountOut: toBigIntStrict(quote.minAmountOut, 'minAmountOut'),
    minSrcSwapOut: toBigIntDefault(quote.minSrcSwapOut, 0n),
    dstChainId: quote.dstChainId,
    rail: railValue,
    settlementToken: settlementValue,
    feeAmount: toBigIntStrict(quote.feeAmountToken, 'feeAmountToken'),
    swapDataSrc: normalizeBytes(quote.swapDataSrc ?? '0x', 'swapDataSrc'),
    swapDataDst: normalizeBytes(quote.swapDataDst ?? '0x', 'swapDataDst'),
    swapPluginIdSrc: normalizeBytes32(quote.swapPluginIdSrc, 'swapPluginIdSrc'),
    dstSwapPluginId: normalizeBytes32(quote.swapPluginIdDst, 'swapPluginIdDst'),
    railPluginId: normalizeBytes32(quote.railPluginId, 'railPluginId'),
    railData: normalizeBytes(quote.railData ?? '0x', 'railData'),
    dstReceiver,
    nativeDstAddress: quote.nativeDstAddress ? toUtf8Bytes(String(quote.nativeDstAddress)) : '0x',
    thorAssetIdentifier: String(quote.thorAsset ?? ''),
    minThorOutput: toBigIntDefault(quote.minThorOutput, 0n),
    intentId: normalizeBytes32(intentId, 'intentId'),
    deadline: toBigIntStrict(quote.expiresAt, 'expiresAt'),
  };

  return ROUTER_V1_IFACE.encodeFunctionData('initiateSwap', [payload]);
}

function estimateNativeGas(_quote: QuoteResult): string {
  // TODO: replace with chain-specific gas + rail fee estimation.
  return '0';
}

function normalizeAddress(value: unknown, field: string): string {
  if (typeof value !== 'string' || !isAddress(value)) {
    throw new Error(`calldata: invalid ${field}`);
  }
  return getAddress(value);
}

function normalizeBytes32(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`calldata: invalid ${field}`);
  }
  return value.toLowerCase();
}

function normalizeBytes(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]*$/.test(value) || value.length % 2 !== 0) {
    throw new Error(`calldata: invalid ${field}`);
  }
  return value.toLowerCase();
}

function toBigIntStrict(value: unknown, field: string): bigint {
  try {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') return BigInt(Math.floor(value));
    if (typeof value === 'string') return BigInt(value);
  } catch {
    // no-op
  }
  throw new Error(`calldata: invalid ${field}`);
}

function toBigIntDefault(value: unknown, fallback: bigint): bigint {
  try {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') return BigInt(Math.floor(value));
    if (typeof value === 'string') return BigInt(value);
  } catch {
    return fallback;
  }
  return fallback;
}
