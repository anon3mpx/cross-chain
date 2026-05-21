import test from 'node:test';
import assert from 'node:assert/strict';
import { isBenignEmptyReceiveMessageStaticResult } from '../../src/vps/services/CctpAttestationWorker';

test('isBenignEmptyReceiveMessageStaticResult accepts empty BAD_DATA response from receiveMessage static call', () => {
  const err = {
    code: 'BAD_DATA',
    value: '0x',
    info: {
      method: 'receiveMessage',
      signature: 'receiveMessage(bytes,bytes)',
    },
  };

  assert.equal(isBenignEmptyReceiveMessageStaticResult(err), true);
});

test('isBenignEmptyReceiveMessageStaticResult rejects unrelated errors', () => {
  const err = {
    code: 'CALL_EXCEPTION',
    value: '0x',
    info: {
      method: 'receiveMessage',
      signature: 'receiveMessage(bytes,bytes)',
    },
  };

  assert.equal(isBenignEmptyReceiveMessageStaticResult(err), false);
});
