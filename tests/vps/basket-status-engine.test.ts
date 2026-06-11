import test from 'node:test';
import assert from 'node:assert/strict';
import { BasketStatusEngine } from '../../src/vps/services/BasketStatusEngine';
import { IntentStatus, Rail, SettlementToken } from '../../src/vps/types';

function makeIntent(intentId: string, status: IntentStatus) {
  return {
    intentId,
    status,
    quote: {
      intentId,
      srcChainId: 1,
      dstChainId: 8453,
      tokenIn: '0x1',
      tokenOut: '0x2',
      amountIn: 1n,
      estimatedOut: 2n,
      minAmountOut: 2n,
      minSrcSwapOut: 0n,
      feeAmountUSD: 0,
      feeAmountToken: 0n,
      rail: Rail.CCTP,
      railType: 'messaging',
      settlementToken: SettlementToken.USDC,
      settlementAssetId: `0x${'0'.repeat(64)}`,
      expectedDstSettlementToken: '0x0000000000000000000000000000000000000000',
      expectedDstSettlementAssetId: `0x${'0'.repeat(64)}`,
      minSettlementAmount: 0n,
      dstGasLimit: 0,
      etaSeconds: 60,
      expiresAt: Date.now() + 60_000,
      railPluginId: 'cctp',
      railData: '0x',
      swapPluginIdSrc: '0x',
      swapPluginIdDst: '0x',
      swapDataSrc: '0x',
      swapDataDst: '0x',
    },
    userAddress: '0x3333333333333333333333333333333333333333',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    retryCount: 0,
  };
}

test('BasketStatusEngine rolls up child intents into partial-settled status', async () => {
  const repo = {
    async findIntentsByBasket() {
      return [
        makeIntent('0x' + '11'.repeat(32), IntentStatus.SETTLED),
        makeIntent('0x' + '22'.repeat(32), IntentStatus.IN_TRANSIT),
      ];
    },
  } as any;

  const status = await new BasketStatusEngine(repo).getStatus('bkt_1');
  assert.equal(status.composite, 'PARTIAL_SETTLED');
  assert.equal(status.counts.total, 2);
  assert.equal(status.counts.settled, 1);
  assert.equal(status.counts.inTransit, 1);
});
