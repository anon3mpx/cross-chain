import test from 'node:test';
import assert from 'node:assert/strict';

import * as quoteCacheModule from '../../src/vps/cache/QuoteCache';

test('QuoteCache exposes helpers to sign and verify Redis payload integrity', () => {
  const signEncodedQuote = (quoteCacheModule as any).signEncodedQuote;
  const verifyEncodedQuote = (quoteCacheModule as any).verifyEncodedQuote;

  assert.equal(typeof signEncodedQuote, 'function');
  assert.equal(typeof verifyEncodedQuote, 'function');

  const signed = signEncodedQuote('{"amountIn":"1"}', 'secret-key');
  assert.equal(verifyEncodedQuote(signed, 'secret-key'), '{"amountIn":"1"}');
  assert.equal(verifyEncodedQuote(`${signed}tampered`, 'secret-key'), null);
});
