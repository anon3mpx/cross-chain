import { Interface, ZeroAddress } from 'ethers';

export const OPTIMISM_NATIVE_BRIDGE_RAIL_PROVIDER = 'optimism_standard_bridge';
export const OPTIMISM_L1_STANDARD_BRIDGE = '0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1';
export const OPTIMISM_L2_STANDARD_BRIDGE = '0x4200000000000000000000000000000000000010';
export const OPTIMISM_NATIVE_TOKEN_SENTINEL = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
export const OPTIMISM_DEFAULT_MIN_GAS_LIMIT = 200_000;
export const OPTIMISM_DEPOSIT_ETA_SECONDS = 3 * 60;
export const OPTIMISM_WITHDRAWAL_ETA_SECONDS = 7 * 24 * 60 * 60;

export const OPTIMISM_L1_BRIDGE_IFACE = new Interface([
  'function depositERC20To(address _l1Token,address _l2Token,address _to,uint256 _amount,uint32 _minGasLimit,bytes _extraData) external',
  'function depositETHTo(address _to,uint32 _minGasLimit,bytes _extraData) external payable',
]);

export const OPTIMISM_L2_BRIDGE_IFACE = new Interface([
  'function bridgeERC20To(address _localToken,address _remoteToken,address _to,uint256 _amount,uint32 _minGasLimit,bytes _extraData) external payable',
  'function bridgeETHTo(address _to,uint32 _minGasLimit,bytes _extraData) external payable',
]);

interface OptimismTokenPair {
  l1Token: string;
  l2Token: string;
  settlementKind: 'native' | 'erc20';
  settlementSymbol: 'ETH' | 'USDC' | 'USDT' | 'WETH';
  decimals: number;
}

const OPTIMISM_TOKEN_PAIRS: readonly OptimismTokenPair[] = [
  {
    l1Token: OPTIMISM_NATIVE_TOKEN_SENTINEL,
    l2Token: OPTIMISM_NATIVE_TOKEN_SENTINEL,
    settlementKind: 'native',
    settlementSymbol: 'ETH',
    decimals: 18,
  },
  {
    l1Token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    l2Token: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    settlementKind: 'erc20',
    settlementSymbol: 'USDC',
    decimals: 6,
  },
  {
    l1Token: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    l2Token: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    settlementKind: 'erc20',
    settlementSymbol: 'USDT',
    decimals: 6,
  },
  {
    l1Token: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    l2Token: '0x4200000000000000000000000000000000000006',
    settlementKind: 'erc20',
    settlementSymbol: 'WETH',
    decimals: 18,
  },
];

export interface ResolvedOptimismNativeBridgeRoute {
  direction: 'deposit' | 'withdraw';
  settlementKind: 'native' | 'erc20';
  settlementSymbol: 'ETH' | 'USDC' | 'USDT' | 'WETH';
  l1Token: string;
  l2Token: string;
  decimals: number;
  requiresPatient: boolean;
  etaSeconds: number;
}

export function isOptimismNativeBridgeNativeToken(token: string): boolean {
  const normalized = token.trim().toLowerCase();
  return normalized === 'native'
    || normalized === ZeroAddress
    || normalized === OPTIMISM_NATIVE_TOKEN_SENTINEL;
}

export function resolveOptimismNativeBridgeRoute(
  srcChainId: number,
  dstChainId: number,
  tokenIn: string,
  tokenOut: string,
): ResolvedOptimismNativeBridgeRoute | null {
  const pair = OPTIMISM_TOKEN_PAIRS.find((candidate) => {
    if (srcChainId === 1 && dstChainId === 10) {
      return tokenMatches(tokenIn, candidate.l1Token) && tokenMatches(tokenOut, candidate.l2Token);
    }
    if (srcChainId === 10 && dstChainId === 1) {
      return tokenMatches(tokenIn, candidate.l2Token) && tokenMatches(tokenOut, candidate.l1Token);
    }
    return false;
  });
  if (!pair) return null;

  return {
    direction: srcChainId === 1 ? 'deposit' : 'withdraw',
    settlementKind: pair.settlementKind,
    settlementSymbol: pair.settlementSymbol,
    l1Token: pair.l1Token,
    l2Token: pair.l2Token,
    decimals: pair.decimals,
    requiresPatient: srcChainId === 10 && dstChainId === 1,
    etaSeconds: srcChainId === 1 ? OPTIMISM_DEPOSIT_ETA_SECONDS : OPTIMISM_WITHDRAWAL_ETA_SECONDS,
  };
}

function tokenMatches(input: string, expected: string): boolean {
  if (isOptimismNativeBridgeNativeToken(expected)) {
    return isOptimismNativeBridgeNativeToken(input);
  }
  return input.trim().toLowerCase() === expected.toLowerCase();
}
