import test from 'node:test';
import assert from 'node:assert/strict';
import { StaticDestinationGasPolicy } from '../../src/vps/services/DestinationGasPolicy';
import { Rail } from '../../src/vps/types';
import { RAIL_SETTLEMENT_ASSET_ALLOWLISTS } from '../../src/vps/config/routeExecution';
import { StaticRouteAssetPolicy } from '../../src/vps/services/RouteAssetPolicy';

test('settlement asset policy and destination gas policy expose configurable rail behavior', () => {
  const policy = new StaticRouteAssetPolicy(RAIL_SETTLEMENT_ASSET_ALLOWLISTS);
  const gasPolicy = new StaticDestinationGasPolicy();

  assert.equal(policy.isAllowed(Rail.AXELAR, 'USDC'), true);
  assert.equal(policy.isAllowed(Rail.LAYERZERO, 'WETH'), true);
  assert.equal(policy.isAllowed(Rail.CCTP, 'USDT'), false);

  assert.equal(gasPolicy.gasLimit(Rail.CCTP, 'cctp_standard'), 200_000);
  assert.equal(gasPolicy.gasLimit(Rail.AXELAR, 'axelar_dst_swap'), 260_000);
  assert.equal(gasPolicy.gasLimit(Rail.LAYERZERO, 'lz_stargate_pool'), 240_000);
  assert.equal(gasPolicy.gasLimit(Rail.THORCHAIN, 'thor_api_direct'), 0);
});
