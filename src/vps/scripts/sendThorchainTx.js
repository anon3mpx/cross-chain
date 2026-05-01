#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { JsonRpcProvider, Wallet, getAddress } = require('ethers');

function parseArgs(argv) {
  const args = {
    file: 'thorchain-calldata.md',
    index: 0,
    to: undefined,
    data: undefined,
    value: undefined,
    chainId: undefined,
    rpcUrl: process.env.RPC_URL,
    privateKey: process.env.DEPLOYER_PRIVATE_KEY,
    statusApiUrl: process.env.STATUS_API_URL,
    intentId: undefined,
    skipStatusUpdate: false,
    notifyOnly: false,
    txHash: undefined,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = argv[i + 1];

    if (a === '--file' && next) {
      args.file = next;
      i += 1;
    } else if (a === '--index' && next) {
      args.index = Number(next);
      i += 1;
    } else if (a === '--to' && next) {
      args.to = next;
      i += 1;
    } else if (a === '--data' && next) {
      args.data = next;
      i += 1;
    } else if (a === '--value' && next) {
      args.value = next;
      i += 1;
    } else if (a === '--chain-id' && next) {
      args.chainId = Number(next);
      i += 1;
    } else if (a === '--rpc-url' && next) {
      args.rpcUrl = next;
      i += 1;
    } else if (a === '--private-key' && next) {
      args.privateKey = next;
      i += 1;
    } else if (a === '--status-api' && next) {
      args.statusApiUrl = next;
      i += 1;
    } else if (a === '--intent-id' && next) {
      args.intentId = next;
      i += 1;
    } else if (a === '--skip-status-update') {
      args.skipStatusUpdate = true;
    } else if (a === '--notify-only') {
      args.notifyOnly = true;
    } else if (a === '--tx-hash' && next) {
      args.txHash = next;
      i += 1;
    } else if (a === '--dry-run') {
      args.dryRun = true;
    } else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node src/vps/scripts/sendThorchainTx.js [options]

Options:
  --file <path>         File containing /quote/select response (default: thorchain-calldata.md)
  --index <n>           Which integration.tx payload to use from file (default: 0)
  --to <address>        Override destination contract address
  --data <hex>          Override calldata
  --value <wei>         Override tx value in wei (decimal)
  --chain-id <n>        Expected chain id (optional safety check)
  --rpc-url <url>       Override RPC URL (default: env RPC_URL)
  --private-key <hex>   Override signer key (default: env DEPLOYER_PRIVATE_KEY)
  --status-api <url>    POST /intent/:id/submitted to this API after broadcast (default: env STATUS_API_URL)
  --intent-id <id>      Override intent id when status-updating
  --skip-status-update  Broadcast without notifying the status API
  --notify-only         Only POST /intent/:id/submitted; do not broadcast a transaction
  --tx-hash <hex>       Existing source tx hash to use with --notify-only
  --dry-run             Print selected tx payload without broadcasting
  -h, --help            Show help

Examples:
  node src/vps/scripts/sendThorchainTx.js --dry-run
  node src/vps/scripts/sendThorchainTx.js --file thorchain-calldata.md
  node src/vps/scripts/sendThorchainTx.js --status-api http://localhost:8787
  node src/vps/scripts/sendThorchainTx.js --notify-only --status-api http://localhost:8787 --tx-hash 0xabc...
`);
}

function isHexData(v) {
  return typeof v === 'string' && /^0x[0-9a-fA-F]*$/.test(v) && v.length % 2 === 0;
}

function isAddress(v) {
  return typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);
}

function extractTxPayloads(text) {
  const payloads = [];
  const re = /"tx"\s*:\s*\{\s*"to"\s*:\s*"(0x[0-9a-fA-F]{40})"\s*,\s*"data"\s*:\s*"(0x[0-9a-fA-F]*)"\s*,\s*"value"\s*:\s*"([0-9]+)"\s*,\s*"chainId"\s*:\s*([0-9]+)\s*\}/g;

  let m;
  while ((m = re.exec(text)) !== null) {
    payloads.push({
      to: m[1],
      data: m[2],
      value: m[3],
      chainId: Number(m[4]),
    });
  }

  return payloads;
}

function extractIntentId(text) {
  const matches = [...text.matchAll(/"intentId"\s*:\s*"(0x[0-9a-fA-F]{64})"/g)];
  if (matches.length === 0) return undefined;
  return matches[matches.length - 1][1];
}

function buildIntentSubmittedMessage(intentId, userAddress, timestamp, srcTxHash) {
  return [
    'EMPX-Cross-Chain intent submitted',
    `intentId:${intentId}`,
    `wallet:${getAddress(userAddress)}`,
    `timestamp:${Math.trunc(timestamp)}`,
    `srcTxHash:${String(srcTxHash).trim()}`,
  ].join('\n');
}

function pickPayload(args) {
  const hasOverrides = !!(args.to || args.data || args.value);
  if (hasOverrides) {
    if (!args.to || !args.data) {
      throw new Error('--to and --data are both required when overriding payload');
    }
    return {
      to: args.to,
      data: args.data,
      value: args.value ?? '0',
      chainId: Number.isFinite(args.chainId) ? args.chainId : undefined,
      intentId: args.intentId,
      source: 'cli-overrides',
    };
  }

  const filePath = path.resolve(process.cwd(), args.file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`file not found: ${filePath}`);
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const txs = extractTxPayloads(text);
  if (txs.length === 0) {
    throw new Error('no integration.tx payloads found in file');
  }
  if (!Number.isInteger(args.index) || args.index < 0 || args.index >= txs.length) {
    throw new Error(`--index must be between 0 and ${txs.length - 1}`);
  }

  return {
    ...txs[args.index],
    intentId: args.intentId ?? extractIntentId(text),
    source: `${filePath}#${args.index}`,
  };
}

async function notifyIntentSubmitted(statusApiUrl, intentId, wallet, srcTxHash) {
  const normalizedBaseUrl = String(statusApiUrl || '').trim().replace(/\/$/, '');
  if (!normalizedBaseUrl || !intentId) return;

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
    const errorBody = await response.text();
    throw new Error(`status update failed (${response.status}): ${errorBody}`);
  }

  const payload = await response.json();
  console.log(`intentStatus: ${payload.status}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const payload = pickPayload(args);

  if (!isAddress(payload.to)) {
    throw new Error(`invalid to address: ${payload.to}`);
  }
  if (!isHexData(payload.data)) {
    throw new Error('invalid calldata hex');
  }
  if (!/^\d+$/.test(String(payload.value))) {
    throw new Error('value must be a non-negative integer string');
  }

  const txRequest = {
    to: payload.to,
    data: payload.data,
    value: BigInt(payload.value),
  };

  console.log('Selected THOR tx payload:');
  console.log(`  source: ${payload.source}`);
  console.log(`  to: ${txRequest.to}`);
  console.log(`  value: ${txRequest.value.toString()} wei`);
  console.log(`  dataBytes: ${(txRequest.data.length - 2) / 2}`);
  if (payload.chainId !== undefined) {
    console.log(`  chainId: ${payload.chainId}`);
  }
  if (payload.intentId) {
    console.log(`  intentId: ${payload.intentId}`);
  }

  if (args.dryRun) {
    console.log('\nDry run only. No transaction broadcast.');
    return;
  }

  if (!args.privateKey) {
    throw new Error('missing private key. Set DEPLOYER_PRIVATE_KEY or pass --private-key');
  }

  if (args.notifyOnly) {
    if (!args.statusApiUrl) {
      throw new Error('missing status API URL. Set STATUS_API_URL or pass --status-api');
    }
    if (!payload.intentId) {
      throw new Error('missing intent id. Pass --intent-id or provide a file that contains the selected intent');
    }
    if (!args.txHash) {
      throw new Error('missing tx hash. Pass --tx-hash with --notify-only');
    }
    const wallet = new Wallet(args.privateKey);
    console.log(`\nPosting submitted status for ${payload.intentId} ...`);
    await notifyIntentSubmitted(args.statusApiUrl, payload.intentId, wallet, args.txHash);
    return;
  }

  if (!args.rpcUrl) {
    throw new Error('missing RPC URL. Set RPC_URL or pass --rpc-url');
  }

  const provider = new JsonRpcProvider(args.rpcUrl);
  if (payload.chainId !== undefined) {
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== payload.chainId) {
      throw new Error(`RPC chainId mismatch: payload=${payload.chainId}, rpc=${network.chainId.toString()}`);
    }
  }

  const wallet = new Wallet(args.privateKey, provider);
  console.log(`\nBroadcasting from ${wallet.address} ...`);
  const tx = await wallet.sendTransaction(txRequest);
  console.log(`txHash: ${tx.hash}`);
  if (!args.skipStatusUpdate && args.statusApiUrl && payload.intentId) {
    try {
      await notifyIntentSubmitted(args.statusApiUrl, payload.intentId, wallet, tx.hash);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`statusUpdateWarning: ${msg}`);
    }
  }

  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error('no receipt returned');
  }

  console.log('confirmed:');
  console.log(`  blockNumber: ${receipt.blockNumber}`);
  console.log(`  gasUsed: ${receipt.gasUsed.toString()}`);
  console.log(`  status: ${receipt.status}`);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Error: ${msg}`);
  process.exit(1);
});
