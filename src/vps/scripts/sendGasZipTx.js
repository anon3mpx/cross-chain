#!/usr/bin/env node

const { JsonRpcProvider, Wallet } = require('ethers');

/**
 * Minimal Gas.zip native tx sender.
 *
 * 1) Fill the constants below.
 * 2) Run: node src/vps/scripts/sendGasZipTx.js
 */

const RPC_URL = '';
const PRIVATE_KEY = '';

const CHAIN_ID = '';
const TO = ''; // Replace with actual recipient address
const DATA = ''; // Replace with actual transaction data
const VALUE_WEI = ''; // Replace with actual value in wei

const DRY_RUN = false;

function requireString(label, value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} is required`);
  }
}

function assertAddress(label, value) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${label} must be a 0x-prefixed 40-hex address`);
  }
}

function assertHex(label, value) {
  if (!/^0x[0-9a-fA-F]*$/.test(value) || value.length % 2 !== 0) {
    throw new Error(`${label} must be valid 0x hex bytes`);
  }
}

async function main() {
  requireString('RPC_URL', RPC_URL);
  requireString('PRIVATE_KEY', PRIVATE_KEY);
  requireString('TO', TO);
  requireString('DATA', DATA);
  requireString('VALUE_WEI', VALUE_WEI);

  assertAddress('TO', TO);
  assertHex('DATA', DATA);

  const provider = new JsonRpcProvider(RPC_URL);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== CHAIN_ID) {
    throw new Error(`RPC chainId mismatch: expected ${CHAIN_ID}, got ${network.chainId.toString()}`);
  }

  const wallet = new Wallet(PRIVATE_KEY, provider);
  const txRequest = {
    to: TO,
    data: DATA,
    value: BigInt(VALUE_WEI),
    chainId: CHAIN_ID,
  };

  console.log('from:', wallet.address);
  console.log('to:', txRequest.to);
  console.log('valueWei:', txRequest.value.toString());
  console.log('data:', txRequest.data);
  console.log('chainId:', txRequest.chainId);

  if (DRY_RUN) {
    console.log('dry run only, transaction not sent');
    return;
  }

  const response = await wallet.sendTransaction(txRequest);
  console.log('txHash:', response.hash);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
