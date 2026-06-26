import test from 'node:test';
import assert from 'node:assert/strict';
import { IntentEngine } from '../../src/vps/services/IntentEngine';
import { IntentService } from '../../src/vps/services/IntentService';
import {
  OptimismNativeBridgeMonitorWorker,
  RpcOptimismNativeBridgeStatusClient,
} from '../../src/vps/services/nativebridge/OptimismNativeBridgeMonitorWorker';
import { IntentStatus, Rail, SettlementToken, type QuoteResult } from '../../src/vps/types';

function makeQuote(intentId: string): QuoteResult {
  return {
    intentId,
    srcChainId: 10,
    dstChainId: 1,
    tokenIn: '0x4200000000000000000000000000000000000006',
    tokenOut: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    amountIn: 1_000_000_000_000_000n,
    estimatedOut: 1_000_000_000_000_000n,
    minAmountOut: 1_000_000_000_000_000n,
    minSrcSwapOut: 0n,
    feeAmountUSD: 0,
    feeAmountToken: 0n,
    rail: Rail.OPTIMISM_NATIVE_BRIDGE,
    railType: 'messaging',
    settlementToken: SettlementToken.ETH,
    settlementAssetId: '0x' + '00'.repeat(32),
    expectedDstSettlementToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    expectedDstSettlementAssetId: '0x' + '00'.repeat(32),
    minSettlementAmount: 1_000_000_000_000_000n,
    dstGasLimit: 0,
    etaSeconds: 60,
    expiresAt: Math.floor(Date.now() / 1000) + 900,
    railPluginId: '0x' + '00'.repeat(32),
    railData: '0x',
    swapPluginIdSrc: '0x' + '00'.repeat(32),
    swapPluginIdDst: '0x' + '00'.repeat(32),
    swapDataSrc: '0x',
    swapDataDst: '0x',
    selectedByUser: true,
    offerType: 'optimism_native_bridge_direct',
    executionMode: 'provider_direct',
  };
}

test('RpcOptimismNativeBridgeStatusClient treats mined-but-not-mature withdrawals as in transit', async () => {
  const client = new RpcOptimismNativeBridgeStatusClient(async () => ({
    getTransactionReceipt: async (hash: string) => {
      assert.equal(hash, '0xsource');
      return { status: 1, blockNumber: 123 };
    },
    getBlock: async (blockNumber: number) => {
      assert.equal(blockNumber, 123);
      return { timestamp: Math.floor((Date.now() - 30_000) / 1000) };
    },
  }));

  const status = await client.getStatus({
    srcTxHash: '0xsource',
    quote: makeQuote('0x' + '11'.repeat(32)),
  } as any);

  assert.equal(status?.status, IntentStatus.IN_TRANSIT);
  assert.equal(status?.sourceTxHash, '0xsource');
});

test('OptimismNativeBridgeMonitorWorker settles mature bridge intents', async () => {
  const intentService = new IntentService(new IntentEngine());
  const intentId = '0x' + '22'.repeat(32);
  await intentService.createQuotedIntent(makeQuote(intentId), '0x3333333333333333333333333333333333333333');
  await intentService.markSubmitted(intentId, '0xsource');

  const worker = new OptimismNativeBridgeMonitorWorker(
    intentService,
    {
      getStatus: async (intent) => {
        assert.equal(intent.intentId, intentId);
        return {
          status: IntentStatus.SETTLED,
          sourceTxHash: '0xsource',
          destinationTxHash: '0xdestination',
        };
      },
    },
    { pollIntervalMs: 60_000 },
  );

  await worker.start();
  worker.stop();

  const intent = await intentService.getIntent(intentId);
  assert.equal(intent?.status, IntentStatus.SETTLED);
  assert.equal(intent?.dstTxHash, '0xdestination');
});
