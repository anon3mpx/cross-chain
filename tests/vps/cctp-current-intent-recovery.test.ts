import test from 'node:test';
import assert from 'node:assert/strict';
import { AbiCoder, Interface } from 'ethers';
import {
  buildRecoveryExecutionFromSourceTxData,
  getRpcCandidates,
  withDirectDelivery,
  withRecoverySwapData,
} from '../../src/vps/scripts/recoverCurrentStuckCctpIntent';

const abiCoder = AbiCoder.defaultAbiCoder();

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

test('getRpcCandidates prefers numbered runtime RPC env keys before legacy fallback keys', async () => {
  await withEnv({
    CHAIN_42161_RPC_1: 'https://arb-a.example',
    CHAIN_42161_RPC_2: 'https://arb-b.example',
    CHAIN_42161_RPC_URL: 'https://arb-legacy.example',
    CHAIN_42161_RPC_FALLBACK: 'https://arb-legacy-backup.example',
  }, () => {
    assert.deepEqual(getRpcCandidates(42161), [
      'https://arb-a.example',
      'https://arb-b.example',
    ]);
  });
});

const ROUTER_IFACE = new Interface([
  'function initiateSwap((address user,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 minSrcSwapOut,uint32 dstChainId,uint8 rail,address routeToken,bytes32 routeAssetId,address expectedDstRouteToken,bytes32 expectedDstRouteAssetId,uint256 minRouteAmount,uint256 feeAmount,bytes swapDataSrc,bytes swapDataDst,bytes32 swapPluginIdSrc,bytes32 dstSwapPluginId,bytes32 railPluginId,bytes railData,uint256 dstGasLimit,address dstReceiver,bytes nativeDstAddress,string thorAssetIdentifier,uint256 minThorOutput,bytes32 intentId,uint256 deadline) intent,bytes signature)',
]);

test('buildRecoveryExecutionFromSourceTxData decodes CCTP calldata into receiver execution payload', () => {
  const intent = {
    user: '0x05f8cc8753d90d67dbb8c02118440b8283f941c9',
    tokenIn: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    tokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    amountIn: 1_000_000n,
    minAmountOut: 996_871n,
    minSrcSwapOut: 0n,
    dstChainId: 8453,
    rail: 0,
    routeToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    routeAssetId: '0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94',
    expectedDstRouteToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    expectedDstRouteAssetId: '0xf7135e5fd9158c9cea11c421e7df327b195498f7dacd89fb0de0449e618c4027',
    minRouteAmount: 996_871n,
    feeAmount: 3_000n,
    swapDataSrc: '0x',
    swapDataDst: '0x',
    swapPluginIdSrc: '0x0000000000000000000000000000000000000000000000000000000000000000',
    dstSwapPluginId: '0x0000000000000000000000000000000000000000000000000000000000000000',
    railPluginId: '0x9181644edfd36b07ccd623494a3681a4a6b9cd5d52611accda20264cd09259ac',
    railData: abiCoder.encode(['uint32', 'uint256'], [500, 129n]),
    dstGasLimit: 0n,
    dstReceiver: '0x3aef79e7455843a33e4c46d5cf283a809bf50970',
    nativeDstAddress: '0x',
    thorAssetIdentifier: '',
    minThorOutput: 0n,
    intentId: '0x50e1885bd55419344cd41134372d32a3b751e4497fab5857a80853f05d0db0ac',
    deadline: 1_779_812_491n,
  };

  const txData = ROUTER_IFACE.encodeFunctionData('initiateSwap', [intent, '0x']);
  const recovery = buildRecoveryExecutionFromSourceTxData(txData, intent.intentId);
  const decodedPayload = abiCoder.decode(
    ['bytes32', 'address', 'address', 'uint256', 'address', 'bytes32', 'uint256', 'bytes', 'bytes32'],
    recovery.payload,
  );

  assert.equal(recovery.intentId, intent.intentId.toLowerCase());
  assert.equal(recovery.dstChainId, 8453);
  assert.equal(recovery.receiver.toLowerCase(), intent.dstReceiver.toLowerCase());
  assert.equal(decodedPayload[0], intent.intentId);
  assert.equal(decodedPayload[1].toLowerCase(), intent.user.toLowerCase());
  assert.equal(decodedPayload[2].toLowerCase(), intent.tokenOut.toLowerCase());
  assert.equal(decodedPayload[3], intent.minAmountOut);
  assert.equal(decodedPayload[4].toLowerCase(), intent.expectedDstRouteToken.toLowerCase());
  assert.equal(decodedPayload[5], intent.expectedDstRouteAssetId);
  assert.equal(decodedPayload[6], intent.minRouteAmount);
  assert.equal(decodedPayload[7], '0x');
  assert.equal(decodedPayload[8], intent.dstSwapPluginId);
});

test('withRecoverySwapData injects replacement destination swap calldata without changing intent fields', () => {
  const intent = {
    user: '0x05f8cc8753d90d67dbb8c02118440b8283f941c9',
    tokenIn: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    tokenOut: '0x4200000000000000000000000000000000000006',
    amountIn: 1_000_000n,
    minAmountOut: 992_815n,
    minSrcSwapOut: 0n,
    dstChainId: 8453,
    rail: 0,
    routeToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    routeAssetId: '0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94',
    expectedDstRouteToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    expectedDstRouteAssetId: '0xf7135e5fd9158c9cea11c421e7df327b195498f7dacd89fb0de0449e618c4027',
    minRouteAmount: 995_803n,
    feeAmount: 3_000n,
    swapDataSrc: '0x',
    swapDataDst: '0x',
    swapPluginIdSrc: '0x0000000000000000000000000000000000000000000000000000000000000000',
    dstSwapPluginId: '0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6',
    railPluginId: '0x9181644edfd36b07ccd623494a3681a4a6b9cd5d52611accda20264cd09259ac',
    railData: abiCoder.encode(['uint32', 'uint256'], [500, 129n]),
    dstGasLimit: 0n,
    dstReceiver: '0x3aef79e7455843a33e4c46d5cf283a809bf50970',
    nativeDstAddress: '0x',
    thorAssetIdentifier: '',
    minThorOutput: 0n,
    intentId: '0x50e1885bd55419344cd41134372d32a3b751e4497fab5857a80853f05d0db0ac',
    deadline: 1_779_812_491n,
  };

  const txData = ROUTER_IFACE.encodeFunctionData('initiateSwap', [intent, '0x']);
  const recovery = buildRecoveryExecutionFromSourceTxData(txData, intent.intentId);
  const hydrated = withRecoverySwapData(recovery, '0x1234');
  const decodedPayload = abiCoder.decode(
    ['bytes32', 'address', 'address', 'uint256', 'address', 'bytes32', 'uint256', 'bytes', 'bytes32'],
    hydrated.payload,
  );

  assert.equal(hydrated.intentId, recovery.intentId);
  assert.equal(hydrated.dstChainId, recovery.dstChainId);
  assert.equal(hydrated.receiver, recovery.receiver);
  assert.equal(decodedPayload[0], intent.intentId);
  assert.equal(decodedPayload[1].toLowerCase(), intent.user.toLowerCase());
  assert.equal(decodedPayload[2].toLowerCase(), intent.tokenOut.toLowerCase());
  assert.equal(decodedPayload[3], intent.minAmountOut);
  assert.equal(decodedPayload[4].toLowerCase(), intent.expectedDstRouteToken.toLowerCase());
  assert.equal(decodedPayload[5], intent.expectedDstRouteAssetId);
  assert.equal(decodedPayload[6], intent.minRouteAmount);
  assert.equal(decodedPayload[7], '0x1234');
  assert.equal(decodedPayload[8], intent.dstSwapPluginId);
});

test('withDirectDelivery rewrites payload to settle in destination settlement token', () => {
  const intent = {
    user: '0x05f8cc8753d90d67dbb8c02118440b8283f941c9',
    tokenIn: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    tokenOut: '0x4200000000000000000000000000000000000006',
    amountIn: 1_000_000n,
    minAmountOut: 992_815n,
    minSrcSwapOut: 0n,
    dstChainId: 8453,
    rail: 0,
    routeToken: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    routeAssetId: '0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94',
    expectedDstRouteToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    expectedDstRouteAssetId: '0xf7135e5fd9158c9cea11c421e7df327b195498f7dacd89fb0de0449e618c4027',
    minRouteAmount: 995_803n,
    feeAmount: 3_000n,
    swapDataSrc: '0x',
    swapDataDst: '0xdeadbeef',
    swapPluginIdSrc: '0x0000000000000000000000000000000000000000000000000000000000000000',
    dstSwapPluginId: '0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6',
    railPluginId: '0x9181644edfd36b07ccd623494a3681a4a6b9cd5d52611accda20264cd09259ac',
    railData: abiCoder.encode(['uint32', 'uint256'], [500, 129n]),
    dstGasLimit: 0n,
    dstReceiver: '0x3aef79e7455843a33e4c46d5cf283a809bf50970',
    nativeDstAddress: '0x',
    thorAssetIdentifier: '',
    minThorOutput: 0n,
    intentId: '0x50e1885bd55419344cd41134372d32a3b751e4497fab5857a80853f05d0db0ac',
    deadline: 1_779_812_491n,
  };

  const txData = ROUTER_IFACE.encodeFunctionData('initiateSwap', [intent, '0x']);
  const recovery = buildRecoveryExecutionFromSourceTxData(txData, intent.intentId);
  const direct = withDirectDelivery(recovery);
  const decodedPayload = abiCoder.decode(
    ['bytes32', 'address', 'address', 'uint256', 'address', 'bytes32', 'uint256', 'bytes', 'bytes32'],
    direct.payload,
  );

  assert.equal(decodedPayload[0], intent.intentId);
  assert.equal(decodedPayload[2].toLowerCase(), intent.expectedDstRouteToken.toLowerCase());
  assert.equal(decodedPayload[3], intent.minAmountOut);
  assert.equal(decodedPayload[4].toLowerCase(), intent.expectedDstRouteToken.toLowerCase());
  assert.equal(decodedPayload[7], '0x');
  assert.equal(decodedPayload[8], '0x0000000000000000000000000000000000000000000000000000000000000000');
});
