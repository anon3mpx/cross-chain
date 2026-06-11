import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { buildStatusAPI } from '../../src/vps/api/StatusAPI';
import { IntentEngine } from '../../src/vps/services/IntentEngine';
import { IntentService } from '../../src/vps/services/IntentService';
import { QuoteEngine } from '../../src/vps/services/QuoteEngine';

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

test('StatusAPI exposes agent basket and erc7683 surfaces', async () => {
  const app = buildStatusAPI(
    new IntentService(new IntentEngine()),
    new QuoteEngine(undefined, {
      thorchainQuoteWorker: undefined,
      layerZeroValueTransferApiQuoteWorker: undefined,
    }),
    {
      basketQuoteEngine: {
        quote: async () => ({
          basketId: 'bkt_1',
          mode: 'multi-to-one',
          legs: [],
          totals: { inputsUsd: 0, outputsUsd: 0, feeUsd: 0, worstEtaSeconds: 0, parallelEtaSeconds: 0 },
          aggregateTier: 'unknown',
          skipped: [],
          effectiveConstraints: {},
          expiresAt: Date.now() + 60_000,
        }),
      } as any,
      erc7683Adapter: {
        resolve: async () => ({
          resolved: {
            user: '0x3333333333333333333333333333333333333333',
            originChainId: 1,
            openDeadline: 1,
            fillDeadline: 2,
            orderId: '0x' + '11'.repeat(32),
            maxSpent: [],
            minReceived: [],
            fillInstructions: [],
          },
          empx: {
            estimatedOut: '100',
            minAmountOut: '90',
            etaSeconds: 60,
            feeUsd: 1,
            executionMode: 'provider_direct',
            revenueTier: 'api-direct',
          },
        }),
      } as any,
    },
  );

  const server = await listen(app);
  try {
    const basketRes = await fetch(`${server.baseUrl}/api/v1/basket/quote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        basket: {
          mode: 'multi-to-one',
          inputs: [{ chainId: 8453, token: '0x1', amount: '1000', wallet: '0x3333333333333333333333333333333333333333' }],
          outputs: [{ chainId: 8453, token: '0x2', recipient: '0x3333333333333333333333333333333333333333' }],
          constraints: {},
        },
      }),
    });
    assert.equal(basketRes.status, 200);

    const ercRes = await fetch(`${server.baseUrl}/api/v1/erc7683/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        orderDataJson: {
          srcChainId: 1,
          dstChainId: 8453,
          tokenIn: '0x1',
          tokenOut: '0x2',
          amountIn: '1000',
          minAmountOut: '900',
          recipient: '0x3333333333333333333333333333333333333333',
        },
      }),
    });
    assert.equal(ercRes.status, 200);
  } finally {
    await server.close();
  }
});

test('StatusAPI solver list returns enriched solver stats', async () => {
  const app = buildStatusAPI(
    new IntentService(new IntentEngine()),
    new QuoteEngine(undefined, {
      thorchainQuoteWorker: undefined,
      layerZeroValueTransferApiQuoteWorker: undefined,
    }),
    {
      solversRepository: {
        listWithStats: async () => [{
          id: 'solver_1',
          type: 'external',
          displayName: 'Solver 1',
          capabilities: {},
          active: true,
          createdAt: 1,
          updatedAt: 1,
          volumeStats: { total: 5, settled: 4, failed: 1, stuck: 0, successRate: 0.8 },
        }],
      } as any,
    },
  );

  const server = await listen(app);
  try {
    const res = await fetch(`${server.baseUrl}/api/v1/solvers`);
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.solvers[0]?.volumeStats?.total, 5);
  } finally {
    await server.close();
  }
});
