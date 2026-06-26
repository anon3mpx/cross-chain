import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';

import { buildPartnerAPI } from '../../src/vps/api/PartnerAPI';
import { ApiKeyManager, PartnerTier } from '../../src/vps/services/ApiKeyManager';
import { IntentEngine } from '../../src/vps/services/IntentEngine';
import { IntentService } from '../../src/vps/services/IntentService';
import { Rail, SettlementToken, type OfferSet, type QuoteResult } from '../../src/vps/types';

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

function makeOfferSet(): OfferSet {
  return {
    offerSetId: 'offer-set-1',
    expiresAt: Math.floor(Date.now() / 1000) + 60,
    bestOfferId: 'offer-1',
    offers: [{
      offerId: 'offer-1',
      rail: Rail.CCTP,
      offerType: 'cctp_standard',
      railType: 'messaging',
      srcChainId: 8453,
      dstChainId: 10,
      tokenIn: '0x0000000000000000000000000000000000000001',
      tokenOut: '0x0000000000000000000000000000000000000002',
      amountIn: 1_000_000n,
      estimatedOut: 995_000n,
      minAmountOut: 990_000n,
      expiresAt: Math.floor(Date.now() / 1000) + 60,
      executionMode: 'router_intent',
      sourceSettlementAsset: {
        canonicalAssetId: 'src-usdc',
        providerAssetId: 'src-usdc',
        tokenAddress: '0x0000000000000000000000000000000000000001',
        decimals: 6,
        assetKind: 'erc20',
      },
      destinationSettlementAsset: {
        canonicalAssetId: 'dst-usdc',
        providerAssetId: 'dst-usdc',
        tokenAddress: '0x0000000000000000000000000000000000000002',
        decimals: 6,
        assetKind: 'erc20',
      },
      economics: {
        providerFeeUSD: 0.1,
        protocolFeeUSD: 0,
        sourceGasUSD: 0,
        settlementTimeSeconds: 30,
      },
      execution: {
        quote: makeQuote(),
      },
    }],
  };
}

function makeQuote(): QuoteResult {
  return {
    intentId: '0x' + '1'.repeat(64),
    srcChainId: 8453,
    dstChainId: 10,
    tokenIn: '0x0000000000000000000000000000000000000001',
    tokenOut: '0x0000000000000000000000000000000000000002',
    amountIn: 1_000_000n,
    estimatedOut: 995_000n,
    minAmountOut: 990_000n,
    minSrcSwapOut: 0n,
    feeAmountUSD: 0.1,
    feeAmountToken: 0n,
    rail: Rail.CCTP,
    railType: 'messaging',
    settlementToken: SettlementToken.USDC,
    settlementAssetId: '0x' + '0'.repeat(64),
    expectedDstSettlementToken: '0x0000000000000000000000000000000000000002',
    expectedDstSettlementAssetId: '0x' + '1'.repeat(64),
    minSettlementAmount: 995_000n,
    dstGasLimit: 250_000,
    etaSeconds: 30,
    expiresAt: Math.floor(Date.now() / 1000) + 60,
    railPluginId: '0x' + '2'.repeat(64),
    railData: '0x',
    swapPluginIdSrc: '0x' + '0'.repeat(64),
    swapPluginIdDst: '0x' + '0'.repeat(64),
    swapDataSrc: '0x',
    swapDataDst: '0x',
  };
}

test('PartnerAPI surfaces explicit destination-gas downgrade reasons when auto-fund is not enabled', async () => {
  const previous = process.env.ENABLE_AUTO_FUND_DESTINATION_GAS;
  delete process.env.ENABLE_AUTO_FUND_DESTINATION_GAS;

  const keyManager = new ApiKeyManager();
  const partner = await keyManager.registerPartner({
    active: true,
    contactEmail: 'ops@example.com',
    feeShareBps: 0,
    maxTxPerDay: 100,
    name: 'Partner',
    quotesPerMin: 100,
    tier: PartnerTier.FREE,
  });

  const quoteEngine = {
    async getOffers() { return makeOfferSet(); },
    async getQuote() { return makeQuote(); },
    buildGasZipComposition() { return null; },
  } as any;

  const app = express();
  app.use(express.json());
  app.use('/partner', buildPartnerAPI(
    keyManager,
    new IntentService(new IntentEngine()),
    quoteEngine,
    { getProvider() { throw new Error('unused'); } } as any,
  ));

  const server = await listen(app);
  try {
    const res = await fetch(`${server.baseUrl}/partner/quote`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': partner.apiKey,
      },
      body: JSON.stringify({
        tokenIn: '0x0000000000000000000000000000000000000001',
        tokenOut: '0x0000000000000000000000000000000000000002',
        amountIn: '1000000',
        srcChainId: 8453,
        dstChainId: 10,
        userAddress: '0x0000000000000000000000000000000000000003',
        autoFundDestinationGas: { topUpUsd: 2 },
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.destinationGasDecision.outcome, 'feature_disabled');
    assert.equal(body.destinationGasDecision.effectiveDestinationGas.length, 0);
  } finally {
    await server.close();
    if (previous === undefined) delete process.env.ENABLE_AUTO_FUND_DESTINATION_GAS;
    else process.env.ENABLE_AUTO_FUND_DESTINATION_GAS = previous;
  }
});

test('PartnerAPI returns auto-attached destination-gas details and forwards the effective request to the quote engine', async () => {
  const previous = process.env.ENABLE_AUTO_FUND_DESTINATION_GAS;
  process.env.ENABLE_AUTO_FUND_DESTINATION_GAS = '1';

  const keyManager = new ApiKeyManager();
  const partner = await keyManager.registerPartner({
    active: true,
    contactEmail: 'ops@example.com',
    feeShareBps: 0,
    maxTxPerDay: 100,
    name: 'Partner',
    quotesPerMin: 100,
    tier: PartnerTier.FREE,
  });

  const seenRequests: any[] = [];
  const quoteEngine = {
    async getOffers(req: any) {
      seenRequests.push(req);
      return makeOfferSet();
    },
    async getQuote(req: any) {
      seenRequests.push(req);
      return makeQuote();
    },
    buildGasZipComposition(req: any) {
      return {
        kind: 'primary_transfer_with_gaszip_destination_gas',
        primaryTransferOfferId: 'offer-1',
        gasZipDestinationGasOfferId: 'offer-gas',
        primaryTransferOffer: makeOfferSet().offers[0],
        gasZipDestinationGasOffer: {
          ...makeOfferSet().offers[0],
          offerId: 'offer-gas',
          rail: Rail.GASZIP,
          offerType: 'gaszip_api_direct',
          executionMode: 'provider_direct',
        },
        executionPlan: [],
        uxHints: {
          destinationGasProvider: 'gaszip',
          destinationGasIncluded: true,
          recommendedExecution: 'primary_then_gas',
          atomic: false,
        },
      };
    },
  } as any;

  const app = express();
  app.use(express.json());
  app.use('/partner', buildPartnerAPI(
    keyManager,
    new IntentService(new IntentEngine()),
    quoteEngine,
    {
      getProvider() {
        return {
          async send(method: string) {
            assert.equal(method, 'eth_getBalance');
            return '0x0';
          },
        };
      },
    } as any,
  ));

  const server = await listen(app);
  try {
    const res = await fetch(`${server.baseUrl}/partner/quote`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': partner.apiKey,
      },
      body: JSON.stringify({
        tokenIn: '0x0000000000000000000000000000000000000001',
        tokenOut: '0x0000000000000000000000000000000000000002',
        amountIn: '1000000',
        srcChainId: 8453,
        dstChainId: 10,
        userAddress: '0x0000000000000000000000000000000000000003',
        autoFundDestinationGas: { topUpUsd: 2, thresholdUsd: 1 },
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json() as any;
    assert.equal(body.destinationGasDecision.outcome, 'auto_attached');
    assert.equal(body.destinationGasDecision.autoAdded.length, 1);
    assert.equal(body.gasZipComposition.kind, 'primary_transfer_with_gaszip_destination_gas');
    assert.equal(seenRequests[0].destinationGas.length, 1);
    assert.equal(seenRequests[1].destinationGas.length, 1);
  } finally {
    await server.close();
    if (previous === undefined) delete process.env.ENABLE_AUTO_FUND_DESTINATION_GAS;
    else process.env.ENABLE_AUTO_FUND_DESTINATION_GAS = previous;
  }
});
