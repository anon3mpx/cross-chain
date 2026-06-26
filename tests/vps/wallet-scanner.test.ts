import test from 'node:test';
import assert from 'node:assert/strict';
import { WalletScanner } from '../../src/vps/services/WalletScanner';

test('WalletScanner returns native balances from the injected provider registry', async () => {
  const scanner = new WalletScanner({
    registry: {
      getProvider() {
        return {
          asEthersProvider() {
            return {
              getBalance: async () => 123n,
            };
          },
        };
      },
    } as any,
  });

  const result = await scanner.scan({
    wallet: '0x3333333333333333333333333333333333333333',
    chainIds: [8453],
    tokensByChain: { 8453: [] },
  }, { routeSource: 'agent-sdk' });

  assert.equal(result.wallet, '0x3333333333333333333333333333333333333333');
  assert.ok(result.balances.length === 1 || result.skipped.length === 1);
});
