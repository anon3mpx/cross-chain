import test from 'node:test';
import assert from 'node:assert/strict';
import { AxelarAssetCatalog } from '../../src/vps/services/axelar/AxelarAssetCatalog';

const BASE_USDC = '0x0000000000000000000000000000000000001001';
const BASE_ETH = '0x0000000000000000000000000000000000001003';
const ARB_USDC = '0x0000000000000000000000000000000000002001';
const ARB_ETH = '0x0000000000000000000000000000000000002003';
const ARB_USDC_TOKEN_ID = '0x' + '11'.repeat(32);
const ARB_ETH_TOKEN_ID = '0x' + '22'.repeat(32);

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

test('AxelarAssetCatalog lists both direct and destination-swap route assets', async () => {
  await withPatchedEnv({
    CHAIN_8453_TOKEN_AXELAR_USDC: BASE_USDC,
    CHAIN_42161_TOKEN_AXELAR_USDC: ARB_USDC,
    CHAIN_8453_TOKEN_AXELAR_ETH: BASE_ETH,
    CHAIN_42161_TOKEN_AXELAR_ETH: ARB_ETH,
    CHAIN_42161_AXELAR_TOKEN_ID_USDC: ARB_USDC_TOKEN_ID,
    CHAIN_42161_AXELAR_TOKEN_ID_WETH: ARB_ETH_TOKEN_ID,
    CHAIN_42161_AXELAR_TOKEN_ID_ETH: ARB_ETH_TOKEN_ID,
  }, () => {
    const catalog = new AxelarAssetCatalog({
      defaultCanonicalAssetIds: ['USDC', 'WETH'],
      directCanonicalAssetIds: ['WETH'],
    });

    const routes = catalog.listRoutes({ srcChainId: 8453, dstChainId: 42161 });
    assert.ok(routes.some((route) => route.offerType === 'axelar_direct'));
    assert.ok(routes.some((route) => route.offerType === 'axelar_dst_swap'));
  });
});
