import test from 'node:test';
import assert from 'node:assert/strict';

import { RpcProviderRegistry } from '../../src/vps/services/RpcProviderRegistry';

test('RpcProviderRegistry rotates read providers after retryable failures and reuses the active provider otherwise', async () => {
  let now = 1_000;
  const registry = new RpcProviderRegistry({
    env: {
      CHAIN_8453_RPC_1: 'https://base-a.example',
      CHAIN_8453_RPC_2: 'https://base-b.example',
    },
    now: () => now,
    providerFactory: (rpcUrl) => ({ rpcUrl }) as any,
  });

  const first = registry.getReadProvider(8453) as any;
  assert.equal(first.rpcUrl, 'https://base-a.example');

  registry.reportFailure(8453, 'read', 'https://base-a.example', new Error('429 Too Many Requests'));
  const second = registry.getReadProvider(8453) as any;
  assert.equal(second.rpcUrl, 'https://base-b.example');

  now += 31_000;
  const third = registry.getReadProvider(8453) as any;
  assert.equal(third.rpcUrl, 'https://base-a.example');
});

test('RpcProviderRegistry ignores non-retryable failures and throws when no endpoints exist', () => {
  const registry = new RpcProviderRegistry({
    env: { CHAIN_10_RPC_1: 'https://op-a.example' },
    providerFactory: (rpcUrl) => ({ rpcUrl }) as any,
  });

  registry.reportFailure(10, 'read', 'https://op-a.example', new Error('receiver does not approve relayer'));
  assert.equal((registry.getReadProvider(10) as any).rpcUrl, 'https://op-a.example');

  const empty = new RpcProviderRegistry({ env: {}, providerFactory: (rpcUrl) => ({ rpcUrl }) as any });
  assert.throws(() => empty.getReadProvider(999), /No RPC URLs configured/);
});
