// ─────────────────────────────────────────────────────────────────────────────
// ReliabilityRepository — reads + writes for the `route_outcomes` table.
//
// Strategic role (the moat — notes.txt §"Reliability Database"):
//
//   Every settled / failed / stuck intent yields one row.  Over time this
//   becomes proprietary intelligence: which rails actually deliver, which
//   route signatures (rail × src × dst × tokens) have the best p50 settlement
//   time, where slippage promises break down.  RailSelector reads windowed
//   queries from here instead of relying on static config constants.
//
// This module is deliberately small and DB-only.  It does no transformation
// from Intent → RouteOutcome — that lives in `ReliabilityRecorder` so the
// I/O surface stays separable.
// ─────────────────────────────────────────────────────────────────────────────

import type { Pool, PoolClient } from 'pg';

export interface RouteOutcomeInsert {
  intentId: string;
  routeSignature: string;
  rail: string;
  srcChainId: number;
  dstChainId: number;
  srcToken: string;
  dstToken: string;
  quotedOut?: bigint;
  quotedEtaSeconds?: number;
  quotedFeeUsd?: number;
  actualOut?: bigint;
  actualEtaSeconds?: number;
  actualFeeUsd?: number;
  status: 'SETTLED' | 'FAILED' | 'STUCK';
  failureReason?: string;
  partnerId?: string;
  integratorId?: string;
  agentId?: string;
  routeSource?: string;
  settledAt?: Date;

  // Migration 003 — revenue tier slicing.
  /** 'router_intent' (agg-wired) | 'provider_direct' (api-direct). */
  executionMode?: 'router_intent' | 'provider_direct';
  /** Detailed offer-type family for drill-down. */
  offerType?: string;
}

export interface RailReliabilityStats {
  rail: string;
  total: number;
  settled: number;
  failed: number;
  stuck: number;
  successRate: number;       // 0..1
  p50ActualEtaS: number | null;
  p50QuotedEtaS: number | null;
  meanSlippageBps: number | null;  // average (quotedOut - actualOut) / quotedOut * 10000
}

export interface ReliabilityRepository {
  insert(row: RouteOutcomeInsert, client?: PoolClient): Promise<void>;
  /** Aggregate stats per rail over the trailing window. */
  windowedRailStats(windowMs: number): Promise<RailReliabilityStats[]>;
  /** Stats for one route signature.  Returns null if no samples. */
  windowedRouteStats(routeSignature: string, windowMs: number): Promise<RailReliabilityStats | null>;
  /** Revenue-tier slice — agg-wired vs api-direct. */
  windowedTierStats(windowMs: number): Promise<Array<{
    executionMode: string;
    total: number;
    settled: number;
    failed: number;
    stuck: number;
    successRate: number;
  }>>;
}

export class PostgresReliabilityRepository implements ReliabilityRepository {
  constructor(private readonly pool: Pool) {}

  async insert(row: RouteOutcomeInsert, client?: PoolClient): Promise<void> {
    const q = `
      INSERT INTO route_outcomes (
        intent_id, route_signature, rail, src_chain_id, dst_chain_id,
        src_token, dst_token,
        quoted_out, quoted_eta_s, quoted_fee_usd,
        actual_out, actual_eta_s, actual_fee_usd,
        status, failure_reason,
        partner_id, integrator_id, agent_id, route_source,
        settled_at,
        execution_mode, offer_type
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,
        $8,$9,$10,
        $11,$12,$13,
        $14,$15,
        $16,$17,$18,$19,
        $20,
        $21,$22
      )
    `;
    const params = [
      row.intentId,
      row.routeSignature,
      row.rail,
      row.srcChainId,
      row.dstChainId,
      row.srcToken,
      row.dstToken,
      row.quotedOut !== undefined ? row.quotedOut.toString() : null,
      row.quotedEtaSeconds ?? null,
      row.quotedFeeUsd ?? null,
      row.actualOut !== undefined ? row.actualOut.toString() : null,
      row.actualEtaSeconds ?? null,
      row.actualFeeUsd ?? null,
      row.status,
      row.failureReason ?? null,
      row.partnerId ?? null,
      row.integratorId ?? null,
      row.agentId ?? null,
      row.routeSource ?? null,
      row.settledAt ?? null,
      row.executionMode ?? null,
      row.offerType ?? null,
    ];
    const exec = client ?? this.pool;
    await exec.query(q, params);
  }

  /**
   * Revenue-tier slice — settled/failed/stuck counts and success-rate split
   * by execution_mode (agg-wired vs api-direct).  Powers the
   * /admin/reliability tier=true response.
   */
  async windowedTierStats(windowMs: number): Promise<Array<{
    executionMode: string;
    total: number;
    settled: number;
    failed: number;
    stuck: number;
    successRate: number;
  }>> {
    const q = `
      WITH win AS (
        SELECT * FROM route_outcomes
        WHERE observed_at > NOW() - ($1::bigint * INTERVAL '1 millisecond')
      )
      SELECT
        COALESCE(execution_mode, 'unknown')                    AS execution_mode,
        COUNT(*)::int                                          AS total,
        COUNT(*) FILTER (WHERE status = 'SETTLED')::int        AS settled,
        COUNT(*) FILTER (WHERE status = 'FAILED' )::int        AS failed,
        COUNT(*) FILTER (WHERE status = 'STUCK'  )::int        AS stuck
      FROM win
      GROUP BY 1
      ORDER BY total DESC
    `;
    const res = await this.pool.query(q, [windowMs.toString()]);
    return res.rows.map((r) => ({
      executionMode: r.execution_mode,
      total: r.total,
      settled: r.settled,
      failed: r.failed,
      stuck: r.stuck,
      successRate: r.total > 0 ? r.settled / r.total : 0,
    }));
  }

  async windowedRailStats(windowMs: number): Promise<RailReliabilityStats[]> {
    const q = `
      WITH win AS (
        SELECT * FROM route_outcomes
        WHERE observed_at > NOW() - ($1::bigint * INTERVAL '1 millisecond')
      )
      SELECT
        rail,
        COUNT(*)::int                                                AS total,
        COUNT(*) FILTER (WHERE status = 'SETTLED')::int              AS settled,
        COUNT(*) FILTER (WHERE status = 'FAILED' )::int              AS failed,
        COUNT(*) FILTER (WHERE status = 'STUCK'  )::int              AS stuck,
        PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY actual_eta_s)    AS p50_actual_eta_s,
        PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY quoted_eta_s)    AS p50_quoted_eta_s,
        AVG(
          CASE
            WHEN quoted_out IS NULL OR actual_out IS NULL OR quoted_out = 0 THEN NULL
            ELSE (quoted_out - actual_out) * 10000.0 / quoted_out
          END
        )::double precision                                          AS mean_slip_bps
      FROM win
      GROUP BY rail
      ORDER BY total DESC
    `;
    const res = await this.pool.query(q, [windowMs.toString()]);
    return res.rows.map((r) => ({
      rail: r.rail,
      total: r.total,
      settled: r.settled,
      failed: r.failed,
      stuck: r.stuck,
      successRate: r.total > 0 ? r.settled / r.total : 0,
      p50ActualEtaS: r.p50_actual_eta_s !== null ? Number(r.p50_actual_eta_s) : null,
      p50QuotedEtaS: r.p50_quoted_eta_s !== null ? Number(r.p50_quoted_eta_s) : null,
      meanSlippageBps: r.mean_slip_bps !== null ? Number(r.mean_slip_bps) : null,
    }));
  }

  async windowedRouteStats(routeSignature: string, windowMs: number): Promise<RailReliabilityStats | null> {
    const q = `
      SELECT
        rail,
        COUNT(*)::int                                              AS total,
        COUNT(*) FILTER (WHERE status = 'SETTLED')::int            AS settled,
        COUNT(*) FILTER (WHERE status = 'FAILED' )::int            AS failed,
        COUNT(*) FILTER (WHERE status = 'STUCK'  )::int            AS stuck,
        PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY actual_eta_s)  AS p50_actual_eta_s,
        PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY quoted_eta_s)  AS p50_quoted_eta_s,
        AVG(
          CASE
            WHEN quoted_out IS NULL OR actual_out IS NULL OR quoted_out = 0 THEN NULL
            ELSE (quoted_out - actual_out) * 10000.0 / quoted_out
          END
        )::double precision                                        AS mean_slip_bps
      FROM route_outcomes
      WHERE route_signature = $1
        AND observed_at > NOW() - ($2::bigint * INTERVAL '1 millisecond')
      GROUP BY rail
    `;
    const res = await this.pool.query(q, [routeSignature, windowMs.toString()]);
    if (res.rowCount === 0) return null;
    const r = res.rows[0];
    return {
      rail: r.rail,
      total: r.total,
      settled: r.settled,
      failed: r.failed,
      stuck: r.stuck,
      successRate: r.total > 0 ? r.settled / r.total : 0,
      p50ActualEtaS: r.p50_actual_eta_s !== null ? Number(r.p50_actual_eta_s) : null,
      p50QuotedEtaS: r.p50_quoted_eta_s !== null ? Number(r.p50_quoted_eta_s) : null,
      meanSlippageBps: r.mean_slip_bps !== null ? Number(r.mean_slip_bps) : null,
    };
  }
}

/** Build a stable signature string for grouping rails over time. */
export function buildRouteSignature(params: {
  rail: string;
  srcChainId: number;
  dstChainId: number;
  srcToken: string;
  dstToken: string;
}): string {
  return [
    params.rail.toUpperCase(),
    params.srcChainId,
    params.dstChainId,
    params.srcToken.toLowerCase(),
    params.dstToken.toLowerCase(),
  ].join(':');
}
