import { hasAggregator, getChainConfig } from './chains';

export interface GlobalTokenSupportConfig {
  /**
   * EVM chains with our aggregator can support arbitrary ERC-20 tokenIn/tokenOut,
   * because Ruflo can swap into and out of curated settlement assets.
   */
  arbitraryErc20OnAggregatorChains: boolean;
  /**
   * Chains without an aggregator can only originate or receive curated direct assets.
   * This is intentionally separate from messaging-rail settlement policy.
   */
  directAssetAliasesOnNonAggregatorChains: string[];
  /**
   * Non-EVM native delivery assets that can be exposed through provider-direct rails.
   */
  nativeDeliveryAssetAliases: string[];
}

export const GLOBAL_TOKEN_SUPPORT: GlobalTokenSupportConfig = {
  arbitraryErc20OnAggregatorChains: true,
  directAssetAliasesOnNonAggregatorChains: ['USDC', 'USDT', 'WETH'],
  nativeDeliveryAssetAliases: ['BTC.BTC', 'SOL.SOL', 'DOGE.DOGE'],
};

export function supportsArbitraryInputToken(chainId: number): boolean {
  const chain = getChainConfig(chainId);
  if (!chain?.isEVM) return false;
  return GLOBAL_TOKEN_SUPPORT.arbitraryErc20OnAggregatorChains && hasAggregator(chainId);
}

export function supportsArbitraryOutputToken(chainId: number): boolean {
  const chain = getChainConfig(chainId);
  if (!chain?.isEVM) return false;
  return GLOBAL_TOKEN_SUPPORT.arbitraryErc20OnAggregatorChains && hasAggregator(chainId);
}

export function supportedDirectAssetAliases(chainId: number): string[] {
  const chain = getChainConfig(chainId);
  if (!chain) return [];
  if (!chain.isEVM) return [...GLOBAL_TOKEN_SUPPORT.nativeDeliveryAssetAliases];
  if (hasAggregator(chainId)) return [];
  return [...GLOBAL_TOKEN_SUPPORT.directAssetAliasesOnNonAggregatorChains];
}
