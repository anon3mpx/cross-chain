import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';

import { buildPartnerAPI } from '../../src/vps/api/PartnerAPI';
import { InMemoryPartnerRepository } from '../../src/vps/db/InMemoryPartnerRepository';
import { ApiKeyManager, PARTNER_TIER_DEFINITIONS, PartnerTier } from '../../src/vps/services/ApiKeyManager';
import { IntentEngine } from '../../src/vps/services/IntentEngine';
import { IntentService } from '../../src/vps/services/IntentService';
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

function partnerApp(repository = new InMemoryPartnerRepository()) {
  const app = express();
  const keyManager = new ApiKeyManager({ repository });
  app.use(express.json());
  app.use('/partner', buildPartnerAPI(
    keyManager,
    new IntentService(new IntentEngine()),
    new QuoteEngine(undefined, { thorchainQuoteWorker: undefined }),
    new RpcProviderRegistry({ disableFreeRpcs: true }),
  ));
  return { app, keyManager, repository };
}

test('partner tier definitions match the public product model', () => {
  assert.deepEqual(Object.keys(PARTNER_TIER_DEFINITIONS), [
    PartnerTier.FREE,
    PartnerTier.GROWTH,
    PartnerTier.PARTNER,
    PartnerTier.ENTERPRISE,
  ]);
  assert.equal(PARTNER_TIER_DEFINITIONS.FREE.quotesPerMin, 60);
  assert.equal(PARTNER_TIER_DEFINITIONS.GROWTH.feeShareBps, 1500);
  assert.equal(PARTNER_TIER_DEFINITIONS.PARTNER.sla, '99.5%');
  assert.equal(PARTNER_TIER_DEFINITIONS.ENTERPRISE.maxTxPerDay, 500_000);
});

test('PartnerAPI exposes public tier definitions without an api key', async () => {
  const { app } = partnerApp();
  const server = await listen(app);
  try {
    const res = await fetch(`${server.baseUrl}/partner/tiers`);
    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.defaultTier, PartnerTier.FREE);
    assert.equal(body.tiers.FREE.quotesPerMin, 60);
    assert.equal(body.tiers.GROWTH.approval, 'approval_required');
  } finally {
    await server.close();
  }
});

test('PartnerAPI registers FREE partners and returns a one-time key response', async () => {
  const { app, keyManager } = partnerApp();
  const server = await listen(app);
  try {
    const res = await fetch(`${server.baseUrl}/partner/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Dev App',
        contactEmail: 'dev@example.com',
        webhookUrl: 'https://partner.example/webhook',
        payoutAddress: '0x3333333333333333333333333333333333333333',
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json() as any;
    assert.match(body.apiKey, /^rflo_/);
    assert.equal(typeof body.webhookSecret, 'string');
    assert.equal(body.tier, PartnerTier.FREE);
    assert.equal(body.limits.quotesPerMin, 60);

    const check = await keyManager.validateKey(body.apiKey);
    assert.equal(check.allowed, true);
    if (check.allowed) {
      assert.equal(check.partner.contactEmail, 'dev@example.com');
      assert.equal(check.partner.webhookSecret, '');
    }
  } finally {
    await server.close();
  }
});

test('ApiKeyManager can validate a key through a shared partner repository', async () => {
  const repository = new InMemoryPartnerRepository();
  const manager = new ApiKeyManager({ repository });
  const partner = await manager.registerPartner({
    active: true,
    contactEmail: 'dev@example.com',
    feeShareBps: 0,
    maxTxPerDay: 500,
    name: 'Dev App',
    quotesPerMin: 60,
    tier: PartnerTier.FREE,
  });

  const restartedManager = new ApiKeyManager({ repository });
  const check = await restartedManager.validateKey(partner.apiKey);
  assert.equal(check.allowed, true);
  if (check.allowed) {
    assert.equal(check.partner.contactEmail, 'dev@example.com');
  }
});
