import { ethers } from 'ethers';
import { QuoteEngine } from '../services/QuoteEngine';
import { CHAIN_CONFIGS } from '../config/chains';
import { RpcProviderRegistry } from '../services/RpcProviderRegistry';

const UNIV2_ROUTER_ABI = [
  'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)',
];

function boolFromEnv(value: string | undefined, fallback = false): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

export function registerDexQuoteAdapters(
  quoteEngine: QuoteEngine,
  env: Record<string, string | undefined> = process.env,
  rpcProviderRegistry: Pick<RpcProviderRegistry, 'getReadProvider'> = new RpcProviderRegistry({ env }),
): void {
  for (const chain of Object.values(CHAIN_CONFIGS)) {
    const chainId = chain.chainId;
    const enabled = boolFromEnv(env[`CHAIN_${chainId}_DEX_QUOTES_ENABLED`], true);
    if (!enabled) continue;

    const univ2Router = env[`CHAIN_${chainId}_UNIV2_ROUTER`]?.trim();
    if (univ2Router) {
      let provider: ethers.JsonRpcProvider;
      try {
        provider = rpcProviderRegistry.getReadProvider(chainId);
      } catch {
        continue;
      }
      const router = new ethers.Contract(univ2Router, UNIV2_ROUTER_ABI, provider);

      quoteEngine.registerDexQuoteFn(chainId, async (tokenIn, tokenOut, amountIn) => {
        const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
        const out = amounts?.[amounts.length - 1];
        return BigInt(out?.toString() ?? '0');
      });
    }
  }
}
