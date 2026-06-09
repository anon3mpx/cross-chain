import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HYPERLANE_DOMAIN_BY_CHAIN_ID,
  HyperlaneNexusQuoteWorker,
} from '../../src/vps/services/hyperlane/HyperlaneNexusQuoteWorker';
import { Rail } from '../../src/vps/types';
import { CHAIN_RAILS, RAIL_PROVIDERS, ZERO_PLUGIN_ID } from '../../src/vps/rails/registry';

test('Hyperlane Nexus rail is registered as a messaging provider-direct stablecoin rail', () => {
  assert.equal(Rail.HYPERLANE_NEXUS, 'HYPERLANE_NEXUS');

  const provider = RAIL_PROVIDERS[Rail.HYPERLANE_NEXUS];
  assert.ok(provider);
  assert.equal(provider.config.railType, 'messaging');
  assert.equal(provider.config.pluginId, ZERO_PLUGIN_ID);
  assert.equal(provider.config.supportsUSDC, true);
  assert.equal(provider.config.supportsUSDT, true);
  assert.equal(provider.config.supportsETH, false);

  for (const chainId of [1, 10, 56, 137, 8453, 42161, 43114]) {
    assert.ok(CHAIN_RAILS[chainId]?.includes(Rail.HYPERLANE_NEXUS));
    assert.equal(HYPERLANE_DOMAIN_BY_CHAIN_ID[chainId], chainId);
  }
});

test('HyperlaneNexusQuoteWorker returns null without a configured warp route', async () => {
  const worker = new HyperlaneNexusQuoteWorker();
  const result = await worker.quote({
    srcChainId: 1,
    dstChainId: 8453,
    tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    assetSymbol: 'USDC',
    amountIn: 1_000_000n,
    destinationAddress: '0x3333333333333333333333333333333333333333',
  });

  assert.equal(result, null);
});

test('HyperlaneNexusQuoteWorker builds a 1:1 quote from env config', async () => {
  process.env.HYPERLANE_WARP_ROUTE_USDC_1 = '0x' + 'a'.repeat(40);
  process.env.HYPERLANE_IGP_FEE_1 = '50000000000000';
  process.env.HYPERLANE_ETA_1 = '75';

  try {
    const worker = new HyperlaneNexusQuoteWorker();
    const result = await worker.quote({
      srcChainId: 1,
      dstChainId: 8453,
      tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      assetSymbol: 'USDC',
      amountIn: 1_000_000n,
      destinationAddress: '0x3333333333333333333333333333333333333333',
    });

    assert.ok(result);
    assert.equal(result.warpRouteAddress, '0x' + 'a'.repeat(40));
    assert.equal(result.destinationDomain, 8453);
    assert.equal(result.expectedAmountOut, 1_000_000n);
    assert.equal(result.interchainGasFee, 50_000_000_000_000n);
    assert.equal(result.etaSeconds, 75);
  } finally {
    delete process.env.HYPERLANE_WARP_ROUTE_USDC_1;
    delete process.env.HYPERLANE_IGP_FEE_1;
    delete process.env.HYPERLANE_ETA_1;
  }
});

test('HyperlaneNexusQuoteWorker rejects malformed warp-route env values', async () => {
  process.env.HYPERLANE_WARP_ROUTE_USDC_1 = 'not-an-address';

  try {
    const worker = new HyperlaneNexusQuoteWorker();
    const result = await worker.quote({
      srcChainId: 1,
      dstChainId: 8453,
      tokenIn: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      assetSymbol: 'USDC',
      amountIn: 1_000_000n,
      destinationAddress: '0x3333333333333333333333333333333333333333',
    });

    assert.equal(result, null);
  } finally {
    delete process.env.HYPERLANE_WARP_ROUTE_USDC_1;
  }
});
