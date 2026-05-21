import test from 'node:test';
import assert from 'node:assert/strict';
import { IntentEngine } from '../../src/vps/services/IntentEngine';
import { IntentService } from '../../src/vps/services/IntentService';
import { THORChainMonitorWorker, THORChainTxStatus } from '../../src/vps/services/thorchain/THORChainMonitorWorker';
import { Rail, SettlementToken, type QuoteResult, IntentStatus } from '../../src/vps/types';

function makeThorQuote(intentId: string): QuoteResult {
  return {
    intentId,
    srcChainId: 8453,
    dstChainId: 8453,
    tokenIn: 'BASE.ETH',
    tokenOut: 'BASE.USDC',
    amountIn: 500000000000000n,
    estimatedOut: 87376000n,
    minAmountOut: 87288624n,
    minSrcSwapOut: 0n,
    feeAmountUSD: 0.0000015,
    feeAmountToken: 1500000000000n,
    rail: Rail.THORCHAIN,
    railType: 'liquidity',
    settlementToken: SettlementToken.USDC,
    settlementAssetId: '0x' + '00'.repeat(32),
    expectedDstSettlementToken: '0x' + '00'.repeat(20),
    expectedDstSettlementAssetId: '0x' + '00'.repeat(32),
    minSettlementAmount: 498500000000000n,
    dstGasLimit: 0,
    etaSeconds: 30,
    expiresAt: 1777561352,
    railPluginId: '0x' + '11'.repeat(32),
    railData: '0x',
    swapPluginIdSrc: '0x' + '00'.repeat(32),
    swapPluginIdDst: '0x' + '00'.repeat(32),
    swapDataSrc: '0x',
    swapDataDst: '0x',
    minThorOutput: 87376000n,
    selectedByUser: true,
  };
}

async function createSubmittedThorIntent(intentId: string, srcTxHash: string): Promise<IntentService> {
  const intentService = new IntentService(new IntentEngine());
  await intentService.createQuotedIntent(makeThorQuote(intentId), '0x05F8cC8753D90d67DBB8c02118440b8283F941c9');
  await intentService.markSubmitted(intentId, srcTxHash);
  return intentService;
}

test('THORChain monitor moves submitted intents into transit using the source tx hash', async () => {
  const intentId = '0x' + '12'.repeat(32);
  const srcTxHash = '0x' + 'ab'.repeat(32);
  const intentService = await createSubmittedThorIntent(intentId, srcTxHash);

  const worker = new THORChainMonitorWorker(intentService, {
    inboundAddresses: async () => [],
    txStatus: async () => ({
      status: 'observed',
      stages: {
        swap_status: { completed: false },
      },
    }),
  }, { pollIntervalMs: 60_000 });

  await worker.start();
  worker.stop();

  const intent = await intentService.getIntent(intentId);
  assert.ok(intent);
  assert.equal(intent.status, IntentStatus.IN_TRANSIT);
  assert.equal(intent.railTxId, srcTxHash);
  assert.equal(intent.srcTxHash, srcTxHash);
});

test('THORChain monitor settles submitted intents when thornode already has an outbound tx', async () => {
  const intentId = '0x' + '34'.repeat(32);
  const srcTxHash = '0x' + 'cd'.repeat(32);
  const outboundTxHash = '0x' + 'ef'.repeat(32);
  const intentService = await createSubmittedThorIntent(intentId, srcTxHash);

  const worker = new THORChainMonitorWorker(intentService, {
    inboundAddresses: async () => [],
    txStatus: async () => ({
      status: 'done',
      out_txs: [{ txID: outboundTxHash }],
    } satisfies THORChainTxStatus),
  }, { pollIntervalMs: 60_000 });

  await worker.start();
  worker.stop();

  const intent = await intentService.getIntent(intentId);
  assert.ok(intent);
  assert.equal(intent.status, IntentStatus.SETTLED);
  assert.equal(intent.dstTxHash, outboundTxHash);
  assert.equal(intent.srcTxHash, srcTxHash);
});
