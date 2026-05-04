import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeOfferSet } from '../../src/vps/api/quoteCodec';
import { Rail } from '../../src/vps/types';

test('serializeOfferSet preserves routeAsset, offerType, deliveryShape, and executionMode', () => {
  const json = serializeOfferSet({
    offerSetId: '0x' + '11'.repeat(32),
    expiresAt: 1_800_000_000,
    offers: [
      {
        offerId: '0x' + 'aa'.repeat(32),
        rail: Rail.LAYERZERO,
        offerType: 'lz_oft',
        railType: 'messaging',
        srcChainId: 8453,
        dstChainId: 42161,
        tokenIn: '0x1111111111111111111111111111111111111111',
        tokenOut: '0x2222222222222222222222222222222222222222',
        amountIn: 1_000_000n,
        estimatedOut: 990_000n,
        minAmountOut: 985_000n,
        expiresAt: 1_800_000_000,
        deliveryShape: 'direct',
        executionMode: 'router_intent',
        routeAsset: {
          canonicalAssetId: 'eip155:8453/erc20:0x0000000000000000000000000000000000001003',
          providerAssetId: 'layerzero:oft:base:weth',
          srcTokenAddress: '0x0000000000000000000000000000000000001003',
          dstTokenAddress: '0x0000000000000000000000000000000000002003',
          decimals: 18,
          assetKind: 'erc20',
          assetStandard: 'oft',
        },
        economics: {
          providerFeeUSD: 0.21,
          protocolFeeUSD: 0.50,
          sourceGasUSD: 0.08,
          settlementTimeSeconds: 45,
        },
        execution: { mode: 'router_intent' },
      },
    ],
  } as any);

  assert.equal((json as any).offers[0].offerType, 'lz_oft');
  assert.equal((json as any).offers[0].deliveryShape, 'direct');
  assert.equal((json as any).offers[0].executionMode, 'router_intent');
  assert.equal((json as any).offers[0].routeAsset.assetStandard, 'oft');
});
