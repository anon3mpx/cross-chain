sed -n '1,20p' src/vps/services/empseal/EmpsealQuoteWorker.ts
import { AbiCoder, Contract, JsonRpcProvider, getAddress } from 'ethers';
import { getChainConfig } from '../../config/chains';
import { getEmpsealRouterAddressForChain } from '../../config/contracts';

const EMPSEAL_ROUTER_ABI = [
  'function findBestPath(uint256 _amountIn, address _tokenIn, address _tokenOut, uint256 _maxSteps) view returns ((uint256[] amounts, address[] path, address[] adapters, uint256[] gasEstimates))',
];

const abiCoder = AbiCoder.defaultAbiCoder();
const DEFAULT_MAX_STEPS = 3n;

export interface EmpsealTrade {
  amountIn: bigint;
  amountOut: bigint;
  path: string[];
  adapters: string[];
}

export interface EmpsealSwapPlan {
  amountOut: bigint;
Ganadhishs-MacBook-Air:ruflo ganadhish$ docker exec -it empx-cross-chain-api sh -lc "sed -n '1,20p' /app/src/vps/services/empseal/EmpsealQuoteWorker.ts"
import { AbiCoder, Contract, JsonRpcProvider, getAddress } from 'ethers';
import { getChainConfig } from '../../config/chains';
import { getEmpsealRouterAddressForChain } from '../../config/contracts';

const EMPSEAL_ROUTER_ABI = [
  'function findBestPath(uint256 _amountIn, address _tokenIn, address _tokenOut, uint256 _maxSteps) view returns ((uint256[] amounts, address[] path, address[] adapters, uint256[] gasEstimates))',
];

const abiCoder = AbiCoder.defaultAbiCoder();
const DEFAULT_MAX_STEPS = 3n;

export interface EmpsealTrade {
  amountIn: bigint;
  amountOut: bigint;
  path: string[];
  adapters: string[];
}

export interface EmpsealSwapPlan {
  amountOut: bigint;
Ganadhishs-MacBook-Air:ruflo ganadhish$ node --import tsx -e "
> import { Contract, JsonRpcProvider } from 'ethers';
> const provider = new JsonRpcProvider('https://arb1.arbitrum.io/rpc');
> const router = new Contract(
>   '0xA7772cDBA7739F19dcaE85fe0357929790FD23F9',
>   ['function findBestPath(uint256,address,address,uint256) view returns ((uint256[] amounts,address[] path,address[] adapters,uint256[] gasEstimates))'],
>   provider
> );
> const out = await router.findBestPath(
>   199400000000000000000n,
>   '0x1b896893dfc86bb67cf57767298b9073d2c1ba2c',
>   '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
>   3
> );
> console.log(JSON.stringify({
>   amounts: out.amounts.map(x => x.toString()),
>   path: out.path,
>   adapters: out.adapters
> }, null, 2));
> "
/Users/ganadhish/code/work/ruflo/node_modules/ethers/src.ts/utils/errors.ts:698
            error = new Error(message);
                    ^

Error: could not decode result data (value="0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000acf3b1b8894e4000000000000000000000000000000000000000000000000000001daf33b6db0e1650000000000000000000000000000000000000000000000000000000011ec46030000000000000000000000000000000000000000000000000000000011ec0e720000000000000000000000000000000000000000000000000000000000000003000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d7000000000000000000000000a91d8284c199fe4c178d76558a1427790af7e80f000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d700000000000000000000000000000000000000000000000000000000000000040000000000000000000000001b896893dfc86bb67cf57767298b9073d2c1ba2c00000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab1000000000000000000000000fd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e5831", info={ "method": "findBestPath", "signature": "findBestPath(uint256,address,address,uint256)" }, code=BAD_DATA, version=6.16.0)
    at makeError (/Users/ganadhish/code/work/ruflo/node_modules/ethers/src.ts/utils/errors.ts:698:21)
    at assert (/Users/ganadhish/code/work/ruflo/node_modules/ethers/src.ts/utils/errors.ts:719:25)
    at Interface.decodeFunctionResult (/Users/ganadhish/code/work/ruflo/node_modules/ethers/src.ts/abi/interface.ts:916:9)
    at staticCallResult (/Users/ganadhish/code/work/ruflo/node_modules/ethers/src.ts/contract/contract.ts:346:35)
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async staticCall (/Users/ganadhish/code/work/ruflo/node_modules/ethers/src.ts/contract/contract.ts:303:24)
    at async Proxy.findBestPath (/Users/ganadhish/code/work/ruflo/node_modules/ethers/src.ts/contract/contract.ts:351:41)
    at async file:///Users/ganadhish/code/work/ruflo/[eval1]:9:13 {
  code: 'BAD_DATA',
  value: '0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000acf3b1b8894e4000000000000000000000000000000000000000000000000000001daf33b6db0e1650000000000000000000000000000000000000000000000000000000011ec46030000000000000000000000000000000000000000000000000000000011ec0e720000000000000000000000000000000000000000000000000000000000000003000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d7000000000000000000000000a91d8284c199fe4c178d76558a1427790af7e80f000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d700000000000000000000000000000000000000000000000000000000000000040000000000000000000000001b896893dfc86bb67cf57767298b9073d2c1ba2c00000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab1000000000000000000000000fd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e5831',
  info: {
    method: 'findBestPath',
    signature: 'findBestPath(uint256,address,address,uint256)'
  },
  shortMessage: 'could not decode result data'
}

Node.js v24.11.1
Ganadhishs-MacBook-Air:ruflo ganadhish$ curl -s http://localhost:8787/api/v1/quote \
>   -H 'accept: application/json' \
>   -H 'Content-Type: application/json' \
>   -d '{
>     "tokenIn": "0x1b896893dfc86bb67cf57767298b9073d2c1ba2c",
>     "tokenOut": "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
>     "amountIn": "200000000000000000000",
>     "srcChainId": 42161,
>     "dstChainId": 10,
>     "userAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9"
>   }' | jq
{
  "error": "No route available for this pair"
}


node --import tsx -e "
import { Contract, JsonRpcProvider } from 'ethers';
const provider = new JsonRpcProvider('https://arbitrum.drpc.org');
const router = new Contract(
  '0xA7772cDBA7739F19dcaE85fe0357929790FD23F9',
  ['function findBestPath(uint256,address,address,uint256) view returns ((uint256[] amounts,address[] path,address[] adapters,uint256[] gasEstimates))'],
  provider
);
const out = await router.findBestPath(
  199400000000000000000n,
  '0x1b896893dfc86bb67cf57767298b9073d2c1ba2c',
  '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  3
);
console.log(JSON.stringify({
  amounts: out.amounts.map(x => x.toString()),
  path: out.path,
  adapters: out.adapters
}, null, 2));
"
