import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTHORChainQuoteRequest,
  shouldCacheOfferSet,
} from '../../src/vps/services/thorchain/THORChainQuotePolicy';
import { Rail } from '../../src/vps/types';

test('buildTHORChainQuoteRequest maps EVM USDC assets to THORChain notation', () => {
  const request = buildTHORChainQuoteRequest({
    amountIn: 1_000_000n,
    srcChainId: 8453,
    dstChainId: 42161,
    destinationAddress: '0x3333333333333333333333333333333333333333',
    routeAssetAlias: 'USDC',
    sourceTokenAddress: '0x0000000000000000000000000000000000001001',
    destinationTokenAddress: '0x0000000000000000000000000000000000002001',
    tokenIn: '0x0000000000000000000000000000000000001001',
    tokenOut: '0x0000000000000000000000000000000000002001',
  });

  assert.ok(request);
  assert.equal(request!.fromAsset, 'BASE.USDC-0X0000000000000000000000000000000000001001');
  assert.equal(request!.toAsset, 'ARB.USDC-0X0000000000000000000000000000000000002001');
  assert.equal(request!.destinationAddress, '0x3333333333333333333333333333333333333333');
});

test('buildTHORChainQuoteRequest maps ETH route asset to chain-native ETH notation', () => {
  const request = buildTHORChainQuoteRequest({
    amountIn: 1_000_000n,
    srcChainId: 8453,
    dstChainId: 42161,
    destinationAddress: '0x3333333333333333333333333333333333333333',
    routeAssetAlias: 'WETH',
    sourceTokenAddress: '0x0000000000000000000000000000000000001003',
    destinationTokenAddress: '0x0000000000000000000000000000000000002003',
    tokenIn: '0x0000000000000000000000000000000000001003',
    tokenOut: '0x0000000000000000000000000000000000002003',
  });

  assert.ok(request);
  assert.equal(request!.fromAsset, 'BASE.ETH');
  assert.equal(request!.toAsset, 'ARB.ETH');
});

test('buildTHORChainQuoteRequest returns null when route asset alias is unsupported', () => {
  const request = buildTHORChainQuoteRequest({
    amountIn: 1_000_000n,
    srcChainId: 8453,
    dstChainId: 42161,
    destinationAddress: '0x3333333333333333333333333333333333333333',
    routeAssetAlias: 'RUNE',
    sourceTokenAddress: '0x0000000000000000000000000000000000001001',
    destinationTokenAddress: '0x0000000000000000000000000000000000002001',
    tokenIn: '0x0000000000000000000000000000000000001001',
    tokenOut: '0x0000000000000000000000000000000000002001',
  });

  assert.equal(request, null);
});

test('shouldCacheOfferSet disables cache reuse for THOR offers', () => {
  assert.equal(
    shouldCacheOfferSet({
      offerSetId: 'x',
      expiresAt: Math.floor(Date.now() / 1000) + 60,
      offers: [{ rail: Rail.THORCHAIN } as any],
    }),
    false,
  );

  assert.equal(
    shouldCacheOfferSet({
      offerSetId: 'y',
      expiresAt: Math.floor(Date.now() / 1000) + 60,
      offers: [{ rail: Rail.CCTP } as any],
    }),
    true,
  );
});
