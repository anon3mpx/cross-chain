import test from 'node:test';
import assert from 'node:assert/strict';
import { AbiCoder, getAddress, keccak256 } from 'ethers';
import {
  getLayerZeroDestinationEidEnvKeys,
  getLayerZeroExtraOptionsEnvKeys,
  getLayerZeroOftAddressEnvKeys,
} from '../../src/vps/rails/registry';
import { LayerZeroRouteCatalog } from '../../src/vps/services/layerzero/LayerZeroRouteCatalog';
import { SettlementToken } from '../../src/vps/types';

const abiCoder = AbiCoder.defaultAbiCoder();

const BASE_USDC = '0x0000000000000000000000000000000000001001';
const BASE_ETH = '0x0000000000000000000000000000000000001003';
const ARB_USDC = '0x0000000000000000000000000000000000002001';
const ARB_ETH = '0x0000000000000000000000000000000000002003';
const BASE_OFT_ETH = '0x0000000000000000000000000000000000003003';

function withPatchedEnv(extraEnv: Record<string, string>, fn: () => void | Promise<void>) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(extraEnv)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }

  return Promise.resolve(fn()).finally(() => {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

function settlementAssetId(chainId: number, token: string): string {
  return keccak256(
    abiCoder.encode(['uint256', 'address'], [BigInt(chainId), getAddress(token)]),
  );
}

test('LayerZeroRouteCatalog resolves route metadata with alias and env fallbacks', async () => {
  await withPatchedEnv({
    CHAIN_8453_TOKEN_LAYERZERO_USDC: BASE_USDC,
    CHAIN_42161_TOKEN_LAYERZERO_USDC: ARB_USDC,
    CHAIN_8453_TOKEN_LAYERZERO_ETH: BASE_ETH,
    CHAIN_42161_TOKEN_LAYERZERO_ETH: ARB_ETH,
    CHAIN_8453_LZ_OFT_ETH: BASE_OFT_ETH,
    CHAIN_42161_DST_EID_LAYERZERO: '30110',
    CHAIN_42161_LZ_EXTRA_OPTIONS: '0x01020304',
  }, () => {
    const catalog = new LayerZeroRouteCatalog();
    const resolved = catalog.resolve({
      srcChainId: 8453,
      dstChainId: 42161,
      canonicalAssetId: 'WETH',
    });

    assert.equal(resolved.settlementToken, SettlementToken.ETH);
    assert.equal(resolved.sourceSettlementToken, getAddress(BASE_ETH));
    assert.equal(resolved.sourceSettlementAssetId, settlementAssetId(8453, BASE_ETH));
    assert.equal(resolved.oftAddress, getAddress(BASE_OFT_ETH));
    assert.equal(resolved.expectedDstSettlementToken, getAddress(ARB_ETH));
    assert.equal(resolved.expectedDstSettlementAssetId, settlementAssetId(42161, ARB_ETH));
    assert.equal(resolved.dstEid, 30110);
    assert.equal(resolved.extraOptions, '0x01020304');
  });
});

test('LayerZeroRouteCatalog rejects invalid destination eid and invalid options bytes', async () => {
  await withPatchedEnv({
    CHAIN_8453_TOKEN_LAYERZERO_ETH: BASE_ETH,
    CHAIN_42161_TOKEN_LAYERZERO_ETH: ARB_ETH,
    CHAIN_8453_LAYERZERO_OFT_ETH: BASE_OFT_ETH,
    CHAIN_42161_LAYERZERO_DST_EID: 'not-a-number',
  }, () => {
    const catalog = new LayerZeroRouteCatalog();
    assert.throws(
      () =>
        catalog.resolve({
          srcChainId: 8453,
          dstChainId: 42161,
          canonicalAssetId: 'ETH',
        }),
      /invalid dstEid/,
    );
  });

  await withPatchedEnv({
    CHAIN_8453_TOKEN_LAYERZERO_ETH: BASE_ETH,
    CHAIN_42161_TOKEN_LAYERZERO_ETH: ARB_ETH,
    CHAIN_8453_LAYERZERO_OFT_ETH: BASE_OFT_ETH,
    CHAIN_42161_LAYERZERO_DST_EID: '30110',
    CHAIN_42161_LZ_EXTRA_OPTIONS_ETH: '0x123',
  }, () => {
    const catalog = new LayerZeroRouteCatalog();
    assert.throws(
      () =>
        catalog.resolve({
          srcChainId: 8453,
          dstChainId: 42161,
          canonicalAssetId: 'ETH',
        }),
      /invalid extraOptions/,
    );
  });
});

test('LayerZero registry helpers produce expected env key priority lists', () => {
  const oftKeys = getLayerZeroOftAddressEnvKeys(8453, 'WETH');
  assert.deepEqual(oftKeys.slice(0, 3), [
    'CHAIN_8453_LAYERZERO_OFT_WETH',
    'CHAIN_8453_LZ_OFT_WETH',
    'CHAIN_8453_OFT_LAYERZERO_WETH',
  ]);
  assert.ok(oftKeys.includes('CHAIN_8453_LAYERZERO_OFT_ETH'));
  assert.ok(oftKeys.includes('CHAIN_8453_LZ_OFT_ETH'));

  const dstEidKeys = getLayerZeroDestinationEidEnvKeys(42161);
  assert.deepEqual(dstEidKeys, [
    'CHAIN_42161_LAYERZERO_DST_EID',
    'CHAIN_42161_LZ_DST_EID',
    'CHAIN_42161_DST_EID_LAYERZERO',
  ]);

  const extraOptionKeys = getLayerZeroExtraOptionsEnvKeys(42161, 'WETH');
  assert.deepEqual(extraOptionKeys.slice(0, 3), [
    'CHAIN_42161_LAYERZERO_EXTRA_OPTIONS_WETH',
    'CHAIN_42161_LZ_EXTRA_OPTIONS_WETH',
    'CHAIN_42161_EXTRA_OPTIONS_LAYERZERO_WETH',
  ]);
  assert.ok(extraOptionKeys.includes('CHAIN_42161_LZ_EXTRA_OPTIONS_ETH'));
  assert.deepEqual(extraOptionKeys.slice(-3), [
    'CHAIN_42161_LAYERZERO_EXTRA_OPTIONS',
    'CHAIN_42161_LZ_EXTRA_OPTIONS',
    'CHAIN_42161_EXTRA_OPTIONS_LAYERZERO',
  ]);
});
