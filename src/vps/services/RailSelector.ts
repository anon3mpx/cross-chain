// ─────────────────────────────────────────────────────────
// EMPX Cross Chain VPS — Rail Selector Service
// Determines the optimal rail + settlement token for a given route.
// All logic is in-memory — <1ms per call, no I/O.
// ─────────────────────────────────────────────────────────

import { Rail, RailConfig, RailScore, SettlementToken, ChainConfig, CHAIN_ID } from '../types';
import {
  CHAIN_RAILS,
  PLUGIN_ID,
  getChainRails,
  getRailConfig,
} from '../rails/registry';

export { CHAIN_RAILS, PLUGIN_ID };
export const RAIL_CONFIGS: Record<Rail, RailConfig> = Object.values(Rail).reduce((acc, rail) => {
  acc[rail] = getRailConfig(rail);
  return acc;
}, {} as Record<Rail, RailConfig>);

export class RailSelector {

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

    const scores: RailScore[] = candidates.map(rail => {
      const config = RAIL_CONFIGS[rail];
      const settlementToken = this._pickSettlementToken(rail, config, dstChain);
      const requiresTokenHop = settlementToken !== SettlementToken.USDC || !config.nativeUSDC;

      return {
        rail,
        config,
        settlementToken,
        requiresTokenHop,
        score: this._scoreRail(config, settlementToken, amountUSD, urgency),
      };
    });

    // Sort descending by score
    return scores.sort((a, b) => b.score - a.score);
  }

  /// @notice Pick the most appropriate settlement token for a given rail + destination.
  private _pickSettlementToken(
    rail: Rail,
    config: RailConfig,
    dstChain: ChainConfig,
  ): SettlementToken {
    // Native BTC/SOL destinations — settlement IS the native asset
    if (dstChain.chainId === CHAIN_ID.BTC  && config.supportsBTC) return SettlementToken.BTC;
    if (dstChain.chainId === CHAIN_ID.SOL  && config.supportsSOL) return SettlementToken.SOL;
    if (dstChain.chainId === CHAIN_ID.DOGE) return SettlementToken.ETH; // THORChain uses ETH→DOGE
    // Destination prefers USDT (e.g. Plasma, Tron-adjacent)
    if (dstChain.nativeStable === SettlementToken.USDT && config.supportsUSDT) return SettlementToken.USDT;
    // CCTP: USDC only
    if (rail === Rail.CCTP) return SettlementToken.USDC;
    // Default preference: USDC > ETH
    if (config.supportsUSDC) return SettlementToken.USDC;
    if (config.supportsETH)  return SettlementToken.ETH;
    return SettlementToken.USDC;
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
    token: SettlementToken,
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
    const nativeBonus = (config.nativeUSDC && token === SettlementToken.USDC) ? 1.30 : 1.0;

    // ── Reliability amplifier: doubles in weight above $5k (SLA protection) ─
    const reliabilityWeight = amountUSD > 5_000 ? config.reliabilityScore ** 3 : config.reliabilityScore;

    return (costScore * costWeight + speedScore * speedWeight) * reliabilityWeight * nativeBonus;
  }
}
