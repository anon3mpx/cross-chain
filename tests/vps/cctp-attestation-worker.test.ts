import test from 'node:test';
import assert from 'node:assert/strict';
import { AbiCoder } from 'ethers';
import {
  buildReceiverExecutionPayloadFromIntent,
  recoverFastTransferExecuteAmountFromReceiverBalance,
} from '../../src/vps/services/CctpAttestationWorker';

const abiCoder = AbiCoder.defaultAbiCoder();

test('buildReceiverExecutionPayloadFromIntent matches ReceiverV1 execution payload layout', () => {
  const intent = {
    intentId: '0x5b14fe4877d9f22acbe93ecffc64805a5aca42c19e21c66e889cd26a8e975104',
    user: '0x05f8cc8753d90d67dbb8c02118440b8283f941c9',
    tokenOut: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    minAmountOut: 1_194_963n,
    expectedDstRouteToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    expectedDstRouteAssetId: '0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94',
    minRouteAmount: 1_194_963n,
    swapDataDst: '0x',
    dstSwapPluginId: '0x0000000000000000000000000000000000000000000000000000000000000000',
  };

  const payload = buildReceiverExecutionPayloadFromIntent(intent);
  const decoded = abiCoder.decode(
    ['bytes32', 'address', 'address', 'uint256', 'address', 'bytes32', 'uint256', 'bytes', 'bytes32'],
    payload,
  );

  assert.equal(decoded[0], intent.intentId);
  assert.equal(decoded[1].toLowerCase(), intent.user.toLowerCase());
  assert.equal(decoded[2].toLowerCase(), intent.tokenOut.toLowerCase());
  assert.equal(decoded[3], intent.minAmountOut);
  assert.equal(decoded[4].toLowerCase(), intent.expectedDstRouteToken.toLowerCase());
  assert.equal(decoded[5], intent.expectedDstRouteAssetId);
  assert.equal(decoded[6], intent.minRouteAmount);
  assert.equal(decoded[7], intent.swapDataDst);
  assert.equal(decoded[8], intent.dstSwapPluginId);
});

test('recoverFastTransferExecuteAmountFromReceiverBalance uses receiver balance when it satisfies min route amount', () => {
  const intent = {
    intentId: '0x9b59aab47dda4ef20f1048cc442794d3988ec1b997e27c9a142a57b1d0a8320f',
    user: '0x05f8cc8753d90d67dbb8c02118440b8283f941c9',
    tokenOut: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
    minAmountOut: 996_827n,
    expectedDstRouteToken: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
    expectedDstRouteAssetId: '0xc9e6c698b6a822819702171c2ca95ee8e0bd8b87d4d4954b42a3ef3815a80042',
    minRouteAmount: 996_827n,
    swapDataDst: '0x',
    dstSwapPluginId: '0x0000000000000000000000000000000000000000000000000000000000000000',
  };

  const payload = buildReceiverExecutionPayloadFromIntent(intent);
  const recovered = recoverFastTransferExecuteAmountFromReceiverBalance(996_871n, payload);
  assert.equal(recovered, 996_871n);
});

test('recoverFastTransferExecuteAmountFromReceiverBalance throws when receiver balance is below min route amount', () => {
  const intent = {
    intentId: '0x9b59aab47dda4ef20f1048cc442794d3988ec1b997e27c9a142a57b1d0a8320f',
    user: '0x05f8cc8753d90d67dbb8c02118440b8283f941c9',
    tokenOut: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
    minAmountOut: 996_827n,
    expectedDstRouteToken: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
    expectedDstRouteAssetId: '0xc9e6c698b6a822819702171c2ca95ee8e0bd8b87d4d4954b42a3ef3815a80042',
    minRouteAmount: 996_827n,
    swapDataDst: '0x',
    dstSwapPluginId: '0x0000000000000000000000000000000000000000000000000000000000000000',
  };

  const payload = buildReceiverExecutionPayloadFromIntent(intent);
  assert.throws(
    () => recoverFastTransferExecuteAmountFromReceiverBalance(996_000n, payload),
    /receiver balance .* is below minRouteAmount/i,
  );
});
