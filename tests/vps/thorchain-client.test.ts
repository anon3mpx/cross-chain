import test from 'node:test';
import assert from 'node:assert/strict';
import { THORChainClient } from '../../src/vps/services/thorchain/THORChainClient';

test('THORChainClient retries 503 responses and forwards x-client-id header', async () => {
  let calls = 0;
  const client = new THORChainClient({
    baseUrl: 'https://thornode.thorchain.network',
    clientId: 'ruflo-test-client',
    maxRetries: 2,
    retryBaseDelayMs: 1,
    fetchFn: (async (_url, init) => {
      calls += 1;
      assert.equal((init?.headers as Record<string, string>)['x-client-id'], 'ruflo-test-client');
      if (calls === 1) {
        return new Response('busy', { status: 503 });
      }
      return new Response(JSON.stringify({ expected_amount_out: '123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch,
  });

  const response = await client.quoteSwap(new URLSearchParams({
    from_asset: 'BASE.ETH',
    to_asset: 'ETH.ETH',
    amount: '1000000',
  }));

  assert.equal(calls, 2);
  assert.equal(response.expected_amount_out, '123');
});

test('THORChainClient throws after exhausting retries', async () => {
  const client = new THORChainClient({
    baseUrl: 'https://thornode.thorchain.network',
    maxRetries: 1,
    retryBaseDelayMs: 1,
    fetchFn: (async () => new Response('busy', { status: 503 })) as typeof fetch,
  });

  await assert.rejects(
    client.quoteSwap(new URLSearchParams({
      from_asset: 'BASE.ETH',
      to_asset: 'ETH.ETH',
      amount: '1000000',
    })),
    /THORChain API 503/,
  );
});
