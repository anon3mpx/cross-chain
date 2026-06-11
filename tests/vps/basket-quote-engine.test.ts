import test from 'node:test';
import assert from 'node:assert/strict';
import { BasketQuoteEngine } from '../../src/vps/services/BasketQuoteEngine';

test('BasketQuoteEngine quotes a same-chain one-to-many basket', async () => {
  const engine = new BasketQuoteEngine({
    swapAdapter: {
      quote: async () => ({ amountOut: '1000' }),
      swap: async () => ({ calldata: { to: '0x1', data: '0x', value: '0', chainId: 8453 } }),
    } as any,
    quoteEngine: {} as any,
  });

  const result = await engine.quote({
    mode: 'one-to-many',
    inputs: [{
      chainId: 8453,
      token: '0x1111111111111111111111111111111111111111',
      amount: '1000',
      wallet: '0x3333333333333333333333333333333333333333',
    }],
    outputs: [{
      chainId: 8453,
      token: '0x2222222222222222222222222222222222222222',
      allocationBps: 10_000,
      recipient: '0x3333333333333333333333333333333333333333',
    }],
    constraints: {},
  }, { routeSource: 'agent-sdk' });

  assert.ok(!('error' in result));
  assert.equal(result.legs.length, 1);
  assert.equal(result.legs[0]?.legKind, 'single-chain');
});

test('BasketQuoteEngine emits a contract-backed multicall tx for eligible same-chain legs', async () => {
  const previous = process.env.CHAIN_8453_EMPSEAL_MULTICALL_ROUTER;
  process.env.CHAIN_8453_EMPSEAL_MULTICALL_ROUTER = '0x4444444444444444444444444444444444444444';

  const engine = new BasketQuoteEngine({
    swapAdapter: {
      swap: async (_request: any) => ({
        tradeInfo: {
          amountIn: '1000',
          amountOut: '900',
          fee: '28',
          path: [
            '0x1111111111111111111111111111111111111111',
            '0x2222222222222222222222222222222222222222',
          ],
          adapters: ['0x3333333333333333333333333333333333333333'],
        },
        calldata: {
          to: '0x5555555555555555555555555555555555555555',
          data: '0x1234',
          value: '0',
          chainId: 8453,
        },
        swapType: 'ERC20ToERC20',
      }),
    } as any,
    quoteEngine: {} as any,
    intentService: {} as any,
  });

  try {
    const result = await engine.executeBasket({
      mode: 'one-to-many',
      inputs: [{
        chainId: 8453,
        token: '0x1111111111111111111111111111111111111111',
        amount: '1000',
        wallet: '0x3333333333333333333333333333333333333333',
      }],
      outputs: [
        {
          chainId: 8453,
          token: '0x2222222222222222222222222222222222222222',
          allocationBps: 5_000,
          recipient: '0x3333333333333333333333333333333333333333',
        },
        {
          chainId: 8453,
          token: '0x2222222222222222222222222222222222222222',
          allocationBps: 5_000,
          recipient: '0x3333333333333333333333333333333333333333',
        },
      ],
      constraints: {},
    }, '0x3333333333333333333333333333333333333333', {}, { routeSource: 'agent-sdk' }, { mode: 'multicall' });

    assert.ok(!('error' in result));
    assert.equal(result.mode, 'multicall');
    assert.equal(result.batchedTx?.to, '0x4444444444444444444444444444444444444444');
    assert.equal(result.batchedTx?.chainId, 8453);
  } finally {
    process.env.CHAIN_8453_EMPSEAL_MULTICALL_ROUTER = previous;
  }
});
