import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';

import { buildAdminAPI } from '../../src/vps/api/AdminAPI';
import { IntentService } from '../../src/vps/services/IntentService';
import { IntentEngine } from '../../src/vps/services/IntentEngine';

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

test('AdminAPI exposes reliability and oracle observability endpoints behind admin auth', async () => {
  const previous = process.env.VPS_ADMIN_API_KEY;
  process.env.VPS_ADMIN_API_KEY = 'x'.repeat(32);

  const app = express();
  app.use(express.json());
  app.use('/admin', buildAdminAPI(
    new IntentService(new IntentEngine()),
    {
      async insert() {},
      async windowedRailStats() {
        return [{ rail: 'CCTP', total: 1, settled: 1, failed: 0, stuck: 0, successRate: 1, p50ActualEtaS: 5, p50QuotedEtaS: 5, meanSlippageBps: 0 }];
      },
      async windowedRouteStats() {
        return { rail: 'CCTP', total: 1, settled: 1, failed: 0, stuck: 0, successRate: 1, p50ActualEtaS: 5, p50QuotedEtaS: 5, meanSlippageBps: 0 };
      },
      async windowedTierStats() {
        return [{
          executionMode: 'provider_direct',
          total: 1,
          settled: 1,
          failed: 0,
          stuck: 0,
          successRate: 1,
        }];
      },
    },
    {
      snapshot() {
        return {
          nativeBy: [],
          tokenBy: [],
          sizes: { native: 0, token: 0 },
          counters: {
            nativeFreshHit: 0,
            nativeStaleHit: 0,
            nativeColdMiss: 0,
            nativeRefreshFail: 0,
            tokenFreshHit: 0,
            tokenStaleHit: 0,
            tokenColdMiss: 0,
            tokenRefreshFail: 0,
          },
          hitRates: {
            nativeFreshPct: 0,
            nativeColdMissPct: 0,
            nativeFailPct: 0,
            tokenFreshPct: 0,
            tokenColdMissPct: 0,
            tokenFailPct: 0,
          },
          ttlMs: 1000,
          inflight: { native: 0, token: 0 },
        };
      },
      resetCounters() {},
    } as any,
  ));

  const server = await listen(app);
  try {
    const headers = { 'x-admin-key': process.env.VPS_ADMIN_API_KEY! };

    const reliabilityRes = await fetch(`${server.baseUrl}/admin/reliability`, { headers });
    assert.equal(reliabilityRes.status, 200);
    const reliabilityBody = await reliabilityRes.json() as any;
    assert.equal(reliabilityBody.stats[0].rail, 'CCTP');

    const tierRes = await fetch(`${server.baseUrl}/admin/reliability/tier`, { headers });
    assert.equal(tierRes.status, 200);
    const tierBody = await tierRes.json() as any;
    assert.equal(tierBody.stats[0].executionMode, 'provider_direct');

    const oracleRes = await fetch(`${server.baseUrl}/admin/oracle/snapshot`, { headers });
    assert.equal(oracleRes.status, 200);
    const oracleBody = await oracleRes.json() as any;
    assert.equal(oracleBody.ttlMs, 1000);
  } finally {
    await server.close();
    if (previous === undefined) delete process.env.VPS_ADMIN_API_KEY;
    else process.env.VPS_ADMIN_API_KEY = previous;
  }
});
