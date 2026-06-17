import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { buildPartnerApiApp, buildVpsApiApp } from '../../src/vps/app/http';

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

function runtimeWithPartnerRouter() {
  const partnerRouter = express.Router();
  partnerRouter.get('/ping', (_req, res) => res.json({ ok: true, surface: 'partner' }));

  return {
    intentService: {} as any,
    quoteEngine: {} as any,
    rpcProviderRegistry: undefined,
    idempotency: undefined,
    basketQuoteEngine: undefined,
    basketStatusEngine: undefined,
    walletScanner: undefined,
    walletLiquidator: undefined,
    erc7683Adapter: undefined,
    solversRepository: undefined,
    reliability: undefined,
    usdOracle: undefined,
    partnerApiRouter: partnerRouter,
  };
}

test('buildVpsApiApp keeps partner routes off the app-facing service', async () => {
  const app = buildVpsApiApp(runtimeWithPartnerRouter() as any);
  const server = await listen(app);

  try {
    const res = await fetch(`${server.baseUrl}/partner/ping`);
    assert.equal(res.status, 404);
  } finally {
    await server.close();
  }
});

test('buildPartnerApiApp serves only partner routes under /partner', async () => {
  const app = buildPartnerApiApp(runtimeWithPartnerRouter() as any);
  const server = await listen(app);

  try {
    const partnerRes = await fetch(`${server.baseUrl}/partner/ping`);
    assert.equal(partnerRes.status, 200);
    assert.deepEqual(await partnerRes.json(), { ok: true, surface: 'partner' });

    const statusRes = await fetch(`${server.baseUrl}/api/v1/health`);
    assert.equal(statusRes.status, 404);
  } finally {
    await server.close();
  }
});

test('buildPartnerApiApp applies partner-specific CORS allowlist', async () => {
  const original = process.env.PARTNER_API_CORS_ORIGIN;
  process.env.PARTNER_API_CORS_ORIGIN = 'https://partners.example,https://app.empx.io';
  const app = buildPartnerApiApp(runtimeWithPartnerRouter() as any);
  const server = await listen(app);

  try {
    const allowed = await fetch(`${server.baseUrl}/partner/ping`, {
      method: 'OPTIONS',
      headers: {
        origin: 'https://app.empx.io',
        'access-control-request-method': 'GET',
      },
    });
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://app.empx.io');
    assert.equal(allowed.headers.get('vary'), 'Origin');

    const blocked = await fetch(`${server.baseUrl}/partner/ping`, {
      method: 'OPTIONS',
      headers: {
        origin: 'https://blocked.example',
        'access-control-request-method': 'GET',
      },
    });
    assert.equal(blocked.status, 204);
    assert.equal(blocked.headers.get('access-control-allow-origin'), null);
  } finally {
    if (original === undefined) {
      delete process.env.PARTNER_API_CORS_ORIGIN;
    } else {
      process.env.PARTNER_API_CORS_ORIGIN = original;
    }
    await server.close();
  }
});

