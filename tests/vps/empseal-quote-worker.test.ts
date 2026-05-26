import test from 'node:test';
import assert from 'node:assert/strict';
import { Interface, JsonRpcProvider } from 'ethers';
import { CHAIN_CONFIGS } from '../../src/vps/config/chains';
import { EmpsealQuoteWorker } from '../../src/vps/services/empseal/EmpsealQuoteWorker';

test('EmpsealQuoteWorker decodes live formatted offers with adapters before path', async () => {
  const worker = new EmpsealQuoteWorker();
  const actualRouterInterface = new Interface([
    'function findBestPath(uint256,address,address,uint256) view returns ((uint256[] amounts,address[] adapters,address[] path))',
  ]);
  const raw = actualRouterInterface.encodeFunctionResult('findBestPath', [{
    amounts: [
      199_400_000_000_000_000_000n,
      125_000_000_000_000_000n,
      124_000_000n,
    ],
    adapters: [
      '0xe92d374a55655f4b8447e3a6eaca87bbc09dd8d7',
      '0xa91d8284c199fe4c178d76558a1427790af7e80f',
    ],
    path: [
      '0x1b896893dfc86bb67cf57767298b9073d2c1ba2c',
      '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
      '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    ],
  }]);

  const offer = (worker as any)._decodeFormattedOffer(raw);
  assert.deepEqual(offer.amounts.map((value: bigint) => value.toString()), [
    '199400000000000000000',
    '125000000000000000',
    '124000000',
  ]);
  assert.deepEqual(offer.path.map((value: string) => value.toLowerCase()), [
    '0x1b896893dfc86bb67cf57767298b9073d2c1ba2c',
    '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
    '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
  ]);
  assert.deepEqual(offer.adapters.map((value: string) => value.toLowerCase()), [
    '0xe92d374a55655f4b8447e3a6eaca87bbc09dd8d7',
    '0xa91d8284c199fe4c178d76558a1427790af7e80f',
  ]);
});

test('EmpsealQuoteWorker defaults to two max steps to avoid expensive failing mainnet path search', async () => {
  const previousEnv = new Map<string, string | undefined>();
  const env = {
    CHAIN_8453_RPC_URL: 'https://base.invalid',
    CHAIN_8453_EMPSEAL_ROUTER: '0xB12b7C117434B58B7623f994F4D0b4af7BC0Ac37',
  };
  for (const [key, value] of Object.entries(env)) {
    previousEnv.set(key, process.env[key]);
    process.env[key] = value;
  }

  const callInterface = new Interface([
    'function findBestPath(uint256 _amountIn, address _tokenIn, address _tokenOut, uint256 _maxSteps)',
  ]);
  const resultInterface = new Interface([
    'function findBestPath(uint256,address,address,uint256) view returns ((uint256[] amounts,address[] adapters,address[] path))',
  ]);
  const originalCall = JsonRpcProvider.prototype.call;
  const originalRpcUrl = CHAIN_CONFIGS[8453].rpcUrl;
  let observedMaxSteps: bigint | undefined;
  CHAIN_CONFIGS[8453].rpcUrl = 'https://base.invalid';

  JsonRpcProvider.prototype.call = async function patchedCall(tx: any) {
    const decoded = callInterface.decodeFunctionData('findBestPath', tx.data);
    observedMaxSteps = decoded._maxSteps;
    if (observedMaxSteps !== 2n) {
      throw new Error(`unexpected max steps ${observedMaxSteps}`);
    }
    return resultInterface.encodeFunctionResult('findBestPath', [{
      amounts: [997_000_000_000_000_000n, 2_116_155_573n],
      adapters: ['0xcA9B4b3a861eBb3475263c8cd5943c8aB7403Ba1'],
      path: [
        '0x4200000000000000000000000000000000000006',
        '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      ],
    }]);
  };

  try {
    const worker = new EmpsealQuoteWorker();
    const plan = await worker.buildSwapPlan({
      chainId: 8453,
      tokenIn: '0x4200000000000000000000000000000000000006',
      tokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      amountIn: 997_000_000_000_000_000n,
    });

    assert.equal(observedMaxSteps, 2n);
    assert.equal(plan?.amountOut, 2_116_155_573n);
  } finally {
    JsonRpcProvider.prototype.call = originalCall;
    CHAIN_CONFIGS[8453].rpcUrl = originalRpcUrl;
    for (const [key, value] of previousEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
