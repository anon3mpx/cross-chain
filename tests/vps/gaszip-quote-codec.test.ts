import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuoteRequest } from '../../src/vps/api/quoteCodec';

test('parseQuoteRequest preserves destination gas requests', () => {
  const parsed = parseQuoteRequest({
    tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    amountIn: '1',
    srcChainId: 8453,
    dstChainId: 42161,
    userAddress: '0x3333333333333333333333333333333333333333',
    destinationGas: [{
      chainId: 42161,
      amountWei: '800000000000000',
      recipient: '0x4444444444444444444444444444444444444444',
    }],
  } as any);

  assert.deepEqual((parsed as any).destinationGas, [{
    chainId: 42161,
    amountWei: '800000000000000',
    recipient: '0x4444444444444444444444444444444444444444',
    provider: undefined,
  }]);
});

test('parseQuoteRequest preserves patient urgency and provider-direct refund addresses', () => {
  const parsed = parseQuoteRequest({
    tokenIn: 'BTC',
    tokenOut: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    amountIn: '100000000',
    srcChainId: 0,
    dstChainId: 137,
    userAddress: '0x3333333333333333333333333333333333333333',
    refundAddress: 'bc1qrefunddestination',
    urgency: 'patient',
  } as any);

  assert.equal(parsed.urgency, 'patient');
  assert.equal(parsed.refundAddress, 'bc1qrefunddestination');
});
