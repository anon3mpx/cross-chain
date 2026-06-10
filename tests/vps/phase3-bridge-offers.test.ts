import test from 'node:test';
import assert from 'node:assert/strict';
import { QuoteEngine } from '../../src/vps/services/QuoteEngine';
import { CHAIN_RAILS, RAIL_PROVIDERS } from '../../src/vps/rails/registry';
import { CHAIN_ID, Rail } from '../../src/vps/types';

const USER = '0x3333333333333333333333333333333333333333';
const ETH_USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const ARB_USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
const POLY_USDC = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const BSC_USDT = '0x55d398326f99059fF775485246999027B3197955';

test('Phase 3 rails are registered and advertised on the expected chain set', () => {
  assert.equal(Rail.CHAINFLIP, 'CHAINFLIP');
  assert.equal(Rail.MAYA, 'MAYA');
  assert.equal(Rail.TELESWAP, 'TELESWAP');

  assert.equal(RAIL_PROVIDERS[Rail.CHAINFLIP].config.railType, 'liquidity');
  assert.equal(RAIL_PROVIDERS[Rail.MAYA].config.railType, 'liquidity');
  assert.equal(RAIL_PROVIDERS[Rail.TELESWAP].config.railType, 'liquidity');

  assert.ok(CHAIN_RAILS[1]?.includes(Rail.CHAINFLIP));
  assert.ok(CHAIN_RAILS[42161]?.includes(Rail.MAYA));
  assert.ok(CHAIN_RAILS[56]?.includes(Rail.TELESWAP));
  assert.ok(CHAIN_RAILS[CHAIN_ID.DOT]?.includes(Rail.CHAINFLIP));
  assert.ok(CHAIN_RAILS[CHAIN_ID.KUJI]?.includes(Rail.MAYA));
  assert.ok(CHAIN_RAILS[CHAIN_ID.BTC]?.includes(Rail.TELESWAP));
});

test('QuoteEngine includes Chainflip provider-direct offers', async () => {
  const engine = new QuoteEngine(undefined, {
    thorchainQuoteWorker: undefined,
    chainflipQuoteWorker: {
      quote: async () => ({
        depositAddress: '0x4444444444444444444444444444444444444444',
        channelId: 'cf-channel-1',
        expectedAmountOut: 990_000n,
        effectiveRateBps: 9_950,
        expiresAtUnix: 1_900_000_123,
        etaSeconds: 45,
        networkFees: {
          sourceFee: 1_000n,
          destinationFee: 2_000n,
        },
        brokerFeeAmount: 500n,
      }),
    },
  } as any);

  const offerSet = await engine.getOffers({
    tokenIn: ETH_USDC,
    tokenOut: 'DOT',
    amountIn: 1_000_000n,
    srcChainId: 1,
    dstChainId: CHAIN_ID.DOT,
    userAddress: USER,
    nativeDstAddress: '1dotDest',
  });

  const offer = offerSet?.offers.find((candidate) => candidate.rail === Rail.CHAINFLIP);
  assert.ok(offer);
  assert.equal(offer.executionMode, 'provider_direct');
  assert.equal(offer.offerType, 'chainflip_broker_direct');
  assert.equal(offer.execution.provider, 'chainflip_broker');
  assert.equal(offer.execution.channelId, 'cf-channel-1');
});

test('QuoteEngine includes Maya provider-direct offers', async () => {
  const engine = new QuoteEngine(undefined, {
    thorchainQuoteWorker: undefined,
    mayaQuoteWorker: {
      quote: async () => ({
        vaultAddress: '0x5555555555555555555555555555555555555555',
        memo: '=:ARB.USDC:0xabc',
        expectedAmountOut: 985_000n,
        slipBps: 35,
        outboundFee: 500n,
        expiresAtUnix: 1_900_000_123,
        etaSeconds: 90,
      }),
    },
  } as any);

  const offerSet = await engine.getOffers({
    tokenIn: ETH_USDC,
    tokenOut: ARB_USDC,
    amountIn: 1_000_000n,
    srcChainId: 1,
    dstChainId: 42161,
    userAddress: USER,
  });

  const offer = offerSet?.offers.find((candidate) => candidate.rail === Rail.MAYA);
  assert.ok(offer);
  assert.equal(offer.executionMode, 'provider_direct');
  assert.equal(offer.offerType, 'maya_direct');
  assert.equal(offer.execution.provider, 'maya_midgard');
  assert.equal(offer.execution.memo, '=:ARB.USDC:0xabc');
});

test('QuoteEngine includes TeleSwap provider-direct offers', async () => {
  const engine = new QuoteEngine(undefined, {
    thorchainQuoteWorker: undefined,
    teleSwapQuoteWorker: {
      quote: async () => ({
        depositAddress: '0x7777777777777777777777777777777777777777',
        swapId: 'ts-swap-1',
        expectedAmountOut: 970_000n,
        slipBps: 55,
        etaSeconds: 1800,
        protocolFeeAmount: 1_500n,
        dexRouter: 'uniswap-v3-polygon',
      }),
    },
  } as any);

  const offerSet = await engine.getOffers({
    tokenIn: 'BTC',
    tokenOut: POLY_USDC,
    amountIn: 100_000_000n,
    srcChainId: CHAIN_ID.BTC,
    dstChainId: 137,
    userAddress: USER,
  });

  const offer = offerSet?.offers.find((candidate) => candidate.rail === Rail.TELESWAP);
  assert.ok(offer);
  assert.equal(offer.executionMode, 'provider_direct');
  assert.equal(offer.offerType, 'teleswap_direct');
  assert.equal(offer.execution.provider, 'teleswap_api');
  assert.equal(offer.execution.swapId, 'ts-swap-1');
});
