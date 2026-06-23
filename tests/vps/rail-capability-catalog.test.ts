import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAINFLIP_ASSET_CATALOG,
  MAYA_ASSET_CATALOG,
  RAIL_CAPABILITY_CATALOG,
  TELESWAP_ROUTE_CHAIN_IDS,
  deriveChainRailsFromCapabilities,
  toChainflipCatalogAsset,
  toMayaCatalogAsset,
} from '../../src/vps/config/railCapabilities';
import { checkProviderLimitedRailCapabilities } from '../../src/vps/services/RailCapabilityHealth';
import { CHAIN_RAILS } from '../../src/vps/rails/registry';
import { CHAINFLIP_ACCESSIBLE_CHAIN_IDS, toChainflipAsset } from '../../src/vps/services/chainflip/ChainflipQuoteWorker';
import { MAYA_ACCESSIBLE_CHAIN_IDS, toMayaAsset } from '../../src/vps/services/maya/MayaQuoteWorker';
import { TELESWAP_ACCESSIBLE_CHAIN_IDS } from '../../src/vps/services/teleswap/TeleSwapQuoteWorker';
import { CHAIN_ID, Rail } from '../../src/vps/types';

test('rail capability catalog derives CHAIN_RAILS without losing provider-limited rail coverage', () => {
  assert.deepEqual(CHAIN_RAILS, deriveChainRailsFromCapabilities());

  assert.ok(CHAIN_RAILS[1]?.includes(Rail.CHAINFLIP));
  assert.ok(CHAIN_RAILS[42161]?.includes(Rail.MAYA));
  assert.ok(CHAIN_RAILS[56]?.includes(Rail.TELESWAP));
  assert.ok(CHAIN_RAILS[CHAIN_ID.DOT]?.includes(Rail.CHAINFLIP));
  assert.ok(CHAIN_RAILS[CHAIN_ID.KUJI]?.includes(Rail.MAYA));
  assert.ok(CHAIN_RAILS[CHAIN_ID.BTC]?.includes(Rail.TELESWAP));
});

test('provider-limited asset maps are served from the reviewed capability catalog', () => {
  assert.equal(toChainflipCatalogAsset(1, 'USDC'), 'ETH.USDC');
  assert.equal(toChainflipCatalogAsset(CHAIN_ID.DOT, 'DOT'), 'DOT.DOT');
  assert.equal(toChainflipAsset(42161, 'ETH'), 'ARB.ETH');
  assert.equal(toChainflipAsset(56, 'USDC'), null);

  assert.equal(toMayaCatalogAsset(56, 'USDT'), 'BSC.USDT');
  assert.equal(toMayaCatalogAsset(CHAIN_ID.KUJI, 'KUJI'), 'KUJI.KUJI');
  assert.equal(toMayaAsset(43114, 'AVAX'), 'AVAX.AVAX');
  assert.equal(toMayaAsset(CHAIN_ID.SOL, 'SOL'), null);
});

test('accessible chain ID exports are derived from the catalog data', () => {
  const chainflipCatalogIds = new Set(CHAINFLIP_ASSET_CATALOG.map((entry) => entry.chainId));
  const mayaCatalogIds = new Set(MAYA_ASSET_CATALOG.map((entry) => entry.chainId));

  assert.deepEqual(CHAINFLIP_ACCESSIBLE_CHAIN_IDS, chainflipCatalogIds);
  assert.deepEqual(MAYA_ACCESSIBLE_CHAIN_IDS, mayaCatalogIds);
  assert.deepEqual(TELESWAP_ACCESSIBLE_CHAIN_IDS, new Set(TELESWAP_ROUTE_CHAIN_IDS));
});

test('provider-limited capability health validates static catalog coverage when rails are disabled', async () => {
  const reports = await checkProviderLimitedRailCapabilities({
    enabled: {
      [Rail.CHAINFLIP]: false,
      [Rail.MAYA]: false,
      [Rail.TELESWAP]: false,
    },
  });

  assert.equal(reports.length, 3);
  assert.equal(reports.find((report) => report.rail === Rail.CHAINFLIP)?.status, 'ok');
  assert.equal(reports.find((report) => report.rail === Rail.MAYA)?.status, 'ok');
  assert.equal(reports.find((report) => report.rail === Rail.TELESWAP)?.status, 'ok');
});

test('Maya capability health compares catalog chains against live inbound addresses when enabled', async () => {
  const reports = await checkProviderLimitedRailCapabilities({
    enabled: { [Rail.MAYA]: true },
    mayaClient: {
      getInboundAddresses: async () => new Map([
        ['BTC', 'bc1maya'],
        ['ETH', '0xmaya'],
      ]),
    },
  });

  const maya = reports.find((report) => report.rail === Rail.MAYA);
  assert.equal(maya?.status, 'warning');
  assert.ok(maya?.missingProviderChainIds?.includes(CHAIN_ID.KUJI));
  assert.ok(maya?.providerChainIds?.includes(1));
  assert.ok(maya?.providerChainIds?.includes(CHAIN_ID.BTC));
});

test('Via Labs remains catalog-advertised only and has no provider-direct capability source', () => {
  const viaLabs = RAIL_CAPABILITY_CATALOG.find((entry) => entry.rail === Rail.VIA_LABS);
  assert.equal(viaLabs?.source, 'operator_config');
  assert.match(viaLabs?.note ?? '', /requires a concrete Via Labs API contract/i);
});
