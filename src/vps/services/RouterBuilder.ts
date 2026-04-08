// ─────────────────────────────────────────────────────────
// EMPX Cross Chain VPS — Route Builder
//
// Builds all candidate routes for a cross-chain swap, handling four scenarios:
//
//  Scenario A — FULL_SWAP:   agg on src AND dst
//    tokenIn → (src agg) → settlementToken → (rail) → settlementToken → (dst agg) → tokenOut
//
//  Scenario B — SRC_SWAP:    agg on src only
//    tokenIn → (src agg) → settlementToken → (rail) → deliver settlementToken
//
//  Scenario C — DST_SWAP:    agg on dst only
//    provide settlementToken → (rail) → settlementToken → (dst agg) → tokenOut
//
//  Scenario D — BRIDGE_ONLY: no agg on either side
//    provide settlementToken → (rail) → receive settlementToken
//
//  Hub-Hop: when no single rail covers src→dst, find an intermediate hub chain
//    that bridges the gap. The hub must have our aggregator to convert between
//    settlement tokens if the two legs use different ones.
//
//  All messaging-rail routes are evaluated in parallel with THORChain routes.
// ─────────────────────────────────────────────────────────

import {
  Rail, SettlementToken, Route, RouteType, Hop, CHAIN_ID, LIQUIDITY_RAILS,
} from '../types';
import { RAIL_CONFIGS, CHAIN_RAILS, RailSelector } from './RailSelector';
import { getChainConfig, hasAggregator, HUB_CHAIN_IDS } from '../config/chains';

// ── Settlement token compatibility matrix ─────────────────────────────────────
// When two consecutive hops use different settlement tokens on the hub,
// the hub aggregator must bridge them. This map defines which conversions are
// trivially possible (same stablecoin family) vs require a DEX swap.
const SAME_FAMILY: Partial<Record<SettlementToken, SettlementToken[]>> = {
  [SettlementToken.USDC]: [SettlementToken.USDT], // USDC ↔ USDT via Curve/Uniswap
  [SettlementToken.USDT]: [SettlementToken.USDC],
};

function settlementsCompatible(a: SettlementToken, b: SettlementToken): boolean {
  if (a === b) return true;
  return SAME_FAMILY[a]?.includes(b) ?? false;
}

// ── Route scoring ──────────────────────────────────────────────────────────────
// Composite score for the full route (all hops combined).
// Multi-hop routes are penalised for added complexity and latency.
function scoreRoute(
  totalFeeUSD: number,
  totalEtaSeconds: number,
  reliabilityProduct: number,
  hopCount: number,
  urgency: 'fast' | 'normal',
  amountUSD: number,
): number {
  const costWeight  = urgency === 'fast' ? 0.4 : 1.8;
  const speedWeight = urgency === 'fast' ? 2.5 : 0.6;
  const hopPenalty  = hopCount > 1 ? 0.75 : 1.0; // 25% penalty for each extra hop

  const feePct    = totalFeeUSD / Math.max(amountUSD, 1);
  const costScore  = 1 / (feePct + 0.001);
  const speedScore = 1000 / totalEtaSeconds;
  const relWeight  = amountUSD > 5_000 ? reliabilityProduct ** 2 : reliabilityProduct;

  return (costScore * costWeight + speedScore * speedWeight) * relWeight * hopPenalty;
}

// ── RouteBuilder ───────────────────────────────────────────────────────────────

export class RouteBuilder {
  private readonly selector = new RailSelector();

  /**
   * Build and rank all viable routes for a given chain pair.
   *
   * Returns routes sorted by score (best first).
   * Includes both messaging-rail and THORChain routes, evaluated in parallel.
   *
   * @param srcChainId  Source chain ID
   * @param dstChainId  Destination chain ID
   * @param amountUSD   Transfer amount in USD (affects scoring)
   * @param urgency     'fast' | 'normal'
   */
  buildRoutes(
    srcChainId: number,
    dstChainId: number,
    amountUSD: number,
    urgency: 'fast' | 'normal' = 'normal',
  ): Route[] {
    // All route builders run "in parallel" — synchronous but evaluated together
    // before any filtering, mirroring what async parallel queries would do.
    const candidates: Route[] = [
      ...this._buildDirectRoutes(srcChainId, dstChainId, amountUSD, urgency),
      ...this._buildHubHopRoutes(srcChainId, dstChainId, amountUSD, urgency),
    ];

    // Deduplicate: same rail sequence + route type → keep best score
    const seen = new Map<string, Route>();
    for (const r of candidates) {
      const key = r.hops.map(h => `${h.rail}:${h.srcChainId}>${h.dstChainId}`).join('|') + `|${r.routeType}`;
      const existing = seen.get(key);
      if (!existing || r.score > existing.score) seen.set(key, r);
    }

    return [...seen.values()].sort((a, b) => {
      // Viable routes rank above non-viable
      if (a.viable !== b.viable) return a.viable ? -1 : 1;
      return b.score - a.score;
    });
  }

  // ── Direct routes (single hop) ──────────────────────────────────────────────

  private _buildDirectRoutes(
    srcChainId: number,
    dstChainId: number,
    amountUSD: number,
    urgency: 'fast' | 'normal',
  ): Route[] {
    const srcRails = new Set(CHAIN_RAILS[srcChainId] ?? []);
    const dstRails = new Set(CHAIN_RAILS[dstChainId] ?? []);
    const shared   = [...srcRails].filter(r => dstRails.has(r));

    if (shared.length === 0) return [];

    const srcChain = getChainConfig(srcChainId);
    const dstChain = getChainConfig(dstChainId);
    const srcHasAgg = hasAggregator(srcChainId);
    const dstHasAgg = hasAggregator(dstChainId);
    const routeType = this._classifyRouteType(srcHasAgg, dstHasAgg);

    return shared.map(rail => {
      const config    = RAIL_CONFIGS[rail];
      const dstCfg    = dstChain ?? { chainId: dstChainId, nativeStable: SettlementToken.USDC } as any;
      const railScore = this.selector.selectRail(srcChainId, dstChainId, dstCfg, amountUSD, urgency)
                            .find(s => s.rail === rail);

      const settlementToken = railScore?.settlementToken ?? SettlementToken.USDC;

      const hop: Hop = {
        rail,
        srcChainId,
        dstChainId,
        settlementTokenIn:  settlementToken,
        settlementTokenOut: settlementToken,
        hubSwapNeeded:      false,
      };

      const score = scoreRoute(
        config.fee,
        config.etaSeconds,
        config.reliabilityScore,
        1,
        urgency,
        amountUSD,
      );

      return {
        hops: [hop],
        routeType,
        srcSwap: srcHasAgg,
        dstSwap: dstHasAgg,
        totalFeeUSD:     config.fee,
        totalEtaSeconds: config.etaSeconds,
        score,
        viable: true,
      } satisfies Route;
    });
  }

  // ── Hub-hop routes (two hops via intermediate chain) ────────────────────────
  //
  // Used when:
  //   a) No single rail covers both src and dst, OR
  //   b) A better score is achievable by combining two specialised rails
  //
  // Hub selection:
  //   - Hub must have at least one shared rail with src (leg 1)
  //   - Hub must have at least one shared rail with dst (leg 2)
  //   - If settlement tokens differ across legs, hub MUST have our aggregator
  //
  private _buildHubHopRoutes(
    srcChainId: number,
    dstChainId: number,
    amountUSD: number,
    urgency: 'fast' | 'normal',
  ): Route[] {
    const routes: Route[] = [];

    const srcRails = new Set(CHAIN_RAILS[srcChainId] ?? []);
    const dstRails = new Set(CHAIN_RAILS[dstChainId] ?? []);

    for (const hubId of HUB_CHAIN_IDS) {
      if (hubId === srcChainId || hubId === dstChainId) continue;

      const hubRails  = new Set(CHAIN_RAILS[hubId] ?? []);
      const leg1Rails = [...srcRails].filter(r => hubRails.has(r));
      const leg2Rails = [...hubRails].filter(r => dstRails.has(r));

      if (leg1Rails.length === 0 || leg2Rails.length === 0) continue;

      const hubHasAgg  = hasAggregator(hubId);
      const srcHasAgg  = hasAggregator(srcChainId);
      const dstHasAgg  = hasAggregator(dstChainId);
      const routeType  = this._classifyRouteType(srcHasAgg, dstHasAgg);
      const hubCfg     = getChainConfig(hubId) ?? { chainId: hubId, nativeStable: SettlementToken.USDC } as any;
      const dstCfg     = getChainConfig(dstChainId) ?? { chainId: dstChainId, nativeStable: SettlementToken.USDC } as any;

      // Evaluate best combination of leg1 × leg2 rails
      for (const r1 of leg1Rails) {
        for (const r2 of leg2Rails) {
          // Prefer not using the same rail twice (redundant)
          const c1 = RAIL_CONFIGS[r1];
          const c2 = RAIL_CONFIGS[r2];

          // Pick settlement tokens for each leg independently
          const leg1Scores = this.selector.selectRail(srcChainId, hubId, hubCfg, amountUSD, urgency);
          const leg2Scores = this.selector.selectRail(hubId, dstChainId, dstCfg, amountUSD, urgency);

          const st1 = leg1Scores.find(s => s.rail === r1)?.settlementToken ?? SettlementToken.USDC;
          const st2 = leg2Scores.find(s => s.rail === r2)?.settlementToken ?? SettlementToken.USDC;

          // If settlement tokens differ across legs, hub aggregator must convert
          const tokenMismatch  = st1 !== st2;
          const hubSwapNeeded  = tokenMismatch;

          // A token mismatch without a hub aggregator makes the route non-viable
          const viable = tokenMismatch ? (hubHasAgg && settlementsCompatible(st1, st2)) : true;
          const reason = !viable
            ? `Hub ${hubId} has no aggregator to convert ${st1}→${st2}`
            : undefined;

          const hop1: Hop = {
            rail: r1, srcChainId, dstChainId: hubId,
            settlementTokenIn: st1, settlementTokenOut: st1,
            hubSwapNeeded: false,
          };
          const hop2: Hop = {
            rail: r2, srcChainId: hubId, dstChainId,
            settlementTokenIn: st1, settlementTokenOut: st2,
            hubSwapNeeded,
          };

          const totalFee = c1.fee + c2.fee;
          const totalEta = c1.etaSeconds + c2.etaSeconds +
            (hubHasAgg && hubSwapNeeded ? 15 : 0); // ~15s for hub swap
          const reliability = c1.reliabilityScore * c2.reliabilityScore;

          const score = scoreRoute(totalFee, totalEta, reliability, 2, urgency, amountUSD);

          routes.push({
            hops: [hop1, hop2],
            routeType,
            srcSwap: srcHasAgg,
            dstSwap: dstHasAgg,
            totalFeeUSD:     totalFee,
            totalEtaSeconds: totalEta,
            score,
            viable,
            reason,
          });
        }
      }
    }

    return routes;
  }

  // ── Route type classification ────────────────────────────────────────────────

  private _classifyRouteType(srcHasAgg: boolean, dstHasAgg: boolean): RouteType {
    if  (srcHasAgg && dstHasAgg)  return RouteType.FULL_SWAP;
    if  (srcHasAgg && !dstHasAgg) return RouteType.SRC_SWAP;
    if  (!srcHasAgg && dstHasAgg) return RouteType.DST_SWAP;
    return RouteType.BRIDGE_ONLY;
  }

  // ── Convenience: best single route ──────────────────────────────────────────

  /** Returns the single best viable route, or undefined if no path exists. */
  bestRoute(
    srcChainId: number,
    dstChainId: number,
    amountUSD: number,
    urgency: 'fast' | 'normal' = 'normal',
  ): Route | undefined {
    return this.buildRoutes(srcChainId, dstChainId, amountUSD, urgency)
               .find(r => r.viable);
  }

  /**
   * Describes what the user will experience for a given route type.
   * Useful for SDK messaging and UI hints.
   */
  describeRoute(route: Route): string {
    const hops = route.hops.length === 1 ? 'direct' : `via hub (${route.hops.length} legs)`;
    const rail = route.hops.map(h => h.rail).join(' → ');
    switch (route.routeType) {
      case RouteType.FULL_SWAP:
        return `Full swap [${hops}] via ${rail}: any token in → any token out`;
      case RouteType.SRC_SWAP:
        return `Source swap [${hops}] via ${rail}: any token in → deliver ${route.hops[route.hops.length - 1].settlementTokenOut}`;
      case RouteType.DST_SWAP:
        return `Destination swap [${hops}] via ${rail}: provide ${route.hops[0].settlementTokenIn} → any token out`;
      case RouteType.BRIDGE_ONLY:
        return `Bridge only [${hops}] via ${rail}: provide ${route.hops[0].settlementTokenIn} → receive ${route.hops[route.hops.length - 1].settlementTokenOut}`;
    }
  }
}
