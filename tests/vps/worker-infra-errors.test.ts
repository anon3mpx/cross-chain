import test from 'node:test';
import assert from 'node:assert/strict';

import { isRetryableInfraError } from '../../src/vps/app/infraErrors';

test('isRetryableInfraError treats connect timeouts as retryable', () => {
  const error = new AggregateError([
    Object.assign(new Error('connect ETIMEDOUT 172.66.171.45:443'), {
      code: 'ETIMEDOUT',
      errno: -110,
      syscall: 'connect',
      address: '172.66.171.45',
      port: 443,
    }),
    Object.assign(new Error('connect ENETUNREACH 2606:4700:10::ac42:ab2d:443 - Local (:::0)'), {
      code: 'ENETUNREACH',
      errno: -101,
      syscall: 'connect',
      address: '2606:4700:10::ac42:ab2d',
      port: 443,
    }),
  ]);
  Object.assign(error, { code: 'ETIMEDOUT' });

  assert.equal(isRetryableInfraError(error), true);
});

test('isRetryableInfraError treats explicit rate limiting as retryable', () => {
  assert.equal(isRetryableInfraError(new Error('429 Too Many Requests')), true);
});

test('isRetryableInfraError does not hide non-infra application errors', () => {
  assert.equal(isRetryableInfraError(new Error('receiver does not approve relayer')), false);
});
