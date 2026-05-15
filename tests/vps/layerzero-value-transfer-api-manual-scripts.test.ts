import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SCRIPT_DIR = resolve(process.cwd(), 'src/vps/scripts');

function readScript(name: string): string {
  return readFileSync(resolve(SCRIPT_DIR, name), 'utf8');
}

test('LayerZero Value Transfer API manual scripts are dry-run by default', () => {
  const approval = readScript('sendLayerZeroValueTransferApiApproval.js');
  const transfer = readScript('sendLayerZeroValueTransferApiTx.js');

  for (const script of [approval, transfer]) {
    assert.match(script, /const PRIVATE_KEY = '';/);
    assert.match(script, /const DRY_RUN = true;/);
  }
});

test('LayerZero Value Transfer API manual scripts expose the required LZ user-step fields', () => {
  const approval = readScript('sendLayerZeroValueTransferApiApproval.js');
  const transfer = readScript('sendLayerZeroValueTransferApiTx.js');

  assert.match(approval, /TOKEN_ADDRESS/);
  assert.match(approval, /SPENDER_ADDRESS/);
  assert.match(approval, /AMOUNT_RAW/);

  assert.match(transfer, /TO_ADDRESS/);
  assert.match(transfer, /CALLDATA/);
  assert.match(transfer, /VALUE_WEI/);
});
