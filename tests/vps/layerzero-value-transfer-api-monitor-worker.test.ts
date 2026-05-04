import test from 'node:test';
import assert from 'node:assert/strict';
import { IntentEngine } from '../../src/vps/services/IntentEngine';
import { IntentService } from '../../src/vps/services/IntentService';
import { LayerZeroValueTransferApiMonitorWorker } from '../../src/vps/services/layerzero/LayerZeroValueTransferApiMonitorWorker';
import { IntentStatus, Rail, SettlementToken } from '../../src/vps/types';

test('LayerZeroValueTransferApiMonitorWorker settles provider-direct intents from API status', async () => {
  const intentEngine = new IntentEngine();
  const intentService = new IntentService(intentEngine);
  const intent = await intentService.createQuotedIntent({
    intentId: '0x' + '11'.repeat(32),
    srcChainId: 8453,
    dstChainId: 42161,
    tokenIn: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    tokenOut: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    amountIn: 1_000_000n,
    estimatedOut: 997_000n,
    minAmountOut: 990_000n,
    minSrcSwapOut: 0n,
    feeAmountUSD: 0.5,
    feeAmountToken: 0n,
    rail: Rail.LAYERZERO,
    railType: 'messaging',
    settlementToken: SettlementToken.USDC,
    settlementAssetId: '0x' + '00'.repeat(32),
    expectedDstSettlementToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    expectedDstSettlementAssetId: '0x' + '00'.repeat(32),
    minSettlementAmount: 990_000n,
    dstGasLimit: 0,
    etaSeconds: 45,
    expiresAt: Math.floor(Date.now() / 1000) + 120,
    railPluginId: '0x' + '00'.repeat(32),
    railData: '0x',
    swapPluginIdSrc: '0x' + '00'.repeat(32),
    swapPluginIdDst: '0x' + '00'.repeat(32),
    swapDataSrc: '0x',
    swapDataDst: '0x',
  }, '0x3333333333333333333333333333333333333333');
  (intent.quote as any).layerZeroValueTransferApiQuoteId = 'quote_lz_direct';

  await intentService.markSubmitted(intent.intentId, '0xsource');

  const worker = new LayerZeroValueTransferApiMonitorWorker(
    intentService,
    {
      getLayerZeroValueTransferApiStatus: async (quoteId, txHash) => {
        assert.equal(quoteId, 'quote_lz_direct');
        assert.equal(txHash, '0xsource');
        return {
          status: 'SUCCEEDED',
          executionHistory: [
            { event: 'SENT', transaction: { chainKey: 'base', hash: '0xsource' } },
            { event: 'DELIVERED', transaction: { chainKey: 'arbitrum', hash: '0xdestination' } },
          ],
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
});
