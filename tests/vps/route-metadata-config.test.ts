import test from 'node:test';
import assert from 'node:assert/strict';
import { getSettlementTokenAddress } from '../../src/vps/config/contracts';
import { getRouteMetadataEntry } from '../../src/vps/config/routeMetadata';
import { Rail, SettlementToken } from '../../src/vps/types';
import { AxelarAssetCatalog } from '../../src/vps/services/axelar/AxelarAssetCatalog';
import { LayerZeroRouteCatalog } from '../../src/vps/services/layerzero/LayerZeroRouteCatalog';

const BASE_AXL_USDC = '0x0000000000000000000000000000000000001002';
const BASE_LZ_USDC = '0x0000000000000000000000000000000000001001';
const BASE_LZ_USDT = '0x0000000000000000000000000000000000001004';
const BASE_LZ_ETH = '0x0000000000000000000000000000000000001003';
const ARB_AXL_USDC = '0x0000000000000000000000000000000000002002';
const ARB_LZ_USDC = '0x0000000000000000000000000000000000002001';
const ARB_LZ_USDT = '0x0000000000000000000000000000000000002004';
const ARB_LZ_ETH = '0x0000000000000000000000000000000000002003';
const BASE_LZ_OFT_USDC = '0x0000000000000000000000000000000000003001';
const BASE_LZ_OFT_USDT = '0x0000000000000000000000000000000000003002';
const BASE_LZ_OFT_ETH = '0x0000000000000000000000000000000000003003';
const ARB_AXL_USDC_TOKEN_ID = '0x' + '11'.repeat(32);
const ARB_AXL_USDT_TOKEN_ID = '0x' + '22'.repeat(32);
const ARB_AXL_ETH_TOKEN_ID = '0x' + '33'.repeat(32);

test('route metadata config exposes typed chain entries', () => {
  const base = getRouteMetadataEntry(8453);
  const arbitrum = getRouteMetadataEntry(42161);

  assert.ok(base);
  assert.ok(arbitrum);
  assert.equal(base?.rails.AXELAR?.tokens.USDC, BASE_AXL_USDC);
  assert.equal(base?.rails.LAYERZERO?.tokens.USDT, BASE_LZ_USDT);
  assert.equal(arbitrum?.axelarTokenIds?.WETH, ARB_AXL_ETH_TOKEN_ID);
  assert.equal(arbitrum?.layerZero?.dstEid, 30110);
});

test('getSettlementTokenAddress resolves TS metadata before env fallback', () => {
  process.env.CHAIN_8453_TOKEN_AXELAR_USDC = '0x0000000000000000000000000000000000009999';
  try {
    assert.equal(
      getSettlementTokenAddress(8453, SettlementToken.USDC, Rail.AXELAR),
      BASE_AXL_USDC,
    );
    assert.equal(
      getSettlementTokenAddress(8453, SettlementToken.USDC, Rail.LAYERZERO),
      BASE_LZ_USDC,
    );
  } finally {
    delete process.env.CHAIN_8453_TOKEN_AXELAR_USDC;
  }
});

test('AxelarAssetCatalog resolves destination token IDs from TS metadata', () => {
  const catalog = new AxelarAssetCatalog({
    defaultCanonicalAssetIds: ['USDC', 'USDT', 'WETH'],
    directCanonicalAssetIds: ['WETH'],
  });

  const routes = catalog.listRoutes({ srcChainId: 8453, dstChainId: 42161 });
  assert.deepEqual(
    routes.map((route) => route.destinationTokenId),
    [ARB_AXL_USDC_TOKEN_ID, ARB_AXL_USDT_TOKEN_ID, ARB_AXL_ETH_TOKEN_ID],
  );
});

test('LayerZeroRouteCatalog resolves OFT metadata and destination eid from TS metadata', () => {
  const catalog = new LayerZeroRouteCatalog({
    defaultCanonicalAssetIds: ['USDC', 'USDT', 'WETH'],
    routeFamilyOverrides: {
      USDC: 'lz_stargate_pool',
      USDT: 'lz_oft_adapter',
      WETH: 'lz_oft',
    },
  });

  const routes = catalog.listRoutes({ srcChainId: 8453, dstChainId: 42161 });
  assert.equal(routes.length, 3);
  assert.equal(routes[0].oftAddress, BASE_LZ_OFT_USDC);
  assert.equal(routes[1].oftAddress, BASE_LZ_OFT_USDT);
  assert.equal(routes[2].oftAddress, BASE_LZ_OFT_ETH);
  assert.ok(routes.every((route) => route.dstEid === 30110));
});
