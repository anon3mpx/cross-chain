import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';

import { WebSocketAPI } from '../../src/vps/api/WebSocketAPI';
import { ApiKeyManager, PartnerTier } from '../../src/vps/services/ApiKeyManager';
import { IntentEngine } from '../../src/vps/services/IntentEngine';
import { IntentStatus, Rail } from '../../src/vps/types';

test('WebSocketAPI accepts API key auth via Sec-WebSocket-Protocol', async () => {
  const keyManager = new ApiKeyManager();
  const partner = await keyManager.registerPartner({
    active: true,
    contactEmail: 'ops@example.com',
    feeShareBps: 0,
    maxTxPerDay: 100,
    name: 'Test Partner',
    quotesPerMin: 100,
    tier: PartnerTier.FREE,
  });

  const intentId = '0x' + '33'.repeat(32);
  const intentEngine = new IntentEngine();
  intentEngine.upsert({
    intentId,
    status: IntentStatus.QUOTED,
    userAddress: '0x3333333333333333333333333333333333333333',
    quote: {
      rail: Rail.CCTP,
      etaSeconds: 30,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    retryCount: 0,
  } as any);

  const api = new WebSocketAPI(0, intentEngine, keyManager);
  const port = ((api as any).wss.address() as any).port;

  try {
    const message = await new Promise<any>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/intent/${intentId}`, ['rflo-auth', partner.apiKey]);
      ws.once('message', (raw) => {
        try {
          resolve(JSON.parse(String(raw)));
        } catch (err) {
          reject(err);
        } finally {
          ws.close();
        }
      });
      ws.once('error', reject);
    });

    assert.equal(message.status, IntentStatus.QUOTED);
    assert.equal(message.intentId, intentId);
  } finally {
    await new Promise<void>((resolve, reject) => {
      (api as any).wss.close((err: Error | undefined) => err ? reject(err) : resolve());
    });
  }
});
