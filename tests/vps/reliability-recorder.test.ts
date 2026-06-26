import test from 'node:test';
import assert from 'node:assert/strict';

import { ReliabilityRecorder } from '../../src/vps/services/ReliabilityRecorder';
import { IntentEngine } from '../../src/vps/services/IntentEngine';
import { IntentStatus, Rail, SettlementToken, type QuoteResult } from '../../src/vps/types';

function makeQuote(): QuoteResult {
  return {
    intentId: '0x' + '1'.repeat(64),
    srcChainId: 8453,
    dstChainId: 10,
    tokenIn: '0x0000000000000000000000000000000000000001',
    tokenOut: '0x0000000000000000000000000000000000000002',
    amountIn: 1_000_000n,
    estimatedOut: 995_000n,
    minAmountOut: 990_000n,
    minSrcSwapOut: 0n,
    feeAmountUSD: 0.25,
    feeAmountToken: 0n,
    rail: Rail.CCTP,
    railType: 'messaging',
    settlementToken: SettlementToken.USDC,
    settlementAssetId: '0x' + '0'.repeat(64),
    expectedDstSettlementToken: '0x0000000000000000000000000000000000000002',
    expectedDstSettlementAssetId: '0x' + '1'.repeat(64),
    minSettlementAmount: 995_000n,
    dstGasLimit: 250_000,
    etaSeconds: 30,
    expiresAt: Math.floor(Date.now() / 1000) + 60,
    railPluginId: '0x' + '2'.repeat(64),
    railData: '0x',
    swapPluginIdSrc: '0x' + '0'.repeat(64),
    swapPluginIdDst: '0x' + '0'.repeat(64),
    swapDataSrc: '0x',
    swapDataDst: '0x',
  };
}

test('ReliabilityRecorder records settled actual values without leaving economics blank', async () => {
  const engine = new IntentEngine();
  const rows: any[] = [];
  const recorder = new ReliabilityRecorder(engine, {
    async insert(row) {
      rows.push(row);
    },
    async windowedRailStats() { return []; },
    async windowedRouteStats() { return null; },
    async windowedTierStats() { return []; },
  });

  recorder.start();

  const now = Date.now();
  engine.upsert({
    intentId: makeQuote().intentId,
    status: IntentStatus.SETTLED,
    quote: makeQuote(),
    userAddress: '0x0000000000000000000000000000000000000003',
    dstTxHash: '0x' + 'a'.repeat(64),
    createdAt: now - 20_000,
    updatedAt: now,
    retryCount: 0,
  }, true);

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(rows.length, 1);
  assert.equal(rows[0].actualOut, 995_000n);
  assert.equal(rows[0].actualFeeUsd, 0.25);
});

test('ReliabilityRecorder prefers explicit actual execution values when present on the intent', async () => {
  const engine = new IntentEngine();
  const rows: any[] = [];
  const recorder = new ReliabilityRecorder(engine, {
    async insert(row) {
      rows.push(row);
    },
    async windowedRailStats() { return []; },
    async windowedRouteStats() { return null; },
    async windowedTierStats() { return []; },
  });

  recorder.start();

  const now = Date.now();
  engine.upsert({
    intentId: makeQuote().intentId,
    status: IntentStatus.SETTLED,
    quote: makeQuote(),
    userAddress: '0x0000000000000000000000000000000000000003',
    dstTxHash: '0x' + 'b'.repeat(64),
    createdAt: now - 20_000,
    updatedAt: now,
    retryCount: 0,
    actualOut: 990_123n,
    actualFeeUsd: 0.31,
  } as any, true);

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(rows.length, 1);
  assert.equal(rows[0].actualOut, 990_123n);
  assert.equal(rows[0].actualFeeUsd, 0.31);
});
