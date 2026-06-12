import test from 'node:test';
import assert from 'node:assert/strict';
import { QuoteEngine } from '../../src/vps/services/QuoteEngine';
import { CHAIN_RAILS, RAIL_PROVIDERS } from '../../src/vps/rails/registry';
import { Rail } from '../../src/vps/types';

const USER = '0x3333333333333333333333333333333333333333';
const ETH_USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const OP_USDC = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85';
const ETH_WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const OP_WETH = '0x4200000000000000000000000000000000000006';

test('Phase 5 registry adds the first official native bridge rollout while keeping Wormhole gated', () => {
  assert.equal(Rail.OPTIMISM_NATIVE_BRIDGE, 'OPTIMISM_NATIVE_BRIDGE');
  assert.equal(RAIL_PROVIDERS[Rail.OPTIMISM_NATIVE_BRIDGE].config.railType, 'messaging');

  assert.ok(CHAIN_RAILS[1]?.includes(Rail.OPTIMISM_NATIVE_BRIDGE));
  assert.ok(CHAIN_RAILS[10]?.includes(Rail.OPTIMISM_NATIVE_BRIDGE));
  assert.ok(CHAIN_RAILS[1]?.includes(Rail.VIA_LABS));
  assert.ok(CHAIN_RAILS[421614]?.includes(Rail.AXELAR));
  assert.equal(CHAIN_RAILS[1]?.includes(Rail.WORMHOLE) ?? false, false);
});

test('QuoteEngine surfaces Optimism native bridge deposits as provider-direct offers', async () => {
  const engine = new QuoteEngine(undefined, {
    thorchainQuoteWorker: undefined,
  } as any);

  const offerSet = await engine.getOffers({
    tokenIn: ETH_USDC,
    tokenOut: OP_USDC,
    amountIn: 1_000_000n,
    srcChainId: 1,
    dstChainId: 10,
    userAddress: USER,
  });

  const offer = offerSet?.offers.find((candidate) => candidate.rail === Rail.OPTIMISM_NATIVE_BRIDGE);
  assert.ok(offer);
  assert.equal(offer.executionMode, 'provider_direct');
  assert.equal(offer.offerType, 'optimism_native_bridge_direct');
  assert.equal(offer.execution.provider, 'optimism_standard_bridge');
  assert.equal((offer.execution as any).direction, 'deposit');
  assert.equal((offer.execution as any).requiresPatient, false);
});

test('QuoteEngine only surfaces native bridge withdrawals when patient urgency is explicit', async () => {
  const engine = new QuoteEngine(undefined, {
    thorchainQuoteWorker: undefined,
  } as any);

  const hidden = await engine.getOffers({
    tokenIn: OP_WETH,
    tokenOut: ETH_WETH,
    amountIn: 1_000_000_000_000_000n,
    srcChainId: 10,
    dstChainId: 1,
    userAddress: USER,
    urgency: 'normal',
  });
  assert.equal(hidden?.offers.some((candidate) => candidate.rail === Rail.OPTIMISM_NATIVE_BRIDGE) ?? false, false);

  const surfaced = await engine.getOffers({
    tokenIn: OP_WETH,
    tokenOut: ETH_WETH,
    amountIn: 1_000_000_000_000_000n,
    srcChainId: 10,
    dstChainId: 1,
    userAddress: USER,
    urgency: 'patient',
  });
  const offer = surfaced?.offers.find((candidate) => candidate.rail === Rail.OPTIMISM_NATIVE_BRIDGE);
  assert.ok(offer);
  assert.equal((offer.execution as any).direction, 'withdraw');
  assert.equal((offer.execution as any).requiresPatient, true);
  assert.ok(Number((offer.execution as any).challengePeriodSeconds) > 0);
});

test('QuoteEngine propagates explicit refund addresses for non-EVM source TeleSwap flows', async () => {
  const engine = new QuoteEngine(undefined, {
    thorchainQuoteWorker: undefined,
    teleSwapQuoteWorker: {
      quote: async () => ({
        depositAddress: '0x7777777777777777777777777777777777777777',
        swapId: 'ts-swap-phase5',
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
    tokenOut: OP_USDC,
    amountIn: 100_000_000n,
    srcChainId: 0,
    dstChainId: 10,
    userAddress: USER,
    refundAddress: 'bc1qphase5refund',
  });

  const offer = offerSet?.offers.find((candidate) => candidate.rail === Rail.TELESWAP);
  assert.ok(offer);
  assert.equal((offer.execution as any).refundAddress, 'bc1qphase5refund');
  assert.equal((offer.execution.quote as any).refundAddress, 'bc1qphase5refund');
});
