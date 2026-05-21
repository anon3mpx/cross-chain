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
  const op = getDeploymentEntry(10);

  assert.ok(base);
  assert.ok(arbitrum);
  assert.ok(op);
  assert.equal(getRouterAddressFromDeploymentRegistry(8453), '0x10c9db3761056d752bc41ac817f730f9e4348bb0');
  assert.equal(
    getRailPluginAddressFromDeploymentRegistry(8453, Rail.CCTP_FAST),
    '0xf788dc2af6a35339028df57d92a3d6221547d991',
  );
  assert.equal(
    getReceiverAdapterAddressFromDeploymentRegistry(42161, 'layerzero'),
    '0xcdbc01b0dddac2729263a7ff4318a1b17b2eedb3',
  );
  assert.equal(
    getRailPluginAddressFromDeploymentRegistry(10, Rail.CCTP),
    '0x1b7eb489eb0ae102720442fe15b0e08653a13404',
  );
});

test('chain config resolves deployment registry addresses before env fallback', () => {
  const base = getChainConfig(8453);
  const arbitrum = getChainConfig(42161);
  const op = getChainConfig(10);

  assert.equal(base?.routerV1, '0x10c9db3761056d752bc41ac817f730f9e4348bb0');
  assert.equal(arbitrum?.receiverV1, '0xa10914363664e46154328e6e787961641ea6e3de');
  assert.equal(op?.receiverV1, '0x65642ac8fd57eff8dd4651cb76be48814c8bf386');
});
