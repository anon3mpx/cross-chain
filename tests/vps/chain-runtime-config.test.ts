import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveChainRpcUrls,
  resolveLegacyChainRpcFields,
} from '../../src/vps/config/chainRuntime';

function withEnv(extraEnv: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(extraEnv)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return Promise.resolve(fn()).finally(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test('resolveChainRpcUrls returns ordered unique read and poll URLs and falls back to read when poll is empty', async () => {
  await withEnv({
    CHAIN_8453_RPC_1: 'https://base-a.example',
    CHAIN_8453_RPC_2: 'https://base-b.example',
    CHAIN_8453_RPC_3: 'https://base-a.example',
    CHAIN_8453_RPC_POLL_1: undefined,
    CHAIN_8453_RPC_POLL_2: undefined,
  }, () => {
    assert.deepEqual(resolveChainRpcUrls(8453, 'read'), [
      'https://base-a.example',
      'https://base-b.example',
    ]);
    assert.deepEqual(resolveChainRpcUrls(8453, 'poll'), [
      'https://base-a.example',
      'https://base-b.example',
    ]);
  });
});

test('resolveLegacyChainRpcFields falls back to legacy env keys when numbered keys are absent', async () => {
  await withEnv({
    CHAIN_42161_RPC_1: undefined,
    CHAIN_42161_RPC_2: undefined,
    CHAIN_42161_RPC_URL: 'https://arb-primary.example',
    CHAIN_42161_RPC_FALLBACK: 'https://arb-backup.example',
  }, () => {
    assert.deepEqual(resolveChainRpcUrls(42161, 'read'), [
      'https://arb-primary.example',
      'https://arb-backup.example',
    ]);
    assert.deepEqual(resolveLegacyChainRpcFields(42161), {
      rpcUrl: 'https://arb-primary.example',
      rpcFallback: 'https://arb-backup.example',
    });
  });
});
