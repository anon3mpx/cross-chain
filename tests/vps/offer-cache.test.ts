import assert from 'node:assert/strict';
import test from 'node:test';

import { serializeOfferSet } from '../../src/vps/api/quoteCodec';
import { InMemoryOfferCache } from '../../src/vps/cache/OfferCache';
import { OfferSet, Rail } from '../../src/vps/types';

test('serializeOfferSet preserves multiple offers and provider economics', async () => {
  const cache = new InMemoryOfferCache();
  const usdcAsset = {
    canonicalAssetId: 'usdc',
    providerAssetId: 'provider-usdc',
    tokenAddress: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    decimals: 6,
    assetKind: 'erc20' as const,
  };

  const btcAsset = {
    canonicalAssetId: 'btc',
    providerAssetId: 'provider-btc',
    decimals: 8,
    assetKind: 'btc' as const,
  };

  const offerSet: OfferSet = {
    offerSetId: '0x' + '11'.repeat(32),
    expiresAt: 1_800_000_000,
    bestOfferId: '0x' + 'aa'.repeat(32),
    offers: [
      {
        offerId: '0x' + 'aa'.repeat(32),
        rail: Rail.CCTP,
        railType: 'messaging',
        srcChainId: 1,
        dstChainId: 10,
        tokenIn: usdcAsset.tokenAddress,
        tokenOut: usdcAsset.tokenAddress,
        amountIn: 1_000_000n,
        estimatedOut: 998_900n,
        minAmountOut: 998_000n,
        expiresAt: 1_800_000_000,
        sourceSettlementAsset: usdcAsset,
        destinationSettlementAsset: usdcAsset,
        economics: { providerFeeUSD: 0, protocolFeeUSD: 0.5, sourceGasUSD: 0.11, settlementTimeSeconds: 25 },
        execution: { adapter: 'cctp-fast' },
      },
      {
        offerId: '0x' + 'bb'.repeat(32),
        rail: Rail.THORCHAIN,
        railType: 'liquidity',
        srcChainId: 1,
        dstChainId: 0,
        tokenIn: usdcAsset.tokenAddress,
        tokenOut: 'btc',
        amountIn: 1_000_000n,
        estimatedOut: 1_950_000n,
        minAmountOut: 1_900_000n,
        expiresAt: 1_800_000_000,
        sourceSettlementAsset: usdcAsset,
        destinationSettlementAsset: btcAsset,
        economics: { providerFeeUSD: 0, protocolFeeUSD: 0.5, sourceGasUSD: 0.14, slippageBps: 19, settlementTimeSeconds: 24 },
        execution: { memo: '=:btc-destination' },
      },
    ],
  };

  await cache.set(offerSet.offerSetId, offerSet, 30_000);
  const restored = await cache.get(offerSet.offerSetId);
  assert.equal(restored?.offers.length, 2);
  assert.equal(restored?.offers[0].amountIn, 1_000_000n);

  const json = serializeOfferSet(offerSet) as any;
  assert.equal(json.offers[1].economics.slippageBps, 19);
  assert.equal(json.offers[0].amountIn, '1000000');
});

test('in-memory offer cache honors zero TTL exactly', async () => {
  const cache = new InMemoryOfferCache();
  const offerSet: OfferSet = {
    offerSetId: '0x' + '22'.repeat(32),
    expiresAt: 1_800_000_000,
    offers: [],
  };

  await cache.set(offerSet.offerSetId, offerSet, 0);
  const restored = await cache.get(offerSet.offerSetId);
  assert.equal(restored, null);
});
