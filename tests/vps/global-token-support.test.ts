import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GLOBAL_TOKEN_SUPPORT,
  supportedDirectAssetAliases,
  supportsArbitraryInputToken,
  supportsArbitraryOutputToken,
} from '../../src/vps/config/globalTokenSupport';

test('aggregator chains support arbitrary user-facing input and output tokens', () => {
  assert.equal(GLOBAL_TOKEN_SUPPORT.arbitraryErc20OnAggregatorChains, true);
  assert.equal(supportsArbitraryInputToken(8453), true);
  assert.equal(supportsArbitraryOutputToken(42161), true);
});

test('non-aggregator and non-evm chains fall back to curated direct asset support', () => {
  assert.equal(supportsArbitraryInputToken(11155111), false);
  assert.equal(supportsArbitraryOutputToken(99), false);

  assert.deepEqual(supportedDirectAssetAliases(11155111), ['USDC', 'USDT', 'WETH']);
  assert.deepEqual(supportedDirectAssetAliases(99), ['BTC.BTC', 'SOL.SOL', 'DOGE.DOGE']);
});
