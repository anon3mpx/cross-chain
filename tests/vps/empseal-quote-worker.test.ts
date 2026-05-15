import test from 'node:test';
import assert from 'node:assert/strict';
import { Interface } from 'ethers';
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
