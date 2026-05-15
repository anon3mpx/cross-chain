import test from 'node:test';
import assert from 'node:assert/strict';
import { zeroPadValue } from 'ethers';
import { extractReceivedSettlementAmountFromReceipt } from '../../src/vps/services/CctpAttestationWorker';

const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

test('extractReceivedSettlementAmountFromReceipt counts settlement transfers to receiver even when sender is non-zero', () => {
  const settlementToken = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
  const receiver = '0xa10914363664e46154328e6e787961641ea6e3de';
  const intermediate = '0xe737e5ce90b1ce27500000000000000000000000';
  const value = 1_196_245n;

  const receipt = {
    logs: [
      {
        address: settlementToken,
        topics: [
          TRANSFER_TOPIC,
          zeroPadValue(intermediate, 32),
          zeroPadValue(receiver, 32),
        ],
        data: `0x${value.toString(16).padStart(64, '0')}`,
      },
    ],
  } as any;

  assert.equal(
    extractReceivedSettlementAmountFromReceipt(receipt, settlementToken, receiver),
    value,
  );
});

test('extractReceivedSettlementAmountFromReceipt sums multiple transfers to receiver in the same receipt', () => {
  const settlementToken = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
  const receiver = '0xa10914363664e46154328e6e787961641ea6e3de';
  const senderA = '0x1111111111111111111111111111111111111111';
  const senderB = '0x2222222222222222222222222222222222222222';

  const receipt = {
    logs: [
      {
        address: settlementToken,
        topics: [
          TRANSFER_TOPIC,
          zeroPadValue(senderA, 32),
          zeroPadValue(receiver, 32),
        ],
        data: `0x${(700_000n).toString(16).padStart(64, '0')}`,
      },
      {
        address: settlementToken,
        topics: [
          TRANSFER_TOPIC,
          zeroPadValue(senderB, 32),
          zeroPadValue(receiver, 32),
        ],
        data: `0x${(496_245n).toString(16).padStart(64, '0')}`,
      },
    ],
  } as any;

  assert.equal(
    extractReceivedSettlementAmountFromReceipt(receipt, settlementToken, receiver),
    1_196_245n,
  );
});
