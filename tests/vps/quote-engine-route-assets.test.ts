import test from 'node:test';
import assert from 'node:assert/strict';
import { QuoteEngine } from '../../src/vps/services/QuoteEngine';
import { Rail } from '../../src/vps/types';

const BASE_USDC = '0x0000000000000000000000000000000000001001';
const BASE_ETH = '0x0000000000000000000000000000000000001003';
const ARB_USDC = '0x0000000000000000000000000000000000002001';
const ARB_ETH = '0x0000000000000000000000000000000000002003';

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
    CHAIN_42161_TOKEN_CCTP_USDC: ARB_USDC,
    CHAIN_42161_TOKEN_AXELAR_USDC: ARB_USDC,
    CHAIN_42161_TOKEN_LAYERZERO_USDC: ARB_USDC,
    CHAIN_42161_TOKEN_THORCHAIN_USDC: ARB_USDC,
    CHAIN_42161_TOKEN_AXELAR_ETH: ARB_ETH,
    CHAIN_42161_TOKEN_LAYERZERO_ETH: ARB_ETH,
    CHAIN_42161_TOKEN_THORCHAIN_ETH: ARB_ETH,
    ...extraEnv,
  };

  for (const [key, value] of Object.entries(nextEnv)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }

  return fn().finally(() => {
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
      assert.ok(result!.offers.some((offer) => offer.rail === Rail.LAYERZERO && Boolean(offer.offerType)));
      assert.ok(result!.offers.some((offer) => offer.rail === Rail.CCTP && offer.offerType === 'cctp_standard'));
      assert.ok(result!.offers.some((offer) => offer.rail === Rail.THORCHAIN && offer.executionMode === 'provider_direct'));
      assert.ok(result!.offers.every((offer) => offer.routeAsset));
      assert.ok(result!.offers.every((offer) => offer.deliveryShape));
    } finally {
      engine.resetDexQuoteFns();
    }
  });
});
