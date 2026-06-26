import test from 'node:test';
import assert from 'node:assert/strict';
import { Erc7683Adapter } from '../../src/vps/services/Erc7683Adapter';
import { Rail } from '../../src/vps/types';

test('Erc7683Adapter resolves an ergonomic JSON order through the quote engine', async () => {
  const adapter = new Erc7683Adapter({
    quoteEngine: {
      getOffers: async () => ({
        offers: [{
          offerId: 'offer_1',
          executionMode: 'provider_direct',
          estimatedOut: 900n,
          minAmountOut: 850n,
          economics: { settlementTimeSeconds: 60, providerFeeUSD: 1, protocolFeeUSD: 0.5 },
          rail: Rail.CHAINFLIP,
        }],
      }),
    } as any,
    intentService: {} as any,
    swapAdapter: {} as any,
  });

  const result = await adapter.resolve({
    orderDataJson: {
      srcChainId: 1,
      dstChainId: 8453,
      tokenIn: '0x1111111111111111111111111111111111111111',
      tokenOut: '0x2222222222222222222222222222222222222222',
      amountIn: '1000',
      minAmountOut: '850',
      recipient: '0x3333333333333333333333333333333333333333',
    },
  }, { routeSource: 'external-solver' });

  assert.ok(!('error' in result));
  assert.equal(result.empx.executionMode, 'provider_direct');
  assert.equal(result.empx.estimatedOut, '900');
});
