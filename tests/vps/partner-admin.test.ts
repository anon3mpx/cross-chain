import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';

import { buildAdminAPI } from '../../src/vps/api/AdminAPI';
import { InMemoryPartnerRepository } from '../../src/vps/db/InMemoryPartnerRepository';
import { ApiKeyManager, PartnerTier } from '../../src/vps/services/ApiKeyManager';
import { IntentEngine } from '../../src/vps/services/IntentEngine';
import { IntentService } from '../../src/vps/services/IntentService';

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

test('admin partner lifecycle endpoints require x-admin-key and update tier/activity', async () => {
  const previous = process.env.VPS_ADMIN_API_KEY;
  process.env.VPS_ADMIN_API_KEY = 'x'.repeat(32);
  const repository = new InMemoryPartnerRepository();
  const keyManager = new ApiKeyManager({ repository });
  const partner = await keyManager.registerPartner({
    active: true,
    contactEmail: 'ops@example.com',
    feeShareBps: 0,
    maxTxPerDay: 500,
    name: 'Ops Partner',
    quotesPerMin: 60,
    tier: PartnerTier.FREE,
  });
  const apiKeyPrefix = partner.apiKey.slice(0, 12);

  const app = express();
  app.use(express.json());
  app.use('/admin', buildAdminAPI(
    new IntentService(new IntentEngine()),
    undefined,
    undefined,
    { partnerRepository: repository },
  ));

  const server = await listen(app);
  try {
    const unauthorized = await fetch(`${server.baseUrl}/admin/partners/${apiKeyPrefix}/tier`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tier: 'GROWTH' }),
    });
    assert.equal(unauthorized.status, 401);

    const headers = {
      'x-admin-key': process.env.VPS_ADMIN_API_KEY!,
      'content-type': 'application/json',
    };
    const tierRes = await fetch(`${server.baseUrl}/admin/partners/${apiKeyPrefix}/tier`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tier: 'GROWTH' }),
    });
    assert.equal(tierRes.status, 200);
    const tierBody = await tierRes.json() as any;
    assert.equal(tierBody.partner.tier, 'GROWTH');
    assert.equal(tierBody.partner.apiKey, undefined);
    assert.equal(tierBody.partner.apiKeyHash, undefined);

    const originsRes = await fetch(`${server.baseUrl}/admin/partners/${apiKeyPrefix}/allowed-origins`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ allowedOrigins: ['https://app.partner.example'] }),
    });
    assert.equal(originsRes.status, 200);
    const originsBody = await originsRes.json() as any;
    assert.deepEqual(originsBody.partner.allowedOrigins, ['https://app.partner.example']);

    const deactivateRes = await fetch(`${server.baseUrl}/admin/partners/${apiKeyPrefix}/deactivate`, {
      method: 'POST',
      headers,
    });
    assert.equal(deactivateRes.status, 200);
    const check = await keyManager.validateKey(partner.apiKey);
    assert.deepEqual(check, { allowed: false, reason: 'INACTIVE' });
  } finally {
    await server.close();
    if (previous === undefined) delete process.env.VPS_ADMIN_API_KEY;
    else process.env.VPS_ADMIN_API_KEY = previous;
  }
});
