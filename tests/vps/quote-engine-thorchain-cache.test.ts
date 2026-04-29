import test from 'node:test';
import assert from 'node:assert/strict';
import { QuoteEngine } from '../../src/vps/services/QuoteEngine';

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

  return fn().finally(() => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test('QuoteEngine does not reuse in-memory offer cache when THOR provider-direct offers are present', async () => {
  await withPatchedEnv({}, async () => {
    let quoteCalls = 0;
    const engine = new QuoteEngine(undefined, {
      thorchainQuoteWorker: {
        quote: async () => {
          quoteCalls += 1;
          return {
            quote: {
              to_asset: 'ARB.USDC-0X0000000000000000000000000000000000002001',
              expected_amount_out: '99500000',
              inbound_address: '0xthorvault',
              memo: '=:ARB.USDC-0X0000000000000000000000000000000000002001:0x3333333333333333333333333333333333333333:0',
              expiry: Math.floor(Date.now() / 1000) + 60,
            },
            expectedAmountOut: '99500000',
          };
        },
      },
    });

    try {
      engine.registerDexQuoteFn(8453, async (_tokenIn, _tokenOut, amountIn) => amountIn);
      engine.registerDexQuoteFn(42161, async (_tokenIn, _tokenOut, amountIn) => amountIn);

      const request = {
        tokenIn: BASE_USDC,
        tokenOut: ARB_USDC,
        amountIn: 100_000_000n,
        srcChainId: 8453,
        dstChainId: 42161,
        userAddress: '0x3333333333333333333333333333333333333333',
      } as const;

      await engine.getOffers(request);
      const quoteCallsAfterFirstFetch = quoteCalls;
      await engine.getOffers(request);

      assert.ok(quoteCallsAfterFirstFetch > 0);
      assert.equal(quoteCalls, quoteCallsAfterFirstFetch * 2);
    } finally {
      engine.resetDexQuoteFns();
    }
  });
});
