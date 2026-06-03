# Multi-RPC Runtime Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-endpoint RPC failover per chain, centralize chain runtime settings in one committed config file, and migrate VPS services to one shared provider policy without breaking legacy env-only deployments.

**Architecture:** Static protocol metadata stays in `src/vps/config/chains.ts`, while a new `src/vps/config/chainRuntime.ts` owns chain-specific runtime RPC policy through env-key lists. A shared `RpcProviderRegistry` resolves ordered endpoints, tracks cooldowns for retryable infra failures, and becomes the common source for read-path provider selection; polling services use the same runtime config and health policy while retaining service-owned listener/provider lifecycle.

**Tech Stack:** TypeScript, Node.js, ethers v6, Express, node:test, tsx

**Execution constraint:** Do not create git commits while implementing this plan unless the user explicitly changes that instruction.

---

## File Structure

### Runtime config foundation

- Create: `src/vps/config/chainRuntime.ts`
  Responsibility: define typed chain runtime RPC config, resolve ordered env-key lists for `read` and `poll` workloads, and preserve legacy `CHAIN_<id>_RPC_URL` / `CHAIN_<id>_RPC_FALLBACK` fallback behavior.
- Modify: `src/vps/config/chains.ts`
  Responsibility: keep static metadata intact while deriving legacy `rpcUrl` and `rpcFallback` compatibility fields from the new runtime resolver.
- Create: `tests/vps/chain-runtime-config.test.ts`
  Responsibility: lock env-key resolution order, dedupe rules, poll fallback, and legacy compatibility.

### Shared provider policy

- Create: `src/vps/services/RpcProviderRegistry.ts`
  Responsibility: resolve chain RPC URLs by workload, cache read providers, track retryable failure cooldowns, and expose shared selection helpers for consumers.
- Modify: `src/vps/app/infraErrors.ts`
  Responsibility: remain the single retryability classifier reused by the registry.
- Create: `tests/vps/rpc-provider-registry.test.ts`
  Responsibility: verify provider selection, cooldown rotation, recovery after cooldown, and hard failure when no endpoints exist.

### Read-path consumers

- Modify: `src/vps/api/StatusAPI.ts`
  Responsibility: stop constructing source providers from `chain.rpcUrl`; use registry-backed read providers instead.
- Modify: `src/vps/bootstrap/dexAdapters.ts`
  Responsibility: initialize DEX quote adapters from runtime-configured read providers instead of a single chain URL.
- Modify: `src/vps/services/IntentCalldataBuilder.ts`
  Responsibility: estimate fees using registry-backed source-chain providers.
- Modify: `src/vps/services/empseal/EmpsealQuoteWorker.ts`
  Responsibility: obtain quote providers from registry-backed read URLs instead of direct `chain.rpcUrl`.
- Modify: `src/vps/services/gaszip/GasZipMonitorWorker.ts`
  Responsibility: default its receipt provider factory to runtime-configured read endpoints.
- Create: `tests/vps/status-api-rpc-provider.test.ts`
  Responsibility: verify `StatusAPI` uses the injected registry and surfaces chain-unavailable errors cleanly.
- Modify: `tests/vps/dex-adapters.test.ts`
  Responsibility: cover registry-backed adapter initialization.
- Modify: `tests/vps/gaszip-monitor-worker.test.ts`
  Responsibility: ensure default provider resolution can be injected from the new registry hooks without changing existing monitoring behavior.

### Polling workers and runtime wiring

- Modify: `src/vps/services/EventMonitor.ts`
  Responsibility: rebuild listener-bound providers from runtime-configured polling URLs and rotate on retryable provider errors.
- Modify: `src/vps/services/CctpAttestationWorker.ts`
  Responsibility: initialize per-chain polling providers from runtime config and rotate providers on retryable errors rather than relying on one URL.
- Modify: `src/vps/app/runtime.ts`
  Responsibility: construct one registry instance and pass it to services that need shared provider policy.
- Create: `tests/vps/event-monitor-rpc-failover.test.ts`
  Responsibility: verify the event monitor swaps to the next polling URL when the current provider emits a retryable error.
- Modify: `tests/vps/cctp-attestation-worker.test.ts`
  Responsibility: cover polling provider bootstrap from the registry and retryable rotation behavior.

### Script and ops cleanup

- Modify: `src/vps/scripts/recoverCurrentStuckCctpIntent.ts`
  Responsibility: replace local RPC candidate assembly with the shared runtime config resolver while preserving the script’s sequential retry behavior.
- Modify: `docs/superpowers/specs/2026-06-02-multi-rpc-runtime-config-design.md`
  Responsibility: update status from draft after implementation if desired.
- Create: `docs/ops/runtime-rpc-config.md`
  Responsibility: document the new env key scheme, read vs poll endpoint pools, and the legacy fallback window.

---

### Task 1: Build The Runtime Config Foundation

**Files:**
- Create: `tests/vps/chain-runtime-config.test.ts`
- Create: `src/vps/config/chainRuntime.ts`
- Modify: `src/vps/config/chains.ts`
- Test: `tests/vps/deployment-registry-config.test.ts`

- [ ] **Step 1: Write the failing runtime-config resolver test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveChainRpcUrls,
  resolveLegacyChainRpcFields,
} from '../../src/vps/config/chainRuntime';

function withEnv(extraEnv: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(extraEnv)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return Promise.resolve(fn()).finally(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test('resolveChainRpcUrls returns ordered unique read and poll URLs and falls back to read when poll is empty', async () => {
  await withEnv({
    CHAIN_8453_RPC_1: 'https://base-a.example',
    CHAIN_8453_RPC_2: 'https://base-b.example',
    CHAIN_8453_RPC_3: 'https://base-a.example',
    CHAIN_8453_RPC_POLL_1: undefined,
    CHAIN_8453_RPC_POLL_2: undefined,
  }, () => {
    assert.deepEqual(resolveChainRpcUrls(8453, 'read'), [
      'https://base-a.example',
      'https://base-b.example',
    ]);
    assert.deepEqual(resolveChainRpcUrls(8453, 'poll'), [
      'https://base-a.example',
      'https://base-b.example',
    ]);
  });
});

test('resolveLegacyChainRpcFields falls back to legacy env keys when numbered keys are absent', async () => {
  await withEnv({
    CHAIN_42161_RPC_1: undefined,
    CHAIN_42161_RPC_2: undefined,
    CHAIN_42161_RPC_URL: 'https://arb-primary.example',
    CHAIN_42161_RPC_FALLBACK: 'https://arb-backup.example',
  }, () => {
    assert.deepEqual(resolveChainRpcUrls(42161, 'read'), [
      'https://arb-primary.example',
      'https://arb-backup.example',
    ]);
    assert.deepEqual(resolveLegacyChainRpcFields(42161), {
      rpcUrl: 'https://arb-primary.example',
      rpcFallback: 'https://arb-backup.example',
    });
  });
});
```

- [ ] **Step 2: Run the new test and confirm the module does not exist yet**

Run: `node --import tsx --test tests/vps/chain-runtime-config.test.ts`
Expected: FAIL with `Cannot find module '../../src/vps/config/chainRuntime'`.

- [ ] **Step 3: Create `src/vps/config/chainRuntime.ts` with typed env-key resolution**

```ts
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

function readEnv(env: Record<string, string | undefined>, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

function unique(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export const CHAIN_RUNTIME_CONFIG: Record<number, ChainRuntimeConfig> = {
  10: { rpc: { readEnvKeys: ['CHAIN_10_RPC_1', 'CHAIN_10_RPC_2', 'CHAIN_10_RPC_3', 'CHAIN_10_RPC_4', 'CHAIN_10_RPC_5'], pollEnvKeys: ['CHAIN_10_RPC_POLL_1', 'CHAIN_10_RPC_POLL_2'], timeoutMs: 4_000, cooldownMs: 30_000 } },
  8453: { rpc: { readEnvKeys: ['CHAIN_8453_RPC_1', 'CHAIN_8453_RPC_2', 'CHAIN_8453_RPC_3', 'CHAIN_8453_RPC_4', 'CHAIN_8453_RPC_5'], pollEnvKeys: ['CHAIN_8453_RPC_POLL_1', 'CHAIN_8453_RPC_POLL_2'], timeoutMs: 4_000, cooldownMs: 30_000 } },
  42161: { rpc: { readEnvKeys: ['CHAIN_42161_RPC_1', 'CHAIN_42161_RPC_2', 'CHAIN_42161_RPC_3', 'CHAIN_42161_RPC_4', 'CHAIN_42161_RPC_5'], pollEnvKeys: ['CHAIN_42161_RPC_POLL_1', 'CHAIN_42161_RPC_POLL_2'], timeoutMs: 4_000, cooldownMs: 30_000 } },
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
```

- [ ] **Step 4: Update `src/vps/config/chains.ts` to derive compatibility fields from the new resolver**

```ts
import {
  resolveLegacyChainRpcFields,
} from './chainRuntime';

const cfg = (
  chainId: number,
  name: string,
  defaultHasAggregator: boolean,
  nativeStable: SettlementToken = SettlementToken.USDC,
  blockTimeMs = 2000,
  isEVM = true,
): ChainConfig => {
  const { rpcUrl, rpcFallback } = resolveLegacyChainRpcFields(chainId);

  return {
    ...(() => {
      const override = env(`CHAIN_${chainId}_HAS_AGGREGATOR`);
      const hasAggregator = override
        ? ['1', 'true', 'yes', 'on'].includes(override.toLowerCase())
        : defaultHasAggregator;
      return { hasAggregator };
    })(),
    chainId,
    name,
    rpcUrl,
    rpcFallback,
    routerV1: env(`CHAIN_${chainId}_ROUTER_V1`) ?? getRouterAddressFromDeploymentRegistry(chainId),
    receiverV1: env(`CHAIN_${chainId}_RECEIVER_V1`) ?? getReceiverAddressFromDeploymentRegistry(chainId),
    nativeStable,
    blockTimeMs,
    isEVM,
  };
};
```

- [ ] **Step 5: Re-run the new resolver test and the existing deployment registry compatibility test**

Run: `node --import tsx --test tests/vps/chain-runtime-config.test.ts tests/vps/deployment-registry-config.test.ts`
Expected: PASS with both tests green.

- [ ] **Step 6: Review the local diff without committing**

Run: `git diff -- src/vps/config/chains.ts src/vps/config/chainRuntime.ts tests/vps/chain-runtime-config.test.ts`
Expected: only the new runtime resolver and the compatibility-field derivation are present.

### Task 2: Add The Shared RPC Provider Registry

**Files:**
- Create: `tests/vps/rpc-provider-registry.test.ts`
- Create: `src/vps/services/RpcProviderRegistry.ts`
- Test: `tests/vps/worker-infra-errors.test.ts`

- [ ] **Step 1: Write the failing provider-registry test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { RpcProviderRegistry } from '../../src/vps/services/RpcProviderRegistry';

test('RpcProviderRegistry rotates read providers after retryable failures and reuses the active provider otherwise', async () => {
  let now = 1_000;
  const registry = new RpcProviderRegistry({
    env: {
      CHAIN_8453_RPC_1: 'https://base-a.example',
      CHAIN_8453_RPC_2: 'https://base-b.example',
    },
    now: () => now,
    providerFactory: (rpcUrl) => ({ rpcUrl }) as any,
  });

  const first = registry.getReadProvider(8453) as any;
  assert.equal(first.rpcUrl, 'https://base-a.example');

  registry.reportFailure(8453, 'read', 'https://base-a.example', new Error('429 Too Many Requests'));
  const second = registry.getReadProvider(8453) as any;
  assert.equal(second.rpcUrl, 'https://base-b.example');

  now += 31_000;
  const third = registry.getReadProvider(8453) as any;
  assert.equal(third.rpcUrl, 'https://base-a.example');
});
```

- [ ] **Step 2: Run the test and confirm the registry does not exist yet**

Run: `node --import tsx --test tests/vps/rpc-provider-registry.test.ts`
Expected: FAIL with `Cannot find module '../../src/vps/services/RpcProviderRegistry'`.

- [ ] **Step 3: Create `src/vps/services/RpcProviderRegistry.ts` with read-provider caching and cooldown tracking**

```ts
import { JsonRpcProvider } from 'ethers';

import { isRetryableInfraError } from '../app/infraErrors';
import {
  getChainRpcRuntimeConfig,
  resolveChainRpcUrls,
  type RpcWorkload,
} from '../config/chainRuntime';

type ProviderFactory = (rpcUrl: string, chainId: number) => JsonRpcProvider;

interface RpcProviderRegistryOptions {
  env?: Record<string, string | undefined>;
  now?: () => number;
  providerFactory?: ProviderFactory;
}

interface EndpointState {
  cooldownUntil: number;
}

export class RpcProviderRegistry {
  private readonly env: Record<string, string | undefined>;
  private readonly now: () => number;
  private readonly providerFactory: ProviderFactory;
  private readonly endpointState = new Map<string, EndpointState>();
  private readonly readProviders = new Map<string, JsonRpcProvider>();

  constructor(options: RpcProviderRegistryOptions = {}) {
    this.env = options.env ?? process.env;
    this.now = options.now ?? (() => Date.now());
    this.providerFactory = options.providerFactory ?? ((rpcUrl, chainId) => new JsonRpcProvider(rpcUrl, chainId, { staticNetwork: true }));
  }

  getRpcUrls(chainId: number, workload: RpcWorkload): string[] {
    return resolveChainRpcUrls(chainId, workload, this.env);
  }

  getReadProvider(chainId: number): JsonRpcProvider {
    const rpcUrl = this.selectRpcUrl(chainId, 'read');
    const cacheKey = `${chainId}:${rpcUrl}`;
    const cached = this.readProviders.get(cacheKey);
    if (cached) return cached;

    const provider = this.providerFactory(rpcUrl, chainId);
    this.readProviders.set(cacheKey, provider);
    return provider;
  }

  getPollingRpcUrl(chainId: number): string {
    return this.selectRpcUrl(chainId, 'poll');
  }

  reportFailure(chainId: number, workload: RpcWorkload, rpcUrl: string, err: unknown): void {
    if (!isRetryableInfraError(err)) return;
    const cooldownMs = getChainRpcRuntimeConfig(chainId)?.cooldownMs ?? 30_000;
    this.endpointState.set(this.key(chainId, workload, rpcUrl), {
      cooldownUntil: this.now() + cooldownMs,
    });
  }

  private selectRpcUrl(chainId: number, workload: RpcWorkload): string {
    const urls = this.getRpcUrls(chainId, workload);
    if (urls.length === 0) {
      throw new Error(`No RPC URLs configured for chain ${chainId} workload ${workload}`);
    }

    const now = this.now();
    for (const rpcUrl of urls) {
      const state = this.endpointState.get(this.key(chainId, workload, rpcUrl));
      if (!state || state.cooldownUntil <= now) return rpcUrl;
    }

    return urls[0];
  }

  private key(chainId: number, workload: RpcWorkload, rpcUrl: string): string {
    return `${chainId}:${workload}:${rpcUrl}`;
  }
}
```

- [ ] **Step 4: Expand the test to cover non-retryable failures and empty-config hard errors**

```ts
test('RpcProviderRegistry ignores non-retryable failures and throws when no endpoints exist', () => {
  const registry = new RpcProviderRegistry({
    env: { CHAIN_10_RPC_1: 'https://op-a.example' },
    providerFactory: (rpcUrl) => ({ rpcUrl }) as any,
  });

  registry.reportFailure(10, 'read', 'https://op-a.example', new Error('receiver does not approve relayer'));
  assert.equal((registry.getReadProvider(10) as any).rpcUrl, 'https://op-a.example');

  const empty = new RpcProviderRegistry({ env: {}, providerFactory: (rpcUrl) => ({ rpcUrl }) as any });
  assert.throws(() => empty.getReadProvider(999), /No RPC URLs configured/);
});
```

- [ ] **Step 5: Re-run registry and infra retryability tests**

Run: `node --import tsx --test tests/vps/rpc-provider-registry.test.ts tests/vps/worker-infra-errors.test.ts`
Expected: PASS with registry rotation and retryability coverage green.

- [ ] **Step 6: Review the local diff without committing**

Run: `git diff -- src/vps/services/RpcProviderRegistry.ts tests/vps/rpc-provider-registry.test.ts`
Expected: only the registry implementation and its focused tests are present.

### Task 3: Migrate Read-Path Consumers To The Registry

**Files:**
- Create: `tests/vps/status-api-rpc-provider.test.ts`
- Modify: `src/vps/api/StatusAPI.ts`
- Modify: `src/vps/bootstrap/dexAdapters.ts`
- Modify: `src/vps/services/IntentCalldataBuilder.ts`
- Modify: `src/vps/services/empseal/EmpsealQuoteWorker.ts`
- Modify: `src/vps/services/gaszip/GasZipMonitorWorker.ts`
- Modify: `tests/vps/dex-adapters.test.ts`
- Modify: `tests/vps/gaszip-monitor-worker.test.ts`

- [ ] **Step 1: Write the failing `StatusAPI` integration test for registry-backed source providers**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildStatusAPI } from '../../src/vps/api/StatusAPI';
import { IntentEngine } from '../../src/vps/services/IntentEngine';
import { IntentService } from '../../src/vps/services/IntentService';
import { QuoteEngine } from '../../src/vps/services/QuoteEngine';

test('buildStatusAPI requests source providers from the injected RPC registry', async () => {
  let requestedChainId = -1;
  const app = buildStatusAPI(
    new IntentService(new IntentEngine()),
    new QuoteEngine(undefined, {
      thorchainQuoteWorker: undefined,
      layerZeroValueTransferApiQuoteWorker: undefined,
    }),
    {
      rpcProviderRegistry: {
        getReadProvider(chainId: number) {
          requestedChainId = chainId;
          return {
            getTransactionReceipt: async () => ({ status: 1 }),
          } as any;
        },
      } as any,
    },
  );

  assert.ok(app);
  assert.equal(requestedChainId, -1);
});
```

- [ ] **Step 2: Run the test and confirm `rpcProviderRegistry` is not a supported option yet**

Run: `node --import tsx --test tests/vps/status-api-rpc-provider.test.ts`
Expected: FAIL with a TypeScript error for unknown `rpcProviderRegistry` in `StatusApiOptions`.

- [ ] **Step 3: Add registry injection to `StatusAPI` and use it in `getSourceProvider`**

```ts
import { RpcProviderRegistry } from '../services/RpcProviderRegistry';

interface StatusApiOptions {
  layerZeroValueTransferApiClient?: LayerZeroValueTransferApiHttpClient;
  rpcProviderRegistry?: Pick<RpcProviderRegistry, 'getReadProvider'>;
}

export function buildStatusAPI(
  intentService: IntentService,
  quoteEngine: QuoteEngine,
  options: StatusApiOptions = {},
): express.Application {
  const app = express();
  const providers = new Map<number, ethers.JsonRpcProvider>();
  const rpcProviderRegistry = options.rpcProviderRegistry ?? new RpcProviderRegistry();

  function getSourceProvider(chainId: number): ethers.JsonRpcProvider {
    const existing = providers.get(chainId);
    if (existing) return existing;

    const chain = CHAIN_CONFIGS[chainId];
    if (!chain?.isEVM) {
      throw new IntentLifecycleError('CHAIN_RPC_UNAVAILABLE', `No EVM RPC is configured for source chain ${chainId}.`, 503);
    }

    const provider = rpcProviderRegistry.getReadProvider(chainId);
    providers.set(chainId, provider);
    return provider;
  }
```

- [ ] **Step 4: Migrate `dexAdapters`, `IntentCalldataBuilder`, `EmpsealQuoteWorker`, and `GasZipMonitorWorker` to accept registry-backed provider hooks**

```ts
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
    if (!univ2Router) continue;

    try {
      const provider = rpcProviderRegistry.getReadProvider(chainId);
      const router = new ethers.Contract(univ2Router, UNIV2_ROUTER_ABI, provider);
      quoteEngine.registerDexQuoteFn(chainId, async (tokenIn, tokenOut, amountIn) => {
        const amounts = await router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
        return BigInt(amounts?.[amounts.length - 1]?.toString() ?? '0');
      });
    } catch {
      continue;
    }
  }
}
```

```ts
const rpcProviderRegistry = new RpcProviderRegistry();
const provider = rpcProviderRegistry.getReadProvider(quote.srcChainId);
```

```ts
const defaultGasZipReceiptProviderFactory: GasZipReceiptProviderFactory = (chainId) => {
  try {
    return new RpcProviderRegistry().getReadProvider(chainId);
  } catch {
    return null;
  }
};
```

- [ ] **Step 5: Add or update tests for the migrated read-path consumers**

```ts
test('registerDexQuoteAdapters skips router wiring when the registry has no configured provider for the chain', async () => {
  const engine = new QuoteEngine(undefined, {
    thorchainQuoteWorker: undefined,
    layerZeroValueTransferApiQuoteWorker: undefined,
  });

  registerDexQuoteAdapters(
    engine,
    {
      CHAIN_8453_UNIV2_ROUTER: '0x1111111111111111111111111111111111111111',
    },
    {
      getReadProvider() {
        throw new Error('No RPC URLs configured');
      },
    } as any,
  );

  const result = await engine.getOffers({
    tokenIn: BASE_WETH,
    tokenOut: ARB_USDC,
    amountIn: 1_000_000_000_000_000_000n,
    srcChainId: 8453,
    dstChainId: 42161,
    userAddress: '0x05f8cc8753d90d67dbb8c02118440b8283f941c9',
    urgency: 'fast',
  });

  assert.equal(result, null);
});
```

- [ ] **Step 6: Run the read-path test set**

Run: `node --import tsx --test tests/vps/status-api-rpc-provider.test.ts tests/vps/dex-adapters.test.ts tests/vps/gaszip-monitor-worker.test.ts tests/vps/layerzero-value-transfer-api-status-api.test.ts`
Expected: PASS with no direct dependence on `chain.rpcUrl` in the covered code paths.

- [ ] **Step 7: Review the local diff without committing**

Run: `git diff -- src/vps/api/StatusAPI.ts src/vps/bootstrap/dexAdapters.ts src/vps/services/IntentCalldataBuilder.ts src/vps/services/empseal/EmpsealQuoteWorker.ts src/vps/services/gaszip/GasZipMonitorWorker.ts tests/vps/status-api-rpc-provider.test.ts tests/vps/dex-adapters.test.ts tests/vps/gaszip-monitor-worker.test.ts`
Expected: only read-path provider wiring changes and corresponding tests are present.

### Task 4: Migrate Polling Workers And Runtime Wiring

**Files:**
- Create: `tests/vps/event-monitor-rpc-failover.test.ts`
- Modify: `src/vps/services/EventMonitor.ts`
- Modify: `src/vps/services/CctpAttestationWorker.ts`
- Modify: `src/vps/app/runtime.ts`
- Modify: `tests/vps/cctp-attestation-worker.test.ts`

- [ ] **Step 1: Write the failing event-monitor failover test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { EventMonitor } from '../../src/vps/services/EventMonitor';

test('EventMonitor replaces the active polling RPC URL after a retryable provider error', () => {
  const switchedTo: string[] = [];
  const monitor = new EventMonitor(
    {} as any,
    {
      getPollingRpcUrl(chainId: number) {
        return switchedTo.length === 0
          ? 'https://base-poll-a.example'
          : 'https://base-poll-b.example';
      },
      reportFailure(_chainId: number, _workload: 'poll', rpcUrl: string) {
        switchedTo.push(rpcUrl);
      },
    } as any,
  );

  assert.ok(monitor);
});
```

- [ ] **Step 2: Run the test and confirm `EventMonitor` does not yet accept a registry dependency**

Run: `node --import tsx --test tests/vps/event-monitor-rpc-failover.test.ts`
Expected: FAIL with a constructor signature mismatch for `EventMonitor`.

- [ ] **Step 3: Refactor `EventMonitor` to own polling providers but select URLs through the registry**

```ts
import { isRetryableInfraError } from '../app/infraErrors';
import { RpcProviderRegistry } from './RpcProviderRegistry';

export class EventMonitor {
  private providers = new Map<number, ethers.JsonRpcProvider>();

  constructor(
    private intentService: IntentService,
    private rpcProviderRegistry: Pick<RpcProviderRegistry, 'getPollingRpcUrl' | 'reportFailure'> = new RpcProviderRegistry(),
  ) {}

  private _buildProvider(chain: ChainConfig): ethers.JsonRpcProvider {
    const rpcUrl = this.rpcProviderRegistry.getPollingRpcUrl(chain.chainId);
    const provider = new ethers.JsonRpcProvider(rpcUrl, chain.chainId, {
      polling: true,
      batchMaxCount: 1,
      staticNetwork: true,
    });
    provider.pollingInterval = this._readIntEnv('RPC_POLLING_INTERVAL_MS', 4000);
    provider.on('error', (err) => {
      if (!isRetryableInfraError(err)) return;
      this.rpcProviderRegistry.reportFailure(chain.chainId, 'poll', rpcUrl, err);
      this._rebuildChain(chain);
    });
    return provider;
  }
```

- [ ] **Step 4: Apply the same polling-url selection pattern to `CctpAttestationWorker` and pass one registry from runtime**

```ts
const rpcProviderRegistry = new RpcProviderRegistry();
registerDexQuoteAdapters(quoteEngine, process.env, rpcProviderRegistry);

const eventMonitor = enableEventMonitor ? new EventMonitor(intentService, rpcProviderRegistry) : undefined;

const cctpRelayWorker = enableCctpRelay
  ? new CctpAttestationWorker(intentService, rpcProviderRegistry)
  : undefined;
```

```ts
const rpcUrl = this.rpcProviderRegistry.getPollingRpcUrl(chain.chainId);
const provider = new JsonRpcProvider(rpcUrl, chain.chainId, {
  polling: true,
  batchMaxCount: 1,
  staticNetwork: true,
});
provider.on('error', (err) => {
  if (!isRetryableInfraError(err)) return;
  this.rpcProviderRegistry.reportFailure(chain.chainId, 'poll', rpcUrl, err);
});
```

- [ ] **Step 5: Add the polling-worker regression tests**

```ts
import { EventEmitter } from 'node:events';

class FakeProvider extends EventEmitter {
  pollingInterval = 0;
  destroy() {}
}

test('EventMonitor reports retryable polling failures and rebuilds from the next URL', () => {
  const createdUrls: string[] = [];
  const providers: FakeProvider[] = [];

  const monitor = new EventMonitor(
    { markInTransit: async () => undefined, markSettled: async () => undefined } as any,
    {
      getPollingRpcUrl() {
        return createdUrls.length === 0
          ? 'https://base-poll-a.example'
          : 'https://base-poll-b.example';
      },
      reportFailure(_chainId, _workload, rpcUrl) {
        createdUrls.push(rpcUrl);
      },
    } as any,
    (_rpcUrl: string) => {
      const provider = new FakeProvider() as any;
      providers.push(provider);
      return provider;
    },
  );

  monitor.addChain({
    chainId: 8453,
    name: 'base',
    rpcUrl: '',
    rpcFallback: '',
    routerV1: '0x1111111111111111111111111111111111111111',
    receiverV1: undefined,
    hasAggregator: true,
    nativeStable: 'USDC' as any,
    blockTimeMs: 2000,
    isEVM: true,
  });

  providers[0].emit('error', Object.assign(new Error('429 Too Many Requests'), { code: 'SERVER_ERROR' }));
  assert.deepEqual(createdUrls, ['https://base-poll-a.example']);
});
```

```ts
test('CctpAttestationWorker bootstraps providers from polling URLs before legacy rpcUrl fields', async () => {
  const createdUrls: string[] = [];
  const worker = new CctpAttestationWorker(
    { markDestinationReceived: async () => undefined } as any,
    {
      getPollingRpcUrl(chainId: number) {
        assert.equal(chainId, 8453);
        return 'https://base-poll-a.example';
      },
      reportFailure() {},
    } as any,
    (rpcUrl: string) => {
      createdUrls.push(rpcUrl);
      return {
        on() {},
        destroy() {},
        queryFilter: async () => [],
      } as any;
    },
  );

  await worker.start();
  worker.stop();

  assert.equal(createdUrls.includes('https://base-poll-a.example'), true);
});
```

- [ ] **Step 6: Run the polling-worker test set**

Run: `node --import tsx --test tests/vps/event-monitor-rpc-failover.test.ts tests/vps/cctp-attestation-worker.test.ts`
Expected: PASS with polling-provider creation and retryable rotation covered.

- [ ] **Step 7: Review the local diff without committing**

Run: `git diff -- src/vps/services/EventMonitor.ts src/vps/services/CctpAttestationWorker.ts src/vps/app/runtime.ts tests/vps/event-monitor-rpc-failover.test.ts tests/vps/cctp-attestation-worker.test.ts`
Expected: only polling-path provider lifecycle changes and test coverage are present.

### Task 5: Align Recovery Script And Document The New Runtime Model

**Files:**
- Modify: `src/vps/scripts/recoverCurrentStuckCctpIntent.ts`
- Create: `docs/ops/runtime-rpc-config.md`
- Test: `tests/vps/cctp-current-intent-recovery.test.ts`

- [ ] **Step 1: Write the failing recovery-script helper test for shared RPC resolution**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { getRpcCandidates } from '../../src/vps/scripts/recoverCurrentStuckCctpIntent';

test('getRpcCandidates prefers numbered runtime RPC env keys before legacy fallback keys', () => {
  process.env.CHAIN_42161_RPC_1 = 'https://arb-a.example';
  process.env.CHAIN_42161_RPC_2 = 'https://arb-b.example';
  process.env.CHAIN_42161_RPC_URL = 'https://arb-legacy.example';

  assert.deepEqual(getRpcCandidates(42161), [
    'https://arb-a.example',
    'https://arb-b.example',
  ]);
});
```

- [ ] **Step 2: Run the test and confirm `getRpcCandidates` still reads only legacy keys**

Run: `node --import tsx --test tests/vps/cctp-current-intent-recovery.test.ts`
Expected: FAIL because `getRpcCandidates` ignores numbered runtime keys.

- [ ] **Step 3: Replace local RPC assembly in the recovery script with the shared resolver**

```ts
import { resolveChainRpcUrls } from '../config/chainRuntime';

export function getRpcCandidates(chainId: number): string[] {
  const configured = resolveChainRpcUrls(chainId, 'read');
  const candidates = [...new Set([
    ...(BUILTIN_RPC_URLS[chainId] ?? []),
    ...configured,
  ])];

  if (candidates.length === 0) {
    throw new Error(`missing CHAIN_${chainId}_RPC_URL`);
  }

  return candidates;
}
```

- [ ] **Step 4: Document the new env model and migration path**

```md
# Runtime RPC Config

## Numbered read endpoints

- `CHAIN_<id>_RPC_1`
- `CHAIN_<id>_RPC_2`
- `CHAIN_<id>_RPC_3`
- `CHAIN_<id>_RPC_4`
- `CHAIN_<id>_RPC_5`

## Optional dedicated polling endpoints

- `CHAIN_<id>_RPC_POLL_1`
- `CHAIN_<id>_RPC_POLL_2`

If `CHAIN_<id>_RPC_POLL_*` is unset, poll workloads fall back to the numbered read endpoints.

## Legacy fallback window

Existing environments using `CHAIN_<id>_RPC_URL` and `CHAIN_<id>_RPC_FALLBACK` continue to boot until the migration is complete.
```

- [ ] **Step 5: Run the script and docs regression set**

Run: `node --import tsx --test tests/vps/cctp-current-intent-recovery.test.ts tests/vps/chain-runtime-config.test.ts`
Expected: PASS with the recovery helper using the same runtime RPC resolution rules as the rest of the app.

- [ ] **Step 6: Run a final focused verification sweep**

Run: `node --import tsx --test tests/vps/chain-runtime-config.test.ts tests/vps/rpc-provider-registry.test.ts tests/vps/status-api-rpc-provider.test.ts tests/vps/dex-adapters.test.ts tests/vps/gaszip-monitor-worker.test.ts tests/vps/event-monitor-rpc-failover.test.ts tests/vps/cctp-attestation-worker.test.ts tests/vps/cctp-current-intent-recovery.test.ts`
Expected: PASS across the new runtime-config, registry, read-path, polling-path, and recovery-path coverage.

- [ ] **Step 7: Review the complete local diff without committing**

Run: `git diff -- src/vps/config/chainRuntime.ts src/vps/config/chains.ts src/vps/services/RpcProviderRegistry.ts src/vps/services/EventMonitor.ts src/vps/services/CctpAttestationWorker.ts src/vps/api/StatusAPI.ts src/vps/bootstrap/dexAdapters.ts src/vps/services/IntentCalldataBuilder.ts src/vps/services/empseal/EmpsealQuoteWorker.ts src/vps/services/gaszip/GasZipMonitorWorker.ts src/vps/scripts/recoverCurrentStuckCctpIntent.ts docs/ops/runtime-rpc-config.md tests/vps/chain-runtime-config.test.ts tests/vps/rpc-provider-registry.test.ts tests/vps/status-api-rpc-provider.test.ts tests/vps/dex-adapters.test.ts tests/vps/gaszip-monitor-worker.test.ts tests/vps/event-monitor-rpc-failover.test.ts tests/vps/cctp-attestation-worker.test.ts tests/vps/cctp-current-intent-recovery.test.ts`
Expected: the final diff is limited to runtime RPC config, registry wiring, migrated consumers, recovery-script alignment, and documentation.

---

## Self-Review

### Spec coverage

- Single committed runtime config file: covered by Task 1.
- Env-backed multi-RPC lists per chain: covered by Tasks 1 and 5.
- Shared provider layer: covered by Task 2.
- Read vs poll workload split: covered by Tasks 3 and 4.
- Backward compatibility for `CHAIN_<id>_RPC_URL` and `CHAIN_<id>_RPC_FALLBACK`: covered by Tasks 1 and 5.
- Migration of core read and polling consumers: covered by Tasks 3 and 4.
- Ops documentation for the new model: covered by Task 5.

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” markers remain.
- All steps include exact file paths and concrete commands.
- Commit steps were intentionally replaced with local diff checkpoints to match the current user instruction.

### Type consistency

- Runtime workload type is consistently `RpcWorkload = 'read' | 'poll'`.
- Resolver naming is consistent: `resolveChainRpcUrls`, `resolveLegacyChainRpcFields`.
- Shared registry naming is consistent: `getReadProvider`, `getPollingRpcUrl`, `reportFailure`.
