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
import { IntentStatus, Rail, SettlementToken, type QuoteResult } from '../../src/vps/types';

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

function makePhase5Quote(intentId: string): QuoteResult {
  return {
    intentId,
    srcChainId: 0,
    dstChainId: 137,
    tokenIn: 'BTC',
    tokenOut: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    amountIn: 100_000_000n,
    estimatedOut: 970_000n,
    minAmountOut: 965_000n,
    minSrcSwapOut: 0n,
    feeAmountUSD: 0,
    feeAmountToken: 0n,
    rail: Rail.TELESWAP,
    railType: 'liquidity',
    settlementToken: SettlementToken.USDC,
    settlementAssetId: '0x' + '00'.repeat(32),
    expectedDstSettlementToken: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    expectedDstSettlementAssetId: '0x' + '00'.repeat(32),
    minSettlementAmount: 970_000n,
    dstGasLimit: 0,
    etaSeconds: 1800,
    expiresAt: Math.floor(Date.now() / 1000) + 900,
    railPluginId: '0x' + '00'.repeat(32),
    railData: '0x',
    swapPluginIdSrc: '0x' + '00'.repeat(32),
    swapPluginIdDst: '0x' + '00'.repeat(32),
    swapDataSrc: '0x',
    swapDataDst: '0x',
    offerType: 'teleswap_direct',
    executionMode: 'provider_direct',
    refundAddress: 'bc1qrefundaddress',
    selectedByUser: true,
  };
}

test('PartnerAPI accepts provider-direct submitted callbacks for partner-owned intents', async () => {
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

  const intentService = new IntentService(new IntentEngine());
  const intentId = '0x' + '33'.repeat(32);
  await intentService.createQuotedIntent(
    makePhase5Quote(intentId),
    '0x3333333333333333333333333333333333333333',
    { partnerApiKey: partner.apiKey, partnerId: 'ptn_test', routeSource: 'partner-api' },
  );

  const app = express();
  app.use(express.json());
  app.use('/partner', buildPartnerAPI(
    keyManager,
    intentService,
    new QuoteEngine(undefined, { thorchainQuoteWorker: undefined }),
    new RpcProviderRegistry({ disableFreeRpcs: true, env: { CHAIN_8453_RPC_1: 'https://base.example' } }),
  ));

  const server = await listen(app);
  try {
    const res = await fetch(`${server.baseUrl}/partner/intent/${intentId}/submitted`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': partner.apiKey },
      body: JSON.stringify({
        userAddress: '0x3333333333333333333333333333333333333333',
        sourceTxHash: '0xsource-phase5',
      }),
    });

    assert.equal(res.status, 202);
    const body = await res.json() as any;
    assert.equal(body.intentId, intentId);
    assert.equal(body.status, IntentStatus.SUBMITTED);
    assert.equal(body.srcTxHash, '0xsource-phase5');

    const stored = await intentService.getIntent(intentId);
    assert.equal(stored?.status, IntentStatus.SUBMITTED);
    assert.equal(stored?.srcTxHash, '0xsource-phase5');
  } finally {
    await server.close();
  }
});
