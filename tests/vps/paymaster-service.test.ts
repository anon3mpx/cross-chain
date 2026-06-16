import test from 'node:test';
import assert from 'node:assert/strict';

import { PaymasterService } from '../../src/vps/services/PaymasterService';

test('PaymasterService uses the chain-scoped token rate cache after an update', async () => {
  const service = new PaymasterService();

  await service.updateTokenRates(
    {
      setTokenRateBatch: async () => {},
    } as any,
    ['0xToken'],
    async (token) => token === 'ETH' ? 2000 : 2,
  );

  const maxTokenFee = (service as any)._computeMaxTokenFee(
    {
      callGasLimit: '100',
      verificationGasLimit: '0',
      preVerificationGas: '0',
    },
    1n,
    '0xToken',
    1,
  );

  assert.equal(maxTokenFee, 120_000n);
});
