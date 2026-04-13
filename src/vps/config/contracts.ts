import { SettlementToken } from '../types';
import { hasAggregator } from './chains';

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

// EmpsealSwapPlugin.pluginId = keccak256("EMPSEAL_V1")
const DEFAULT_EMPSEAL_SWAP_PLUGIN_ID =
  '0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6';
const DEFAULT_UNIV2_SWAP_PLUGIN_ID =
  '0xd7099269d6f03dcf43069b0eaaa4e0cf1c11e826eeb6895af3e6dc361969a8f7';
const DEFAULT_UNIV3_SWAP_PLUGIN_ID =
  '0xa24768123ec9aba5087758f18a2e2e881edf551d7c2f293a97823d0ae43308b4';

function readEnv(key: string): string | undefined {
  const v = process.env[key];
  if (!v) return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

function asAddress(value?: string): string | undefined {
  if (!value) return undefined;
  if (!ADDRESS_RE.test(value)) return undefined;
  if (value.toLowerCase() === ZERO_ADDR) return undefined;
  return value;
}

function asBytes32(value?: string): string | undefined {
  if (!value || !BYTES32_RE.test(value)) return undefined;
  return value.toLowerCase();
}

function tokenEnvKey(chainId: number, token: SettlementToken): string {
  return `CHAIN_${chainId}_TOKEN_${token}`;
}

/**
 * Returns settlement token address on a given chain.
 * Expected env format: CHAIN_<chainId>_TOKEN_USDC / _USDT / _ETH.
 */
export function getSettlementTokenAddress(
  chainId: number,
  token: SettlementToken,
): string | undefined {
  return asAddress(readEnv(tokenEnvKey(chainId, token)));
}

/**
 * Returns swap plugin ID for the chain.
 * Expected env format: CHAIN_<chainId>_SWAP_PLUGIN_ID.
 * Falls back to Empseal plugin ID on chains where aggregator is enabled.
 */
export function getSwapPluginIdForChain(chainId: number): string | undefined {
  const configured = asBytes32(readEnv(`CHAIN_${chainId}_SWAP_PLUGIN_ID`));
  if (configured) return configured;
  if (!hasAggregator(chainId)) return undefined;

  const kind = (readEnv(`CHAIN_${chainId}_SWAP_PLUGIN_KIND`) ?? readEnv('DEFAULT_SWAP_PLUGIN_KIND') ?? 'EMPSEAL')
    .trim()
    .toUpperCase();
  if (kind === 'UNIV2' || kind === 'UNISWAP_V2') return DEFAULT_UNIV2_SWAP_PLUGIN_ID;
  if (kind === 'UNIV3' || kind === 'UNISWAP_V3') return DEFAULT_UNIV3_SWAP_PLUGIN_ID;
  if (kind === 'EMPSEAL') return DEFAULT_EMPSEAL_SWAP_PLUGIN_ID;
  return undefined;
}
