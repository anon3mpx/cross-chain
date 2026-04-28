import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMessagingRouteConfigPlan,
  renderMessagingRouteConfigPlan,
} from '../../src/vps/config/routeConfigPlanner';

test('route config planner collapses source config and preserves destination asset rows', () => {
  const plan = buildMessagingRouteConfigPlan({
    srcChainId: 8453,
    dstChainId: 42161,
  });

  assert.equal(plan.srcChainId, 8453);
  assert.equal(plan.dstChainId, 42161);

  assert.ok(plan.axelar);
  assert.equal(plan.axelar?.sourceRoute.chainName, 'arbitrum');
  assert.deepEqual(
    plan.axelar?.sourceRoute.assetAliases,
    ['USDC', 'USDT', 'WETH'],
  );
  assert.equal(plan.axelar?.destinationTrusts.length, 3);
  assert.deepEqual(
    plan.axelar?.destinationTrusts.map((asset) => asset.destinationTokenId),
    [
      '0x' + '11'.repeat(32),
      '0x' + '22'.repeat(32),
      '0x' + '33'.repeat(32),
    ],
  );

  assert.ok(plan.layerZero);
  assert.equal(plan.layerZero?.sourceEid, 30184);
  assert.equal(plan.layerZero?.sourceFamilies.length, 3);
  assert.deepEqual(
    plan.layerZero?.sourceFamilies.map((family) => family.family),
    ['lz_stargate_pool', 'lz_oft_adapter', 'lz_oft'],
  );
  assert.equal(plan.layerZero?.destinationAssets.length, 3);
  assert.deepEqual(
    plan.layerZero?.destinationAssets.map((asset) => asset.composeSender),
    [
      '0x0000000000000000000000000000000000003001',
      '0x0000000000000000000000000000000000003002',
      '0x0000000000000000000000000000000000003003',
    ],
  );
  assert.equal(plan.layerZero?.destinationAssets[0]?.srcEid, 30184);
  assert.equal(plan.warnings.length, 0);
});

test('route config planner can target a subset of assets', () => {
  const plan = buildMessagingRouteConfigPlan({
    srcChainId: 8453,
    dstChainId: 42161,
    assetAliases: ['USDC', 'WETH'],
  });

  assert.deepEqual(plan.axelar?.sourceRoute.assetAliases, ['USDC', 'WETH']);
  assert.deepEqual(
    plan.layerZero?.sourceFamilies.map((family) => family.family),
    ['lz_stargate_pool', 'lz_oft'],
  );
  assert.equal(plan.layerZero?.destinationAssets.length, 2);
});

test('route config planner renders configure blocks for operators', () => {
  const rendered = renderMessagingRouteConfigPlan(buildMessagingRouteConfigPlan({
    srcChainId: 8453,
    dstChainId: 42161,
    assetAliases: ['USDC'],
  }));

  assert.match(rendered, /AXELAR_ROUTE_NAME=arbitrum/);
  assert.match(rendered, /LZ_ROUTE_FAMILY=lz_stargate_pool/);
  assert.match(rendered, /LZ_SOURCE_EID=30184/);
  assert.match(rendered, /LZ_COMPOSE_SENDER=0x0000000000000000000000000000000000003001/);
});
