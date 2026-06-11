import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { buildPartnerAPI } from '../../src/vps/api/PartnerAPI';
import { ApiKeyManager, PartnerTier } from '../../src/vps/services/ApiKeyManager';
import { IntentService } from '../../src/vps/services/IntentService';
import { IntentEngine } from '../../src/vps/services/IntentEngine';
import { QuoteEngine } from '../../src/vps/services/QuoteEngine';
import { RpcProviderRegistry } from '../../src/vps/services/RpcProviderRegistry';

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

test('PartnerAPI exposes basket quote and solver list surfaces', async () => {
  const keyManager = new ApiKeyManager();
  const partner = keyManager.registerPartner({
    active: true,
    contactEmail: 'ops@example.com',
    feeShareBps: 0,
    maxTxPerDay: 100,
    name: 'Partner',
    quotesPerMin: 100,
    tier: PartnerTier.FREE,
  });

  const app = express();
  app.use(express.json());
  app.use('/partner', buildPartnerAPI(
    keyManager,
    new IntentService(new IntentEngine()),
    new QuoteEngine(undefined, { thorchainQuoteWorker: undefined }),
    new RpcProviderRegistry({ disableFreeRpcs: true, env: { CHAIN_8453_RPC_1: 'https://base.example' } }),
    undefined,
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
      solversRepository: {
        listWithStats: async () => [{ id: 'solver_1', type: 'external', displayName: 'Solver 1', capabilities: {}, active: true, createdAt: 1, updatedAt: 1 }],
      } as any,
    },
  ));

  const server = await listen(app);
  try {
    const quoteRes = await fetch(`${server.baseUrl}/partner/basket/quote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': partner.apiKey },
      body: JSON.stringify({
        basket: {
          mode: 'multi-to-one',
          inputs: [{ chainId: 8453, token: '0x1', amount: '1000', wallet: '0x3333333333333333333333333333333333333333' }],
          outputs: [{ chainId: 8453, token: '0x2', recipient: '0x3333333333333333333333333333333333333333' }],
          constraints: {},
        },
      }),
    });
    assert.equal(quoteRes.status, 200);

    const solversRes = await fetch(`${server.baseUrl}/partner/solvers`, {
      headers: { 'x-api-key': partner.apiKey },
    });
    assert.equal(solversRes.status, 200);
    const solversBody = await solversRes.json() as any;
    assert.equal(solversBody.solvers[0]?.id, 'solver_1');
  } finally {
    await server.close();
  }
});

test('PartnerAPI rejects ERC-7683 solver requests for inactive solvers', async () => {
  const keyManager = new ApiKeyManager();
  const partner = keyManager.registerPartner({
    active: true,
    contactEmail: 'ops@example.com',
    feeShareBps: 0,
    maxTxPerDay: 100,
    name: 'Partner',
    quotesPerMin: 100,
    tier: PartnerTier.FREE,
  });

  const app = express();
  app.use(express.json());
  app.use('/partner', buildPartnerAPI(
    keyManager,
    new IntentService(new IntentEngine()),
    new QuoteEngine(undefined, { thorchainQuoteWorker: undefined }),
    new RpcProviderRegistry({ disableFreeRpcs: true, env: { CHAIN_8453_RPC_1: 'https://base.example' } }),
    undefined,
    {
      erc7683Adapter: {
        resolve: async () => ({}) ,
      } as any,
      solversRepository: {
        get: async () => ({ id: 'solver_1', type: 'external', displayName: 'Solver 1', capabilities: {}, active: false, createdAt: 1, updatedAt: 1 }),
      } as any,
    },
  ));

  const server = await listen(app);
  try {
    const res = await fetch(`${server.baseUrl}/partner/erc7683/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': partner.apiKey },
      body: JSON.stringify({
        solverId: 'solver_1',
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

    assert.equal(res.status, 400);
  } finally {
    await server.close();
  }
});
