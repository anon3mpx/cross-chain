#!/usr/bin/env node

const { JsonRpcProvider, Wallet } = require('ethers');

// fill these
const RPC_URL = '';
const PRIVATE_KEY = ''; // 0x...
const TO = '';          // integration.tx.to
const DATA = '';        // integration.tx.data
const VALUE_WEI = '0';  // integration.tx.value
const DRY_RUN = true;

async function main() {
  const txRequest = { to: TO, data: DATA, value: BigInt(VALUE_WEI) };

  console.log('to:', txRequest.to);
  console.log('value:', txRequest.value.toString());
  console.log('dataBytes:', (txRequest.data.length - 2) / 2);

  if (DRY_RUN) return;

  const provider = new JsonRpcProvider(RPC_URL);
  const wallet = new Wallet(PRIVATE_KEY, provider);
  console.log('from:', wallet.address);

  const tx = await wallet.sendTransaction(txRequest);
  console.log('txHash:', tx.hash);

  const receipt = await tx.wait();
  console.log('status:', receipt?.status);
  console.log('block:', receipt?.blockNumber);
}

main().catch((e) => {
  console.error(e?.message || String(e));
  process.exit(1);
});
