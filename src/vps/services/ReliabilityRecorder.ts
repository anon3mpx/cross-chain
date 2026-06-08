// ─────────────────────────────────────────────────────────────────────────────
// ReliabilityRecorder — bridges IntentEngine state transitions into
// route_outcomes inserts.
//
// Subscribes to IntentEngine.onStateChange().  When an intent transitions
// into SETTLED / FAILED / STUCK, it computes the quoted-vs-actual delta and
// writes one row.  Per-intent deduplication ensures one outcome per intent
// even if the engine emits multiple terminal events (which the audit found
// can happen during recovery).
// ─────────────────────────────────────────────────────────────────────────────

import type { IntentEngine } from './IntentEngine';
import type { Intent } from '../types';
import { IntentStatus } from '../types';
import {
  buildRouteSignature,
  type ReliabilityRepository,
  type RouteOutcomeInsert,
} from '../db/ReliabilityRepository';

export class ReliabilityRecorder {
  private readonly seenIntentTerminals = new Set<string>();

  constructor(
    private readonly engine: IntentEngine,
    private readonly repo: ReliabilityRepository,
  ) {}

  start(): void {
    this.engine.onStateChange((intent) => {
      void this.maybeRecord(intent).catch((err) => {
        // Reliability writes must never crash the engine loop.
        // Log once and move on; failure modes for this table are non-critical.
        console.warn('[ReliabilityRecorder] insert failed', err);
      });
    });
  }

  private async maybeRecord(intent: Intent): Promise<void> {
    if (!this.isTerminalForRecording(intent.status)) return;
    if (this.seenIntentTerminals.has(intent.intentId)) return;
    this.seenIntentTerminals.add(intent.intentId);

    const row = this.toRouteOutcome(intent);
    if (!row) return;
    await this.repo.insert(row);
  }

  private isTerminalForRecording(status: IntentStatus): boolean {
    return status === IntentStatus.SETTLED
      || status === IntentStatus.FAILED
      || status === IntentStatus.STUCK;
  }

  private toRouteOutcome(intent: Intent): RouteOutcomeInsert | null {
    const q = intent.quote;
    if (!q) return null;

    const rail = String(q.rail ?? 'UNKNOWN').toUpperCase();
    const settledAt = intent.updatedAt ? new Date(intent.updatedAt) : new Date();
    const actualEtaSeconds = intent.createdAt
      ? Math.max(0, Math.round((intent.updatedAt - intent.createdAt) / 1000))
      : undefined;

    const status: RouteOutcomeInsert['status'] =
      intent.status === IntentStatus.SETTLED ? 'SETTLED'
      : intent.status === IntentStatus.FAILED  ? 'FAILED'
      : 'STUCK';

    // Revenue tier capture (migration 003).  The QuoteResult on the intent
    // doesn't always carry executionMode (it's typically on the RailOffer),
    // so we infer from rail family when not explicitly set:
    //   THORCHAIN / GASZIP / LZ value-transfer API → provider_direct
    //   everything else → router_intent (agg-wired)
    const explicit = (q as unknown as { executionMode?: 'router_intent' | 'provider_direct' })
      .executionMode;
    const inferred: 'router_intent' | 'provider_direct' =
      rail === 'THORCHAIN' || rail === 'GASZIP' ? 'provider_direct' : 'router_intent';
    const executionMode = explicit ?? inferred;
    const offerType = (q as unknown as { offerType?: string }).offerType;
    const actualOut = readIntentActualOut(intent, status, q.estimatedOut);
    const actualFeeUsd = readIntentActualFeeUsd(intent, status, q.feeAmountUSD);

    return {
      intentId: intent.intentId,
      routeSignature: buildRouteSignature({
        rail,
        srcChainId: q.srcChainId,
        dstChainId: q.dstChainId,
        srcToken: q.tokenIn,
        dstToken: q.tokenOut,
      }),
      rail,
      srcChainId: q.srcChainId,
      dstChainId: q.dstChainId,
      srcToken: q.tokenIn,
      dstToken: q.tokenOut,
      executionMode,
      offerType,
      quotedOut: q.estimatedOut,
      quotedEtaSeconds: q.etaSeconds,
      quotedFeeUsd: typeof q.feeAmountUSD === 'number' ? q.feeAmountUSD : undefined,
      actualOut,
      actualEtaSeconds,
      actualFeeUsd,
      status,
      failureReason: intent.errorMessage,
      // Attribution — read from the new (optional) fields populated by
      // IntentService once Sprint 3.6 lands.  Falls back to undefined.
      partnerId: (intent as unknown as { partnerId?: string }).partnerId,
      integratorId: (intent as unknown as { integratorId?: string }).integratorId,
      agentId: (intent as unknown as { agentId?: string }).agentId,
      routeSource: (intent as unknown as { routeSource?: string }).routeSource,
      settledAt,
    };
  }
}

function readIntentActualOut(
  intent: Intent,
  status: RouteOutcomeInsert['status'],
  fallback: bigint,
): bigint | undefined {
  if (typeof intent.actualOut === 'bigint') return intent.actualOut;
  return status === 'SETTLED' ? fallback : undefined;
}

function readIntentActualFeeUsd(
  intent: Intent,
  status: RouteOutcomeInsert['status'],
  fallback: number,
): number | undefined {
  if (typeof intent.actualFeeUsd === 'number' && Number.isFinite(intent.actualFeeUsd)) {
    return intent.actualFeeUsd;
  }
  return status === 'SETTLED' && Number.isFinite(fallback) ? fallback : undefined;
}
