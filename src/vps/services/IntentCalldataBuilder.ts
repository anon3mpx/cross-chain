import {
  Contract,
  Interface,
  JsonRpcProvider,
  Wallet,
  ZeroAddress,
  getAddress,
  isAddress,
  toUtf8Bytes,
  type TypedDataField,
} from 'ethers';
import { getChainConfig } from '../config/chains';
import { getSettlementTokenAddress } from '../config/contracts';
import { QuoteResult, Rail, SettlementToken } from '../types';
import { getRailEnumValue } from '../rails/registry';

const ROUTER_V1_IFACE = new Interface([
  'function initiateSwap((address user,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 minSrcSwapOut,uint32 dstChainId,uint8 rail,address routeToken,bytes32 routeAssetId,address expectedDstRouteToken,bytes32 expectedDstRouteAssetId,uint256 minRouteAmount,uint256 feeAmount,bytes swapDataSrc,bytes swapDataDst,bytes32 swapPluginIdSrc,bytes32 dstSwapPluginId,bytes32 railPluginId,bytes railData,uint256 dstGasLimit,address dstReceiver,bytes nativeDstAddress,string thorAssetIdentifier,uint256 minThorOutput,bytes32 intentId,uint256 deadline) intent,bytes signature)',
]);

const ROUTER_V1_LEGACY_IFACE = new Interface([
  'function initiateSwap((address user,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 minSrcSwapOut,uint32 dstChainId,uint8 rail,uint8 settlementToken,uint256 feeAmount,bytes swapDataSrc,bytes swapDataDst,bytes32 dstSwapPluginId,address dstReceiver,bytes nativeDstAddress,string thorAssetIdentifier,uint256 minThorOutput,bytes32 intentId,uint256 deadline) intent,bytes32 swapPluginId,bytes32 railPluginId)',
]);

const ROUTER_REGISTRY_ABI = [
  'function registry() view returns (address)',
];

const PLUGIN_REGISTRY_ABI = [
  'function getRailPlugin(bytes32 pluginId) view returns (address)',
];

const RAIL_FEE_ABI = [
  'function estimateFee(uint32 dstChainId,uint256 amount,address routeToken,bytes32 routeAssetId,uint256 dstGasLimit,bytes railData) view returns (uint256 fee,uint256 eta)',
];

const ROUTER_SIGNING_TYPES: Record<string, TypedDataField[]> = {
  SwapIntent: [
    { name: 'user', type: 'address' },
    { name: 'tokenIn', type: 'address' },
    { name: 'tokenOut', type: 'address' },
    { name: 'amountIn', type: 'uint256' },
    { name: 'minAmountOut', type: 'uint256' },
    { name: 'minSrcSwapOut', type: 'uint256' },
    { name: 'dstChainId', type: 'uint32' },
    { name: 'rail', type: 'uint8' },
    { name: 'route', type: 'IntentRoute' },
    { name: 'feeAmount', type: 'uint256' },
    { name: 'execution', type: 'IntentExecution' },
  ],
  IntentRoute: [
    { name: 'routeToken', type: 'address' },
    { name: 'routeAssetId', type: 'bytes32' },
    { name: 'expectedDstRouteToken', type: 'address' },
    { name: 'expectedDstRouteAssetId', type: 'bytes32' },
    { name: 'minRouteAmount', type: 'uint256' },
  ],
  IntentExecution: [
    { name: 'swapDataSrc', type: 'bytes' },
    { name: 'swapDataDst', type: 'bytes' },
    { name: 'swapPluginIdSrc', type: 'bytes32' },
    { name: 'dstSwapPluginId', type: 'bytes32' },
    { name: 'railPluginId', type: 'bytes32' },
    { name: 'railData', type: 'bytes' },
    { name: 'dstGasLimit', type: 'uint256' },
    { name: 'dstReceiver', type: 'address' },
    { name: 'nativeDstAddress', type: 'bytes' },
    { name: 'thorAssetIdentifier', type: 'string' },
    { name: 'minThorOutput', type: 'uint256' },
    { name: 'intentId', type: 'bytes32' },
    { name: 'deadline', type: 'uint256' },
  ],
};

export interface RouterIntegration {
  contractAddress: string;
  calldata: string;
  value: string;
  expiresAt: number;
}

type QuoteSettlementFields = {
  settlementAssetId: unknown;
  expectedDstSettlementToken: unknown;
  expectedDstSettlementAssetId: unknown;
  minSettlementAmount: unknown;
};

export function getRouterAddress(chainId: number): string {
  return getChainConfig(chainId)?.routerV1 ?? ZeroAddress;
}

export async function buildRouterIntegration(
  intentId: string,
  quote: QuoteResult,
  userAddress: string,
): Promise<RouterIntegration> {
  const contractAddress = getRouterAddress(quote.srcChainId);
  if (contractAddress === ZeroAddress) {
    throw new Error(`calldata: RouterV1 missing for source chain ${quote.srcChainId}`);
  }

  return {
    contractAddress,
    calldata: await buildRouterCalldata(intentId, quote, userAddress),
    value: await estimateNativeGas(quote),
    expiresAt: quote.expiresAt,
  };
}

export async function buildRouterCalldata(
  intentId: string,
  quote: QuoteResult,
  userAddress: string,
): Promise<string> {
  const srcCfg = getChainConfig(quote.srcChainId);
  if (!srcCfg) throw new Error(`calldata: unknown source chain ${quote.srcChainId}`);

  const dstCfg = getChainConfig(quote.dstChainId);
  if (!dstCfg) throw new Error(`calldata: unknown destination chain ${quote.dstChainId}`);

  const railValue = getRailEnumValue(quote.rail);
  if (railValue === undefined) throw new Error(`calldata: unsupported rail ${quote.rail}`);

  const dstReceiver = (quote.railType === 'messaging')
    ? normalizeAddress(dstCfg.receiverV1, 'destination receiverV1')
    : ZeroAddress;
  const settlementQuote = quote as QuoteResult & QuoteSettlementFields;
  const routeToken = normalizeAddress(resolveRouteTokenAddress(quote), 'routeToken');
  const expectedDstRouteToken = normalizeAddress(
    settlementQuote.expectedDstSettlementToken,
    'expectedDstRouteToken',
  );
  const expectedDstRouteAssetId = normalizeBytes32(
    settlementQuote.expectedDstSettlementAssetId,
    'expectedDstRouteAssetId',
  );
  const minRouteAmount = toBigIntStrict(settlementQuote.minSettlementAmount, 'minRouteAmount');

  if (quote.railType === 'messaging' && expectedDstRouteToken === ZeroAddress) {
    throw new Error('calldata: expectedDstRouteToken cannot be zero for messaging rails');
  }
  if (quote.railType === 'messaging' && expectedDstRouteAssetId === `0x${'0'.repeat(64)}`) {
    throw new Error('calldata: expectedDstRouteAssetId cannot be zero for messaging rails');
  }

  const payload = {
    user: normalizeAddress(userAddress, 'userAddress'),
    tokenIn: normalizeAddress(quote.tokenIn, 'tokenIn'),
    tokenOut: normalizeAddress(quote.tokenOut, 'tokenOut'),
    amountIn: toBigIntStrict(quote.amountIn, 'amountIn'),
    minAmountOut: toBigIntStrict(quote.minAmountOut, 'minAmountOut'),
    minSrcSwapOut: toBigIntDefault(quote.minSrcSwapOut, 0n),
    dstChainId: quote.dstChainId,
    rail: railValue,
    routeToken,
    routeAssetId: normalizeBytes32(settlementQuote.settlementAssetId, 'routeAssetId'),
    expectedDstRouteToken,
    expectedDstRouteAssetId,
    minRouteAmount,
    feeAmount: toBigIntStrict(quote.feeAmountToken, 'feeAmountToken'),
    swapDataSrc: normalizeBytes(quote.swapDataSrc ?? '0x', 'swapDataSrc'),
    swapDataDst: normalizeBytes(quote.swapDataDst ?? '0x', 'swapDataDst'),
    swapPluginIdSrc: normalizeBytes32(quote.swapPluginIdSrc, 'swapPluginIdSrc'),
    dstSwapPluginId: normalizeBytes32(quote.swapPluginIdDst, 'swapPluginIdDst'),
    railPluginId: normalizeBytes32(quote.railPluginId, 'railPluginId'),
    railData: normalizeBytes(quote.railData ?? '0x', 'railData'),
    dstGasLimit: toBigIntStrict(quote.dstGasLimit, 'dstGasLimit'),
    dstReceiver,
    nativeDstAddress: quote.nativeDstAddress ? toUtf8Bytes(String(quote.nativeDstAddress)) : '0x',
    thorAssetIdentifier: String(quote.thorAsset ?? ''),
    minThorOutput: toBigIntDefault(quote.minThorOutput, 0n),
    intentId: normalizeBytes32(intentId, 'intentId'),
    deadline: toBigIntStrict(quote.expiresAt, 'expiresAt'),
  };

  if (srcCfg.routerV1Abi === 'legacy') {
    throw new Error(
      `calldata: legacy RouterV1 on chain ${quote.srcChainId} cannot verify signed intents; ` +
      'deploy the current RouterV1 ABI or set CHAIN_<chainId>_ROUTER_V1_ABI=current',
    );
  }

  const signature = await signRouterIntent(payload, quote.srcChainId, getRouterAddress(quote.srcChainId));
  return ROUTER_V1_IFACE.encodeFunctionData('initiateSwap', [payload, signature]);
}

async function estimateNativeGas(quote: QuoteResult): Promise<string> {
  if (quote.rail !== Rail.AXELAR && quote.rail !== Rail.LAYERZERO) {
    return '0';
  }

  const srcCfg = getChainConfig(quote.srcChainId);
  if (!srcCfg) throw new Error(`calldata: unknown source chain ${quote.srcChainId}`);

  const rpcUrl = srcCfg.rpcUrl || srcCfg.rpcFallback;
  if (!rpcUrl) {
    throw new Error(`calldata: missing RPC URL for source chain ${quote.srcChainId}`);
  }

  const routerAddress = getRouterAddress(quote.srcChainId);
  if (routerAddress === ZeroAddress) {
    throw new Error(`calldata: RouterV1 missing for source chain ${quote.srcChainId}`);
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const router = new Contract(routerAddress, ROUTER_REGISTRY_ABI, provider);
  const registryAddress = await router.registry();
  if (!isAddress(registryAddress) || registryAddress === ZeroAddress) {
    throw new Error(`calldata: RouterV1 registry missing for source chain ${quote.srcChainId}`);
  }

  const registry = new Contract(registryAddress, PLUGIN_REGISTRY_ABI, provider);
  const railPluginAddress = await registry.getRailPlugin(quote.railPluginId);
  if (!isAddress(railPluginAddress) || railPluginAddress === ZeroAddress) {
    throw new Error(`calldata: rail plugin ${quote.railPluginId} missing on chain ${quote.srcChainId}`);
  }

  const railPlugin = new Contract(railPluginAddress, RAIL_FEE_ABI, provider);
  const bridgeAmount = estimateBridgeAmount(quote);
  const routeToken = normalizeAddress(resolveRouteTokenAddress(quote), 'routeToken');
  const routeAssetId = normalizeBytes32(quote.settlementAssetId, 'routeAssetId');
  const [fee] = await railPlugin.estimateFee(
    quote.dstChainId,
    bridgeAmount,
    routeToken,
    routeAssetId,
    toBigIntStrict(quote.dstGasLimit, 'dstGasLimit'),
    normalizeBytes(quote.railData ?? '0x', 'railData'),
  );
  return fee.toString();
}

function estimateBridgeAmount(quote: QuoteResult): bigint {
  const amountAfterFee = quote.amountIn - quote.feeAmountToken;
  if (amountAfterFee <= 0n) {
    throw new Error('calldata: amount after fee must be positive');
  }

  // Current live routes are direct settlement-token transfers. If/when source
  // swap payloads become active, minSrcSwapOut is the closest safe proxy we
  // have in the quote model for the amount handed to the rail plugin.
  if (quote.minSrcSwapOut > 0n) {
    return quote.minSrcSwapOut;
  }

  return amountAfterFee;
}

function resolveRouteTokenAddress(quote: QuoteResult): string {
  const routeAsset = (quote as QuoteResult & { routeAsset?: { srcTokenAddress?: unknown; tokenAddress?: unknown } }).routeAsset;
  if (typeof routeAsset?.srcTokenAddress === 'string') {
    return routeAsset.srcTokenAddress;
  }
  if (typeof routeAsset?.tokenAddress === 'string') {
    return routeAsset.tokenAddress;
  }

  const configured = getSettlementTokenAddress(quote.srcChainId, quote.settlementToken, quote.rail)
    ?? getSettlementTokenAddress(quote.srcChainId, quote.settlementToken);
  if (!configured) {
    throw new Error(
      `calldata: missing route token address for source chain ${quote.srcChainId}, rail ${quote.rail}, token ${quote.settlementToken}`,
    );
  }
  return configured;
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

async function signRouterIntent(
  payload: Record<string, unknown>,
  chainId: number,
  verifyingContract: string,
): Promise<string> {
  const signerKey = process.env.VPS_INTENT_SIGNER_PRIVATE_KEY
    ?? process.env.INTENT_SIGNER_PRIVATE_KEY
    ?? process.env.DEPLOYER_PRIVATE_KEY;
  if (!signerKey) {
    throw new Error(
      'calldata: missing VPS_INTENT_SIGNER_PRIVATE_KEY (or INTENT_SIGNER_PRIVATE_KEY / DEPLOYER_PRIVATE_KEY)',
    );
  }

  const wallet = new Wallet(signerKey);
  return wallet.signTypedData(
    {
      name: 'EMPX-Cross-Chain Router',
      version: '1',
      chainId,
      verifyingContract,
    },
    ROUTER_SIGNING_TYPES,
    toTypedDataValue(payload),
  );
}

function toTypedDataValue(payload: Record<string, unknown>) {
  return {
    user: payload.user,
    tokenIn: payload.tokenIn,
    tokenOut: payload.tokenOut,
    amountIn: payload.amountIn,
    minAmountOut: payload.minAmountOut,
    minSrcSwapOut: payload.minSrcSwapOut,
    dstChainId: payload.dstChainId,
    rail: payload.rail,
    route: {
      routeToken: payload.routeToken,
      routeAssetId: payload.routeAssetId,
      expectedDstRouteToken: payload.expectedDstRouteToken,
      expectedDstRouteAssetId: payload.expectedDstRouteAssetId,
      minRouteAmount: payload.minRouteAmount,
    },
    feeAmount: payload.feeAmount,
    execution: {
      swapDataSrc: payload.swapDataSrc,
      swapDataDst: payload.swapDataDst,
      swapPluginIdSrc: payload.swapPluginIdSrc,
      dstSwapPluginId: payload.dstSwapPluginId,
      railPluginId: payload.railPluginId,
      railData: payload.railData,
      dstGasLimit: payload.dstGasLimit,
      dstReceiver: payload.dstReceiver,
      nativeDstAddress: payload.nativeDstAddress,
      thorAssetIdentifier: payload.thorAssetIdentifier,
      minThorOutput: payload.minThorOutput,
      intentId: payload.intentId,
      deadline: payload.deadline,
    },
  };
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
