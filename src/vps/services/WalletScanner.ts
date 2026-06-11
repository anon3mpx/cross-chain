import { Contract, ZeroAddress } from 'ethers';
import type { ExecutionContext } from '../core/ExecutionContext';
import type { RpcProviderRegistry } from './RpcProviderRegistry';

const ERC20_READ_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

export const NATIVE_PLACEHOLDER = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

export interface ScannedBalance {
  chainId: number;
  token: string;
  symbol?: string;
  decimals: number;
  balance: string;
  balanceUsd?: number;
}

export interface ScanRequest {
  wallet: string;
  chainIds: number[];
  tokensByChain?: Record<number, string[]>;
}

export interface ScanResult {
  wallet: string;
  scannedAt: number;
  balances: ScannedBalance[];
  skipped: Array<{ chainId: number; reason: string }>;
}

export interface WalletScannerOptions {
  registry: RpcProviderRegistry;
  perChainTimeoutMs?: number;
  maxTokensPerChain?: number;
}

interface CuratedChain {
  native: { symbol: string; decimals: number };
  erc20s: string[];
}

let CURATED_CACHE: Map<number, CuratedChain | null> | null = null;

export class WalletScanner {
  private readonly registry: RpcProviderRegistry;
  private readonly perChainTimeoutMs: number;
  private readonly maxTokensPerChain: number;

  constructor(opts: WalletScannerOptions) {
    this.registry = opts.registry;
    this.perChainTimeoutMs = opts.perChainTimeoutMs ?? 10_000;
    this.maxTokensPerChain = opts.maxTokensPerChain ?? 50;
  }

  async scan(req: ScanRequest, ctx: ExecutionContext): Promise<ScanResult> {
    const skipped: ScanResult['skipped'] = [];
    const balances: ScannedBalance[] = [];

    await Promise.allSettled(req.chainIds.map(async (chainId) => {
      const curated = curatedTokensFor(chainId);
      if (!curated && !(req.tokensByChain?.[chainId]?.length)) {
        skipped.push({ chainId, reason: 'no curated token list for this chain and no tokens supplied' });
        return;
      }

      const extra = (req.tokensByChain?.[chainId] ?? []).filter((token) => /^0x[0-9a-fA-F]{40}$/.test(token));
      const tokens = dedupeAddresses([
        ...(curated?.erc20s ?? []),
        ...extra,
      ]).slice(0, this.maxTokensPerChain);

      try {
        const chainBalances = await this.scanOneChain(chainId, req.wallet, tokens, curated?.native, ctx);
        balances.push(...chainBalances);
      } catch (error) {
        skipped.push({
          chainId,
          reason: error instanceof Error ? error.message : 'scan failed',
        });
      }
    }));

    return {
      wallet: req.wallet,
      scannedAt: Date.now(),
      balances: balances.filter((entry) => entry.balance !== '0'),
      skipped,
    };
  }

  private async scanOneChain(
    chainId: number,
    wallet: string,
    tokens: string[],
    nativeMeta: { symbol: string; decimals: number } | undefined,
    ctx: ExecutionContext,
  ): Promise<ScannedBalance[]> {
    const provider = this.registry.getProvider(chainId, ctx).asEthersProvider();
    const out: ScannedBalance[] = [];
    const deadline = Date.now() + this.perChainTimeoutMs;
    const beforeDeadline = () => Date.now() < deadline;

    if (nativeMeta && beforeDeadline()) {
      try {
        const balance = await provider.getBalance(wallet);
        if (balance > 0n) {
          out.push({
            chainId,
            token: NATIVE_PLACEHOLDER,
            symbol: nativeMeta.symbol,
            decimals: nativeMeta.decimals,
            balance: balance.toString(),
          });
        }
      } catch {
        // Ignore native read errors and keep scanning.
      }
    }

    await Promise.allSettled(tokens.map(async (token) => {
      if (!beforeDeadline()) return;
      try {
        const contract = new Contract(token, ERC20_READ_ABI, provider);
        const [balance, symbol, decimals] = await Promise.all([
          contract.balanceOf(wallet) as Promise<bigint>,
          (contract.symbol() as Promise<string>).catch(() => undefined),
          (contract.decimals() as Promise<bigint | number>).catch(() => 18),
        ]);
        if (balance > 0n) {
          out.push({
            chainId,
            token,
            symbol,
            decimals: Number(decimals),
            balance: balance.toString(),
          });
        }
      } catch {
        // Ignore per-token read failures and return the successful subset.
      }
    }));

    return out;
  }
}

function curatedTokensFor(chainId: number): CuratedChain | undefined {
  if (!CURATED_CACHE) {
    CURATED_CACHE = new Map();
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sdk = require('empx-swap-sdk-beta');
      const chains = sdk.getAllChains?.() ?? [];
      for (const info of chains) {
        const erc20s = dedupeAddresses([
          info.WRAPPED_NATIVE,
          ...(info.STABLE_TOKENS ?? []),
          ...(info.TRUSTED_TOKENS ?? []),
        ].filter((value: unknown) => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value as string)));
        CURATED_CACHE.set(Number(info.chainId), {
          native: {
            symbol: info.nativeCurrency?.symbol ?? 'NATIVE',
            decimals: info.nativeCurrency?.decimals ?? 18,
          },
          erc20s,
        });
      }
    } catch {
      // Optional dependency in tests/partial deployments.
    }
  }
  return CURATED_CACHE.get(chainId) ?? undefined;
}

function dedupeAddresses(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = value.toLowerCase();
    if (normalized === ZeroAddress.toLowerCase()) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(value);
  }
  return out;
}
