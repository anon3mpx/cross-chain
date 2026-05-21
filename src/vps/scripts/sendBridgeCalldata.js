#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Interface, JsonRpcProvider, Wallet } = require('ethers');

const ROUTER_INITIATE_IFACE = new Interface([
  'function initiateSwap((address user,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 minSrcSwapOut,uint32 dstChainId,uint8 rail,address routeToken,bytes32 routeAssetId,address expectedDstRouteToken,bytes32 expectedDstRouteAssetId,uint256 minRouteAmount,uint256 feeAmount,bytes swapDataSrc,bytes swapDataDst,bytes32 swapPluginIdSrc,bytes32 dstSwapPluginId,bytes32 railPluginId,bytes railData,uint256 dstGasLimit,address dstReceiver,bytes nativeDstAddress,string thorAssetIdentifier,uint256 minThorOutput,bytes32 intentId,uint256 deadline) intent,bytes signature)',
]);

const ROUTER_INITIATE_LEGACY_IFACE = new Interface([
  'function initiateSwap((address user,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 minSrcSwapOut,uint32 dstChainId,uint8 rail,uint8 settlementToken,uint256 feeAmount,bytes swapDataSrc,bytes swapDataDst,bytes32 dstSwapPluginId,address dstReceiver,bytes nativeDstAddress,string thorAssetIdentifier,uint256 minThorOutput,bytes32 intentId,uint256 deadline) intent,bytes32 swapPluginId,bytes32 railPluginId)',
]);

const ROUTER_ERRORS_IFACE = new Interface([
  'error IntentExpired(bytes32 intentId)',
  'error IntentDeadlineTooFar(bytes32 intentId)',
  'error IntentAlreadyExecuted(bytes32 intentId)',
  'error InvalidIntentSignature()',
  'error FeeTooHigh(uint256 feeAmount, uint256 maxAllowed)',
  'error ZeroAmount()',
  'error AmountBelowMinimum(uint256 amount, uint256 minimum)',
  'error ZeroAddress(string field)',
  'error SrcSwapSlippage(uint256 got, uint256 min)',
]);

const PLUGIN_REGISTRY_ERRORS_IFACE = new Interface([
  'error PluginNotFound(bytes32 pluginId)',
  'error PluginNotActive(bytes32 pluginId)',
]);

const AXELAR_ERRORS_IFACE = new Interface([
  'error UnsupportedRoute(uint32 dstChainId)',
  'error ReceiverNotConfigured(uint32 dstChainId)',
  'error DestinationTokenNotConfigured(uint32 dstChainId)',
  'error RouteTokenMismatch(address provided, address expected)',
  'error EmptyDestinationCalldata()',
  'error InsufficientGasPayment(uint256 provided, uint256 required)',
  'error InterchainTokenServiceMismatch(address tokenService, address expectedService)',
]);

const LAYERZERO_ERRORS_IFACE = new Interface([
  'error UnsupportedRoute(uint32 dstChainId)',
  'error ReceiverNotConfigured(uint32 dstChainId)',
  'error RouteTokenMismatch(address provided, address expected)',
  'error InsufficientNativeFee(uint256 provided, uint256 required)',
  'error UnsupportedLzTokenFee(uint256 lzTokenFee)',
]);

function parseArgs(argv) {
  const args = {
    file: 'docs/root-notes/bridge-calldata.md',
    index: 0,
    value: undefined,
    to: undefined,
    data: undefined,
    rpcUrl: process.env.RPC_URL,
    privateKey: process.env.DEPLOYER_PRIVATE_KEY,
    dryRun: false,
    forceExpired: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = argv[i + 1];

    if (a === '--file' && next) {
      args.file = next;
      i += 1;
    } else if (a === '--index' && next) {
      args.index = Number(next);
      i += 1;
    } else if (a === '--to' && next) {
      args.to = next;
      i += 1;
    } else if (a === '--data' && next) {
      args.data = next;
      i += 1;
    } else if (a === '--value' && next) {
      args.value = next;
      i += 1;
    } else if (a === '--rpc-url' && next) {
      args.rpcUrl = next;
      i += 1;
    } else if (a === '--private-key' && next) {
      args.privateKey = next;
      i += 1;
    } else if (a === '--dry-run') {
      args.dryRun = true;
    } else if (a === '--force-expired') {
      args.forceExpired = true;
    } else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node src/vps/scripts/sendBridgeCalldata.js [options]

Options:
  --file <path>         Markdown/notes file containing quote response (default: docs/root-notes/bridge-calldata.md)
  --index <n>           Which integration payload to use from file (default: 0)
  --to <address>        Override destination contract address
  --data <hex>          Override calldata
  --value <wei>         Override tx value in wei (decimal)
  --rpc-url <url>       Override RPC URL (default: env RPC_URL)
  --private-key <hex>   Override signer key (default: env DEPLOYER_PRIVATE_KEY)
  --dry-run             Print selected tx payload without broadcasting
  --force-expired       Allow sending even if integration expiresAt is in the past
  -h, --help            Show help

Examples:
  node src/vps/scripts/sendBridgeCalldata.js --dry-run
  node src/vps/scripts/sendBridgeCalldata.js --index 1
  node src/vps/scripts/sendBridgeCalldata.js --to 0x... --data 0x... --value 0
`);
}

function isHexData(v) {
  return typeof v === 'string' && /^0x[0-9a-fA-F]*$/.test(v) && v.length % 2 === 0;
}

function isAddress(v) {
  return typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);
}

function extractIntegrations(markdownText) {
  const entries = [];
  const re = /"integration"\s*:\s*\{\s*"contractAddress"\s*:\s*"(0x[0-9a-fA-F]{40})"\s*,\s*"calldata"\s*:\s*"(0x[0-9a-fA-F]*)"\s*,\s*"value"\s*:\s*"([0-9]+)"\s*,\s*"expiresAt"\s*:\s*([0-9]+)\s*\}/g;

  let m;
  while ((m = re.exec(markdownText)) !== null) {
    entries.push({
      contractAddress: m[1],
      calldata: m[2],
      value: m[3],
      expiresAt: Number(m[4]),
    });
  }

  return entries;
}

function pickPayload(args) {
  const hasOverrides = !!(args.to || args.data || args.value);
  if (hasOverrides) {
    if (!args.to || !args.data) {
      throw new Error('--to and --data are both required when overriding payload');
    }
    return {
      contractAddress: args.to,
      calldata: args.data,
      value: args.value ?? '0',
      expiresAt: undefined,
      source: 'cli-overrides',
    };
  }

  const filePath = path.resolve(process.cwd(), args.file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`file not found: ${filePath}`);
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const integrations = extractIntegrations(text);
  if (integrations.length === 0) {
    throw new Error('no integration payloads found in file');
  }
  if (!Number.isInteger(args.index) || args.index < 0 || args.index >= integrations.length) {
    throw new Error(`--index must be between 0 and ${integrations.length - 1}`);
  }

  return {
    ...integrations[args.index],
    source: `${filePath}#${args.index}`,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const payload = pickPayload(args);

  if (!isAddress(payload.contractAddress)) {
    throw new Error(`invalid to address: ${payload.contractAddress}`);
  }
  if (!isHexData(payload.calldata)) {
    throw new Error('invalid calldata hex');
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.expiresAt && now > payload.expiresAt && !args.forceExpired && !args.dryRun) {
    throw new Error(`payload expired at ${payload.expiresAt} (now=${now}). Pass --force-expired to override.`);
  }

  const txRequest = {
    to: payload.contractAddress,
    data: payload.calldata,
    value: BigInt(payload.value ?? '0'),
  };

  preflightRouterIntent(txRequest.data);

  console.log('Selected payload:');
  console.log(`  source: ${payload.source}`);
  console.log(`  to: ${txRequest.to}`);
  console.log(`  value: ${txRequest.value.toString()} wei`);
  console.log(`  dataBytes: ${(txRequest.data.length - 2) / 2}`);
  if (payload.expiresAt) {
    console.log(`  expiresAt: ${payload.expiresAt} (now=${now})`);
  }

  if (args.dryRun) {
    console.log('\nDry run only. No transaction broadcast.');
    return;
  }

  if (!args.rpcUrl) {
    throw new Error('missing RPC URL. Set RPC_URL or pass --rpc-url');
  }
  if (!args.privateKey) {
    throw new Error('missing private key. Set DEPLOYER_PRIVATE_KEY or pass --private-key');
  }

  const provider = new JsonRpcProvider(args.rpcUrl);
  const wallet = new Wallet(args.privateKey, provider);

  console.log(`\nBroadcasting from ${wallet.address} ...`);
  const tx = await wallet.sendTransaction(txRequest);
  console.log(`txHash: ${tx.hash}`);

  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error('no receipt returned');
  }

  console.log(`status: ${receipt.status === 1 ? 'success' : 'reverted'}`);
  console.log(`blockNumber: ${receipt.blockNumber}`);
}

function extractRevertData(err) {
  if (!err) return undefined;
  const candidates = [
    err.data,
    err.error && err.error.data,
    err.info && err.info.error && err.info.error.data,
    err.info && err.info.data,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && /^0x[0-9a-fA-F]+$/.test(c)) return c;
  }
  const msg = String(err.message || '');
  const m = msg.match(/data=\"(0x[0-9a-fA-F]+)\"/);
  return m ? m[1] : undefined;
}

function describeRouterCustomError(revertData) {
  if (!revertData) return null;
  try {
    const decoded = ROUTER_ERRORS_IFACE.parseError(revertData);
    if (!decoded) return null;

    switch (decoded.name) {
      case 'AmountBelowMinimum': {
        const amount = decoded.args.amount.toString();
        const minimum = decoded.args.minimum.toString();
        return `RouterV1.AmountBelowMinimum: amountIn=${amount}, minimum=${minimum}. Increase amountIn (for 6-decimal USDC, minimum is 1000000 = 1 USDC).`;
      }
      case 'FeeTooHigh': {
        const feeAmount = decoded.args.feeAmount.toString();
        const maxAllowed = decoded.args.maxAllowed.toString();
        return `RouterV1.FeeTooHigh: feeAmount=${feeAmount}, maxAllowed=${maxAllowed}.`;
      }
      case 'IntentExpired':
        return `RouterV1.IntentExpired: intentId=${decoded.args.intentId}. Regenerate quote and calldata.`;
      case 'IntentDeadlineTooFar':
        return `RouterV1.IntentDeadlineTooFar: intentId=${decoded.args.intentId}.`;
      case 'IntentAlreadyExecuted':
        return `RouterV1.IntentAlreadyExecuted: intentId=${decoded.args.intentId}.`;
      case 'InvalidIntentSignature':
        return 'RouterV1.InvalidIntentSignature: the calldata does not match the Router intent signer. Regenerate the quote/integration.';
      case 'ZeroAddress':
        return `RouterV1.ZeroAddress: field=${decoded.args.field}.`;
      case 'SrcSwapSlippage': {
        const got = decoded.args.got.toString();
        const min = decoded.args.min.toString();
        return `RouterV1.SrcSwapSlippage: got=${got}, min=${min}.`;
      }
      default:
        return `RouterV1.${decoded.name}`;
    }
  } catch {
    return null;
  }
}

function describeKnownCustomError(revertData) {
  return (
    describeRouterCustomError(revertData) ||
    describeRegistryCustomError(revertData) ||
    describeAxelarCustomError(revertData) ||
    describeLayerZeroCustomError(revertData)
  );
}

function describeRegistryCustomError(revertData) {
  if (!revertData) return null;
  try {
    const decoded = PLUGIN_REGISTRY_ERRORS_IFACE.parseError(revertData);
    if (!decoded) return null;
    if (decoded.name === 'PluginNotFound') {
      return `PluginRegistry.PluginNotFound: pluginId=${decoded.args.pluginId}.`;
    }
    if (decoded.name === 'PluginNotActive') {
      return `PluginRegistry.PluginNotActive: pluginId=${decoded.args.pluginId}.`;
    }
    return `PluginRegistry.${decoded.name}`;
  } catch {
    return null;
  }
}

function describeAxelarCustomError(revertData) {
  if (!revertData) return null;
  try {
    const decoded = AXELAR_ERRORS_IFACE.parseError(revertData);
    if (!decoded) return null;
    switch (decoded.name) {
      case 'InsufficientGasPayment':
        return `AxelarRailPlugin.InsufficientGasPayment: provided=${decoded.args.provided.toString()}, required=${decoded.args.required.toString()}. The Router tx value must cover Axelar source gas.`;
      case 'UnsupportedRoute':
        return `AxelarRailPlugin.UnsupportedRoute: dstChainId=${decoded.args.dstChainId.toString()}.`;
      case 'ReceiverNotConfigured':
        return `AxelarRailPlugin.ReceiverNotConfigured: dstChainId=${decoded.args.dstChainId.toString()}.`;
      case 'DestinationTokenNotConfigured':
        return `AxelarRailPlugin.DestinationTokenNotConfigured: dstChainId=${decoded.args.dstChainId.toString()}.`;
      case 'RouteTokenMismatch':
        return `AxelarRailPlugin.RouteTokenMismatch: provided=${decoded.args.provided}, expected=${decoded.args.expected}.`;
      case 'EmptyDestinationCalldata':
        return 'AxelarRailPlugin.EmptyDestinationCalldata: dstCalldata is required for Axelar receiver execution.';
      case 'InterchainTokenServiceMismatch':
        return `AxelarRailPlugin.InterchainTokenServiceMismatch: tokenService=${decoded.args.tokenService}, expected=${decoded.args.expectedService}.`;
      default:
        return `AxelarRailPlugin.${decoded.name}`;
    }
  } catch {
    return null;
  }
}

function describeLayerZeroCustomError(revertData) {
  if (!revertData) return null;
  try {
    const decoded = LAYERZERO_ERRORS_IFACE.parseError(revertData);
    if (!decoded) return null;
    switch (decoded.name) {
      case 'InsufficientNativeFee':
        return `LayerZeroRailPlugin.InsufficientNativeFee: provided=${decoded.args.provided.toString()}, required=${decoded.args.required.toString()}.`;
      case 'UnsupportedRoute':
        return `LayerZeroRailPlugin.UnsupportedRoute: dstChainId=${decoded.args.dstChainId.toString()}.`;
      case 'ReceiverNotConfigured':
        return `LayerZeroRailPlugin.ReceiverNotConfigured: dstChainId=${decoded.args.dstChainId.toString()}.`;
      case 'RouteTokenMismatch':
        return `LayerZeroRailPlugin.RouteTokenMismatch: provided=${decoded.args.provided}, expected=${decoded.args.expected}.`;
      case 'UnsupportedLzTokenFee':
        return `LayerZeroRailPlugin.UnsupportedLzTokenFee: lzTokenFee=${decoded.args.lzTokenFee.toString()}.`;
      default:
        return `LayerZeroRailPlugin.${decoded.name}`;
    }
  } catch {
    return null;
  }
}

function preflightRouterIntent(calldataHex) {
  try {
    const intent = decodeRouterIntent(calldataHex);
    const amountIn = BigInt(intent.amountIn.toString());
    const feeAmount = BigInt(intent.feeAmount.toString());
    const amountAfterFee = amountIn - feeAmount;
    const rail = Number(intent.rail);
    const deadline = Number(intent.deadline);
    const now = Math.floor(Date.now() / 1000);

    // 0 = CCTP in current Router enum.
    if (rail === 0 && amountAfterFee < 1_000_000n) {
      throw new Error(
        `preflight: CCTP amount after fee is ${amountAfterFee.toString()} (< 1000000). ` +
        'Use a larger amountIn; for 6-decimal USDC a safe minimum is >= 1010101.',
      );
    }

    if (deadline - now <= 10) {
      console.warn(
        `WARNING: intent deadline is very close (${deadline - now}s). ` +
        'Regenerate quote/calldata to avoid IntentExpired.',
      );
    }
  } catch (e) {
    // If this is not RouterV1 calldata, skip preflight silently.
    const msg = String((e && e.message) || e);
    if (msg.startsWith('preflight:')) throw e;
  }
}

function decodeRouterIntent(calldataHex) {
  try {
    return ROUTER_INITIATE_IFACE.decodeFunctionData('initiateSwap', calldataHex).intent;
  } catch {
    return ROUTER_INITIATE_LEGACY_IFACE.decodeFunctionData('initiateSwap', calldataHex).intent;
  }
}

main().catch((err) => {
  const revertData = extractRevertData(err);
  const decoded = describeKnownCustomError(revertData);
  if (decoded) {
    console.error(`ERROR: ${decoded}`);
    if (revertData) console.error(`revertData: ${revertData}`);
    process.exit(1);
  }
  console.error(`ERROR: ${err.message || String(err)}`);
  process.exit(1);
});
