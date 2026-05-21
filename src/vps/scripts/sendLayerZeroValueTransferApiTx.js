#!/usr/bin/env node

const { JsonRpcProvider, Wallet, isAddress } = require('ethers');

// Replace these values from the LayerZero Value Transfer API bridge userStep.
const RPC_URL = '';
const EXPECTED_CHAIN_ID = '';
const PRIVATE_KEY = '';
const TO_ADDRESS = '';
const CALLDATA = '';
const VALUE_WEI = '';

// Optional. Leave empty to let the wallet/provider estimate.
const GAS_LIMIT = '';

// Optional. Fill these to print the exact callback payload for our API.
const INTENT_ID = '';
const USER_ADDRESS = '';

// Keep true until you have reviewed the printed transaction payload.
const DRY_RUN = false;

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

function requireHexData(name, value) {
  if (!/^0x[0-9a-fA-F]*$/.test(value) || value.length % 2 !== 0) {
    throw new Error(`${name} must be 0x-prefixed hex calldata`);
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
  requireAddress('TO_ADDRESS', TO_ADDRESS);
  if (!DRY_RUN && isZeroAddress(TO_ADDRESS)) {
    throw new Error('TO_ADDRESS must be replaced before broadcasting');
  }
  requireHexData('CALLDATA', CALLDATA);

  const value = BigInt(VALUE_WEI);
  if (value < 0n) {
    throw new Error('VALUE_WEI cannot be negative');
  }

  const provider = new JsonRpcProvider(RPC_URL);
  const network = await provider.getNetwork();
  if (EXPECTED_CHAIN_ID && network.chainId !== BigInt(EXPECTED_CHAIN_ID)) {
    throw new Error(`wrong RPC chain: expected ${EXPECTED_CHAIN_ID}, got ${network.chainId.toString()}`);
  }

  const wallet = PRIVATE_KEY ? new Wallet(PRIVATE_KEY, provider) : null;
  const txRequest = {
    to: TO_ADDRESS,
    data: CALLDATA,
    value,
    ...(GAS_LIMIT ? { gasLimit: BigInt(GAS_LIMIT) } : {}),
  };

  console.log('LayerZero Value Transfer API transaction');
  console.log(`chainId: ${network.chainId.toString()}`);
  console.log(`wallet: ${wallet?.address ?? '<not set - dry run>'}`);
  console.log(`to: ${TO_ADDRESS}`);
  console.log(`valueWei: ${value.toString()}`);
  console.log(`calldataBytes: ${(CALLDATA.length - 2) / 2}`);
  console.log('txRequest:', JSON.stringify({
    ...txRequest,
    value: txRequest.value.toString(),
    gasLimit: txRequest.gasLimit?.toString(),
  }, null, 2));

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

  if (INTENT_ID && USER_ADDRESS) {
    console.log('provider-direct submitted callback:');
    console.log(JSON.stringify({
      method: 'POST',
      path: `/layerzero-value-transfer-api/intents/${INTENT_ID}/submitted`,
      body: {
        userAddress: USER_ADDRESS,
        sourceTxHash: tx.hash,
      },
    }, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
