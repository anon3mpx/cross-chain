import test from 'node:test';
import assert from 'node:assert/strict';
import { QuoteEngine } from '../../src/vps/services/QuoteEngine';
import { RouteBuilder } from '../../src/vps/services/RouterBuilder';
import { getSettlementTokenAddress } from '../../src/vps/config/contracts';
import { Rail, SettlementToken } from '../../src/vps/types';

const BASE_USDC = '0x0000000000000000000000000000000000001001';
const BASE_AXLUSDC = '0x0000000000000000000000000000000000001002';
const BASE_ETH = '0x0000000000000000000000000000000000001003';
const ARB_USDC = '0x0000000000000000000000000000000000002001';
const ARB_AXLUSDC = '0x0000000000000000000000000000000000002002';
const ARB_ETH = '0x0000000000000000000000000000000000002003';
const BASE_OFT_USDC = '0x0000000000000000000000000000000000003001';
const BASE_OFT_USDT = '0x0000000000000000000000000000000000003002';
const BASE_OFT_ETH = '0x0000000000000000000000000000000000003003';
const ARB_USDT = '0x0000000000000000000000000000000000002004';
const BASE_USDT = '0x0000000000000000000000000000000000001004';
const ARB_AXL_USDC_TOKEN_ID = '0x' + '11'.repeat(32);
const ARB_AXL_USDT_TOKEN_ID = '0x' + '22'.repeat(32);
const ARB_AXL_ETH_TOKEN_ID = '0x' + '33'.repeat(32);

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
  CHAIN_8453_TOKEN_AXELAR_USDT: BASE_USDT,
  CHAIN_8453_TOKEN_LAYERZERO_USDT: BASE_USDT,
  CHAIN_8453_TOKEN_VIA_LABS_USDT: BASE_USDT,
  CHAIN_42161_TOKEN_CCTP_USDC: ARB_USDC,
  CHAIN_42161_TOKEN_AXELAR_USDC: ARB_AXLUSDC,
  CHAIN_42161_TOKEN_LAYERZERO_USDC: ARB_USDC,
  CHAIN_42161_TOKEN_VIA_LABS_USDC: ARB_USDC,
  CHAIN_42161_TOKEN_THORCHAIN_USDC: ARB_USDC,
  CHAIN_42161_TOKEN_AXELAR_ETH: ARB_ETH,
  CHAIN_42161_TOKEN_LAYERZERO_ETH: ARB_ETH,
  CHAIN_42161_TOKEN_VIA_LABS_ETH: ARB_ETH,
  CHAIN_42161_TOKEN_THORCHAIN_ETH: ARB_ETH,
  CHAIN_42161_TOKEN_AXELAR_USDT: ARB_USDT,
  CHAIN_42161_TOKEN_LAYERZERO_USDT: ARB_USDT,
  CHAIN_42161_TOKEN_VIA_LABS_USDT: ARB_USDT,
  CHAIN_8453_LZ_OFT_USDC: BASE_OFT_USDC,
  CHAIN_8453_LZ_OFT_USDT: BASE_OFT_USDT,
  CHAIN_8453_LZ_OFT_ETH: BASE_OFT_ETH,
  CHAIN_42161_DST_EID_LAYERZERO: '30110',
  CHAIN_42161_AXELAR_TOKEN_ID_USDC: ARB_AXL_USDC_TOKEN_ID,
  CHAIN_42161_AXELAR_TOKEN_ID_USDT: ARB_AXL_USDT_TOKEN_ID,
  CHAIN_42161_AXELAR_TOKEN_ID_WETH: ARB_AXL_ETH_TOKEN_ID,
  CHAIN_42161_AXELAR_TOKEN_ID_ETH: ARB_AXL_ETH_TOKEN_ID,
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

test('getOffers returns multiple viable rails in scored order and reuses cached offer computation', async () => {
  await withPatchedEnv({}, async () => {
    const engine = new QuoteEngine();
    let srcQuoteCalls = 0;
    let dstQuoteCalls = 0;
    try {
      engine.registerDexQuoteFn(8453, async (_tokenIn, tokenOut, amountIn) => {
        srcQuoteCalls += 1;
        if (tokenOut.toLowerCase() === BASE_USDC.toLowerCase()) return amountIn;
        if (tokenOut.toLowerCase() === BASE_AXLUSDC.toLowerCase()) return amountIn;
        if (tokenOut.toLowerCase() === BASE_ETH.toLowerCase()) return amountIn;
        return amountIn;
      });
      engine.registerDexQuoteFn(42161, async (tokenIn, _tokenOut, amountIn) => {
        dstQuoteCalls += 1;
        if (tokenIn.toLowerCase() === ARB_USDC.toLowerCase()) return amountIn;
        if (tokenIn.toLowerCase() === ARB_AXLUSDC.toLowerCase()) return amountIn;
        if (tokenIn.toLowerCase() === ARB_ETH.toLowerCase()) return amountIn;
        return amountIn;
      });

      const request = {
        tokenIn: BASE_USDC,
        tokenOut: ARB_USDC,
        amountIn: 100_000_000n,
        srcChainId: 8453,
        dstChainId: 42161,
        userAddress: '0x3333333333333333333333333333333333333333',
      } as const;

      const result = await engine.getOffers(request);
      const srcQuoteCallsAfterFirstFetch = srcQuoteCalls;
      const dstQuoteCallsAfterFirstFetch = dstQuoteCalls;
      const cachedResult = await engine.getOffers(request);
      const quote = await engine.getQuote(request);

      assert.ok(result);
      assert.ok(cachedResult);
      assert.ok(quote);
      assert.ok(result.offers.length >= 2);
      assert.equal(srcQuoteCalls, srcQuoteCallsAfterFirstFetch);
      assert.equal(dstQuoteCalls, dstQuoteCallsAfterFirstFetch);

      const routeBuilder = new RouteBuilder();
      const expectedRailOrder = routeBuilder
        .buildRoutes(8453, 42161, 100, 'normal')
        .filter((route) => route.viable && route.hops.length === 1)
        .filter((route) => route.hops[0].rail !== 'THORCHAIN')
        .map((route) => route.hops[0].rail);
      const actualRailOrder = result.offers.map((offer) => offer.rail);

      assert.deepEqual(actualRailOrder, expectedRailOrder);
      assert.deepEqual(cachedResult.offers.map((offer) => offer.offerId), result.offers.map((offer) => offer.offerId));
      assert.ok(result.offers.some((offer) => offer.rail === 'LAYERZERO' && offer.offerType === 'lz_stargate_pool'));
      assert.ok(result.offers.some((offer) => offer.rail === 'LAYERZERO' && offer.offerType === 'lz_oft_adapter'));
      assert.ok(result.offers.some((offer) => offer.rail === 'LAYERZERO' && offer.offerType === 'lz_oft'));

      assert.equal(quote.feeAmountToken, 150_000n);
      assert.equal(quote.estimatedOut, 99_850_000n);
      assert.equal(quote.minAmountOut, 99_750_150n);
    } finally {
      engine.resetDexQuoteFns();
    }
  });
});

test('getQuote applies a fixed 15 bps protocol fee to CCTP quotes', async () => {
  await withPatchedEnv({}, async () => {
    const engine = new QuoteEngine();
    const baseUsdc = getSettlementTokenAddress(8453, SettlementToken.USDC, Rail.CCTP);
    const arbUsdc = getSettlementTokenAddress(42161, SettlementToken.USDC, Rail.CCTP);

    try {
      engine.registerDexQuoteFn(8453, async (_tokenIn, tokenOut, amountIn) => {
        if (baseUsdc && tokenOut.toLowerCase() === baseUsdc.toLowerCase()) return amountIn;
        return amountIn;
      });
      engine.registerDexQuoteFn(42161, async (tokenIn, _tokenOut, amountIn) => {
        if (arbUsdc && tokenIn.toLowerCase() === arbUsdc.toLowerCase()) return amountIn;
        return amountIn;
      });

      assert.ok(baseUsdc);
      assert.ok(arbUsdc);
      const quote = await engine.getQuote({
        tokenIn: baseUsdc,
        tokenOut: arbUsdc,
        amountIn: 100_000_000n,
        srcChainId: 8453,
        dstChainId: 42161,
        userAddress: '0x3333333333333333333333333333333333333333',
      });

      assert.ok(quote);
      assert.equal(quote.feeAmountToken, 150_000n);
      assert.equal(quote.feeAmountUSD, 0.15);
      assert.equal(quote.estimatedOut, 99_850_000n);
      assert.equal(quote.minAmountOut, 99_750_150n);
    } finally {
      engine.resetDexQuoteFns();
    }
  });
});

test('router-intent offers expose protocol fee only and honor runtime ETA overrides', async () => {
  await withPatchedEnv({
    RAIL_LAYERZERO_ETA_SECONDS: '123',
  }, async () => {
    const engine = new QuoteEngine();
    const baseUsdc = getSettlementTokenAddress(8453, SettlementToken.USDC, Rail.LAYERZERO);
    const arbUsdc = getSettlementTokenAddress(42161, SettlementToken.USDC, Rail.LAYERZERO);

    try {
      assert.ok(baseUsdc);
      assert.ok(arbUsdc);
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

      const result = await engine.getOffers({
        tokenIn: baseUsdc,
        tokenOut: arbUsdc,
        amountIn: 100_000_000n,
        srcChainId: 8453,
        dstChainId: 42161,
        userAddress: '0x3333333333333333333333333333333333333333',
      });

      assert.ok(result);
      const layerZeroOffer = result.offers.find((offer) => offer.rail === Rail.LAYERZERO);
      assert.ok(layerZeroOffer);
      assert.equal(layerZeroOffer.economics.providerFeeUSD, 0);
      assert.equal(layerZeroOffer.economics.protocolFeeUSD, 0.15);
      assert.equal(layerZeroOffer.economics.settlementTimeSeconds, 123);
      assert.equal(layerZeroOffer.execution.quote?.feeAmountUSD, 0.15);
      assert.equal(layerZeroOffer.execution.quote?.etaSeconds, 123);
    } finally {
      engine.resetDexQuoteFns();
    }
  });
});

test('getOffers omits THOR provider-direct offers when provider instructions are unavailable', async () => {
  await withPatchedEnv({}, async () => {
    const engine = new QuoteEngine(undefined, {
      thorchainQuoteWorker: {
        quote: async () => {
          throw new Error('thor unavailable');
        },
      },
    });

    try {
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

      const result = await engine.getOffers({
        tokenIn: BASE_USDC,
        tokenOut: ARB_USDC,
        amountIn: 100_000_000n,
        srcChainId: 8453,
        dstChainId: 42161,
        userAddress: '0x3333333333333333333333333333333333333333',
      });

      assert.ok(result);
      assert.ok(result.offers.every((offer) => offer.rail !== 'THORCHAIN'));
    } finally {
      engine.resetDexQuoteFns();
    }
  });
});

test('fast CCTP economics include the realized Circle fee for the built offer', async () => {
  await withPatchedEnv({
    ENABLE_CCTP_FAST: 'true',
    CCTP_ATTESTATION_BASE_URL: 'https://example.test',
  }, async () => {
    const baseUsdc = getSettlementTokenAddress(8453, SettlementToken.USDC, Rail.CCTP);
    const arbUsdc = getSettlementTokenAddress(42161, SettlementToken.USDC, Rail.CCTP);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith('/v2/burn/USDC/fees/6/3')) {
        return new Response(JSON.stringify([
          { finalityThreshold: 1000, minimumFee: 10 },
        ]), { status: 200 });
      }
      if (url.endsWith('/v2/fastBurn/USDC/allowance')) {
        return new Response(JSON.stringify({ allowance: '1000000' }), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;

    try {
      const engine = new QuoteEngine();
      try {
        assert.ok(baseUsdc);
        assert.ok(arbUsdc);
        engine.registerDexQuoteFn(8453, async (_tokenIn, tokenOut, amountIn) => {
          if (tokenOut.toLowerCase() === baseUsdc.toLowerCase()) return amountIn;
          return amountIn;
        });
        engine.registerDexQuoteFn(42161, async (tokenIn, _tokenOut, amountIn) => {
          if (tokenIn.toLowerCase() === arbUsdc.toLowerCase()) return amountIn;
          return amountIn;
        });

        const result = await engine.getOffers({
          tokenIn: baseUsdc,
          tokenOut: arbUsdc,
          amountIn: 1_000_000n,
          srcChainId: 8453,
          dstChainId: 42161,
          userAddress: '0x3333333333333333333333333333333333333333',
          urgency: 'fast',
        });

        assert.ok(result);
        const cctpOffer = result.offers.find((offer) => offer.rail === 'CCTP');
        assert.ok(cctpOffer);
        assert.equal(cctpOffer.economics.providerFeeUSD, 0.000999);
        assert.equal(cctpOffer.economics.outboundFeeUSD, 0.000999);
        assert.equal(cctpOffer.economics.protocolFeeUSD, 0.0015);
        assert.equal(cctpOffer.economics.settlementTimeSeconds, 8);
      } finally {
        engine.resetDexQuoteFns();
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
