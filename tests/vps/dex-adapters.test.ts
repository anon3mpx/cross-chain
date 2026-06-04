import test from 'node:test';
import assert from 'node:assert/strict';
import { registerDexQuoteAdapters } from '../../src/vps/bootstrap/dexAdapters';
import { QuoteEngine } from '../../src/vps/services/QuoteEngine';

const BASE_WETH = '0x4200000000000000000000000000000000000006';
const ARB_USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

function withPatchedEnv(extraEnv: Record<string, string | undefined>, fn: () => Promise<void>) {
  const previous = new Map<string, string | undefined>();

  for (const key of Object.keys(extraEnv)) {
    previous.set(key, process.env[key]);
    const value = extraEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  return fn().finally(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test('registerDexQuoteAdapters does not install quotes for swap-dependent pairs without configured routers', async () => {
  await withPatchedEnv({
    CHAIN_8453_HAS_AGGREGATOR: 'true',
    CHAIN_42161_HAS_AGGREGATOR: 'true',
    CHAIN_8453_SWAP_PLUGIN_KIND: 'EMPSEAL',
    CHAIN_42161_SWAP_PLUGIN_KIND: 'EMPSEAL',
    CHAIN_8453_EMPSEAL_ROUTER: undefined,
    CHAIN_42161_EMPSEAL_ROUTER: undefined,
    CHAIN_8453_DEX_EMPSEAL_ROUTER: undefined,
    CHAIN_42161_DEX_EMPSEAL_ROUTER: undefined,
    CHAIN_8453_UNIV2_ROUTER: undefined,
    CHAIN_42161_UNIV2_ROUTER: undefined,
  }, async () => {
    const engine = new QuoteEngine(undefined, {
      thorchainQuoteWorker: undefined,
      layerZeroValueTransferApiQuoteWorker: undefined,
    });
    registerDexQuoteAdapters(engine, process.env);

    const result = await engine.getOffers({
      tokenIn: BASE_WETH,
      tokenOut: ARB_USDC,
      amountIn: 1_000_000_000_000_000_000n,
      srcChainId: 8453,
      dstChainId: 42161,
      userAddress: '0x05f8cc8753d90d67dbb8c02118440b8283f941c9',
      urgency: 'fast',
    });

    assert.equal(result, null);
  });
});

test('registerDexQuoteAdapters ignores removed DEX mock fee env vars', async () => {
  await withPatchedEnv({
    CHAIN_8453_HAS_AGGREGATOR: 'true',
    CHAIN_42161_HAS_AGGREGATOR: 'true',
    CHAIN_8453_SWAP_PLUGIN_KIND: 'UNIV2',
    CHAIN_42161_SWAP_PLUGIN_KIND: 'UNIV2',
    CHAIN_8453_UNIV2_ROUTER: undefined,
    CHAIN_42161_UNIV2_ROUTER: undefined,
    CHAIN_8453_DEX_MOCK_FEE_BPS: '30',
    CHAIN_42161_DEX_MOCK_FEE_BPS: '30',
  }, async () => {
    const engine = new QuoteEngine(undefined, {
      thorchainQuoteWorker: undefined,
      layerZeroValueTransferApiQuoteWorker: undefined,
    });
    registerDexQuoteAdapters(engine, process.env);

    const result = await engine.getOffers({
      tokenIn: BASE_WETH,
      tokenOut: ARB_USDC,
      amountIn: 1_000_000_000_000_000_000n,
      srcChainId: 8453,
      dstChainId: 42161,
      userAddress: '0x05f8cc8753d90d67dbb8c02118440b8283f941c9',
      urgency: 'fast',
    });

    assert.equal(result, null);
  });
});

test('registerDexQuoteAdapters skips router wiring when the registry has no configured provider for the chain', async () => {
  const engine = new QuoteEngine(undefined, {
    thorchainQuoteWorker: undefined,
    layerZeroValueTransferApiQuoteWorker: undefined,
  });

  registerDexQuoteAdapters(
    engine,
    {
      CHAIN_8453_UNIV2_ROUTER: '0x1111111111111111111111111111111111111111',
    },
    {
      getReadProvider() {
        throw new Error('No RPC URLs configured');
      },
    } as any,
  );

  const result = await engine.getOffers({
    tokenIn: BASE_WETH,
    tokenOut: ARB_USDC,
    amountIn: 1_000_000_000_000_000_000n,
    srcChainId: 8453,
    dstChainId: 42161,
    userAddress: '0x05f8cc8753d90d67dbb8c02118440b8283f941c9',
    urgency: 'fast',
  });

  assert.equal(result, null);
});
