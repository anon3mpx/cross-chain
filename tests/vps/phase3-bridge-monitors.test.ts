import test from 'node:test';
import assert from 'node:assert/strict';
import { IntentEngine } from '../../src/vps/services/IntentEngine';
import { IntentService } from '../../src/vps/services/IntentService';
import { ChainflipMonitorWorker } from '../../src/vps/services/chainflip/ChainflipMonitorWorker';
import { MayaMonitorWorker } from '../../src/vps/services/maya/MayaMonitorWorker';
import { TeleSwapMonitorWorker } from '../../src/vps/services/teleswap/TeleSwapMonitorWorker';
import { IntentStatus, Rail, SettlementToken, type QuoteResult } from '../../src/vps/types';

function makeChainflipQuote(intentId: string): QuoteResult {
  return {
    intentId,
    srcChainId: 1,
    dstChainId: 103,
    tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    tokenOut: 'DOT',
    amountIn: 1_000_000n,
    estimatedOut: 990_000n,
    minAmountOut: 989_000n,
    minSrcSwapOut: 0n,
    feeAmountUSD: 0,
    feeAmountToken: 0n,
    rail: Rail.CHAINFLIP,
    railType: 'liquidity',
    settlementToken: SettlementToken.USDC,
    settlementAssetId: '0x' + '00'.repeat(32),
    expectedDstSettlementToken: 'DOT',
    expectedDstSettlementAssetId: '0x' + '00'.repeat(32),
    minSettlementAmount: 990_000n,
    dstGasLimit: 0,
    etaSeconds: 45,
    expiresAt: Math.floor(Date.now() / 1000) + 900,
    railPluginId: '0x' + '00'.repeat(32),
    railData: '0x',
    swapPluginIdSrc: '0x' + '00'.repeat(32),
    swapPluginIdDst: '0x' + '00'.repeat(32),
    swapDataSrc: '0x',
    swapDataDst: '0x',
    chainflipChannelId: 'cf-channel-1',
    selectedByUser: true,
  };
}

function makeMayaQuote(intentId: string): QuoteResult {
  return {
    intentId,
    srcChainId: 1,
    dstChainId: 42161,
    tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    tokenOut: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    amountIn: 1_000_000n,
    estimatedOut: 985_000n,
    minAmountOut: 980_000n,
    minSrcSwapOut: 0n,
    feeAmountUSD: 0,
    feeAmountToken: 0n,
    rail: Rail.MAYA,
    railType: 'liquidity',
    settlementToken: SettlementToken.USDC,
    settlementAssetId: '0x' + '00'.repeat(32),
    expectedDstSettlementToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    expectedDstSettlementAssetId: '0x' + '00'.repeat(32),
    minSettlementAmount: 985_000n,
    dstGasLimit: 0,
    etaSeconds: 90,
    expiresAt: Math.floor(Date.now() / 1000) + 900,
    railPluginId: '0x' + '00'.repeat(32),
    railData: '0x',
    swapPluginIdSrc: '0x' + '00'.repeat(32),
    swapPluginIdDst: '0x' + '00'.repeat(32),
    swapDataSrc: '0x',
    swapDataDst: '0x',
    selectedByUser: true,
  };
}

function makeTeleSwapQuote(intentId: string): QuoteResult {
  return {
    intentId,
    srcChainId: 0,
    dstChainId: 137,
    tokenIn: 'BTC',
    tokenOut: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    amountIn: 100_000_000n,
    estimatedOut: 970_000n,
    minAmountOut: 965_000n,
    minSrcSwapOut: 0n,
    feeAmountUSD: 0,
    feeAmountToken: 0n,
    rail: Rail.TELESWAP,
    railType: 'liquidity',
    settlementToken: SettlementToken.USDC,
    settlementAssetId: '0x' + '00'.repeat(32),
    expectedDstSettlementToken: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    expectedDstSettlementAssetId: '0x' + '00'.repeat(32),
    minSettlementAmount: 970_000n,
    dstGasLimit: 0,
    etaSeconds: 1800,
    expiresAt: Math.floor(Date.now() / 1000) + 900,
    railPluginId: '0x' + '00'.repeat(32),
    railData: '0x',
    swapPluginIdSrc: '0x' + '00'.repeat(32),
    swapPluginIdDst: '0x' + '00'.repeat(32),
    swapDataSrc: '0x',
    swapDataDst: '0x',
    teleSwapSwapId: 'ts-swap-1',
    selectedByUser: true,
  };
}

test('ChainflipMonitorWorker settles submitted intents from channel status', async () => {
  const intentService = new IntentService(new IntentEngine());
  const intentId = '0x' + '12'.repeat(32);
  await intentService.createQuotedIntent(makeChainflipQuote(intentId), '0x3333333333333333333333333333333333333333');
  await intentService.markSubmitted(intentId, '0xsource');

  const worker = new ChainflipMonitorWorker(
    intentService,
    {
      getSwapStatus: async (channelId) => {
        assert.equal(channelId, 'cf-channel-1');
        return {
          channelId,
          state: 'COMPLETE',
          destinationTxHash: '0xdestination',
        };
      },
    } as any,
    { pollIntervalMs: 60_000 },
  );

  await worker.start();
  worker.stop();

  const intent = await intentService.getIntent(intentId);
  assert.equal(intent?.status, IntentStatus.SETTLED);
  assert.equal(intent?.dstTxHash, '0xdestination');
});

test('MayaMonitorWorker settles intents from Midgard action status', async () => {
  const intentService = new IntentService(new IntentEngine());
  const intentId = '0x' + '34'.repeat(32);
  await intentService.createQuotedIntent(makeMayaQuote(intentId), '0x3333333333333333333333333333333333333333');
  await intentService.markSubmitted(intentId, '0xsource');

  const worker = new MayaMonitorWorker(
    intentService,
    {
      getActionStatus: async (sourceTxHash) => {
        assert.equal(sourceTxHash, '0xsource');
        return {
          txid: sourceTxHash,
          status: 'success',
          inboundObserved: true,
          outboundCompleted: true,
          outboundTxHash: '0xdestination',
        };
      },
    } as any,
    { pollIntervalMs: 60_000 },
  );

  await worker.start();
  worker.stop();

  const intent = await intentService.getIntent(intentId);
  assert.equal(intent?.status, IntentStatus.SETTLED);
  assert.equal(intent?.dstTxHash, '0xdestination');
});

test('TeleSwapMonitorWorker settles intents from swap status', async () => {
  const intentService = new IntentService(new IntentEngine());
  const intentId = '0x' + '56'.repeat(32);
  await intentService.createQuotedIntent(makeTeleSwapQuote(intentId), '0x3333333333333333333333333333333333333333');
  await intentService.markSubmitted(intentId, '0xsource');

  const worker = new TeleSwapMonitorWorker(
    intentService,
    {
      getSwapStatus: async (swapId) => {
        assert.equal(swapId, 'ts-swap-1');
        return {
          state: 'COMPLETE',
          destinationTxHash: '0xdestination',
        };
      },
    } as any,
    { pollIntervalMs: 60_000 },
  );

  await worker.start();
  worker.stop();

  const intent = await intentService.getIntent(intentId);
  assert.equal(intent?.status, IntentStatus.SETTLED);
  assert.equal(intent?.dstTxHash, '0xdestination');
});
