#!/usr/bin/env node

const { Contract, Interface, JsonRpcProvider, Wallet } = require('ethers');

/**
 * Minimal manual tx sender.
 *
 * 1) Paste config values below.
 * 2) Run: node src/vps/scripts/sendManualTx.js
 */

const RPC_URL = 'https://sepolia.base.org';
const PRIVATE_KEY = '';

const TO = '0x44733101c97a41e7f14c995bd212c8d455606751';
const DATA = '0xa97e15e100000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000b148ea5f936a28661e11743b1650193f1b14a2322b9541503bf6815a84a1a6e900000000000000000000000005f8cc8753d90d67dbb8c02118440b8283f941c9000000000000000000000000036cbd53842c5426634e7929541ec2318f3dcf7e00000000000000000000000075faf114eafb1bdbe2f0316df893fd58ce46aa4d00000000000000000000000000000000000000000000000000000000001e848000000000000000000000000000000000000000000000000000000000001e0fb400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000066eee000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004e20000000000000000000000000000000000000000000000000000000000000026000000000000000000000000000000000000000000000000000000000000002800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000b2abe546163021d539e4cc991354c29a124b38ce00000000000000000000000000000000000000000000000000000000000002a000000000000000000000000000000000000000000000000000000000000002c00000000000000000000000000000000000000000000000000000000000000000d70bf26451cf6e5adbca791f47d878fa0c93f920ca024debb0ec681b1834d7eb0000000000000000000000000000000000000000000000000000000069dfa0c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
const VALUE_WEI = '0';

// Set a gas limit explicitly to bypass estimateGas failures.
const GAS_LIMIT = '1200000';

// Set true to only print checks and tx payload without sending.
const DRY_RUN = false;

const ROUTER_IFACE = new Interface([
  'function initiateSwap((address user,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 minSrcSwapOut,uint32 dstChainId,uint8 rail,uint8 settlementToken,uint256 feeAmount,bytes swapDataSrc,bytes swapDataDst,bytes32 dstSwapPluginId,address dstReceiver,bytes nativeDstAddress,string thorAssetIdentifier,uint256 minThorOutput,bytes32 intentId,uint256 deadline) intent,bytes32 swapPluginId,bytes32 railPluginId)',
]);

const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

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

async function tryDecodeAndCheckAllowance(provider, wallet) {
  try {
    const decoded = ROUTER_IFACE.decodeFunctionData('initiateSwap', DATA);
    const intent = decoded.intent;

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
  } catch {
    console.log('\nDATA is not RouterV1 initiateSwap calldata (skipping decode/check).');
  }
}

async function main() {
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
