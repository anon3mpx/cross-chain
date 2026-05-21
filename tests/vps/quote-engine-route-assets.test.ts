import test from 'node:test';
import assert from 'node:assert/strict';
import { QuoteEngine } from '../../src/vps/services/QuoteEngine';
import { Rail } from '../../src/vps/types';
import { resetTHORChainQuotePolicyCacheForTests } from '../../src/vps/services/thorchain/THORChainQuotePolicy';

const BASE_USDC = '0x0000000000000000000000000000000000001001';
const BASE_ETH = '0x0000000000000000000000000000000000001003';
const BASE_USDT = '0x0000000000000000000000000000000000001004';
const ARB_USDC = '0x0000000000000000000000000000000000002001';
const ARB_ETH = '0x0000000000000000000000000000000000002003';
const ARB_USDT = '0x0000000000000000000000000000000000002004';
const BASE_OFT_USDC = '0x0000000000000000000000000000000000003001';
const BASE_OFT_USDT = '0x0000000000000000000000000000000000003002';
const BASE_OFT_ETH = '0x0000000000000000000000000000000000003003';
const ARB_AXL_USDC_TOKEN_ID = '0x' + '11'.repeat(32);
const ARB_AXL_USDT_TOKEN_ID = '0x' + '22'.repeat(32);
const ARB_AXL_ETH_TOKEN_ID = '0x' + '33'.repeat(32);

function withPatchedEnv(extraEnv: Record<string, string>, fn: () => Promise<void>) {
  const previous = new Map<string, string | undefined>();
  const nextEnv = {
    CHAIN_8453_TOKEN_CCTP_USDC: BASE_USDC,
    CHAIN_8453_TOKEN_AXELAR_USDC: BASE_USDC,
    CHAIN_8453_TOKEN_LAYERZERO_USDC: BASE_USDC,
    CHAIN_8453_TOKEN_THORCHAIN_USDC: BASE_USDC,
    CHAIN_8453_TOKEN_AXELAR_ETH: BASE_ETH,
    CHAIN_8453_TOKEN_LAYERZERO_ETH: BASE_ETH,
    CHAIN_8453_TOKEN_THORCHAIN_ETH: BASE_ETH,
    CHAIN_8453_THORCHAIN_CHAIN_ALIAS: 'BASE',
    CHAIN_8453_TOKEN_AXELAR_USDT: BASE_USDT,
    CHAIN_8453_TOKEN_LAYERZERO_USDT: BASE_USDT,
    CHAIN_8453_LZ_OFT_USDC: BASE_OFT_USDC,
    CHAIN_8453_LZ_OFT_USDT: BASE_OFT_USDT,
    CHAIN_8453_LZ_OFT_ETH: BASE_OFT_ETH,
    CHAIN_42161_TOKEN_CCTP_USDC: ARB_USDC,
    CHAIN_42161_TOKEN_AXELAR_USDC: ARB_USDC,
    CHAIN_42161_TOKEN_LAYERZERO_USDC: ARB_USDC,
    CHAIN_42161_TOKEN_THORCHAIN_USDC: ARB_USDC,
    CHAIN_42161_TOKEN_AXELAR_ETH: ARB_ETH,
    CHAIN_42161_TOKEN_LAYERZERO_ETH: ARB_ETH,
    CHAIN_42161_TOKEN_THORCHAIN_ETH: ARB_ETH,
    CHAIN_42161_THORCHAIN_CHAIN_ALIAS: 'ARB',
    CHAIN_42161_TOKEN_AXELAR_USDT: ARB_USDT,
    CHAIN_42161_TOKEN_LAYERZERO_USDT: ARB_USDT,
    CHAIN_42161_DST_EID_LAYERZERO: '30110',
    CHAIN_42161_AXELAR_TOKEN_ID_USDC: ARB_AXL_USDC_TOKEN_ID,
    CHAIN_42161_AXELAR_TOKEN_ID_USDT: ARB_AXL_USDT_TOKEN_ID,
    CHAIN_42161_AXELAR_TOKEN_ID_WETH: ARB_AXL_ETH_TOKEN_ID,
    CHAIN_42161_AXELAR_TOKEN_ID_ETH: ARB_AXL_ETH_TOKEN_ID,
    ...extraEnv,
  };

  for (const [key, value] of Object.entries(nextEnv)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }

  resetTHORChainQuotePolicyCacheForTests();
  return fn().finally(() => {
    resetTHORChainQuotePolicyCacheForTests();
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test('getOffers returns route-asset offer metadata and provider-direct THOR offers', async () => {
  await withPatchedEnv({}, async () => {
    const engine = new QuoteEngine(undefined, {
      thorchainQuoteWorker: {
        quote: async () => ({
          quote: {
            to_asset: 'ETH.ETH',
            expected_amount_out: '99500000',
            inbound_address: '0xthorvault',
            memo: '=:ETH.ETH:0x3333333333333333333333333333333333333333:0',
            expiry: 1_900_000_000,
          },
          expectedAmountOut: '99500000',
          settlementTimeSeconds: 60,
        }),
      },
    });

    try {
      engine.registerDexQuoteFn(8453, async (_tokenIn, _tokenOut, amountIn) => amountIn);
      engine.registerDexQuoteFn(42161, async (_tokenIn, _tokenOut, amountIn) => amountIn);

      const result = await engine.getOffers({
        tokenIn: BASE_USDC,
        tokenOut: ARB_USDC,
        amountIn: 100_000_000n,
        srcChainId: 8453,
        dstChainId: 42161,
        userAddress: '0x3333333333333333333333333333333333333333',
      });

      assert.ok(result);
      assert.ok(result!.offers.some((offer) => offer.rail === Rail.LAYERZERO && offer.offerType === 'lz_stargate_pool'));
      assert.ok(result!.offers.some((offer) => offer.rail === Rail.LAYERZERO && offer.offerType === 'lz_oft_adapter'));
      assert.ok(result!.offers.some((offer) => offer.rail === Rail.LAYERZERO && offer.offerType === 'lz_oft'));
      assert.ok(result!.offers.some((offer) => offer.rail === Rail.CCTP && offer.offerType === 'cctp_standard'));
      assert.ok(result!.offers.some((offer) => offer.rail === Rail.THORCHAIN && offer.executionMode === 'provider_direct'));
      assert.ok(result!.offers.every((offer) => offer.routeAsset));
      assert.ok(result!.offers.every((offer) => offer.deliveryShape));
      assert.ok(result!.offers.some((offer) => offer.rail !== Rail.THORCHAIN && (offer.execution.quote as any).dstGasLimit > 0));
      assert.ok(result!.offers.some((offer) => offer.rail === Rail.THORCHAIN && (offer.execution.quote as any).dstGasLimit === 0));
    } finally {
      engine.resetDexQuoteFns();
    }
  });
});

test('getOffers allows THOR provider-direct offers for destination chains outside local registry', async () => {
  await withPatchedEnv({ CHAIN_8453_THORCHAIN_CHAIN_ALIAS: 'BASE' }, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify([
      { asset: 'BASE.USDC-0X0000000000000000000000000000000000001001', status: 'available', nativeDecimal: '6' },
      { asset: 'TRON.USDT-TXYZUSDT', status: 'available', nativeDecimal: '6' },
    ]), { status: 200 })) as typeof fetch;

    const quoteInputs: Array<{ fromAsset?: string; toAsset?: string; amountInThorchain?: bigint }> = [];
    const engine = new QuoteEngine(undefined, {
      thorchainQuoteWorker: {
        quote: async (input) => {
          quoteInputs.push(input);
          return {
            quote: {
              to_asset: 'TRON.USDT-TXYZUSDT',
              expected_amount_out: '99000000',
              inbound_address: '0xthorvault',
              memo: '=:TRON.USDT-TXYZUSDT:TReceiver:0',
              expiry: 1_900_000_000,
            },
            expectedAmountOut: '99000000',
            settlementTimeSeconds: 60,
          };
        },
      },
    });

    try {
      const result = await engine.getOffers({
        tokenIn: BASE_USDC,
        tokenOut: 'TRON.USDT-TXYZUSDT',
        amountIn: 100_000_000n,
        srcChainId: 8453,
        dstChainId: 195,
        userAddress: '0x3333333333333333333333333333333333333333',
        nativeDstAddress: 'TReceiver',
      });

      assert.ok(result);
      assert.equal(result!.offers.length, 1);
      assert.equal(result!.offers[0].rail, Rail.THORCHAIN);
      assert.equal(quoteInputs[0].toAsset, 'TRON.USDT-TXYZUSDT');
      assert.equal(quoteInputs[0].amountInThorchain, 9_950_000_000n);
    } finally {
      globalThis.fetch = originalFetch;
      engine.resetDexQuoteFns();
    }
  });
});

test('getOffers handles real Base USDC to Avalanche USDC THOR request without rail alias crash', async () => {
  await withPatchedEnv({}, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify([
      {
        asset: 'BASE.USDC-0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913',
        status: 'available',
        nativeDecimal: '6',
      },
      {
        asset: 'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E',
        status: 'available',
        nativeDecimal: '6',
      },
    ]), { status: 200 })) as typeof fetch;

    const quoteInputs: Array<{ fromAsset?: string; toAsset?: string; amountInThorchain?: bigint }> = [];
    const engine = new QuoteEngine(undefined, {
      thorchainQuoteWorker: {
        quote: async (input) => {
          quoteInputs.push(input);
          return {
            quote: {
              to_asset: 'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E',
              expected_amount_out: '9900000',
              inbound_address: '0xthorvault',
              memo: '=:AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E:0x05F8cC8753D90d67DBB8c02118440b8283F941c9:0',
              expiry: 1_900_000_000,
            },
            expectedAmountOut: '9900000',
            settlementTimeSeconds: 60,
          };
        },
      },
    });

    try {
      const result = await engine.getOffers({
        tokenIn: '0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913',
        tokenOut: '0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E',
        amountIn: 10_000_000n,
        srcChainId: 8453,
        dstChainId: 43114,
        userAddress: '0x05F8cC8753D90d67DBB8c02118440b8283F941c9',
      });

      const thorOffer = result?.offers.find((offer) => offer.rail === Rail.THORCHAIN);
      assert.ok(thorOffer);
      assert.equal(quoteInputs[0].fromAsset, 'BASE.USDC-0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913');
      assert.equal(quoteInputs[0].toAsset, 'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E');
      assert.equal(quoteInputs[0].amountInThorchain, 990_000_000n);
    } finally {
      globalThis.fetch = originalFetch;
      engine.resetDexQuoteFns();
    }
  });
});

test('getOffers preserves arbitrary THOR output token metadata', async () => {
  const arbRune = 'ARB.RUNE-0X0000000000000000000000000000000000000999';
  await withPatchedEnv({ CHAIN_8453_THORCHAIN_CHAIN_ALIAS: 'BASE' }, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify([
      { asset: 'BASE.USDC-0X0000000000000000000000000000000000001001', status: 'available', nativeDecimal: '6' },
      { asset: arbRune, status: 'available', nativeDecimal: '18' },
    ]), { status: 200 })) as typeof fetch;

    const engine = new QuoteEngine(undefined, {
      thorchainQuoteWorker: {
        quote: async () => ({
          quote: {
            to_asset: arbRune,
            expected_amount_out: '123456789',
            inbound_address: '0xthorvault',
            memo: `=:${arbRune}:0x3333333333333333333333333333333333333333:0`,
            expiry: 1_900_000_000,
          },
          expectedAmountOut: '123456789',
          settlementTimeSeconds: 60,
        }),
      },
    });

    try {
      engine.registerDexQuoteFn(8453, async (_tokenIn, _tokenOut, amountIn) => amountIn);
      engine.registerDexQuoteFn(42161, async (_tokenIn, _tokenOut, amountIn) => amountIn);

      const result = await engine.getOffers({
        tokenIn: BASE_USDC,
        tokenOut: arbRune,
        amountIn: 100_000_000n,
        srcChainId: 8453,
        dstChainId: 42161,
        userAddress: '0x3333333333333333333333333333333333333333',
      });

      const thorOffer = result?.offers.find((offer) => offer.rail === Rail.THORCHAIN);
      assert.ok(thorOffer);
      assert.equal(thorOffer!.routeAsset!.canonicalAssetId, arbRune);
      assert.equal(thorOffer!.routeAsset!.decimals, 18);
      assert.equal(thorOffer!.routeAsset!.assetKind, 'erc20');
      assert.equal(thorOffer!.routeAsset!.assetStandard, 'erc20');
    } finally {
      globalThis.fetch = originalFetch;
      engine.resetDexQuoteFns();
    }
  });
});

test('selectOffer works for THOR-only offer sets', async () => {
  await withPatchedEnv({ CHAIN_8453_THORCHAIN_CHAIN_ALIAS: 'BASE' }, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify([
      { asset: 'BASE.ETH', status: 'available', nativeDecimal: '18' },
      { asset: 'ETH.ETH', status: 'available', nativeDecimal: '18' },
    ]), { status: 200 })) as typeof fetch;

    const engine = new QuoteEngine(undefined, {
      thorchainQuoteWorker: {
        quote: async () => ({
          quote: {
            to_asset: 'ETH.ETH',
            expected_amount_out: '1000000000000000',
            inbound_address: '0xthorvault',
            memo: '=:ETH.ETH:0x3333333333333333333333333333333333333333:0',
            expiry: Math.floor(Date.now() / 1000) + 120,
          },
          expectedAmountOut: '1000000000000000',
          settlementTimeSeconds: 60,
        }),
      },
    });

    try {
      const offerSet = await engine.getOffers({
        tokenIn: 'BASE.ETH',
        tokenOut: 'ETH.ETH',
        amountIn: 100_000_000_000_000_000n,
        srcChainId: 8453,
        dstChainId: 1,
        userAddress: '0x3333333333333333333333333333333333333333',
      });

      assert.ok(offerSet);
      assert.equal(offerSet!.offers.length, 1);
      assert.equal(offerSet!.offers[0].rail, Rail.THORCHAIN);

      const selected = await engine.selectOffer(offerSet!.offerSetId, offerSet!.offers[0].offerId);
      assert.ok(selected.offer);
      assert.equal(selected.offer!.offerId, offerSet!.offers[0].offerId);
      assert.equal(selected.reason, undefined);
    } finally {
      globalThis.fetch = originalFetch;
      engine.resetDexQuoteFns();
    }
  });
});

test('selectOffer resolves older offerSetId even after a newer quote for same request key', async () => {
  await withPatchedEnv({ CHAIN_8453_THORCHAIN_CHAIN_ALIAS: 'BASE' }, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify([
      { asset: 'BASE.ETH', status: 'available', nativeDecimal: '18' },
      { asset: 'ETH.ETH', status: 'available', nativeDecimal: '18' },
    ]), { status: 200 })) as typeof fetch;

    const engine = new QuoteEngine(undefined, {
      thorchainQuoteWorker: {
        quote: async () => ({
          quote: {
            to_asset: 'ETH.ETH',
            expected_amount_out: '1000000000000000',
            inbound_address: '0xthorvault',
            memo: '=:ETH.ETH:0x3333333333333333333333333333333333333333:0',
            expiry: Math.floor(Date.now() / 1000) + 120,
          },
          expectedAmountOut: '1000000000000000',
          settlementTimeSeconds: 60,
        }),
      },
    });

    try {
      const req = {
        tokenIn: 'BASE.ETH',
        tokenOut: 'ETH.ETH',
        amountIn: 100_000_000_000_000_000n,
        srcChainId: 8453,
        dstChainId: 1,
        userAddress: '0x3333333333333333333333333333333333333333',
      };

      const first = await engine.getOffers(req);
      assert.ok(first);
      const firstOfferId = first!.offers[0].offerId;

      const second = await engine.getOffers(req);
      assert.ok(second);
      assert.notEqual(second!.offerSetId, first!.offerSetId);

      const selectedFromFirst = await engine.selectOffer(first!.offerSetId, firstOfferId);
      assert.ok(selectedFromFirst.offer);
      assert.equal(selectedFromFirst.offer!.offerId, firstOfferId);
    } finally {
      globalThis.fetch = originalFetch;
      engine.resetDexQuoteFns();
    }
  });
});
