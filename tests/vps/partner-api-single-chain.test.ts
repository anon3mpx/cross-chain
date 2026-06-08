import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';

import { buildPartnerAPI } from '../../src/vps/api/PartnerAPI';
import { ApiKeyManager, PartnerTier } from '../../src/vps/services/ApiKeyManager';
import { IntentService } from '../../src/vps/services/IntentService';
import { IntentEngine } from '../../src/vps/services/IntentEngine';
import { QuoteEngine } from '../../src/vps/services/QuoteEngine';
import { SwapAdapter } from '../../src/vps/sdk/swapAdapter';
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

test('PartnerAPI exposes same-chain swap route and forwards execution context metadata', async () => {
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

  let captured: any;
  const originalSwap = SwapAdapter.prototype.swap;
  SwapAdapter.prototype.swap = async function (request: any, ctx: any) {
    captured = { request, ctx };
    return {
      tradeInfo: { amountOut: '123' },
      calldata: { to: '0x1111111111111111111111111111111111111111', data: '0x1234', value: '0', chainId: request.chainId },
      swapType: 'EXACT_IN',
    } as any;
  };

  const app = express();
  app.use(express.json());
  app.use('/partner', buildPartnerAPI(
    keyManager,
    new IntentService(new IntentEngine()),
    new QuoteEngine(undefined, { thorchainQuoteWorker: undefined }),
    new RpcProviderRegistry({ disableFreeRpcs: true, env: { CHAIN_8453_RPC_1: 'https://base.example' } }),
  ));

  const server = await listen(app);
  try {
    const res = await fetch(`${server.baseUrl}/partner/swap-single-chain`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': partner.apiKey,
        'x-request-id': 'rq_test123',
      },
      body: JSON.stringify({
        chainId: 8453,
        tokenIn: '0x0000000000000000000000000000000000000001',
        tokenOut: '0x0000000000000000000000000000000000000002',
        amountIn: '1000000',
        recipient: '0x0000000000000000000000000000000000000003',
        slippageBps: 42,
        integratorId: 'wallet-x',
        agentId: 'agent-y',
        rpcProviders: { 8453: 'https://byo.example' },
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.swapType, 'EXACT_IN');
    assert.equal(captured.request.chainId, 8453);
    assert.equal(captured.ctx.integratorId, 'wallet-x');
    assert.equal(captured.ctx.agentId, 'agent-y');
    assert.equal(captured.ctx.rpcProviders[8453], 'https://byo.example');
  } finally {
    SwapAdapter.prototype.swap = originalSwap;
    await server.close();
  }
});
