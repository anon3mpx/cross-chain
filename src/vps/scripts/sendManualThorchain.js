#!/usr/bin/env node

const { JsonRpcProvider, Wallet } = require('ethers');

// fill these
const RPC_URL = 'https://mainnet.base.org';
const PRIVATE_KEY = ''; // 0x...
const TO = '0x00dc6100103BC402d490aEE3F9a5560cBd91f1d4';          // integration.tx.to
const DATA = '0x44bc937b0000000000000000000000004feea1caeea66b3351ddba68bd80c37c9ed6c3c800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001c6bf5263400000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000069f36f0800000000000000000000000000000000000000000000000000000000000000363d3a424153452e555344433a30783035463863433837353344393064363744424238633032313138343430623832383346393431633900000000000000000000';        // integration.tx.data
const VALUE_WEI = '500000000000000';  // integration.tx.value
const DRY_RUN = false;

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
