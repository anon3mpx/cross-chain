#!/usr/bin/env node

const { JsonRpcProvider, Wallet, isAddress } = require('ethers');

// Replace these values from the LayerZero Value Transfer API bridge userStep.
const RPC_URL = 'https://mainnet.optimism.io';
const EXPECTED_CHAIN_ID = 10;
const PRIVATE_KEY = '';
const TO_ADDRESS = '0x5528Cf58fEB8fbfcE94f43B33240FFFB1312bDe3';
const CALLDATA = '0x571d3dc7000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000019e21b0a91273f1a5be69a886ab589b0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000002c0000000000000000000000000e8cdf27acd73a434d661c84887215f7598e7d0d30000000000000000000000000000000000000000000000000000cbea09fedfe0000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001e4c7c7f5b3000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000001603e90a5fe000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005528cf58feb8fbfce94f43b33240fffb1312bde300000000000000000000000000000000000000000000000000000000000075e800000000000000000000000005f8cc8753d90d67dbb8c02118440b8283f941c90000000000000000000000000000000000000000000000000000b5e620f480000000000000000000000000000000000000000000000000000000b32df711340000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000002000300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005528cf58feb8fbfce94f43b33240fffb1312bde3000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000084d20c88bd000000000000000000000000000000000000000000000000000000000000004000000000000000000000000005f8cc8753d90d67dbb8c02118440b8283f941c90000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
const VALUE_WEI = '224206050484192';

// Optional. Leave empty to let the wallet/provider estimate.
const GAS_LIMIT = '';

// Optional. Fill these to print the exact callback payload for our API.
const INTENT_ID = '0xa0af42f5406c7f61df28df9dc31dcb5479e3cd2a42ca2de257c298e87e61ca44';
const USER_ADDRESS = '0x05F8cC8753D90d67DBB8c02118440b8283F941c9';

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
