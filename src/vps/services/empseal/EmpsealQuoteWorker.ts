import { AbiCoder, Interface, JsonRpcProvider, getAddress } from 'ethers';
import { getChainConfig } from '../../config/chains';
import {
  getEmpsealRouterAddressForChain,
  getEmpsealRouterFeeBpsForChain,
  getSwapPluginIdForChain,
} from '../../config/contracts';
import { applyEmpsealRouterFee, encodeEmpsealSwapData } from './swapData';

const EMPSEAL_ROUTER_CALL_INTERFACE = new Interface([
  'function findBestPath(uint256 _amountIn, address _tokenIn, address _tokenOut, uint256 _maxSteps)',
]);
const EMPSEAL_ROUTER_RESULT_INTERFACES = [
  new Interface([
    'function findBestPath(uint256 _amountIn, address _tokenIn, address _tokenOut, uint256 _maxSteps) view returns ((uint256[] amounts, address[] adapters, address[] path))',
  ]),
  new Interface([
    'function findBestPath(uint256 _amountIn, address _tokenIn, address _tokenOut, uint256 _maxSteps) view returns ((uint256[] amounts, address[] path, address[] adapters))',
  ]),
  new Interface([
    'function findBestPath(uint256 _amountIn, address _tokenIn, address _tokenOut, uint256 _maxSteps) view returns ((uint256[] amounts, address[] adapters, address[] path, uint256[] gasEstimates))',
  ]),
  new Interface([
    'function findBestPath(uint256 _amountIn, address _tokenIn, address _tokenOut, uint256 _maxSteps) view returns ((uint256[] amounts, address[] path, address[] adapters, uint256[] gasEstimates))',
  ]),
];

const abiCoder = AbiCoder.defaultAbiCoder();
const DEFAULT_MAX_STEPS = 1n;
const DEFAULT_RPC_TIMEOUT_MS = 5_000;

export interface EmpsealTrade {
  amountIn: bigint;
  amountOut: bigint;
  path: string[];
  adapters: string[];
}

export interface EmpsealSwapPlan {
  amountOut: bigint;
  trade: EmpsealTrade;
  data: string;
  feeBps: number;
}

export interface EmpsealSwapPlanRequest {
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
}

interface EmpsealFormattedOffer {
  amounts: bigint[];
  adapters: string[];
  path: string[];
}

export interface EmpsealQuoteWorkerLike {
  buildSwapPlan(input: EmpsealSwapPlanRequest): Promise<EmpsealSwapPlan | null>;
}

export class EmpsealQuoteWorker implements EmpsealQuoteWorkerLike {
  private readonly providers = new Map<number, JsonRpcProvider>();
  private readonly routerAddresses = new Map<number, string>();
  private readonly timeoutMs = this._readIntEnv('EMPSEAL_QUOTE_TIMEOUT_MS', DEFAULT_RPC_TIMEOUT_MS);

  async buildSwapPlan(input: EmpsealSwapPlanRequest): Promise<EmpsealSwapPlan | null> {
    const router = this._router(input.chainId);
    if (!router) return null;

    const tokenIn = this._normalizeAddress(input.tokenIn);
    const tokenOut = this._normalizeAddress(input.tokenOut);
    if (!tokenIn || !tokenOut || input.amountIn <= 0n) return null;

    try {
      const provider = this._provider(input.chainId, router.rpcUrl);
      const raw = await this._withTimeout(provider.call({
        to: router.address,
        data: EMPSEAL_ROUTER_CALL_INTERFACE.encodeFunctionData('findBestPath', [
          input.amountIn,
          tokenIn,
          tokenOut,
          DEFAULT_MAX_STEPS,
        ]),
      }), this.timeoutMs, `Empseal quote timeout for chain ${input.chainId}`);
      const offer = this._decodeFormattedOffer(raw);
      const amounts = offer.amounts;
      const path = offer.path;
      const adapters = offer.adapters;
      if (amounts.length < 2 || path.length < 2 || adapters.length + 1 !== path.length) return null;

      const amountOut = amounts[amounts.length - 1];
      if (amountOut <= 0n) return null;
      const feeBps = getEmpsealRouterFeeBpsForChain(input.chainId);
      const netAmountOut = applyEmpsealRouterFee(amountOut, feeBps);
      if (netAmountOut <= 0n) return null;

      const trade: EmpsealTrade = {
        amountIn: input.amountIn,
        amountOut,
        path,
        adapters,
      };

      return {
        amountOut: netAmountOut,
        trade,
        data: encodeEmpsealSwapData(getSwapPluginIdForChain(input.chainId), trade, feeBps),
        feeBps,
      };
    } catch {
      return null;
    }
  }

  encodeTrade(trade: EmpsealTrade): string {
    return abiCoder.encode(
      ['tuple(uint256 amountIn,uint256 amountOut,address[] path,address[] adapters)'],
      [trade],
    );
  }

  private _router(chainId: number): { address: string; rpcUrl: string } | null {
    const cachedAddress = this.routerAddresses.get(chainId);
    const chain = getChainConfig(chainId);
    if (cachedAddress && chain?.rpcUrl) {
      return { address: cachedAddress, rpcUrl: chain.rpcUrl };
    }

    const routerAddress = getEmpsealRouterAddressForChain(chainId);
    if (!routerAddress || !chain?.rpcUrl) return null;

    this.routerAddresses.set(chainId, routerAddress);
    return { address: routerAddress, rpcUrl: chain.rpcUrl };
  }

  private _decodeFormattedOffer(raw: string): EmpsealFormattedOffer {
    for (const iface of EMPSEAL_ROUTER_RESULT_INTERFACES) {
      try {
        const decoded = iface.decodeFunctionResult('findBestPath', raw)[0];
        const amounts = Array.isArray(decoded.amounts)
          ? decoded.amounts.map((value: bigint) => BigInt(value.toString()))
          : [];
        const adapters = Array.isArray(decoded.adapters)
          ? decoded.adapters.map((value: string) => getAddress(String(value)))
          : [];
        const path = Array.isArray(decoded.path)
          ? decoded.path.map((value: string) => getAddress(String(value)))
          : [];
        if (amounts.length >= 2 && path.length >= 2 && adapters.length + 1 === path.length) {
          return { amounts, adapters, path };
        }
      } catch {
        continue;
      }
    }

    throw new Error('Empseal findBestPath decode failed for all known router layouts');
  }

  private _provider(chainId: number, rpcUrl: string): JsonRpcProvider {
    const cached = this.providers.get(chainId);
    if (cached) return cached;

    const provider = new JsonRpcProvider(rpcUrl);
    this.providers.set(chainId, provider);
    return provider;
  }

  private _normalizeAddress(value: string): string | null {
    try {
      return getAddress(value);
    } catch {
      return null;
    }
  }

  private _readIntEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
  }

  private async _withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    return await new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }
}
