#!/usr/bin/env node

const { Contract, Interface, JsonRpcProvider, Wallet } = require('ethers');

/**
 * Minimal manual tx sender.
 *
 * 1) Paste config values below.
 * 2) Run: node src/vps/scripts/sendManualTx.js
 */

const RPC_URL = 'https://arbitrum-sepolia-testnet.api.pocket.network';
const PRIVATE_KEY = '';

const TO = '0x233f82f89333c74bedd2325fd8ca140ffc63ed9e';
const DATA = '0xa97e15e100000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000b148ea5f936a28661e11743b1650193f1b14a2322b9541503bf6815a84a1a6e900000000000000000000000005f8cc8753d90d67dbb8c02118440b8283f941c900000000000000000000000075faf114eafb1bdbe2f0316df893fd58ce46aa4d000000000000000000000000036cbd53842c5426634e7929541ec2318f3dcf7e00000000000000000000000000000000000000000000000000000000001e848000000000000000000000000000000000000000000000000000000000001e366000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000014a34000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004e2000000000000000000000000000000000000000000000000000000000000002600000000000000000000000000000000000000000000000000000000000000280000000000000000000000000000000000000000000000000000000000000000000000000000000000000000094f41058563e46c27aba75ab592752cc09061c6e00000000000000000000000000000000000000000000000000000000000002a000000000000000000000000000000000000000000000000000000000000002c0000000000000000000000000000000000000000000000000000000000000000025f0e7119dc3f54c09997940fc70ff2073311948fb00f7c92fd0a13fca65e34e0000000000000000000000000000000000000000000000000000000069e263ea0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
const VALUE_WEI = '0';

// Set a gas limit explicitly to bypass estimateGas failures.
const GAS_LIMIT = '1200000';

// Set true to only print checks and tx payload without sending.
const DRY_RUN = false;

const ROUTER_IFACE = new Interface([
  'function initiateSwap((address user,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 minSrcSwapOut,uint32 dstChainId,uint8 rail,uint8 settlementToken,uint256 feeAmount,bytes swapDataSrc,bytes swapDataDst,bytes32 swapPluginIdSrc,bytes32 dstSwapPluginId,bytes32 railPluginId,bytes railData,address dstReceiver,bytes nativeDstAddress,string thorAssetIdentifier,uint256 minThorOutput,bytes32 intentId,uint256 deadline) intent)',
]);

const ROUTER_LEGACY_IFACE = new Interface([
  'function initiateSwap((address user,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 minSrcSwapOut,uint32 dstChainId,uint8 rail,uint8 settlementToken,uint256 feeAmount,bytes swapDataSrc,bytes swapDataDst,bytes32 dstSwapPluginId,address dstReceiver,bytes nativeDstAddress,string thorAssetIdentifier,uint256 minThorOutput,bytes32 intentId,uint256 deadline) intent,bytes32 swapPluginId,bytes32 railPluginId)',
]);

const ROUTER_ERRORS_IFACE = new Interface([
  'error IntentExpired(bytes32 intentId)',
  'error IntentDeadlineTooFar(bytes32 intentId)',
  'error IntentAlreadyExecuted(bytes32 intentId)',
  'error FeeTooHigh(uint256 feeAmount, uint256 maxAllowed)',
  'error ZeroAmount()',
  'error AmountBelowMinimum(uint256 amount, uint256 minimum)',
  'error ZeroAddress(string field)',
  'error SrcSwapSlippage(uint256 got, uint256 min)',
]);

const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

function loadDotEnv() {
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

function requireValue(label, v) {
  if (typeof v !== 'string' || v.trim() === '') {
    throw new Error(`missing ${label}. Set it in .env or export it before running this script.`);
  }
}

function assertPrivateKey(v) {
  if (typeof v !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(v)) {
    throw new Error('PRIVATE_KEY must be a 0x-prefixed 64-hex string');
  }
}

function assertAddress(label, v) {
  if (typeof v !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(v)) {
    throw new Error(`${label} must be a 0x-prefixed 40-hex address`);
  }
}

function assertHexData(v) {
  if (typeof v !== 'string' || !/^0x[0-9a-fA-F]*$/.test(v) || v.length % 2 !== 0) {
    throw new Error('DATA must be valid 0x hex bytes');
  }
}

function extractRevertData(err) {
  if (!err) return undefined;
  const candidates = [
    err.data,
    err.error && err.error.data,
    err.info && err.info.error && err.info.error.data,
    err.info && err.info.data,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && /^0x[0-9a-fA-F]+$/.test(candidate)) return candidate;
  }
  return undefined;
}

function describeRouterCustomError(revertData) {
  if (!revertData) return null;
  try {
    const decoded = ROUTER_ERRORS_IFACE.parseError(revertData);
    if (!decoded) return null;

    switch (decoded.name) {
      case 'IntentExpired':
        return `RouterV1.IntentExpired: intentId=${decoded.args.intentId}. Regenerate quote/calldata and resend.`;
      case 'IntentDeadlineTooFar':
        return `RouterV1.IntentDeadlineTooFar: intentId=${decoded.args.intentId}.`;
      case 'IntentAlreadyExecuted':
        return `RouterV1.IntentAlreadyExecuted: intentId=${decoded.args.intentId}.`;
      case 'FeeTooHigh':
        return `RouterV1.FeeTooHigh: feeAmount=${decoded.args.feeAmount.toString()}, maxAllowed=${decoded.args.maxAllowed.toString()}.`;
      case 'AmountBelowMinimum':
        return `RouterV1.AmountBelowMinimum: amountIn=${decoded.args.amount.toString()}, minimum=${decoded.args.minimum.toString()}.`;
      case 'ZeroAddress':
        return `RouterV1.ZeroAddress: field=${decoded.args.field}.`;
      case 'SrcSwapSlippage':
        return `RouterV1.SrcSwapSlippage: got=${decoded.args.got.toString()}, min=${decoded.args.min.toString()}.`;
      default:
        return `RouterV1.${decoded.name}`;
    }
  } catch {
    return null;
  }
}

async function tryDecodeAndCheckAllowance(provider, wallet) {
  try {
    const intent = decodeRouterIntent(DATA);

    const tokenIn = intent.tokenIn;
    const amountIn = BigInt(intent.amountIn.toString());
    const feeAmount = BigInt(intent.feeAmount.toString());
    const amountAfterFee = amountIn - feeAmount;
    const deadline = Number(intent.deadline.toString());
    const now = Math.floor(Date.now() / 1000);

    console.log('\nDecoded RouterV1 intent:');
    console.log(`  tokenIn: ${tokenIn}`);
    console.log(`  amountIn(raw): ${amountIn.toString()}`);
    console.log(`  feeAmount(raw): ${feeAmount.toString()}`);
    console.log(`  amountAfterFee(raw): ${amountAfterFee.toString()}`);
    console.log(`  deadline: ${deadline} (in ${deadline - now}s)`);

    if (deadline < now) {
      throw new Error(`RouterV1.IntentExpired: regenerate quote/calldata before sending (deadline=${deadline}, now=${now}).`);
    }
    if (deadline > now + (30 * 60)) {
      throw new Error(`RouterV1.IntentDeadlineTooFar: deadline exceeds RouterV1 max window (deadline=${deadline}, now=${now}).`);
    }

    if (/^0x[0-9a-fA-F]{40}$/.test(tokenIn)) {
      const erc20 = new Contract(tokenIn, ERC20_ABI, provider);
      const [symbol, decimals, balance, allowance] = await Promise.all([
        erc20.symbol().catch(() => 'TOKEN'),
        erc20.decimals().catch(() => 18),
        erc20.balanceOf(wallet.address),
        erc20.allowance(wallet.address, TO),
      ]);

      console.log('\nToken checks:');
      console.log(`  token: ${tokenIn} (${symbol}, decimals=${decimals})`);
      console.log(`  wallet balance(raw): ${balance.toString()}`);
      console.log(`  allowance to spender(raw): ${allowance.toString()}`);

      if (balance < amountIn) {
        console.log('  WARNING: balance < amountIn (tx will revert).');
      }
      if (allowance < amountIn) {
        console.log('  WARNING: allowance < amountIn (tx will revert).');
      }
    }
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    if (msg.startsWith('RouterV1.')) throw err;
    console.log('\nDATA is not RouterV1 initiateSwap calldata (skipping decode/check).');
  }
}

function decodeRouterIntent(calldataHex) {
  try {
    return ROUTER_IFACE.decodeFunctionData('initiateSwap', calldataHex).intent;
  } catch {
    return ROUTER_LEGACY_IFACE.decodeFunctionData('initiateSwap', calldataHex).intent;
  }
}

async function preflightCall(provider, wallet, txReq) {
  try {
    await provider.call({
      ...txReq,
      from: wallet.address,
    });
  } catch (err) {
    const revertData = extractRevertData(err);
    const decoded = describeRouterCustomError(revertData);
    if (decoded) {
      throw new Error(`${decoded}${revertData ? ` (revertData=${revertData})` : ''}`);
    }
    throw err;
  }
}

async function main() {
  requireValue('DEPLOYER_PRIVATE_KEY', PRIVATE_KEY);
  requireValue('TX_DATA', DATA);
  requireValue('TX_TO, CHAIN_84532_ROUTER_V1, or ROUTER_V1', TO);

  assertPrivateKey(PRIVATE_KEY);
  assertAddress('TO', TO);
  assertHexData(DATA);

  const value = BigInt(VALUE_WEI);
  const gasLimit = BigInt(GAS_LIMIT);

  const provider = new JsonRpcProvider(RPC_URL);
  const wallet = new Wallet(PRIVATE_KEY, provider);

  const network = await provider.getNetwork();
  console.log(`network chainId: ${network.chainId.toString()}`);
  console.log(`from: ${wallet.address}`);
  console.log(`to: ${TO}`);
  console.log(`value(wei): ${value.toString()}`);
  console.log(`gasLimit: ${gasLimit.toString()}`);
  console.log(`dataBytes: ${(DATA.length - 2) / 2}`);

  await tryDecodeAndCheckAllowance(provider, wallet);

  if (DRY_RUN) {
    console.log('\nDRY_RUN=true, not broadcasting.');
    return;
  }

  const txReq = {
    to: TO,
    data: DATA,
    value,
    gasLimit,
  };

  await preflightCall(provider, wallet, txReq);

  const tx = await wallet.sendTransaction(txReq);
  console.log(`\ntxHash: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`status: ${receipt && receipt.status === 1 ? 'success' : 'reverted'}`);
  console.log(`blockNumber: ${receipt ? receipt.blockNumber : 'n/a'}`);
}

main().catch((err) => {
  console.error(`ERROR: ${err.message || String(err)}`);
  process.exit(1);
});
