import { AbiCoder } from 'ethers';
import { EMPSEAL_SWAP_PLUGIN_ID_V2 } from '../../config/contracts';

const abiCoder = AbiCoder.defaultAbiCoder();
const BPS_DENOMINATOR = 10_000n;

export interface EmpsealTradePayload {
  amountIn: bigint;
  amountOut: bigint;
  path: string[];
  adapters: string[];
}

export function applyEmpsealRouterFee(amountOut: bigint, feeBps: number): bigint {
  const boundedFeeBps = BigInt(Math.max(0, Math.min(9_900, Math.floor(feeBps))));
  return (amountOut * (BPS_DENOMINATOR - boundedFeeBps)) / BPS_DENOMINATOR;
}

export function encodeEmpsealSwapData(
  pluginId: string | undefined,
  trade: EmpsealTradePayload,
  routerFeeBps: number,
): string {
  if ((pluginId ?? '').toLowerCase() === EMPSEAL_SWAP_PLUGIN_ID_V2.toLowerCase()) {
    return abiCoder.encode(
      ['tuple(uint256 amountIn,uint256 amountOut,address[] path,address[] adapters)', 'uint256'],
      [trade, BigInt(Math.max(0, Math.min(9_900, Math.floor(routerFeeBps))))],
    );
  }

  return abiCoder.encode(
    ['tuple(uint256 amountIn,uint256 amountOut,address[] path,address[] adapters)'],
    [trade],
  );
}
