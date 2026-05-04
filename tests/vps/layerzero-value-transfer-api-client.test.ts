import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LayerZeroValueTransferApiClient,
} from '../../src/vps/services/layerzero/LayerZeroValueTransferApiClient';

const BASE_URL = 'https://transfer.example.test/v1';

test('LayerZeroValueTransferApiClient covers unauthenticated discovery endpoints', async () => {
  const requests: Array<{ url: string; headers: Headers }> = [];
  const client = new LayerZeroValueTransferApiClient({
    baseUrl: BASE_URL,
    apiKey: 'secret-test-key',
    fetchFn: (async (url, init) => {
      requests.push({ url: String(url), headers: new Headers(init?.headers) });
      if (String(url).includes('/chains')) {
        return new Response(JSON.stringify({
          chains: [{
            name: 'Base',
            shortName: 'Base',
            chainKey: 'base',
            chainType: 'EVM',
            chainId: 8453,
          }],
          pagination: { nextToken: 'chains-next' },
        }), { status: 200 });
      }
      if (String(url).includes('/tokens')) {
        return new Response(JSON.stringify({
          tokens: [{
            isSupported: true,
            chainKey: 'base',
            address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            decimals: 18,
            symbol: 'ETH',
            name: 'Ether',
          }],
          pagination: {},
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        base: {
          deployments: {
            multicall: { address: '0x0564F89f6edf2cA62fBd174378f9187e447DD410' },
            transferDelegate: { address: '0xf45722F37f602c0788Beb7C1471ebEB281308860' },
          },
        },
      }), { status: 200 });
    }) as typeof fetch,
  });

  const chains = await client.listLayerZeroValueTransferApiChains({ nextToken: 'abc' });
  const tokens = await client.listLayerZeroValueTransferApiTokens({
    transferrableFromChainKey: 'base',
    transferrableFromTokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    nextToken: 'def',
  });
  const metadata = await client.getLayerZeroValueTransferApiMetadata();

  assert.equal(chains.chains[0]?.chainKey, 'base');
  assert.equal(tokens.tokens[0]?.symbol, 'ETH');
  assert.equal(metadata.base.deployments.transferDelegate.address, '0xf45722F37f602c0788Beb7C1471ebEB281308860');
  assert.equal(requests[0]!.url, `${BASE_URL}/chains?pagination%5BnextToken%5D=abc`);
  assert.equal(
    requests[1]!.url,
    `${BASE_URL}/tokens?transferrableFromChainKey=base&transferrableFromTokenAddress=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&pagination%5BnextToken%5D=def`,
  );
  assert.equal(requests[2]!.url, `${BASE_URL}/metadata`);
  assert.equal(requests.every((request) => request.headers.get('x-api-key') === null), true);
});

test('LayerZeroValueTransferApiClient covers authenticated transfer lifecycle endpoints', async () => {
  const requests: Array<{ url: string; method: string; headers: Headers; body: string }> = [];
  const client = new LayerZeroValueTransferApiClient({
    baseUrl: BASE_URL,
    apiKey: 'secret-test-key',
    fetchFn: (async (url, init) => {
      requests.push({
        url: String(url),
        method: String(init?.method ?? 'GET'),
        headers: new Headers(init?.headers),
        body: String(init?.body ?? ''),
      });
      if (String(url).endsWith('/quotes')) {
        return new Response(JSON.stringify({
          error: null,
          quotes: [{ id: 'quote_lz_1', srcAmount: '1000000', dstAmount: '999000' }],
          tokens: [],
          rejectedQuotes: [],
        }), { status: 200 });
      }
      if (String(url).endsWith('/build-user-steps')) {
        return new Response(JSON.stringify({
          userSteps: [{
            type: 'TRANSACTION',
            chainKey: 'solana',
            chainType: 'SOLANA',
            signerAddress: 'Dz93pUVjXuaMnSsPSn7V99V4cUzhKoQdx9ECwZJZiafG',
            transaction: {
              encoded: {
                encoding: 'base64',
                data: 'AQAB',
              },
            },
          }],
        }), { status: 200 });
      }
      if (String(url).endsWith('/submit-signature')) {
        return new Response('{}', { status: 200 });
      }
      return new Response(JSON.stringify({
        status: 'SUCCEEDED',
        explorerUrl: 'https://layerzeroscan.com/tx/0xabc',
        executionHistory: [{ event: 'SENT', transaction: { chainKey: 'base', hash: '0xabc' } }],
      }), { status: 200 });
    }) as typeof fetch,
  });

  const quote = await client.requestLayerZeroValueTransferApiQuotes({
    srcChainKey: 'base',
    dstChainKey: 'arbitrum',
    srcTokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    dstTokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    srcWalletAddress: '0x3333333333333333333333333333333333333333',
    dstWalletAddress: '0x3333333333333333333333333333333333333333',
    amount: '1000000',
  });
  const steps = await client.buildLayerZeroValueTransferApiUserSteps({ quoteId: 'quote_lz_1' });
  await client.submitLayerZeroValueTransferApiSignature({
    quoteId: 'quote_lz_1',
    signatures: ['0x1234'],
  });
  const status = await client.getLayerZeroValueTransferApiStatus('quote/lz 1', '0xabc');

  assert.equal(quote.quotes[0]?.id, 'quote_lz_1');
  assert.equal(steps.userSteps[0]?.chainType, 'SOLANA');
  assert.equal(status.status, 'SUCCEEDED');
  assert.equal(requests.map((request) => request.headers.get('x-api-key')).every((key) => key === 'secret-test-key'), true);
  assert.equal(requests[0]!.url, `${BASE_URL}/quotes`);
  assert.equal(requests[1]!.url, `${BASE_URL}/build-user-steps`);
  assert.equal(requests[2]!.url, `${BASE_URL}/submit-signature`);
  assert.equal(requests[3]!.url, `${BASE_URL}/status/quote%2Flz%201?txHash=0xabc`);
  assert.equal(requests[2]!.body.includes('secret-test-key'), false);
});
