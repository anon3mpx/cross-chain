import { CHAIN_ID } from '../types';

export type RpcWorkload = 'read' | 'poll';

export interface ChainRpcRuntimeConfig {
  readEnvKeys: string[];
  pollEnvKeys?: string[];
  timeoutMs?: number;
  cooldownMs?: number;
}

export interface ChainRuntimeConfig {
  rpc?: ChainRpcRuntimeConfig;
}

const DEFAULT_TIMEOUT_MS = 4_000;
const DEFAULT_COOLDOWN_MS = 30_000;

function makeReadEnvKeys(chainId: number): string[] {
  return [
    `CHAIN_${chainId}_RPC_1`,
    `CHAIN_${chainId}_RPC_2`,
    `CHAIN_${chainId}_RPC_3`,
    `CHAIN_${chainId}_RPC_4`,
    `CHAIN_${chainId}_RPC_5`,
  ];
}

function makePollEnvKeys(chainId: number): string[] {
  return [
    `CHAIN_${chainId}_RPC_POLL_1`,
    `CHAIN_${chainId}_RPC_POLL_2`,
  ];
}

function makeRpcRuntimeConfig(chainId: number): ChainRpcRuntimeConfig {
  return {
    readEnvKeys: makeReadEnvKeys(chainId),
    pollEnvKeys: makePollEnvKeys(chainId),
    timeoutMs: DEFAULT_TIMEOUT_MS,
    cooldownMs: DEFAULT_COOLDOWN_MS,
  };
}

function readEnv(env: Record<string, string | undefined>, key: string): string | undefined {
  const value = env[key];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function unique(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export const CHAIN_RUNTIME_CONFIG: Record<number, ChainRuntimeConfig> = {
  [CHAIN_ID.ETH]: { rpc: makeRpcRuntimeConfig(CHAIN_ID.ETH) },
  [CHAIN_ID.OP]: { rpc: makeRpcRuntimeConfig(CHAIN_ID.OP) },
  [CHAIN_ID.ROOTSTOCK]: { rpc: makeRpcRuntimeConfig(CHAIN_ID.ROOTSTOCK) },
  [CHAIN_ID.BSC]: { rpc: makeRpcRuntimeConfig(CHAIN_ID.BSC) },
  [CHAIN_ID.POLYGON]: { rpc: makeRpcRuntimeConfig(CHAIN_ID.POLYGON) },
  [CHAIN_ID.MONAD]: { rpc: makeRpcRuntimeConfig(CHAIN_ID.MONAD) },
  [CHAIN_ID.SONIC]: { rpc: makeRpcRuntimeConfig(CHAIN_ID.SONIC) },
  [CHAIN_ID.HYPEREVM]: { rpc: makeRpcRuntimeConfig(CHAIN_ID.HYPEREVM) },
  [CHAIN_ID.SEI]: { rpc: makeRpcRuntimeConfig(CHAIN_ID.SEI) },
  [CHAIN_ID.BERACHAIN]: { rpc: makeRpcRuntimeConfig(CHAIN_ID.BERACHAIN) },
  [CHAIN_ID.ETHPOW]: { rpc: makeRpcRuntimeConfig(CHAIN_ID.ETHPOW) },
  [CHAIN_ID.PULSE]: { rpc: makeRpcRuntimeConfig(CHAIN_ID.PULSE) },
  [CHAIN_ID.AVAX]: { rpc: makeRpcRuntimeConfig(CHAIN_ID.AVAX) },
  [CHAIN_ID.ARB]: { rpc: makeRpcRuntimeConfig(CHAIN_ID.ARB) },
  [CHAIN_ID.BASE]: { rpc: makeRpcRuntimeConfig(CHAIN_ID.BASE) },
  1101: { rpc: makeRpcRuntimeConfig(1101) },
  59144: { rpc: makeRpcRuntimeConfig(59144) },
  5000: { rpc: makeRpcRuntimeConfig(5000) },
  34443: { rpc: makeRpcRuntimeConfig(34443) },
  81457: { rpc: makeRpcRuntimeConfig(81457) },
  534352: { rpc: makeRpcRuntimeConfig(534352) },
  324: { rpc: makeRpcRuntimeConfig(324) },
  11155111: { rpc: makeRpcRuntimeConfig(11155111) },
  421614: { rpc: makeRpcRuntimeConfig(421614) },
  84532: { rpc: makeRpcRuntimeConfig(84532) },
  11155420: { rpc: makeRpcRuntimeConfig(11155420) },
  43113: { rpc: makeRpcRuntimeConfig(43113) },
  80002: { rpc: makeRpcRuntimeConfig(80002) },
  97: { rpc: makeRpcRuntimeConfig(97) },
  7777777: { rpc: makeRpcRuntimeConfig(7777777) },
  1284: { rpc: makeRpcRuntimeConfig(1284) },
  1285: { rpc: makeRpcRuntimeConfig(1285) },
  42220: { rpc: makeRpcRuntimeConfig(42220) },
};

export function resolveChainRpcUrls(
  chainId: number,
  workload: RpcWorkload,
  env: Record<string, string | undefined> = process.env,
): string[] {
  const rpc = CHAIN_RUNTIME_CONFIG[chainId]?.rpc;
  const readUrls = unique((rpc?.readEnvKeys ?? []).map((key) => readEnv(env, key)));
  const pollUrls = unique((rpc?.pollEnvKeys ?? []).map((key) => readEnv(env, key)));
  const configured = workload === 'poll' && pollUrls.length > 0 ? pollUrls : readUrls;
  if (configured.length > 0) return configured;

  return unique([
    readEnv(env, `CHAIN_${chainId}_RPC_URL`),
    readEnv(env, `CHAIN_${chainId}_RPC_FALLBACK`),
  ]);
}

export function resolveLegacyChainRpcFields(
  chainId: number,
  env: Record<string, string | undefined> = process.env,
): { rpcUrl: string; rpcFallback: string } {
  const readUrls = resolveChainRpcUrls(chainId, 'read', env);
  return {
    rpcUrl: readUrls[0] ?? '',
    rpcFallback: readUrls[1] ?? readUrls[0] ?? '',
  };
}

export function getChainRpcRuntimeConfig(chainId: number): ChainRpcRuntimeConfig | undefined {
  return CHAIN_RUNTIME_CONFIG[chainId]?.rpc;
}
