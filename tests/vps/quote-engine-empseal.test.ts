import test from 'node:test';
import assert from 'node:assert/strict';
import { AbiCoder } from 'ethers';
import { QuoteEngine } from '../../src/vps/services/QuoteEngine';

const abiCoder = AbiCoder.defaultAbiCoder();

const OP_TOKEN = '0x4200000000000000000000000000000000000042';
const OP_USDC = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85';
const ARB_TOKEN = '0x912ce59144191c1204e64559fe8253a0e49e6548';
const ARB_USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';

const EMPSEAL_PLUGIN_ID = '0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6';

function withPatchedEnv(extraEnv: Record<string, string>, fn: () => Promise<void>) {
  const previous = new Map<string, string | undefined>();
  const nextEnv = {
    CHAIN_10_RPC_URL: 'https://optimism.invalid',
    CHAIN_42161_RPC_URL: 'https://arbitrum.invalid',
    CHAIN_10_HAS_AGGREGATOR: 'true',
    CHAIN_42161_HAS_AGGREGATOR: 'true',
    CHAIN_10_SWAP_PLUGIN_KIND: 'EMPSEAL',
    CHAIN_42161_SWAP_PLUGIN_KIND: 'EMPSEAL',
    CHAIN_10_EMPSEAL_ROUTER: '0x686c652d079A370eC97F93B2b4805Ee06aE25d04',
    CHAIN_42161_EMPSEAL_ROUTER: '0xA7772cDBA7739F19dcaE85fe0357929790FD23F9',
    ...extraEnv,
  };

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

test('getOffers uses Empseal swap plans for both swap legs and emits executable swap data', async () => {
  await withPatchedEnv({}, async () => {
    const swapPlanCalls: Array<{ chainId: number; tokenIn: string; tokenOut: string; amountIn: bigint }> = [];
    const engine = new QuoteEngine(undefined, {
      empsealQuoteWorker: {
        buildSwapPlan: async ({ chainId, tokenIn, tokenOut, amountIn }) => {
          swapPlanCalls.push({ chainId, tokenIn, tokenOut, amountIn });

          if (chainId === 10) {
            assert.equal(tokenIn.toLowerCase(), OP_TOKEN.toLowerCase());
            assert.equal(tokenOut.toLowerCase(), OP_USDC.toLowerCase());
            assert.equal(amountIn, 99_700_000_000_000_000_000n);
            return {
              amountOut: 150_000_000n,
              trade: {
                amountIn,
                amountOut: 150_000_000n,
                path: [tokenIn, tokenOut],
                adapters: ['0x0000000000000000000000000000000000000a11'],
              },
            };
          }

          if (chainId === 42161) {
            assert.equal(tokenIn.toLowerCase(), ARB_USDC.toLowerCase());
            assert.equal(tokenOut.toLowerCase(), ARB_TOKEN.toLowerCase());
            assert.equal(amountIn, 150_000_000n);
            return {
              amountOut: 70_000_000_000_000_000_000n,
              trade: {
                amountIn,
                amountOut: 70_000_000_000_000_000_000n,
                path: [tokenIn, tokenOut],
                adapters: ['0x0000000000000000000000000000000000000b22'],
              },
            };
          }

          return null;
        },
      },
    });

    const result = await engine.getOffers({
      tokenIn: OP_TOKEN,
      tokenOut: ARB_TOKEN,
      amountIn: 100_000_000_000_000_000_000n,
      srcChainId: 10,
      dstChainId: 42161,
      userAddress: '0x05f8cc8753d90d67dbb8c02118440b8283f941c9',
    });

    assert.ok(result);
    const cctpOffer = result.offers.find((offer) => offer.rail === 'CCTP');
    assert.ok(cctpOffer);
    assert.equal(cctpOffer.execution.quote.swapPluginIdSrc, EMPSEAL_PLUGIN_ID);
    assert.equal(cctpOffer.execution.quote.swapPluginIdDst, EMPSEAL_PLUGIN_ID);
    assert.equal(cctpOffer.execution.quote.minSrcSwapOut, 149_250_000n);
    assert.equal(cctpOffer.execution.quote.minSettlementAmount, 149_850_000n);
    assert.equal(cctpOffer.execution.quote.estimatedOut, 70_000_000_000_000_000_000n);
    assert.notEqual(cctpOffer.execution.quote.swapDataSrc, '0x');
    assert.notEqual(cctpOffer.execution.quote.swapDataDst, '0x');

    const decodedSrc = abiCoder.decode(
      ['tuple(uint256 amountIn,uint256 amountOut,address[] path,address[] adapters)'],
      cctpOffer.execution.quote.swapDataSrc,
    )[0];
    const decodedDst = abiCoder.decode(
      ['tuple(uint256 amountIn,uint256 amountOut,address[] path,address[] adapters)'],
      cctpOffer.execution.quote.swapDataDst,
    )[0];

    assert.equal(decodedSrc.path[0].toLowerCase(), OP_TOKEN.toLowerCase());
    assert.equal(decodedSrc.path[1].toLowerCase(), OP_USDC.toLowerCase());
    assert.equal(decodedDst.path[0].toLowerCase(), ARB_USDC.toLowerCase());
    assert.equal(decodedDst.path[1].toLowerCase(), ARB_TOKEN.toLowerCase());
    assert.ok(swapPlanCalls.length >= 2);
    assert.ok(swapPlanCalls.some((call) =>
      call.chainId === 10
      && call.tokenIn.toLowerCase() === OP_TOKEN.toLowerCase()
      && call.tokenOut.toLowerCase() === OP_USDC.toLowerCase()
    ));
    assert.ok(swapPlanCalls.some((call) =>
      call.chainId === 42161
      && call.tokenIn.toLowerCase() === ARB_USDC.toLowerCase()
      && call.tokenOut.toLowerCase() === ARB_TOKEN.toLowerCase()
    ));
  });
});

test('getOffers fails closed for swap-required routes when Empseal cannot build a swap plan', async () => {
  await withPatchedEnv({}, async () => {
    const engine = new QuoteEngine(undefined, {
      empsealQuoteWorker: {
        buildSwapPlan: async () => null,
      },
    });

    const result = await engine.getOffers({
      tokenIn: OP_TOKEN,
      tokenOut: ARB_TOKEN,
      amountIn: 100_000_000_000_000_000_000n,
      srcChainId: 10,
      dstChainId: 42161,
      userAddress: '0x05f8cc8753d90d67dbb8c02118440b8283f941c9',
    });

    assert.equal(result, null);
  });
});
