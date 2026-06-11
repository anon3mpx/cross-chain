import { Rail, SettlementToken } from '../types';
import { hasAggregator } from './chains';
import { getRailEnvAliases } from '../rails/registry';
import {
  getDefaultRouteTokenAddress,
  getRouteMetadataTokenAddress,
} from './routeMetadata';

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

// EmpsealSwapPlugin.pluginId = keccak256("EMPSEAL_V1")
export const EMPSEAL_SWAP_PLUGIN_ID_V1 =
  '0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6';
// EmpsealSwapPluginV2.pluginId = keccak256("EMPSEAL_V2")
export const EMPSEAL_SWAP_PLUGIN_ID_V2 =
  '0xa0bbd346f67895db8c54370b8bfbe39761c5ac68106d44456f5fc5ee6b5ba93f';
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
 * Resolution order:
 * 1) CHAIN_<chainId>_TOKEN_<RAIL>_<TOKEN> (e.g. CHAIN_84532_TOKEN_AXELAR_USDC)
 * 2) CHAIN_<chainId>_TOKEN_<TOKEN> (legacy fallback)
 */
export function getSettlementTokenAddress(
  chainId: number,
  token: SettlementToken,
  rail?: Rail,
): string | undefined {
  if (rail) {
    const configured = getRouteMetadataTokenAddress(chainId, rail, token);
    if (configured) return asAddress(configured);
  }

  const defaultConfigured = getDefaultRouteTokenAddress(chainId, token);
  if (defaultConfigured) return asAddress(defaultConfigured);

  if (rail) {
    for (const railName of getRailEnvAliases(rail)) {
      const railScoped = asAddress(readEnv(`CHAIN_${chainId}_TOKEN_${railName}_${token}`));
      if (railScoped) return railScoped;
    }
  }
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

  const kind = getSwapPluginKindForChain(chainId);
  if (kind === 'UNIV2' || kind === 'UNISWAP_V2') return DEFAULT_UNIV2_SWAP_PLUGIN_ID;
  if (kind === 'UNIV3' || kind === 'UNISWAP_V3') return DEFAULT_UNIV3_SWAP_PLUGIN_ID;
  if (kind === 'EMPSEAL') return EMPSEAL_SWAP_PLUGIN_ID_V1;
  return undefined;
}

export function getSwapPluginKindForChain(chainId: number): string | undefined {
  if (!hasAggregator(chainId)) return undefined;
  return (readEnv(`CHAIN_${chainId}_SWAP_PLUGIN_KIND`) ?? readEnv('DEFAULT_SWAP_PLUGIN_KIND') ?? 'EMPSEAL')
    .trim()
    .toUpperCase();
}

export function getEmpsealRouterAddressForChain(chainId: number): string | undefined {
  return asAddress(
    readEnv(`CHAIN_${chainId}_EMPSEAL_ROUTER`)
    ?? readEnv(`CHAIN_${chainId}_DEX_EMPSEAL_ROUTER`)
  );
}

export function getEmpsealMulticallRouterAddressForChain(chainId: number): string | undefined {
  return asAddress(readEnv(`CHAIN_${chainId}_EMPSEAL_MULTICALL_ROUTER`));
}

export function getEmpsealRouterFeeBpsForChain(chainId: number): number {
  const raw = readEnv(`CHAIN_${chainId}_EMPSEAL_ROUTER_FEE_BPS`)
    ?? readEnv('DEFAULT_EMPSEAL_ROUTER_FEE_BPS')
    ?? '0';
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(9_900, parsed));
}
