// ─────────────────────────────────────────────────────────
// EMPX Cross Chain VPS — Rail Selector Service
// Determines the optimal rail + settlement token for a given route.
// All logic is in-memory — <1ms per call, no I/O.
// ─────────────────────────────────────────────────────────

import { Rail, RailConfig, RailScore, SettlementToken, ChainConfig, CHAIN_ID } from '../types';
import { RAIL_SETTLEMENT_ASSET_ALLOWLISTS } from '../config/routeExecution';
import { type DeploymentRegistry } from './DeploymentRegistry';
import { StaticRouteAssetPolicy, type RouteAssetPolicy } from './RouteAssetPolicy';
import {
  CHAIN_RAILS,
  PLUGIN_ID,
  RAIL_PROVIDERS,
  getChainRails,
} from '../rails/registry';

export { CHAIN_RAILS, PLUGIN_ID };
export const RAIL_CONFIGS: Partial<Record<Rail, RailConfig>> = Object.values(RAIL_PROVIDERS).reduce((acc, provider) => {
  acc[provider.rail] = provider.config;
  return acc;
}, {} as Partial<Record<Rail, RailConfig>>);

export class RailSelector {
  constructor(
    private readonly routeAssetPolicy: RouteAssetPolicy = new StaticRouteAssetPolicy(RAIL_SETTLEMENT_ASSET_ALLOWLISTS),
    private readonly deploymentRegistry?: DeploymentRegistry,
  ) {}

  /// @notice Select the best rail + settlement token for a given chain pair.
  /// @param srcChainId Source EVM chain ID
  /// @param dstChainId Destination EVM chain ID
  /// @param dstChain   Destination chain config (to check nativeStable preference)
  /// @param amountUSD  Transfer amount in USD (affects fee weight)
  /// @param urgency    'fast' | 'normal' — shifts speed vs cost weighting
  /// @returns Ranked list of rail options (best first), or empty if no route
  selectRail(
    srcChainId: number,
    dstChainId: number,
    dstChain: ChainConfig,
    amountUSD: number,
    urgency: 'fast' | 'normal' = 'normal',
  ): RailScore[] {
    const srcRails = new Set(getChainRails(srcChainId));
    const dstRails = new Set(getChainRails(dstChainId));

    // Only rails that serve BOTH chains
    const candidates = [...srcRails].filter(r => dstRails.has(r));
    if (candidates.length === 0) return [];

    const scores: RailScore[] = [];
    for (const rail of candidates) {
      if (this.deploymentRegistry && !this.deploymentRegistry.isExecutable(rail, srcChainId, dstChainId)) {
        continue;
      }

      const config = RAIL_CONFIGS[rail];
      if (!config) continue;
      for (const routeAssetAlias of this.routeAssetPolicy.allowedAssets(rail)) {
        const settlementToken = this._settlementTokenForRouteAssetAlias(routeAssetAlias);
        if (!settlementToken) continue;
        if (!this._supportsRouteAssetAlias(config, routeAssetAlias, dstChain)) continue;

        scores.push({
          rail,
          config,
          routeAssetAlias,
          settlementToken,
          requiresTokenHop: routeAssetAlias.toUpperCase() !== 'USDC' || !config.nativeUSDC,
          score: this._scoreRail(config, routeAssetAlias, amountUSD, urgency),
        });
      }
    }

    // Sort descending for display/routing order while preserving every viable rail.
    return scores.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      if (a.config.etaSeconds !== b.config.etaSeconds) return a.config.etaSeconds - b.config.etaSeconds;
      return a.config.fee - b.config.fee;
    });
  }

  private _supportsRouteAssetAlias(
    config: RailConfig,
    routeAssetAlias: string,
    dstChain: ChainConfig,
  ): boolean {
    const normalized = routeAssetAlias.trim().toUpperCase();

    // Native BTC/SOL destinations — settlement IS the native asset
    if (normalized === 'BTC' || normalized === 'BTC.BTC') {
      return dstChain.chainId === CHAIN_ID.BTC ? config.supportsBTC : config.supportsBTC;
    }
    if (normalized === 'SOL' || normalized === 'SOL.SOL') {
      return dstChain.chainId === CHAIN_ID.SOL ? config.supportsSOL : config.supportsSOL;
    }
    if (normalized === 'DOGE' || normalized === 'DOGE.DOGE') {
      return config.supportsETH;
    }
    if (normalized === 'USDT') return config.supportsUSDT;
    if (normalized === 'ETH' || normalized === 'WETH' || normalized === 'ETH.ETH') return config.supportsETH;
    if (normalized === 'USDC') return config.supportsUSDC;
    return false;
  }

  private _settlementTokenForRouteAssetAlias(routeAssetAlias: string): SettlementToken | null {
    switch (routeAssetAlias.trim().toUpperCase()) {
      case 'USDC':
        return SettlementToken.USDC;
      case 'USDT':
        return SettlementToken.USDT;
      case 'ETH':
      case 'WETH':
      case 'ETH.ETH':
      case 'DOGE':
      case 'DOGE.DOGE':
        return SettlementToken.ETH;
      case 'BTC':
      case 'BTC.BTC':
        return SettlementToken.BTC;
      case 'SOL':
      case 'SOL.SOL':
        return SettlementToken.SOL;
      default:
        return null;
    }
  }

  // ── TODO: Implement your scoring logic here ────────────────────────────────
  //
  // This is the heart of the rail selector. It decides which rail wins when
  // multiple options are available for the same chain pair.
  //
  // Parameters you have:
  //   config      - Rail config (fee, etaSeconds, nativeUSDC, reliabilityScore)
  //   token       - Which settlement token was chosen
  //   amountUSD   - Transfer size in USD
  //   urgency     - 'fast' or 'normal'
  //
  // Things to consider:
  //   - At small amounts (<$50), fee dominates → CCTP always wins
  //   - At large amounts (>$10k), reliability matters more than $0.25 fee diff
  //   - 'fast' urgency should heavily penalize slow rails (etaSeconds weight)
  //   - Native USDC (CCTP) should get a bonus — no wrapped token risk
  //   - Wrapped stablecoins (axlUSDC) carry smart contract risk → small penalty
  //   - reliabilityScore historical data should factor in (SLA protection)
  //
  // Return a number — higher is better. No fixed range required.
  //
  _scoreRail(
    config: RailConfig,
    routeAssetAlias: string,
    amountUSD: number,
    urgency: 'fast' | 'normal',
  ): number {
    // ── Weights shift based on urgency ─────────────────────────────────────
    const costWeight  = urgency === 'fast' ? 0.4 : 1.8;
    const speedWeight = urgency === 'fast' ? 2.5 : 0.6;

    // ── Cost score: fee as a fraction of transfer size ─────────────────────
    // At $10 transfer, $0.25 fee = 2.5% — painful. At $1000, it's 0.025% — irrelevant.
    // We normalise so cost only dominates on small transfers.
    const feePct   = config.fee / Math.max(amountUSD, 1);  // 0–1 range on small txs
    const costScore = 1 / (feePct + 0.001);                // higher = cheaper relative to amount

    // ── Speed score: inverse ETA (etaSeconds is already chain-aware via estimateFee) ──
    const speedScore = 1000 / config.etaSeconds;

    // ── Native USDC bonus: avoid wrapped token risk (axlUSDC has depegged before) ──
    const nativeBonus = (config.nativeUSDC && routeAssetAlias.trim().toUpperCase() === 'USDC') ? 1.30 : 1.0;

    // ── Reliability amplifier: doubles in weight above $5k (SLA protection) ─
    const reliabilityWeight = amountUSD > 5_000 ? config.reliabilityScore ** 3 : config.reliabilityScore;

    return (costScore * costWeight + speedScore * speedWeight) * reliabilityWeight * nativeBonus;
  }
}
