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
    this.providerFactory = options.providerFactory
      ?? ((rpcUrl, chainId) => new JsonRpcProvider(rpcUrl, chainId, {
        staticNetwork: true,
      }));
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
