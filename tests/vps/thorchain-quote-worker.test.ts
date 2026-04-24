import test from 'node:test';
import assert from 'node:assert/strict';
import { THORChainQuoteWorker } from '../../src/vps/services/thorchain/THORChainQuoteWorker';

test('THORChainQuoteWorker omits offers below recommended_min_amount_in', async () => {
  const worker = new THORChainQuoteWorker({
    quoteSwap: async () => ({ recommended_min_amount_in: '500000' }),
  });

  const offer = await worker.quote({
    amountIn: 30000n,
    srcChainId: 8453,
    dstChainId: 0,
    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    tokenOut: 'BTC',
  });

  assert.equal(offer, null);
});
