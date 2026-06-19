import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HYPERLANE_DOMAIN_BY_CHAIN_ID,
  HyperlaneNexusQuoteWorker,
} from '../../src/vps/services/hyperlane/HyperlaneNexusQuoteWorker';
import { HYPERLANE_NEXUS_ROUTE_CHAINS } from '../../src/vps/config/hyperlaneNexusRoutes';
import { HyperlaneNexusRouteCatalog } from '../../src/vps/services/hyperlane/HyperlaneNexusRouteCatalog';
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

test('Hyperlane Nexus default catalog is backed by checked-in placeholder route config', () => {
  assert.deepEqual(
    HYPERLANE_NEXUS_ROUTE_CHAINS.map((chain) => chain.chainId),
    [1, 10, 56, 137, 8453, 42161, 43114],
  );

  for (const chain of HYPERLANE_NEXUS_ROUTE_CHAINS) {
    assert.equal(typeof chain.domain, 'number');
    assert.equal(typeof chain.registryChainName, 'string');
    for (const asset of [chain.assets?.USDC, chain.assets?.USDT]) {
      assert.ok(asset);
      assert.deepEqual(Object.keys(asset), [
        'warpRouteAddress',
        'collateralTokenAddress',
        'tokenType',
        'cctpVersion',
        'connections',
        'interchainGasFee',
        'etaSeconds',
        'disabled',
      ]);
      assert.equal(asset.warpRouteAddress, '');
      assert.equal(asset.collateralTokenAddress, '');
      assert.equal(asset.tokenType, '');
      assert.equal(asset.cctpVersion, '');
      assert.deepEqual(asset.connections, []);
      assert.equal(asset.interchainGasFee, '');
      assert.equal(asset.etaSeconds, 0);
      assert.equal(asset.disabled, true);
    }
  }

  const defaultCatalog = new HyperlaneNexusRouteCatalog({ env: {} });
  assert.equal(defaultCatalog.findRoute({ srcChainId: 1, dstChainId: 8453, assetSymbol: 'USDC' }), null);
});

test('HyperlaneNexusRouteCatalog enforces registry connections when present', () => {
  const catalog = new HyperlaneNexusRouteCatalog({
    defaultInterchainGasFee: 50_000_000_000_000n,
    defaultEtaSeconds: 75,
    chains: [
      {
        chainId: 1,
        domain: 1,
        registryChainName: 'ethereum',
        assets: {
          USDC: {
            warpRouteAddress: '0x' + 'a'.repeat(40),
            connections: [
              {
                protocol: 'ethereum',
                chainName: 'base',
                warpRouteAddress: '0x' + 'b'.repeat(40),
              },
            ],
          },
        },
      },
      {
        chainId: 8453,
        domain: 8453,
        registryChainName: 'base',
        assets: {},
      },
      {
        chainId: 42161,
        domain: 42161,
        registryChainName: 'arbitrum',
        assets: {},
      },
    ],
  });

  assert.ok(catalog.findRoute({ srcChainId: 1, dstChainId: 8453, assetSymbol: 'USDC' }));
  assert.equal(catalog.findRoute({ srcChainId: 1, dstChainId: 42161, assetSymbol: 'USDC' }), null);
});

test('HyperlaneNexusQuoteWorker returns null without a catalog route', async () => {
  const worker = new HyperlaneNexusQuoteWorker({
    catalog: new HyperlaneNexusRouteCatalog({ chains: [] }),
  });
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

test('HyperlaneNexusQuoteWorker builds a 1:1 quote from catalog route metadata', async () => {
  const worker = new HyperlaneNexusQuoteWorker({
    catalog: new HyperlaneNexusRouteCatalog({
      defaultInterchainGasFee: 50_000_000_000_000n,
      defaultEtaSeconds: 75,
      chains: [
        {
          chainId: 1,
          domain: 1,
          assets: {
            USDC: { warpRouteAddress: '0x' + 'a'.repeat(40) },
          },
        },
        { chainId: 8453, domain: 8453, assets: {} },
      ],
    }),
  });

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
});

test('HyperlaneNexusRouteCatalog rejects disabled or malformed routes', async () => {
  const malformedCatalog = new HyperlaneNexusRouteCatalog({
    chains: [
      {
        chainId: 1,
        domain: 1,
        assets: {
          USDC: { warpRouteAddress: 'not-an-address' },
        },
      },
      { chainId: 8453, domain: 8453, assets: {} },
    ],
  });
  assert.equal(malformedCatalog.findRoute({ srcChainId: 1, dstChainId: 8453, assetSymbol: 'USDC' }), null);

  const disabledCatalog = new HyperlaneNexusRouteCatalog({
    chains: [
      {
        chainId: 1,
        domain: 1,
        assets: {
          USDC: { warpRouteAddress: '0x' + 'a'.repeat(40), disabled: true },
        },
      },
      { chainId: 8453, domain: 8453, assets: {} },
    ],
  });
  assert.equal(disabledCatalog.findRoute({ srcChainId: 1, dstChainId: 8453, assetSymbol: 'USDC' }), null);
});

test('HyperlaneNexusQuoteWorker ignores per-route env config without catalog metadata', async () => {
  process.env.HYPERLANE_WARP_ROUTE_USDC_1 = '0x' + 'b'.repeat(40);
  process.env.HYPERLANE_IGP_FEE_1 = '60000000000000';
  process.env.HYPERLANE_ETA_1 = '90';
  try {
    const worker = new HyperlaneNexusQuoteWorker({
      catalog: new HyperlaneNexusRouteCatalog({ chains: [], env: process.env }),
    });
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
    delete process.env.HYPERLANE_IGP_FEE_1;
    delete process.env.HYPERLANE_ETA_1;
  }
});
