import test from 'node:test';
import assert from 'node:assert/strict';
import { IntentEngine } from '../../src/vps/services/IntentEngine';
import { IntentService } from '../../src/vps/services/IntentService';
import { HyperlaneNexusMonitorWorker } from '../../src/vps/services/hyperlane/HyperlaneNexusMonitorWorker';
import { IntentStatus, Rail, SettlementToken } from '../../src/vps/types';

function buildHyperlaneQuote() {
  return {
    intentId: '0x' + '11'.repeat(32),
    srcChainId: 1,
    dstChainId: 8453,
    tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    tokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    amountIn: 1_000_000n,
    estimatedOut: 1_000_000n,
    minAmountOut: 1_000_000n,
    minSrcSwapOut: 0n,
    feeAmountUSD: 0,
    feeAmountToken: 0n,
    rail: Rail.HYPERLANE_NEXUS,
    railType: 'messaging' as const,
    settlementToken: SettlementToken.USDC,
    settlementAssetId: '0x' + '00'.repeat(32),
    expectedDstSettlementToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    expectedDstSettlementAssetId: '0x' + '00'.repeat(32),
    minSettlementAmount: 1_000_000n,
    dstGasLimit: 0,
    etaSeconds: 60,
    expiresAt: Math.floor(Date.now() / 1000) + 120,
    railPluginId: '0x' + '00'.repeat(32),
    railData: '0x',
    swapPluginIdSrc: '0x' + '00'.repeat(32),
    swapPluginIdDst: '0x' + '00'.repeat(32),
    swapDataSrc: '0x',
    swapDataDst: '0x',
  };
}

test('HyperlaneNexusMonitorWorker settles delivered intents from Explorer status', async () => {
  const intentEngine = new IntentEngine();
  const intentService = new IntentService(intentEngine);
  const intent = await intentService.createQuotedIntent(
    buildHyperlaneQuote(),
    '0x3333333333333333333333333333333333333333',
  );

  await intentService.markSubmitted(intent.intentId, '0xsource');

  const worker = new HyperlaneNexusMonitorWorker(
    intentService,
    {
      getMessageStatus: async (trackingId) => {
        assert.equal(trackingId, '0xsource');
        return {
          status: 'delivered',
          destinationTxHash: '0xdestination',
        };
      },
    },
    { pollIntervalMs: 60_000 },
  );

  await worker.start();
  worker.stop();

  const settled = await intentService.getIntent(intent.intentId);
  assert.equal(settled?.status, IntentStatus.SETTLED);
  assert.equal(settled?.dstTxHash, '0xdestination');

  const transfer = await intentService.getProviderTransfer({
    intentId: intent.intentId,
    provider: 'hyperlane_explorer',
    providerQuoteId: '0xsource',
  });
  assert.equal(transfer?.status, 'SETTLED');
  assert.equal(transfer?.sourceTxHash, '0xsource');
  assert.equal(transfer?.destinationTxHash, '0xdestination');
});

test('HyperlaneNexusMonitorWorker marks failed intents from Explorer status', async () => {
  const intentEngine = new IntentEngine();
  const intentService = new IntentService(intentEngine);
  const intent = await intentService.createQuotedIntent(
    buildHyperlaneQuote(),
    '0x3333333333333333333333333333333333333333',
  );

  await intentService.markSubmitted(intent.intentId, '0xsource');

  const worker = new HyperlaneNexusMonitorWorker(
    intentService,
    {
      getMessageStatus: async () => ({
        status: 'failed',
      }),
    },
    { pollIntervalMs: 60_000 },
  );

  await worker.start();
  worker.stop();

  const failed = await intentService.getIntent(intent.intentId);
  assert.equal(failed?.status, IntentStatus.FAILED);
  assert.match(failed?.errorMessage ?? '', /Hyperlane/i);
});
