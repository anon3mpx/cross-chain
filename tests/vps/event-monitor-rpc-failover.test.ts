import test from 'node:test';
import assert from 'node:assert/strict';

import { EventMonitor } from '../../src/vps/services/EventMonitor';

test('EventMonitor uses injected polling RPC helpers when chain config has no legacy rpcUrl', () => {
  const monitor = new EventMonitor(
    {} as any,
    {
      getPollingRpcUrl() {
        return 'https://base-poll-a.example';
      },
      reportFailure() {},
    } as any,
  );

  monitor.addChain({
    chainId: 8453,
    name: 'base',
    rpcUrl: '',
    rpcFallback: '',
    hasAggregator: true,
    nativeStable: 'USDC' as any,
    blockTimeMs: 2_000,
    isEVM: true,
  });

  assert.equal((monitor as any).providers.size, 1);
});
