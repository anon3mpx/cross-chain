// ─────────────────────────────────────────────────────────────────────────────
// DestinationGasAutoFund — decides whether to auto-attach a gas.zip leg.
//
// Strategic role (gas integration §B): when a cross-chain swap delivers
// non-native tokens to an address that has zero (or near-zero) native
// balance on the destination chain, the user can't transact afterwards.
// Auto-attach a small gas.zip leg by default so the user has a working
// destination experience.
//
// Decision tree:
//   1. Kill switch:           env DISABLE_AUTO_FUND_DESTINATION_GAS=1  → skip
//   2. Caller opt-in absent:  req.autoFundDestinationGas missing       → skip
//   3. Explicit gas already:  caller passed destinationGas[] for this chain → skip (caller wins)
//   4. Destination is source: same-chain swap                          → skip
//   5. Source token is native: user already paying gas in native       → skip
//   6. Balance check:         destination native balance > thresholdUsd → skip
//   7. Cap:                   topUpUsd <= AUTO_FUND_MAX_TOPUP_USD       → clamp
//   else: emit a DestinationGasRequest entry.
//
// Returns the FULL effective destinationGas[] (caller-supplied + auto-added)
// so the QuoteEngine can be invoked unchanged.
// ─────────────────────────────────────────────────────────────────────────────

import type { ExecutionContext } from '../core/ExecutionContext';
import type { RpcProviderRegistry } from './RpcProviderRegistry';
import type { DestinationGasDecision, DestinationGasRequest, QuoteRequest } from '../types';
import type { NativeUsdOracle } from './NativeUsdOracle';

const NATIVE_SENTINEL_ADDRS = new Set([
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  '0x0000000000000000000000000000000000000000',
]);

export interface AutoFundDeps {
  registry: RpcProviderRegistry;
  /**
   * Live native-USD price source.  When provided, replaces the static
   * fallback table.  See `NativeUsdOracle` — stale-while-revalidate, lean
   * on RPC, falls back to internal static defaults on RPC failure.
   */
  oracle?: NativeUsdOracle;
  /** Override the static fallback price table (used when oracle is absent
   *  or its refresh fails).  Defaults to the internal STATIC_NATIVE_USD. */
  staticNativeUsd?: (chainId: number) => Promise<number> | number;
  env?: Record<string, string | undefined>;
}

export interface DestinationGasResolution {
  destinationGas: DestinationGasRequest[];
  decision: DestinationGasDecision;
}

/** Coarse static native-USD table.  Refresh quarterly or wire a real
 *  oracle.  Values are deliberately conservative — overestimating the
 *  USD value means we top up LESS native (safer for the user's wallet). */
const STATIC_NATIVE_USD: Record<number, number> = {
  1:        3_000, // ETH
  10:       3_000, // OP — ETH gas
  56:         600, // BSC — BNB
  137:        0.4, // Polygon — MATIC
  8453:    3_000, // Base — ETH gas
  42161:   3_000, // Arbitrum — ETH gas
  43114:      30, // Avalanche — AVAX
  43113:      30, // Avalanche Fuji
  534352:  3_000, // Scroll — ETH gas
  324:     3_000, // zkSync Era — ETH gas
  59144:   3_000, // Linea — ETH gas
  5000:        0.5, // Mantle — MNT
  34443:   3_000, // Mode — ETH gas
  81457:   3_000, // Blast — ETH gas
  369:       0.00005, // PulseChain — PLS
};

export class DestinationGasAutoFund {
  private readonly registry: RpcProviderRegistry;
  private readonly oracle?: NativeUsdOracle;
  private readonly staticNativeUsd: (chainId: number) => Promise<number> | number;
  private readonly env: Record<string, string | undefined>;

  constructor(deps: AutoFundDeps) {
    this.registry = deps.registry;
    this.oracle = deps.oracle;
    this.staticNativeUsd = deps.staticNativeUsd ?? (async (id) => STATIC_NATIVE_USD[id] ?? 0);
    this.env = deps.env ?? process.env;
  }

  /**
   * Returns the destinationGas[] to pass to QuoteEngine.  Always includes
   * the caller's explicit entries verbatim; may append at most one
   * auto-attach entry per (dstChainId, recipient) pair.
   */
  async resolve(req: QuoteRequest, ctx: ExecutionContext): Promise<DestinationGasRequest[]> {
    return (await this.resolveDetailed(req, ctx)).destinationGas;
  }

  async resolveDetailed(req: QuoteRequest, ctx: ExecutionContext): Promise<DestinationGasResolution> {
    const explicit = req.destinationGas ?? [];
    const opts = req.autoFundDestinationGas;
    const requested = !!opts;
    const recipient = opts?.recipient ?? req.userAddress;

    if (!this.envBool('ENABLE_AUTO_FUND_DESTINATION_GAS', false)) {
      return this.finish(explicit, {
        provider: 'gaszip',
        requested,
        outcome: 'feature_disabled',
        recipient,
      });
    }

    // 1. Kill switch
    if (this.envBool('DISABLE_AUTO_FUND_DESTINATION_GAS', false)) {
      return this.finish(explicit, {
        provider: 'gaszip',
        requested,
        outcome: 'kill_switch',
        recipient,
      });
    }

    // 2. Caller opt-in
    if (!opts) {
      return this.finish(explicit, {
        provider: 'gaszip',
        requested: false,
        outcome: 'no_opt_in',
        recipient,
      });
    }

    // 4. Same chain — gas.zip doesn't apply
    if (req.srcChainId === req.dstChainId) {
      return this.finish(explicit, {
        provider: 'gaszip',
        requested,
        outcome: 'same_chain',
        recipient,
      });
    }

    // 5. Source token is native — user is already paying gas in native, no top-up needed
    if (NATIVE_SENTINEL_ADDRS.has(req.tokenIn.toLowerCase())) {
      return this.finish(explicit, {
        provider: 'gaszip',
        requested,
        outcome: 'source_token_native',
        recipient,
      });
    }

    // 3. Explicit entry for this chain already exists — caller wins
    const chainHasExplicit = explicit.some((e) => e.chainId === req.dstChainId);
    if (chainHasExplicit) {
      return this.finish(explicit, {
        provider: 'gaszip',
        requested,
        outcome: 'explicit_destination_gas',
        recipient,
      });
    }

    // Caps + thresholds
    const thresholdUsd  = opts.thresholdUsd ?? this.envNum('AUTO_FUND_DEFAULT_THRESHOLD_USD', 1.0);
    const requestedUsd  = opts.topUpUsd     ?? this.envNum('AUTO_FUND_DEFAULT_TOPUP_USD',     2.0);
    const maxTopUpUsd   =                    this.envNum('AUTO_FUND_MAX_TOPUP_USD',          10.0);
    const topUpUsd      = Math.min(requestedUsd, maxTopUpUsd);
    if (topUpUsd <= 0) {
      return this.finish(explicit, {
        provider: 'gaszip',
        requested,
        outcome: 'zero_top_up',
        recipient,
        thresholdUsd,
        requestedTopUpUsd: requestedUsd,
        appliedTopUpUsd: topUpUsd,
      });
    }

    // 6. Balance check
    let nativeBalanceWei: bigint;
    try {
      const provider = this.registry.getProvider(req.dstChainId, ctx);
      const raw = await provider.send('eth_getBalance', [recipient, 'latest']);
      nativeBalanceWei = BigInt(String(raw));
    } catch {
      // Balance read failed — fail OPEN (skip auto-attach rather than
      // surprise-charge the user when we can't tell what they have).
      return this.finish(explicit, {
        provider: 'gaszip',
        requested,
        outcome: 'balance_check_failed',
        recipient,
        thresholdUsd,
        requestedTopUpUsd: requestedUsd,
        appliedTopUpUsd: topUpUsd,
      });
    }

    // Prefer live oracle (5-min TTL, stale-while-revalidate); fall back
    // to the static table when the oracle fails or isn't wired.
    const nativeUsd = this.oracle
      ? await this.oracle.nativeUsd(req.dstChainId, ctx).catch(() => 0)
        || await this.staticNativeUsd(req.dstChainId)
      : await this.staticNativeUsd(req.dstChainId);
    if (nativeUsd <= 0) {
      return this.finish(explicit, {
        provider: 'gaszip',
        requested,
        outcome: 'unknown_native_price',
        recipient,
        thresholdUsd,
        requestedTopUpUsd: requestedUsd,
        appliedTopUpUsd: topUpUsd,
      });
    }
    const balanceUsd = Number(nativeBalanceWei) / 1e18 * nativeUsd;
    if (balanceUsd >= thresholdUsd) {
      return this.finish(explicit, {
        provider: 'gaszip',
        requested,
        outcome: 'balance_sufficient',
        recipient,
        thresholdUsd,
        requestedTopUpUsd: requestedUsd,
        appliedTopUpUsd: topUpUsd,
        nativeUsd,
        balanceUsd,
      });
    }

    // Convert topUpUsd → wei (18-decimals assumption for native; chains
    // that use 8-dec native like BTC don't apply here — gas.zip targets
    // EVM destinations only).
    const topUpWei = BigInt(Math.floor((topUpUsd / nativeUsd) * 1e18));
    if (topUpWei <= 0n) {
      return this.finish(explicit, {
        provider: 'gaszip',
        requested,
        outcome: 'zero_top_up',
        recipient,
        thresholdUsd,
        requestedTopUpUsd: requestedUsd,
        appliedTopUpUsd: topUpUsd,
        nativeUsd,
        balanceUsd,
      });
    }

    const autoEntry: DestinationGasRequest = {
      provider: 'gaszip',
      chainId: req.dstChainId,
      amountWei: topUpWei.toString(),
      recipient,
    };
    return this.finish([...explicit, autoEntry], {
      provider: 'gaszip',
      requested,
      outcome: 'auto_attached',
      recipient,
      thresholdUsd,
      requestedTopUpUsd: requestedUsd,
      appliedTopUpUsd: topUpUsd,
      nativeUsd,
      balanceUsd,
    }, [autoEntry]);
  }

  private envBool(key: string, fallback: boolean): boolean {
    const v = this.env[key]?.toLowerCase();
    if (!v) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(v);
  }
  private envNum(key: string, fallback: number): number {
    const v = Number(this.env[key]);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  }

  private finish(
    destinationGas: DestinationGasRequest[],
    decision: Omit<DestinationGasDecision, 'effectiveDestinationGas' | 'autoAdded'>,
    autoAdded: DestinationGasRequest[] = [],
  ): DestinationGasResolution {
    return {
      destinationGas,
      decision: {
        ...decision,
        effectiveDestinationGas: destinationGas,
        autoAdded,
      },
    };
  }
}
