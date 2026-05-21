import test from 'node:test';
import assert from 'node:assert/strict';
import { Rail } from '../../src/vps/types';
import { StaticRouteAssetPolicy } from '../../src/vps/services/RouteAssetPolicy';
import { StaticDeploymentRegistry } from '../../src/vps/services/DeploymentRegistry';

test('pair availability requires policy plus deployment registry, while THOR direct skips destination deployments', () => {
  const policy = new StaticRouteAssetPolicy({
    [Rail.AXELAR]: ['USDC', 'WETH'],
    [Rail.THORCHAIN]: ['BTC.BTC', 'SOL.SOL'],
  });
  const registry = new StaticDeploymentRegistry([
    {
      rail: Rail.AXELAR,
      srcChainId: 42161,
      dstChainId: 8453,
      enabled: true,
      requiresDestinationContracts: true,
      sourceReady: true,
      destinationReady: true,
    },
    {
      rail: Rail.THORCHAIN,
      srcChainId: 42161,
      dstChainId: 99,
      enabled: true,
      requiresDestinationContracts: false,
      sourceReady: true,
      destinationReady: false,
    },
  ]);

  assert.equal(policy.isAllowed(Rail.AXELAR, 'WETH'), true);
  assert.equal(registry.isExecutable(Rail.AXELAR, 42161, 8453), true);
  assert.equal(registry.isExecutable(Rail.THORCHAIN, 42161, 99), true);
  assert.equal(registry.requiresDestinationContracts(Rail.THORCHAIN, 42161, 99), false);
});
