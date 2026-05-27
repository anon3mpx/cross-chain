import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AbiCoder,
  Contract,
  Interface,
  JsonRpcProvider,
  Wallet,
  ZeroAddress,
  ethers,
} from 'ethers';
import {
  buildReceiverExecutionPayloadFromIntent,
  extractReceivedSettlementAmountFromReceipt,
} from '../services/CctpAttestationWorker';
import {
  getEmpsealRouterAddressForChain,
  getEmpsealRouterFeeBpsForChain,
  getSettlementTokenAddress,
  getSwapPluginIdForChain,
  getSwapPluginKindForChain,
} from '../config/contracts';
import { getRouterAddressFromDeploymentRegistry } from '../config/deploymentRegistry';
import { getRailEnumValue } from '../rails/registry';
import { applyEmpsealRouterFee, encodeEmpsealSwapData } from '../services/empseal/swapData';
import { Rail, SettlementToken } from '../types';

const DEFAULT_CONFIG = {
  intentId: '0x50e1885bd55419344cd41134372d32a3b751e4497fab5857a80853f05d0db0ac',
  srcChainId: 42161,
  dstReceiveTxHash: '0x117b63f46965261f65877479d1fbcc7aff42c4d66a59a6ba633c9ec035300630',
} as const;

const BUILTIN_RPC_URLS: Partial<Record<number, string[]>> = {
  42161: ['https://arb1.arbitrum.io/rpc'],
  8453: ['https://mainnet.base.org'],
  10: ['https://mainnet.optimism.io'],
};

const ROUTER_IFACE = new Interface([
  'event IntentInitiated(bytes32 indexed intentId, address indexed user, address tokenIn, uint256 amountIn, uint32 dstChainId, bytes32 railTxId)',
  'function initiateSwap((address user,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 minSrcSwapOut,uint32 dstChainId,uint8 rail,address routeToken,bytes32 routeAssetId,address expectedDstRouteToken,bytes32 expectedDstRouteAssetId,uint256 minRouteAmount,uint256 feeAmount,bytes swapDataSrc,bytes swapDataDst,bytes32 swapPluginIdSrc,bytes32 dstSwapPluginId,bytes32 railPluginId,bytes railData,uint256 dstGasLimit,address dstReceiver,bytes nativeDstAddress,string thorAssetIdentifier,uint256 minThorOutput,bytes32 intentId,uint256 deadline) intent,bytes signature)',
]);
const EMPSEAL_ROUTER_CALL_INTERFACE = new Interface([
  'function findBestPath(uint256 _amountIn, address _tokenIn, address _tokenOut, uint256 _maxSteps)',
]);
const EMPSEAL_ROUTER_RESULT_INTERFACES = [
  new Interface([
    'function findBestPath(uint256 _amountIn, address _tokenIn, address _tokenOut, uint256 _maxSteps) view returns ((uint256[] amounts, address[] adapters, address[] path))',
  ]),
  new Interface([
    'function findBestPath(uint256 _amountIn, address _tokenIn, address _tokenOut, uint256 _maxSteps) view returns ((uint256[] amounts, address[] path, address[] adapters))',
  ]),
  new Interface([
    'function findBestPath(uint256 _amountIn, address _tokenIn, address _tokenOut, uint256 _maxSteps) view returns ((uint256[] amounts, address[] adapters, address[] path, uint256[] gasEstimates))',
  ]),
  new Interface([
    'function findBestPath(uint256 _amountIn, address _tokenIn, address _tokenOut, uint256 _maxSteps) view returns ((uint256[] amounts, address[] path, address[] adapters, uint256[] gasEstimates))',
  ]),
];
const abiCoder = AbiCoder.defaultAbiCoder();
const ZERO_PLUGIN_ID = '0x0000000000000000000000000000000000000000000000000000000000000000';
const DEFAULT_EMPSEAL_MAX_STEPS = 2n;

const RECEIVER_ABI = [
  'function execute(address settlementToken, uint256 amount, bytes payload) external',
  'function approvedCallers(address caller) external view returns (bool)',
  'function settledIntents(bytes32 intentId) external view returns (bool)',
];

const ERC20_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
];

export interface RecoveryExecution {
  intentId: string;
  dstChainId: number;
  receiver: string;
  payload: string;
}

export interface DecodedReceiverExecutionPayload {
  intentId: string;
  user: string;
  tokenOut: string;
  minAmountOut: bigint;
  expectedRouteToken: string;
  expectedRouteAssetId: string;
  minRouteAmount: bigint;
  swapData: string;
  swapPluginId: string;
}

interface EmpsealSwapPlan {
  amountOut: bigint;
  data: string;
}

export function buildRecoveryExecutionFromSourceTxData(
  txData: string,
  expectedIntentId?: string,
): RecoveryExecution {
  const decoded = ROUTER_IFACE.decodeFunctionData('initiateSwap', txData);
  const intent = decoded[0];
  const railValue = Number(intent.rail);
  if (railValue !== getRailEnumValue(Rail.CCTP)) {
    throw new Error(`expected CCTP rail, got rail=${railValue}`);
  }

  const intentId = String(intent.intentId).toLowerCase();
  if (expectedIntentId && intentId !== expectedIntentId.toLowerCase()) {
    throw new Error(`intent mismatch: expected=${expectedIntentId.toLowerCase()} got=${intentId}`);
  }

  const receiver = ethers.getAddress(String(intent.dstReceiver));
  if (receiver === ZeroAddress) {
    throw new Error(`intent.dstReceiver is zero for ${intentId}`);
  }

  return {
    intentId,
    dstChainId: Number(intent.dstChainId),
    receiver,
    payload: buildReceiverExecutionPayloadFromIntent(intent),
  };
}

export function decodeRecoveryPayload(payload: string): DecodedReceiverExecutionPayload {
  const [
    intentId,
    user,
    tokenOut,
    minAmountOut,
    expectedRouteToken,
    expectedRouteAssetId,
    minRouteAmount,
    swapData,
    swapPluginId,
  ] = abiCoder.decode(
    ['bytes32', 'address', 'address', 'uint256', 'address', 'bytes32', 'uint256', 'bytes', 'bytes32'],
    payload,
  );

  return {
    intentId: String(intentId).toLowerCase(),
    user: ethers.getAddress(String(user)),
    tokenOut: ethers.getAddress(String(tokenOut)),
    minAmountOut: BigInt(minAmountOut),
    expectedRouteToken: ethers.getAddress(String(expectedRouteToken)),
    expectedRouteAssetId: String(expectedRouteAssetId).toLowerCase(),
    minRouteAmount: BigInt(minRouteAmount),
    swapData: String(swapData),
    swapPluginId: String(swapPluginId).toLowerCase(),
  };
}

export function withRecoverySwapData(recovery: RecoveryExecution, swapData: string): RecoveryExecution {
  const decoded = decodeRecoveryPayload(recovery.payload);
  return {
    ...recovery,
    payload: abiCoder.encode(
      ['bytes32', 'address', 'address', 'uint256', 'address', 'bytes32', 'uint256', 'bytes', 'bytes32'],
      [
        decoded.intentId,
        decoded.user,
        decoded.tokenOut,
        decoded.minAmountOut,
        decoded.expectedRouteToken,
        decoded.expectedRouteAssetId,
        decoded.minRouteAmount,
        swapData,
        decoded.swapPluginId,
      ],
    ),
  };
}

export function withDirectDelivery(recovery: RecoveryExecution): RecoveryExecution {
  const decoded = decodeRecoveryPayload(recovery.payload);
  return {
    ...recovery,
    payload: abiCoder.encode(
      ['bytes32', 'address', 'address', 'uint256', 'address', 'bytes32', 'uint256', 'bytes', 'bytes32'],
      [
        decoded.intentId,
        decoded.user,
        decoded.expectedRouteToken,
        decoded.minAmountOut,
        decoded.expectedRouteToken,
        decoded.expectedRouteAssetId,
        decoded.minRouteAmount,
        '0x',
        ZERO_PLUGIN_ID,
      ],
    ),
  };
}

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function loadDotEnv(): void {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const idx = line.indexOf('=');
    if (idx <= 0) continue;

    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) continue;

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function parseArgs(argv: string[]) {
  const options = {
    broadcast: false,
    directUsdc: false,
    intentId: DEFAULT_CONFIG.intentId,
    srcChainId: DEFAULT_CONFIG.srcChainId,
    dstReceiveTxHash: DEFAULT_CONFIG.dstReceiveTxHash,
    srcTxHash: readEnv('SRC_TX_HASH'),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--broadcast') {
      options.broadcast = true;
      continue;
    }
    if (arg === '--direct-usdc') {
      options.directUsdc = true;
      continue;
    }
    if (arg === '--intent-id') {
      options.intentId = String(argv[++i] ?? '').trim();
      continue;
    }
    if (arg === '--src-chain-id') {
      options.srcChainId = Number.parseInt(String(argv[++i] ?? ''), 10);
      continue;
    }
    if (arg === '--dst-receive-tx-hash') {
      options.dstReceiveTxHash = String(argv[++i] ?? '').trim();
      continue;
    }
    if (arg === '--src-tx-hash') {
      options.srcTxHash = String(argv[++i] ?? '').trim();
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  return options;
}

function getRpcCandidates(chainId: number): string[] {
  const candidates = [
    ...(BUILTIN_RPC_URLS[chainId] ?? []),
    readEnv(`CHAIN_${chainId}_RPC_URL`),
    readEnv(`CHAIN_${chainId}_RPC_FALLBACK`),
  ].filter((value): value is string => Boolean(value));

  const unique = [...new Set(candidates)];
  if (unique.length === 0) {
    throw new Error(`missing CHAIN_${chainId}_RPC_URL`);
  }
  return unique;
}

async function resolveSourceTxHash(
  srcProvider: JsonRpcProvider,
  routerAddress: string,
  intentId: string,
): Promise<string> {
  const router = new Contract(routerAddress, ROUTER_IFACE, srcProvider);
  const logs = await router.queryFilter(router.filters.IntentInitiated(intentId));
  if (logs.length === 0) {
    throw new Error(`IntentInitiated not found for intentId=${intentId}`);
  }
  if (logs.length > 1) {
    throw new Error(`multiple IntentInitiated logs found for intentId=${intentId}`);
  }
  return logs[0].transactionHash;
}

async function withProviderCandidates<T>(
  chainId: number,
  task: (provider: JsonRpcProvider, rpcUrl: string) => Promise<T>,
): Promise<T> {
  const errors: string[] = [];
  for (const rpcUrl of getRpcCandidates(chainId)) {
    const provider = new JsonRpcProvider(rpcUrl);
    try {
      return await task(provider, rpcUrl);
    } catch (err) {
      errors.push(`${rpcUrl}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      provider.destroy();
    }
  }
  throw new Error(`all RPC candidates failed for chain ${chainId}\n${errors.join('\n')}`);
}

function decodeEmpsealFormattedOffer(raw: string): { amounts: bigint[]; path: string[]; adapters: string[] } {
  for (const iface of EMPSEAL_ROUTER_RESULT_INTERFACES) {
    try {
      const decoded = iface.decodeFunctionResult('findBestPath', raw)[0];
      const amounts = Array.isArray(decoded.amounts)
        ? decoded.amounts.map((value: bigint) => BigInt(value.toString()))
        : [];
      const path = Array.isArray(decoded.path)
        ? decoded.path.map((value: string) => ethers.getAddress(String(value)))
        : [];
      const adapters = Array.isArray(decoded.adapters)
        ? decoded.adapters.map((value: string) => ethers.getAddress(String(value)))
        : [];
      if (amounts.length >= 2 && path.length >= 2 && adapters.length + 1 === path.length) {
        return { amounts, path, adapters };
      }
    } catch {
      continue;
    }
  }

  throw new Error('Empseal findBestPath decode failed for all known router layouts');
}

async function buildEmpsealSwapPlan(
  chainId: number,
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
): Promise<EmpsealSwapPlan | null> {
  const router = getEmpsealRouterAddressForChain(chainId);
  if (!router || amountIn <= 0n) return null;

  const raw = await withProviderCandidates(chainId, (provider) => provider.call({
    to: router,
    data: EMPSEAL_ROUTER_CALL_INTERFACE.encodeFunctionData('findBestPath', [
      amountIn,
      tokenIn,
      tokenOut,
      DEFAULT_EMPSEAL_MAX_STEPS,
    ]),
  }));

  const offer = decodeEmpsealFormattedOffer(raw);
  const grossAmountOut = offer.amounts[offer.amounts.length - 1];
  if (grossAmountOut <= 0n) return null;
  const feeBps = getEmpsealRouterFeeBpsForChain(chainId);
  const amountOut = applyEmpsealRouterFee(grossAmountOut, feeBps);
  if (amountOut <= 0n) return null;
  const trade = {
    amountIn,
    amountOut: grossAmountOut,
    path: offer.path,
    adapters: offer.adapters,
  };

  return {
    amountOut,
    data: encodeEmpsealSwapData(getSwapPluginIdForChain(chainId), trade, feeBps),
  };
}

async function main(): Promise<void> {
  loadDotEnv();
  const args = parseArgs(process.argv.slice(2));
  const srcRouter =
    readEnv(`CHAIN_${args.srcChainId}_ROUTER_V1`)
    || getRouterAddressFromDeploymentRegistry(args.srcChainId);
  if (!srcRouter) {
    throw new Error(`missing routerV1 config for source chain ${args.srcChainId}`);
  }

  const srcTxHash = args.srcTxHash || await withProviderCandidates(
    args.srcChainId,
    (provider) => resolveSourceTxHash(provider, srcRouter, args.intentId),
  );
  const srcTx = await withProviderCandidates(args.srcChainId, async (provider) => {
    const tx = await provider.getTransaction(srcTxHash);
    if (!tx) throw new Error(`source tx not found: ${srcTxHash}`);
    return tx;
  });

  let recovery = buildRecoveryExecutionFromSourceTxData(srcTx.data, args.intentId);
  const settlementToken = getSettlementTokenAddress(recovery.dstChainId, SettlementToken.USDC, Rail.CCTP);
  if (!settlementToken) {
    throw new Error(`missing CHAIN_${recovery.dstChainId}_TOKEN_CCTP_USDC`);
  }

  const dstProvider = new JsonRpcProvider(getRpcCandidates(recovery.dstChainId)[0]);
  const dstReceipt = await withProviderCandidates(recovery.dstChainId, async (provider) => {
    const receipt = await provider.getTransactionReceipt(args.dstReceiveTxHash);
    if (!receipt) throw new Error(`destination receiveMessage tx not found: ${args.dstReceiveTxHash}`);
    return receipt;
  });

  const mintedAmount = extractReceivedSettlementAmountFromReceipt(
    dstReceipt,
    settlementToken,
    recovery.receiver,
  );
  if (mintedAmount === 0n) {
    throw new Error(`minted amount could not be determined from ${args.dstReceiveTxHash}`);
  }

  const decodedPayload = decodeRecoveryPayload(recovery.payload);
  let fallbackSwapPlan: EmpsealSwapPlan | null = null;
  if (!args.directUsdc && decodedPayload.swapPluginId !== ZERO_PLUGIN_ID && decodedPayload.swapData === '0x') {
    if (getSwapPluginKindForChain(recovery.dstChainId) !== 'EMPSEAL') {
      throw new Error(
        `intent requires destination swap plugin ${decodedPayload.swapPluginId}, but only EMPSEAL fallback hydration is supported by this script`,
      );
    }

    fallbackSwapPlan = await buildEmpsealSwapPlan(
      recovery.dstChainId,
      decodedPayload.expectedRouteToken,
      decodedPayload.tokenOut,
      mintedAmount,
    );
    if (!fallbackSwapPlan) {
      throw new Error(
        `could not rebuild Empseal swap plan for chain=${recovery.dstChainId} tokenIn=${decodedPayload.expectedRouteToken} tokenOut=${decodedPayload.tokenOut}`,
      );
    }
    if (fallbackSwapPlan.amountOut < decodedPayload.minAmountOut) {
      throw new Error(
        `rebuilt Empseal amountOut ${fallbackSwapPlan.amountOut} is below minAmountOut ${decodedPayload.minAmountOut}`,
      );
    }
    recovery = withRecoverySwapData(recovery, fallbackSwapPlan.data);
  }
  if (args.directUsdc) {
    recovery = withDirectDelivery(recovery);
  }

  const receiver = new Contract(recovery.receiver, RECEIVER_ABI, dstProvider);
  const token = new Contract(settlementToken, ERC20_ABI, dstProvider);
  const relayerPk = readEnv('CCTP_RELAYER_PRIVATE_KEY') || readEnv('DEPLOYER_PRIVATE_KEY');
  const receiverBalance = BigInt(await token.balanceOf(recovery.receiver));
  const settled = await receiver.settledIntents(recovery.intentId);

  console.log('Recovery summary:');
  console.log(`  intentId: ${recovery.intentId}`);
  console.log(`  srcChainId: ${args.srcChainId}`);
  console.log(`  srcTxHash: ${srcTxHash}`);
  console.log(`  dstChainId: ${recovery.dstChainId}`);
  console.log(`  dstReceiveTxHash: ${args.dstReceiveTxHash}`);
  console.log(`  receiver: ${recovery.receiver}`);
  console.log(`  settlementToken: ${settlementToken}`);
  console.log(`  mintedAmount: ${mintedAmount.toString()}`);
  console.log(`  receiverBalance: ${receiverBalance.toString()}`);
  console.log(`  settled: ${String(settled)}`);
  console.log(`  hasDstSwap: ${String(decodedPayload.swapPluginId !== ZERO_PLUGIN_ID)}`);
  console.log(`  recoveredSwapData: ${String(fallbackSwapPlan !== null)}`);
  console.log(`  directUsdc: ${String(args.directUsdc)}`);
  if (fallbackSwapPlan) {
    console.log(`  rebuiltDstSwapAmountOut: ${fallbackSwapPlan.amountOut.toString()}`);
  }

  if (settled) {
    console.log('Intent already settled; no action required.');
    return;
  }
  if (receiverBalance < mintedAmount) {
    throw new Error(`receiver balance ${receiverBalance} is below minted amount ${mintedAmount}`);
  }
  if (!relayerPk) {
    throw new Error('missing CCTP_RELAYER_PRIVATE_KEY/DEPLOYER_PRIVATE_KEY');
  }

  const signer = new Wallet(relayerPk, dstProvider);
  const approved = await receiver.approvedCallers(signer.address);
  console.log(`  signer: ${signer.address}`);
  console.log(`  approvedCaller: ${String(approved)}`);
  if (!approved) {
    throw new Error(`receiver does not approve signer ${signer.address}`);
  }

  if (!args.broadcast) {
    console.log('Dry run only. Re-run with --broadcast to execute ReceiverV1.execute(...).');
    return;
  }

  const signedReceiver = receiver.connect(signer);
  const tx = await signedReceiver.execute(settlementToken, mintedAmount, recovery.payload);
  console.log(`broadcast txHash: ${tx.hash}`);
  const rcpt = await tx.wait();
  console.log(`status: ${rcpt?.status === 1 ? 'success' : 'failed'}`);
  console.log(`blockNumber: ${rcpt?.blockNumber ?? 'unknown'}`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((err) => {
    console.error(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
}
