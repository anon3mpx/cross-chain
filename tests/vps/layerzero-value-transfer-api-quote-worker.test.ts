import test from 'node:test';
import assert from 'node:assert/strict';
import { LayerZeroValueTransferApiClient } from '../../src/vps/services/layerzero/LayerZeroValueTransferApiClient';
import { LayerZeroValueTransferApiQuoteWorker } from '../../src/vps/services/layerzero/LayerZeroValueTransferApiQuoteWorker';

const USER = '0x3333333333333333333333333333333333333333';
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const ARB_USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

test('LayerZeroValueTransferApiClient sends authenticated quote requests without exposing the API key in the body', async () => {
  let capturedUrl = '';
  let capturedHeaders: Headers;
  let capturedBody = '';
  const client = new LayerZeroValueTransferApiClient({
    baseUrl: 'https://transfer.example.test/v1',
    apiKey: 'secret-test-key',
    fetchFn: (async (url, init) => {
      capturedUrl = String(url);
      capturedHeaders = new Headers(init?.headers);
      capturedBody = String(init?.body ?? '');
      return new Response(JSON.stringify({ quotes: [], tokens: [] }), { status: 200 });
    }) as typeof fetch,
  });

  await client.requestLayerZeroValueTransferApiQuotes({
    srcChainKey: 'base',
    dstChainKey: 'arbitrum',
    srcTokenAddress: BASE_USDC,
    dstTokenAddress: ARB_USDC,
    srcWalletAddress: USER,
    dstWalletAddress: USER,
    amount: '1000000',
  });

  assert.equal(capturedUrl, 'https://transfer.example.test/v1/quotes');
  assert.equal(capturedHeaders!.get('x-api-key'), 'secret-test-key');
  assert.equal(capturedBody.includes('secret-test-key'), false);
});

test('LayerZeroValueTransferApiQuoteWorker maps Value Transfer API quotes into provider-direct results', async () => {
  let capturedRequest: unknown;
  const worker = new LayerZeroValueTransferApiQuoteWorker(
    {
      requestLayerZeroValueTransferApiQuotes: async (request) => {
        capturedRequest = request;
        return {
          quotes: [{
            id: 'quote_lz_1',
            feeUsd: '0.42',
            srcAmount: '1000000',
            dstAmount: '998000',
            dstAmountMin: '990000',
            duration: { estimated: '27600' },
            routeSteps: [{ type: 'STARGATE_V2_TAXI', srcChainKey: 'base' }],
            userSteps: [{
              type: 'TRANSACTION',
              description: 'bridge',
              chainKey: 'base',
              chainType: 'EVM',
              signerAddress: USER,
              transaction: {
                encoded: {
                  chainId: 8453,
                  to: '0x27a16dc786820B16E5c9028b75B99F6f604b5d26',
                  data: '0x1234',
                  value: '456',
                },
              },
            }],
          }],
          tokens: [
            { chainKey: 'base', address: BASE_USDC, decimals: 6, symbol: 'USDC', name: 'USD Coin' },
            { chainKey: 'arbitrum', address: ARB_USDC, decimals: 6, symbol: 'USDC', name: 'USD Coin' },
          ],
        };
      },
    },
    {
      enabled: true,
      allowedAssetSymbols: ['USDC'],
    },
  );

  const result = await worker.quoteLayerZeroValueTransferApi({
    tokenIn: BASE_USDC,
    tokenOut: ARB_USDC,
    amountIn: 1_000_000n,
    srcChainId: 8453,
    dstChainId: 42161,
    userAddress: USER,
  });

  assert.ok(result);
  assert.deepEqual(capturedRequest, {
    srcChainKey: 'base',
    dstChainKey: 'arbitrum',
    srcTokenAddress: BASE_USDC,
    dstTokenAddress: ARB_USDC,
    srcWalletAddress: USER,
    dstWalletAddress: USER,
    amount: '1000000',
  });
  assert.equal(result.quote.id, 'quote_lz_1');
  assert.equal(result.expectedAmountOut, '998000');
  assert.equal(result.minAmountOut, '990000');
  assert.equal(result.feeUsd, 0.42);
  assert.equal(result.settlementTimeSeconds, 28);
  assert.equal(result.sourceToken.symbol, 'USDC');
  assert.equal(result.destinationToken.symbol, 'USDC');
  assert.equal(result.userSteps.length, 1);
});

test('LayerZeroValueTransferApiQuoteWorker omits quotes outside the curated asset allowlist', async () => {
  const worker = new LayerZeroValueTransferApiQuoteWorker(
    {
      requestLayerZeroValueTransferApiQuotes: async () => ({
        quotes: [{
          id: 'quote_lz_pepe',
          feeUsd: '1',
          srcAmount: '1000000',
          dstAmount: '900000',
          dstAmountMin: '890000',
          routeSteps: [{ type: 'OFT', srcChainKey: 'base' }],
          userSteps: [],
        }],
        tokens: [
          { chainKey: 'base', address: BASE_USDC, decimals: 18, symbol: 'PEPE', name: 'Pepe' },
          { chainKey: 'arbitrum', address: ARB_USDC, decimals: 18, symbol: 'PEPE', name: 'Pepe' },
        ],
      }),
    },
    {
      enabled: true,
      allowedAssetSymbols: ['USDC', 'USDT', 'WETH'],
    },
  );

  const result = await worker.quoteLayerZeroValueTransferApi({
    tokenIn: BASE_USDC,
    tokenOut: ARB_USDC,
    amountIn: 1_000_000n,
    srcChainId: 8453,
    dstChainId: 42161,
    userAddress: USER,
  });

  assert.equal(result, null);
});
