import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { IntentEngine } from '../../src/vps/services/IntentEngine';
import { IntentService } from '../../src/vps/services/IntentService';
import { QuoteEngine } from '../../src/vps/services/QuoteEngine';
import { buildStatusAPI } from '../../src/vps/api/StatusAPI';
import { IntentStatus, Rail } from '../../src/vps/types';

const USER = '0x3333333333333333333333333333333333333333';
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const ARB_USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
const API_PREFIX = '/api/v1';

async function listen(app: express.Express) {
  const server = await new Promise<ReturnType<express.Express['listen']>>((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });

  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    },
  };
}

test('StatusAPI exposes LayerZero Value Transfer API discovery and intent-bound execution helpers', async () => {
  const intentService = new IntentService(new IntentEngine());
  const quoteEngine = new QuoteEngine(undefined, {
    thorchainQuoteWorker: undefined,
    layerZeroValueTransferApiQuoteWorker: {
      quoteLayerZeroValueTransferApi: async () => ({
        quote: {
          id: 'quote_lz_direct',
          feeUsd: '0.50',
          srcAmount: '1000000',
          dstAmount: '997000',
          dstAmountMin: '990000',
          routeSteps: [{ type: 'STARGATE_V2_TAXI', srcChainKey: 'base' }],
          userSteps: [{
            type: 'TRANSACTION',
            chainKey: 'base',
            chainType: 'EVM',
            signerAddress: USER,
            transaction: {
              encoded: {
                chainId: 8453,
                to: '0x27a16dc786820B16E5c9028b75B99F6f604b5d26',
                data: '0x1234',
                value: '0',
              },
            },
          }],
        },
        sourceToken: {
          chainKey: 'base',
          address: BASE_USDC,
          decimals: 6,
          symbol: 'USDC',
          name: 'USD Coin',
        },
        destinationToken: {
          chainKey: 'arbitrum',
          address: ARB_USDC,
          decimals: 6,
          symbol: 'USDC',
          name: 'USD Coin',
        },
        expectedAmountOut: '997000',
        minAmountOut: '990000',
        feeUsd: 0.5,
        settlementTimeSeconds: 45,
        userSteps: [],
      }),
    },
  });

  let capturedTokenRequest: unknown;
  let capturedBuildUserStepsRequest: unknown;
  let capturedSubmitSignatureRequest: unknown;
  const app = buildStatusAPI(intentService, quoteEngine, {
    layerZeroValueTransferApiClient: {
      listLayerZeroValueTransferApiChains: async () => ({
        chains: [{
          name: 'Base',
          shortName: 'Base',
          chainKey: 'base',
          chainType: 'EVM',
          chainId: 8453,
        }],
      }),
      listLayerZeroValueTransferApiTokens: async (request) => {
        capturedTokenRequest = request;
        return {
          tokens: [{
            isSupported: true,
            chainKey: 'base',
            address: BASE_USDC,
            decimals: 6,
            symbol: 'USDC',
            name: 'USD Coin',
          }],
        };
      },
      buildLayerZeroValueTransferApiUserSteps: async (request) => {
        capturedBuildUserStepsRequest = request;
        return {
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
        };
      },
      submitLayerZeroValueTransferApiSignature: async (request) => {
        capturedSubmitSignatureRequest = request;
        return {};
      },
    },
  });

  const server = await listen(app);
  try {
    const chainsRes = await fetch(`${server.baseUrl}${API_PREFIX}/layerzero-value-transfer-api/chains`);
    assert.equal(chainsRes.status, 200);
    const chains = await chainsRes.json() as any;
    assert.equal(chains.chains[0].chainKey, 'base');

    const tokensRes = await fetch(
      `${server.baseUrl}${API_PREFIX}/layerzero-value-transfer-api/tokens?transferrableFromChainKey=base&transferrableFromTokenAddress=${BASE_USDC}&nextToken=abc`,
    );
    assert.equal(tokensRes.status, 200);
    assert.deepEqual(capturedTokenRequest, {
      transferrableFromChainKey: 'base',
      transferrableFromTokenAddress: BASE_USDC,
      nextToken: 'abc',
    });

    const quoteRes = await fetch(`${server.baseUrl}${API_PREFIX}/quote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tokenIn: BASE_USDC,
        tokenOut: ARB_USDC,
        amountIn: '1000000',
        srcChainId: 8453,
        dstChainId: 42161,
        userAddress: USER,
      }),
    });
    assert.equal(quoteRes.status, 200);
    const quoteBody = await quoteRes.json() as any;
    const lzOffer = quoteBody.offerSet.offers.find((offer: any) =>
      offer.rail === Rail.LAYERZERO && offer.offerType === 'lz_api_direct'
    );
    assert.ok(lzOffer);
    assert.equal('quote' in quoteBody, false);

    const selectRes = await fetch(`${server.baseUrl}${API_PREFIX}/quote/select`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        offerSetId: quoteBody.offerSet.offerSetId,
        offerId: lzOffer.offerId,
        userAddress: USER,
      }),
    });
    assert.equal(selectRes.status, 200);
    const selected = await selectRes.json() as any;
    assert.equal(selected.integration.action.kind, 'layerzero_value_transfer_api');

    const buildStepsRes = await fetch(
      `${server.baseUrl}${API_PREFIX}/layerzero-value-transfer-api/intents/quote_lz_direct/build-user-steps`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      },
    );
    assert.equal(buildStepsRes.status, 200);
    const buildSteps = await buildStepsRes.json() as any;
    assert.equal(buildSteps.userSteps[0].chainType, 'SOLANA');
    assert.deepEqual(capturedBuildUserStepsRequest, { quoteId: 'quote_lz_direct' });

    const submittedRes = await fetch(
      `${server.baseUrl}${API_PREFIX}/layerzero-value-transfer-api/intents/quote_lz_direct/submitted`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userAddress: USER, sourceTxHash: '0xsource' }),
      },
    );
    assert.equal(submittedRes.status, 202);

    const submitSignatureRes = await fetch(
      `${server.baseUrl}${API_PREFIX}/layerzero-value-transfer-api/intents/quote_lz_direct/submit-signature`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signatures: ['0x1234'] }),
      },
    );
    assert.equal(submitSignatureRes.status, 200);
    assert.deepEqual(capturedSubmitSignatureRequest, {
      quoteId: 'quote_lz_direct',
      signatures: ['0x1234'],
    });

    const intent = await intentService.getIntent(selected.intentId);
    assert.equal(intent?.status, IntentStatus.SUBMITTED);
    assert.equal(intent?.srcTxHash, '0xsource');
    const transfer = await intentService.getProviderTransfer({
      intentId: selected.intentId,
      provider: 'layerzero_value_transfer_api',
      providerQuoteId: 'quote_lz_direct',
    });
    assert.equal(transfer?.status, 'SUBMITTED');
    assert.equal(transfer?.sourceTxHash, '0xsource');
    assert.equal(transfer?.sourceSignature, '0x1234');
    assert.equal(transfer?.latestProviderStatus, 'SIGNATURE_SUBMITTED');
    assert.deepEqual(transfer?.routeStepTypes, ['STARGATE_V2_TAXI']);
  } finally {
    await server.close();
  }
});
