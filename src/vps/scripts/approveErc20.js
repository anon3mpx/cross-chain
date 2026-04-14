#!/usr/bin/env node

const { Contract, JsonRpcProvider, Wallet } = require('ethers');

/**
 * Minimal ERC20 approval sender.
 * Paste values below and run:
 *   node src/vps/scripts/approveErc20.js
 */

const RPC_URL = 'https://sepolia.base.org';
const PRIVATE_KEY = '';
const TOKEN_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // USDC on Base Sepolia
const SPENDER_ADDRESS = '0xd11bd7b46f10477fe61134fddd6538a383f8978e'; // Router on Base Sepolia (for approving router to pull tokens for CCTP test route)
const AMOUNT_RAW = '10000000'; // raw units (USDC 1.0 = 1000000)

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function symbol() external view returns (string)',
];

function assertHex40(label, v) {
  if (typeof v !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(v)) {
    throw new Error(`${label} must be a 0x-prefixed 40-hex address`);
  }
}

function assertPrivateKey(v) {
  if (typeof v !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(v)) {
    throw new Error('PRIVATE_KEY must be a 0x-prefixed 64-hex private key');
  }
}

async function main() {
  assertPrivateKey(PRIVATE_KEY);
  assertHex40('TOKEN_ADDRESS', TOKEN_ADDRESS);
  assertHex40('SPENDER_ADDRESS', SPENDER_ADDRESS);

  const provider = new JsonRpcProvider(RPC_URL);
  const wallet = new Wallet(PRIVATE_KEY, provider);
  const token = new Contract(TOKEN_ADDRESS, ERC20_ABI, wallet);

  const amount = BigInt(AMOUNT_RAW);
  if (amount <= 0n) throw new Error('AMOUNT_RAW must be > 0');

  const symbol = await token.symbol().catch(() => 'TOKEN');
  const before = await token.allowance(wallet.address, SPENDER_ADDRESS);

  console.log(`wallet:   ${wallet.address}`);
  console.log(`token:    ${TOKEN_ADDRESS} (${symbol})`);
  console.log(`spender:  ${SPENDER_ADDRESS}`);
  console.log(`allowance before: ${before.toString()}`);
  console.log(`approving raw amount: ${amount.toString()}`);

  const tx = await token.approve(SPENDER_ADDRESS, amount);
  console.log(`txHash: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`status: ${receipt && receipt.status === 1 ? 'success' : 'reverted'}`);

  const after = await token.allowance(wallet.address, SPENDER_ADDRESS);
  console.log(`allowance after: ${after.toString()}`);
}

main().catch((err) => {
  console.error(`ERROR: ${err.message || String(err)}`);
  process.exit(1);
});
