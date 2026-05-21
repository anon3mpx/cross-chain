#!/usr/bin/env node

const { JsonRpcProvider, Wallet, getAddress } = require('ethers');

// fill these
const RPC_URL = '';
const PRIVATE_KEY = ''; // 0x...
const TO = '';          // integration.tx.to
const DATA = '';        // integration.tx.data
const VALUE_WEI = '';  // integration.tx.value
const STATUS_API_URL = ''; // e.g. http://localhost:8787
const INTENT_ID = ''; // selected intentId from /quote/select
const EXISTING_TX_HASH = ''; // optional backfill tx hash for NOTIFY_ONLY mode
const NOTIFY_ONLY = false; // true = only POST /intent/:id/submitted
const DRY_RUN = false;

function buildIntentSubmittedMessage(intentId, userAddress, timestamp, srcTxHash) {
  return [
    'EMPX-Cross-Chain intent submitted',
    `intentId:${intentId}`,
    `wallet:${getAddress(userAddress)}`,
    `timestamp:${Math.trunc(timestamp)}`,
    `srcTxHash:${String(srcTxHash).trim()}`,
  ].join('\n');
}

async function notifyIntentSubmitted(statusApiUrl, intentId, wallet, srcTxHash) {
  const normalizedBaseUrl = String(statusApiUrl || '').trim().replace(/\/$/, '');
  if (!normalizedBaseUrl) {
    throw new Error('missing STATUS_API_URL');
  }
  if (!intentId) {
    throw new Error('missing INTENT_ID');
  }
  if (!srcTxHash) {
    throw new Error('missing source tx hash');
  }

  const timestamp = Date.now();
  const body = {
    userAddress: wallet.address,
    signature: await wallet.signMessage(
      buildIntentSubmittedMessage(intentId, wallet.address, timestamp, srcTxHash),
    ),
    timestamp,
    srcTxHash,
  };

  const response = await fetch(`${normalizedBaseUrl}/intent/${intentId}/submitted`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`status update failed (${response.status}): ${await response.text()}`);
  }

  const payload = await response.json();
  console.log('intentStatus:', payload.status);
}

async function main() {
  const txRequest = { to: TO, data: DATA, value: BigInt(VALUE_WEI) };

  console.log('to:', txRequest.to);
  console.log('value:', txRequest.value.toString());
  console.log('dataBytes:', (txRequest.data.length - 2) / 2);
  if (INTENT_ID) console.log('intentId:', INTENT_ID);

  if (DRY_RUN) return;

  if (!PRIVATE_KEY) {
    throw new Error('missing PRIVATE_KEY');
  }

  if (NOTIFY_ONLY) {
    const wallet = new Wallet(PRIVATE_KEY);
    console.log('from:', wallet.address);
    await notifyIntentSubmitted(STATUS_API_URL, INTENT_ID, wallet, EXISTING_TX_HASH);
    return;
  }

  const provider = new JsonRpcProvider(RPC_URL);
  const wallet = new Wallet(PRIVATE_KEY, provider);
  console.log('from:', wallet.address);

  const tx = await wallet.sendTransaction(txRequest);
  console.log('txHash:', tx.hash);

  if (STATUS_API_URL && INTENT_ID) {
    try {
      await notifyIntentSubmitted(STATUS_API_URL, INTENT_ID, wallet, tx.hash);
    } catch (err) {
      console.warn('statusUpdateWarning:', err?.message || String(err));
    }
  } else {
    console.warn('statusUpdateWarning: set STATUS_API_URL and INTENT_ID to sync intent status');
  }

  const receipt = await tx.wait();
  console.log('status:', receipt?.status);
  console.log('block:', receipt?.blockNumber);
}

main().catch((e) => {
  console.error(e?.message || String(e));
  process.exit(1);
});
