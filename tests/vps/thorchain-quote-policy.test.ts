import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTHORChainQuoteRequestFromPair,
  buildTHORChainQuoteRequest,
  resetTHORChainQuotePolicyCacheForTests,
  shouldCacheOfferSet,
} from '../../src/vps/services/thorchain/THORChainQuotePolicy';
import { Rail } from '../../src/vps/types';

function withPatchedEnv(extraEnv: Record<string, string>, fn: () => Promise<void>) {
  const previous = new Map<string, string | undefined>();
  const nextEnv = {
    CHAIN_8453_TOKEN_THORCHAIN_USDC: '0x0000000000000000000000000000000000001001',
    CHAIN_42161_TOKEN_THORCHAIN_USDC: '0x0000000000000000000000000000000000002001',
    CHAIN_8453_TOKEN_THORCHAIN_ETH: '0x0000000000000000000000000000000000001003',
    CHAIN_42161_TOKEN_THORCHAIN_ETH: '0x0000000000000000000000000000000000002003',
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

test('buildTHORChainQuoteRequest maps EVM USDC assets to THORChain notation', async () => {
  await withPatchedEnv({}, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify([
      { asset: 'BASE.USDC-0X0000000000000000000000000000000000001001', status: 'available' },
      { asset: 'ARB.USDC-0X0000000000000000000000000000000000002001', status: 'available' },
    ]), { status: 200 })) as typeof fetch;

    try {
      const request = await buildTHORChainQuoteRequest({
        amountIn: 1_000_000n,
        srcChainId: 8453,
        dstChainId: 42161,
        destinationAddress: '0x3333333333333333333333333333333333333333',
        routeAssetAlias: 'USDC',
        sourceTokenAddress: '0x0000000000000000000000000000000000001001',
        destinationTokenAddress: '0x0000000000000000000000000000000000002001',
        tokenIn: '0x0000000000000000000000000000000000001001',
        tokenOut: '0x0000000000000000000000000000000000002001',
      });

      assert.ok(request);
      assert.equal(request!.fromAsset, 'BASE.USDC-0X0000000000000000000000000000000000001001');
      assert.equal(request!.toAsset, 'ARB.USDC-0X0000000000000000000000000000000000002001');
      assert.equal(request!.destinationAddress, '0x3333333333333333333333333333333333333333');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('buildTHORChainQuoteRequestFromPair normalizes source amount to THORChain 1e8 units', async () => {
  await withPatchedEnv({ CHAIN_8453_THORCHAIN_CHAIN_ALIAS: 'BASE' }, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify([
      {
        asset: 'BASE.USDC-0X0000000000000000000000000000000000001001',
        status: 'available',
        nativeDecimal: '6',
      },
      { asset: 'BTC.BTC', status: 'available', nativeDecimal: '8' },
    ]), { status: 200 })) as typeof fetch;

    try {
      const request = await buildTHORChainQuoteRequestFromPair({
        amountIn: 100_000_000n,
        srcChainId: 8453,
        dstChainId: 0,
        tokenIn: '0x0000000000000000000000000000000000001001',
        tokenOut: 'BTC.BTC',
        destinationAddress: 'bc1qexample',
      });

      assert.ok(request);
      assert.equal(request!.fromAsset, 'BASE.USDC-0X0000000000000000000000000000000000001001');
      assert.equal(request!.amountInThorchain, 10_000_000_000n);
      assert.equal(request!.fromAssetDecimals, 6);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('buildTHORChainQuoteRequestFromPair resolves Base USDC to Avalanche USDC with uppercase hex input', async () => {
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

    try {
      const request = await buildTHORChainQuoteRequestFromPair({
        amountIn: 10_000_000n,
        srcChainId: 8453,
        dstChainId: 43114,
        tokenIn: '0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913',
        tokenOut: '0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E',
        destinationAddress: '0x05F8cC8753D90d67DBB8c02118440b8283F941c9',
      });

      assert.ok(request);
      assert.equal(request!.fromAsset, 'BASE.USDC-0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913');
      assert.equal(request!.toAsset, 'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E');
      assert.equal(request!.amountInThorchain, 1_000_000_000n);
      assert.equal(request!.destinationAddress, '0x05F8cC8753D90d67DBB8c02118440b8283F941c9');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('buildTHORChainQuoteRequestFromPair resolves Solana token mints from pools before native SOL fallback', async () => {
  const solUsdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  await withPatchedEnv({}, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify([
      { asset: `SOL.USDC-${solUsdcMint}`, status: 'available', nativeDecimal: '6' },
      { asset: 'BTC.BTC', status: 'available', nativeDecimal: '8' },
    ]), { status: 200 })) as typeof fetch;

    try {
      const request = await buildTHORChainQuoteRequestFromPair({
        amountIn: 1_000_000n,
        srcChainId: 99,
        dstChainId: 0,
        tokenIn: solUsdcMint,
        tokenOut: 'BTC.BTC',
        destinationAddress: 'bc1qexample',
      });

      assert.ok(request);
      assert.equal(request!.fromAsset, `SOL.USDC-${solUsdcMint}`);
      assert.equal(request!.amountInThorchain, 100_000_000n);
      assert.equal(request!.fromAssetDecimals, 6);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('buildTHORChainQuoteRequest maps ETH route asset to chain-native ETH notation', async () => {
  await withPatchedEnv({}, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response(JSON.stringify([
      { asset: 'BASE.USDC-0X0000000000000000000000000000000000001001', status: 'available' },
      { asset: 'ARB.USDC-0X0000000000000000000000000000000000002001', status: 'available' },
    ]), { status: 200 })) as typeof fetch;

    try {
      const request = await buildTHORChainQuoteRequest({
        amountIn: 1_000_000n,
        srcChainId: 8453,
        dstChainId: 42161,
        destinationAddress: '0x3333333333333333333333333333333333333333',
        routeAssetAlias: 'WETH',
        sourceTokenAddress: '0x0000000000000000000000000000000000001003',
        destinationTokenAddress: '0x0000000000000000000000000000000000002003',
        tokenIn: '0x0000000000000000000000000000000000001003',
        tokenOut: '0x0000000000000000000000000000000000002003',
      });

      assert.ok(request);
      assert.equal(request!.fromAsset, 'BASE.ETH');
      assert.equal(request!.toAsset, 'ARB.ETH');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('buildTHORChainQuoteRequest returns null when route asset alias is unsupported', async () => {
  const request = await buildTHORChainQuoteRequest({
    amountIn: 1_000_000n,
    srcChainId: 8453,
    dstChainId: 42161,
    destinationAddress: '0x3333333333333333333333333333333333333333',
    routeAssetAlias: 'RUNE',
    sourceTokenAddress: '0x0000000000000000000000000000000000001001',
    destinationTokenAddress: '0x0000000000000000000000000000000000002001',
    tokenIn: '0x0000000000000000000000000000000000001001',
    tokenOut: '0x0000000000000000000000000000000000002001',
  });

  assert.equal(request, null);
});

test('shouldCacheOfferSet disables cache reuse for THOR offers', () => {
  assert.equal(
    shouldCacheOfferSet({
      offerSetId: 'x',
      expiresAt: Math.floor(Date.now() / 1000) + 60,
      offers: [{ rail: Rail.THORCHAIN } as any],
    }),
    false,
  );

  assert.equal(
    shouldCacheOfferSet({
      offerSetId: 'y',
      expiresAt: Math.floor(Date.now() / 1000) + 60,
      offers: [{ rail: Rail.CCTP } as any],
    }),
    true,
  );
});
