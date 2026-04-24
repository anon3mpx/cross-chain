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

test('THORChainQuoteWorker enforces canary allowlist before calling provider', async () => {
  let called = false;
  const worker = new THORChainQuoteWorker(
    {
      quoteSwap: async () => {
        called = true;
        return { expected_amount_out: '123' };
      },
    },
    {
      enableCanaryGuardrails: true,
      canaryAllowlist: ['8453:1:BASE.ETH:ETH.ETH'],
    },
  );

  const offer = await worker.quote({
    amountIn: 1_000_000n,
    srcChainId: 8453,
    dstChainId: 42161,
    tokenIn: 'BASE.ETH',
    tokenOut: 'ETH.ETH',
    fromAsset: 'BASE.ETH',
    toAsset: 'ETH.ETH',
  });

  assert.equal(offer, null);
  assert.equal(called, false);
});
