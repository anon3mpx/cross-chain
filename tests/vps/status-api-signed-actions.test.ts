import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { Wallet } from 'ethers';
import type { AddressInfo } from 'node:net';

import { buildStatusAPI } from '../../src/vps/api/StatusAPI';
import { QuoteEngine } from '../../src/vps/services/QuoteEngine';
import { IntentEngine } from '../../src/vps/services/IntentEngine';
import { IntentService } from '../../src/vps/services/IntentService';
import * as intentActionAuth from '../../src/vps/utils/intentActionAuth';
import { Rail } from '../../src/vps/types';

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

test('intent action auth exposes a stable action id builder that varies by nonce', () => {
  const helper = (intentActionAuth as any).buildIntentActionId;
  assert.equal(typeof helper, 'function');

  const first = helper('submitted', {
    intentId: '0x' + '11'.repeat(32),
    userAddress: '0x3333333333333333333333333333333333333333',
    timestamp: 1_700_000_000_000,
    nonce: 'nonce-a',
    srcTxHash: '0xabc',
  });
  const second = helper('submitted', {
    intentId: '0x' + '11'.repeat(32),
    userAddress: '0x3333333333333333333333333333333333333333',
    timestamp: 1_700_000_000_000,
    nonce: 'nonce-b',
    srcTxHash: '0xabc',
  });

  assert.notEqual(first, second);
});

test('StatusAPI can require a nonce for signed intent actions', async () => {
  const previous = process.env.VPS_REQUIRE_INTENT_ACTION_NONCE;
  process.env.VPS_REQUIRE_INTENT_ACTION_NONCE = 'true';

  const wallet = new Wallet('0x' + '11'.repeat(32));
  const intentService = new IntentService(new IntentEngine());
  const quoteEngine = new QuoteEngine(undefined, { thorchainQuoteWorker: undefined });
  const intentId = '0x' + '22'.repeat(32);

  await intentService.createQuotedIntent({
    intentId,
    rail: Rail.CCTP,
    etaSeconds: 30,
  } as any, wallet.address);

  const app = buildStatusAPI(intentService, quoteEngine);
  const server = await listen(app);

  try {
    const timestamp = Date.now();
    const signature = await wallet.signMessage(intentActionAuth.buildIntentActionMessage('submitted', {
      intentId,
      userAddress: wallet.address,
      timestamp,
      srcTxHash: '0xabc123',
    } as any));

    const res = await fetch(`${server.baseUrl}${API_PREFIX}/intent/${intentId}/submitted`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        userAddress: wallet.address,
        signature,
        timestamp,
        srcTxHash: '0xabc123',
      }),
    });

    assert.equal(res.status, 400);
  } finally {
    await server.close();
    if (previous === undefined) delete process.env.VPS_REQUIRE_INTENT_ACTION_NONCE;
    else process.env.VPS_REQUIRE_INTENT_ACTION_NONCE = previous;
  }
});
