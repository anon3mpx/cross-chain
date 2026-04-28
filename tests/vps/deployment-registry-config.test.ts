import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDeploymentEntry,
  getReceiverAdapterAddressFromDeploymentRegistry,
  getRailPluginAddressFromDeploymentRegistry,
  getRouterAddressFromDeploymentRegistry,
} from '../../src/vps/config/deploymentRegistry';
import { Rail } from '../../src/vps/types';
import { getChainConfig } from '../../src/vps/config/chains';

test('deployment registry exposes typed per-chain contract addresses', () => {
  const base = getDeploymentEntry(8453);
  const arbitrum = getDeploymentEntry(42161);

  assert.ok(base);
  assert.ok(arbitrum);
  assert.equal(getRouterAddressFromDeploymentRegistry(8453), '0x1111111111111111111111111111111111111111');
  assert.equal(
    getRailPluginAddressFromDeploymentRegistry(8453, Rail.AXELAR),
    '0x1111111111111111111111111111111111111114',
  );
  assert.equal(
    getReceiverAdapterAddressFromDeploymentRegistry(42161, 'layerzero'),
    '0x2222222222222222222222222222222222222227',
  );
});

test('chain config resolves deployment registry addresses before env fallback', () => {
  const base = getChainConfig(8453);
  const arbitrum = getChainConfig(42161);

  assert.equal(base?.routerV1, '0x1111111111111111111111111111111111111111');
  assert.equal(base?.routerV1Abi, 'current');
  assert.equal(arbitrum?.receiverV1, '0x2222222222222222222222222222222222222222');
});
