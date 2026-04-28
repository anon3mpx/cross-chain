import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';

const BASE_USDC = '0x0000000000000000000000000000000000001001';
const BASE_AXLUSDC = '0x0000000000000000000000000000000000001002';
const BASE_ETH = '0x0000000000000000000000000000000000001003';
const ARB_USDC = '0x0000000000000000000000000000000000002001';
const ARB_AXLUSDC = '0x0000000000000000000000000000000000002002';
const ARB_ETH = '0x0000000000000000000000000000000000002003';

const TEST_ENV: Record<string, string> = {
  CHAIN_8453_TOKEN_CCTP_USDC: BASE_USDC,
  CHAIN_8453_TOKEN_AXELAR_USDC: BASE_AXLUSDC,
  CHAIN_8453_TOKEN_LAYERZERO_USDC: BASE_USDC,
  CHAIN_8453_TOKEN_VIA_LABS_USDC: BASE_USDC,
  CHAIN_8453_TOKEN_THORCHAIN_USDC: BASE_USDC,
  CHAIN_8453_TOKEN_AXELAR_ETH: BASE_ETH,
  CHAIN_8453_TOKEN_LAYERZERO_ETH: BASE_ETH,
  CHAIN_8453_TOKEN_VIA_LABS_ETH: BASE_ETH,
  CHAIN_8453_TOKEN_THORCHAIN_ETH: BASE_ETH,
  CHAIN_42161_TOKEN_CCTP_USDC: ARB_USDC,
  CHAIN_42161_TOKEN_AXELAR_USDC: ARB_AXLUSDC,
  CHAIN_42161_TOKEN_LAYERZERO_USDC: ARB_USDC,
  CHAIN_42161_TOKEN_VIA_LABS_USDC: ARB_USDC,
  CHAIN_42161_TOKEN_THORCHAIN_USDC: ARB_USDC,
  CHAIN_42161_TOKEN_AXELAR_ETH: ARB_ETH,
  CHAIN_42161_TOKEN_LAYERZERO_ETH: ARB_ETH,
  CHAIN_42161_TOKEN_VIA_LABS_ETH: ARB_ETH,
  CHAIN_42161_TOKEN_THORCHAIN_ETH: ARB_ETH,
  CHAIN_8453_ROUTER_V1: '0x1111111111111111111111111111111111111111',
  CHAIN_42161_RECEIVER_V1: '0x2222222222222222222222222222222222222222',
  VPS_INTENT_SIGNER_PRIVATE_KEY: '0x59c6995e998f97a5a0044966f0945382db45d7d771f4f5c4b7b0d5c3d53d4f52',
};

const QUOTE_REQUEST = {
  tokenIn: BASE_USDC,
  tokenOut: ARB_USDC,
  amountIn: '100000000',
  srcChainId: 8453,
  dstChainId: 42161,
  userAddress: '0x3333333333333333333333333333333333333333',
};

function withPatchedEnv(extraEnv: Record<string, string>, fn: () => Promise<void>) {
  const nextEnv = { ...TEST_ENV, ...extraEnv };
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(nextEnv)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }

  return fn().finally(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

async function loadVpsModules() {
  const [
    { QuoteEngine },
    { IntentEngine },
    { IntentService },
    { ApiKeyManager, PartnerTier },
    { buildStatusAPI },
    { buildPartnerAPI },
  ] = await Promise.all([
    import('../../src/vps/services/QuoteEngine'),
    import('../../src/vps/services/IntentEngine'),
    import('../../src/vps/services/IntentService'),
    import('../../src/vps/services/ApiKeyManager'),
    import('../../src/vps/api/StatusAPI'),
    import('../../src/vps/api/PartnerAPI'),
  ]);

  return {
    QuoteEngine,
    IntentEngine,
    IntentService,
    ApiKeyManager,
    PartnerTier,
    buildStatusAPI,
    buildPartnerAPI,
  };
}

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

function registerDexQuotes(engine: { registerDexQuoteFn(chainId: number, fn: (...args: any[]) => Promise<bigint>): void }) {
  engine.registerDexQuoteFn(8453, async (_tokenIn, tokenOut, amountIn) => {
    if (tokenOut.toLowerCase() === BASE_USDC.toLowerCase()) return amountIn;
    if (tokenOut.toLowerCase() === BASE_AXLUSDC.toLowerCase()) return amountIn;
    if (tokenOut.toLowerCase() === BASE_ETH.toLowerCase()) return amountIn;
    return amountIn;
  });
  engine.registerDexQuoteFn(42161, async (tokenIn, _tokenOut, amountIn) => {
    if (tokenIn.toLowerCase() === ARB_USDC.toLowerCase()) return amountIn;
    if (tokenIn.toLowerCase() === ARB_AXLUSDC.toLowerCase()) return amountIn;
    if (tokenIn.toLowerCase() === ARB_ETH.toLowerCase()) return amountIn;
    return amountIn;
  });
}

function assertSelectionIntegration(integration: any) {
  if (integration?.mode === 'provider_direct') {
    assert.equal(integration.action?.kind, 'thorchain_swap');
    assert.equal(typeof integration.action?.depositAddress, 'string');
    assert.ok(integration.action.depositAddress.length > 0);
    return;
  }

  const routerIntegration = integration?.mode === 'router_intent'
    ? integration.integration
    : integration;
  assert.equal(routerIntegration.contractAddress, TEST_ENV.CHAIN_8453_ROUTER_V1);
  assert.match(routerIntegration.calldata, /^0x[0-9a-f]+$/i);
}

test('status quote selection creates an intent from the selected offer', async () => {
  await withPatchedEnv({}, async () => {
    const {
      QuoteEngine,
      IntentEngine,
      IntentService,
      buildStatusAPI,
    } = await loadVpsModules();

    const quoteEngine = new QuoteEngine();
    registerDexQuotes(quoteEngine);

    const intentService = new IntentService(new IntentEngine());
    const server = await listen(buildStatusAPI(intentService, quoteEngine));

    try {
      const quoteRes = await fetch(`${server.baseUrl}/quote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(QUOTE_REQUEST),
      });
      assert.equal(quoteRes.status, 200);
      const quoteBody = await quoteRes.json() as {
        offerSet?: { offerSetId: string; bestOfferId?: string; offers: Array<{ offerId: string; rail: string }> };
      };

      assert.ok(quoteBody.offerSet);
      assert.ok(quoteBody.offerSet.offers.length >= 2);

      const selectedOffer = quoteBody.offerSet.offers.find((offer) => offer.offerId !== quoteBody.offerSet?.bestOfferId);
      assert.ok(selectedOffer, 'expected a non-best offer to select');

      const selectRes = await fetch(`${server.baseUrl}/quote/select`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userAddress: QUOTE_REQUEST.userAddress,
          offerSetId: quoteBody.offerSet.offerSetId,
          offerId: selectedOffer.offerId,
        }),
      });

      assert.equal(selectRes.status, 200);
      const selectionBody = await selectRes.json() as {
        intentId: string;
        quote: { rail: string; intentId: string };
        integration: unknown;
      };

      assert.equal(selectionBody.quote.rail, selectedOffer.rail);
      assert.equal(selectionBody.quote.intentId, selectionBody.intentId);
      assertSelectionIntegration(selectionBody.integration);

      const intentRes = await fetch(`${server.baseUrl}/intent/${selectionBody.intentId}`);
      assert.equal(intentRes.status, 200);
      const intentBody = await intentRes.json() as { rail: string };
      assert.equal(intentBody.rail, selectedOffer.rail);
    } finally {
      quoteEngine.resetDexQuoteFns();
      await server.close();
    }
  });
});

test('partner quote selection creates an intent from the selected offer', async () => {
  await withPatchedEnv({}, async () => {
    const {
      QuoteEngine,
      IntentEngine,
      IntentService,
      ApiKeyManager,
      PartnerTier,
      buildPartnerAPI,
    } = await loadVpsModules();

    const quoteEngine = new QuoteEngine();
    registerDexQuotes(quoteEngine);

    const intentService = new IntentService(new IntentEngine());
    const keyManager = new ApiKeyManager();
    const partner = keyManager.registerPartner({
      name: 'Test Partner',
      contactEmail: 'partner@example.com',
      tier: PartnerTier.GROWTH,
      feeShareBps: 1500,
      quotesPerMin: 60,
      maxTxPerDay: 500,
      active: true,
    });

    const app = express();
    app.use(express.json());
    app.use('/partner', buildPartnerAPI(keyManager, intentService, quoteEngine));
    const server = await listen(app);

    try {
      const quoteRes = await fetch(`${server.baseUrl}/partner/quote`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': partner.apiKey,
        },
        body: JSON.stringify(QUOTE_REQUEST),
      });
      assert.equal(quoteRes.status, 200);
      const quoteBody = await quoteRes.json() as {
        offerSet?: { offerSetId: string; bestOfferId?: string; offers: Array<{ offerId: string; rail: string }> };
      };

      assert.ok(quoteBody.offerSet);
      assert.ok(quoteBody.offerSet.offers.length >= 2);

      const selectedOffer = quoteBody.offerSet.offers.find((offer) => offer.offerId !== quoteBody.offerSet?.bestOfferId);
      assert.ok(selectedOffer, 'expected a non-best offer to select');

      const selectRes = await fetch(`${server.baseUrl}/partner/quote/select`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': partner.apiKey,
        },
        body: JSON.stringify({
          userAddress: QUOTE_REQUEST.userAddress,
          offerSetId: quoteBody.offerSet.offerSetId,
          offerId: selectedOffer.offerId,
        }),
      });

      assert.equal(selectRes.status, 200);
      const selectionBody = await selectRes.json() as {
        intentId: string;
        quote: { rail: string; intentId: string };
        integration: unknown;
      };

      assert.equal(selectionBody.quote.rail, selectedOffer.rail);
      assert.equal(selectionBody.quote.intentId, selectionBody.intentId);
      assertSelectionIntegration(selectionBody.integration);

      const intentRes = await fetch(`${server.baseUrl}/partner/intent/${selectionBody.intentId}`, {
        headers: { 'x-api-key': partner.apiKey },
      });
      assert.equal(intentRes.status, 200);
      const intentBody = await intentRes.json() as { rail: string };
      assert.equal(intentBody.rail, selectedOffer.rail);
    } finally {
      quoteEngine.resetDexQuoteFns();
      await server.close();
    }
  });
});

test('status quote selection returns fallback offers when selected offer is unavailable', async () => {
  await withPatchedEnv({}, async () => {
    const {
      QuoteEngine,
      IntentEngine,
      IntentService,
      buildStatusAPI,
    } = await loadVpsModules();

    const quoteEngine = new QuoteEngine();
    registerDexQuotes(quoteEngine);

    const intentService = new IntentService(new IntentEngine());
    const server = await listen(buildStatusAPI(intentService, quoteEngine));

    try {
      const quoteRes = await fetch(`${server.baseUrl}/quote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(QUOTE_REQUEST),
      });
      assert.equal(quoteRes.status, 200);
      const quoteBody = await quoteRes.json() as {
        offerSet?: { offerSetId: string; offers: Array<{ offerId: string }> };
      };
      assert.ok(quoteBody.offerSet);

      const selectRes = await fetch(`${server.baseUrl}/quote/select`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userAddress: QUOTE_REQUEST.userAddress,
          offerSetId: quoteBody.offerSet.offerSetId,
          offerId: '0x00000000000000000000000000000000000000000000000000000000missing',
        }),
      });
      assert.equal(selectRes.status, 409);
      const selectBody = await selectRes.json() as {
        error: string;
        fallbackOfferSet?: { offerSetId: string; offers: Array<{ offerId: string }> };
      };
      assert.equal(selectBody.error, 'OFFER_UNAVAILABLE');
      assert.ok(selectBody.fallbackOfferSet);
      assert.equal(selectBody.fallbackOfferSet.offerSetId, quoteBody.offerSet.offerSetId);
      assert.ok(selectBody.fallbackOfferSet.offers.length > 0);
    } finally {
      quoteEngine.resetDexQuoteFns();
      await server.close();
    }
  });
});

test('partner quote selection returns fallback offers when selected offer is unavailable', async () => {
  await withPatchedEnv({}, async () => {
    const {
      QuoteEngine,
      IntentEngine,
      IntentService,
      ApiKeyManager,
      PartnerTier,
      buildPartnerAPI,
    } = await loadVpsModules();

    const quoteEngine = new QuoteEngine();
    registerDexQuotes(quoteEngine);

    const intentService = new IntentService(new IntentEngine());
    const keyManager = new ApiKeyManager();
    const partner = keyManager.registerPartner({
      name: 'Test Partner',
      contactEmail: 'partner@example.com',
      tier: PartnerTier.GROWTH,
      feeShareBps: 1500,
      quotesPerMin: 60,
      maxTxPerDay: 500,
      active: true,
    });

    const app = express();
    app.use(express.json());
    app.use('/partner', buildPartnerAPI(keyManager, intentService, quoteEngine));
    const server = await listen(app);

    try {
      const quoteRes = await fetch(`${server.baseUrl}/partner/quote`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': partner.apiKey,
        },
        body: JSON.stringify(QUOTE_REQUEST),
      });
      assert.equal(quoteRes.status, 200);
      const quoteBody = await quoteRes.json() as {
        offerSet?: { offerSetId: string; offers: Array<{ offerId: string }> };
      };
      assert.ok(quoteBody.offerSet);

      const selectRes = await fetch(`${server.baseUrl}/partner/quote/select`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': partner.apiKey,
        },
        body: JSON.stringify({
          userAddress: QUOTE_REQUEST.userAddress,
          offerSetId: quoteBody.offerSet.offerSetId,
          offerId: '0x00000000000000000000000000000000000000000000000000000000missing',
        }),
      });
      assert.equal(selectRes.status, 409);
      const selectBody = await selectRes.json() as {
        error: string;
        fallbackOfferSet?: { offerSetId: string; offers: Array<{ offerId: string }> };
      };
      assert.equal(selectBody.error, 'OFFER_UNAVAILABLE');
      assert.ok(selectBody.fallbackOfferSet);
      assert.equal(selectBody.fallbackOfferSet.offerSetId, quoteBody.offerSet.offerSetId);
      assert.ok(selectBody.fallbackOfferSet.offers.length > 0);
    } finally {
      quoteEngine.resetDexQuoteFns();
      await server.close();
    }
  });
});
