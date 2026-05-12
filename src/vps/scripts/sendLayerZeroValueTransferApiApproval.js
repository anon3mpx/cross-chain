#!/usr/bin/env node

const { Contract, Interface, JsonRpcProvider, Wallet, formatUnits, isAddress } = require('ethers');

// Replace these values from the LayerZero Value Transfer API approve userStep.
const RPC_URL = 'https://mainnet.base.org';
const EXPECTED_CHAIN_ID = 8453;
const PRIVATE_KEY = '';
const OWNER_ADDRESS = '';
const TOKEN_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const SPENDER_ADDRESS = '0x0000000000000000000000000000000000000000';
const AMOUNT_RAW = '100000000';

// Keep true until you have reviewed the printed transaction payload.
const DRY_RUN = true;

const ERC20_ABI = [
  'function approve(address spender,uint256 amount) returns (bool)',
  'function allowance(address owner,address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

function requireValue(name, value) {
  if (!value) {
    throw new Error(`${name} is required`);
  }
}

function requireAddress(name, value) {
  if (!isAddress(value)) {
    throw new Error(`${name} must be an EVM address`);
  }
}

function isZeroAddress(value) {
  return /^0x0{40}$/i.test(value);
}

async function main() {
  requireValue('RPC_URL', RPC_URL);
  if (!DRY_RUN) {
    requireValue('PRIVATE_KEY', PRIVATE_KEY);
  }
  requireAddress('TOKEN_ADDRESS', TOKEN_ADDRESS);
  requireAddress('SPENDER_ADDRESS', SPENDER_ADDRESS);
  if (!DRY_RUN && isZeroAddress(SPENDER_ADDRESS)) {
    throw new Error('SPENDER_ADDRESS must be replaced before broadcasting');
  }
  if (OWNER_ADDRESS) {
    requireAddress('OWNER_ADDRESS', OWNER_ADDRESS);
  }

  const amount = BigInt(AMOUNT_RAW);
  if (amount <= 0n) {
    throw new Error('AMOUNT_RAW must be greater than zero');
  }

  const provider = new JsonRpcProvider(RPC_URL);
  const network = await provider.getNetwork();
  if (EXPECTED_CHAIN_ID && network.chainId !== BigInt(EXPECTED_CHAIN_ID)) {
    throw new Error(`wrong RPC chain: expected ${EXPECTED_CHAIN_ID}, got ${network.chainId.toString()}`);
  }

  const wallet = PRIVATE_KEY ? new Wallet(PRIVATE_KEY, provider) : null;
  const ownerAddress = wallet?.address ?? OWNER_ADDRESS;
  const token = new Contract(TOKEN_ADDRESS, ERC20_ABI, provider);
  const erc20 = new Interface(ERC20_ABI);

  const [symbol, decimals, allowanceBefore] = await Promise.all([
    token.symbol().catch(() => 'TOKEN'),
    token.decimals().catch(() => 0),
    ownerAddress ? token.allowance(ownerAddress, SPENDER_ADDRESS) : Promise.resolve(null),
  ]);

  const txRequest = {
    to: TOKEN_ADDRESS,
    data: erc20.encodeFunctionData('approve', [SPENDER_ADDRESS, amount]),
    value: '0',
  };

  console.log('LayerZero Value Transfer API approval');
  console.log(`chainId: ${network.chainId.toString()}`);
  console.log(`owner: ${ownerAddress || '<not set - dry run>'}`);
  console.log(`token: ${TOKEN_ADDRESS} (${symbol})`);
  console.log(`spender: ${SPENDER_ADDRESS}`);
  console.log(`amountRaw: ${amount.toString()}`);
  console.log(`amountFormatted: ${formatUnits(amount, decimals)}`);
  console.log(`allowanceBeforeRaw: ${allowanceBefore?.toString() ?? '<not checked>'}`);
  console.log('txRequest:', JSON.stringify(txRequest, null, 2));

  if (DRY_RUN) {
    console.log('DRY_RUN=true, not broadcasting. Set DRY_RUN=false to send.');
    return;
  }

  if (!wallet) {
    throw new Error('PRIVATE_KEY is required to broadcast');
  }
  const tx = await wallet.sendTransaction(txRequest);
  console.log(`submitted: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`confirmed: status=${receipt?.status} block=${receipt?.blockNumber}`);

  const allowanceAfter = await token.allowance(wallet.address, SPENDER_ADDRESS);
  console.log(`allowanceAfterRaw: ${allowanceAfter.toString()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
