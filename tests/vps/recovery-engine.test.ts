import test from 'node:test';
import assert from 'node:assert/strict';
import { RecoveryEngine } from '../../src/vps/services/RecoveryEngine';
import { Rail } from '../../src/vps/types';

test('RecoveryEngine does not silently switch a user-selected rail', async () => {
  let fallbackRail: Rail | null = null;
  let failureReason: string | null = null;

  const engine = new RecoveryEngine(
    {
      markStuck: async () => ({}),
      markFailed: async (_intentId: string, reason: string) => {
        failureReason = reason;
        return {};
      },
      markRecovering: async () => ({}),
    } as any,
    {} as any,
    async (_intent, nextRail) => {
      fallbackRail = nextRail;
    },
  );

  await (engine as any)._recover({
    intentId: '0x' + '11'.repeat(32),
    retryCount: 0,
    quote: {
      rail: Rail.THORCHAIN,
      selectedByUser: true,
    },
  });

  assert.equal(fallbackRail, null);
  assert.equal(
    failureReason,
    'Selected rail became unrecoverable; user must request a fresh quote',
  );
});
