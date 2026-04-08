// ─────────────────────────────────────────────────────────
// EMPX-Cross-Chain VPS — Intent Engine
// Manages intent lifecycle: state transitions, DB persistence,
// trigger recovery on timeouts.
// ─────────────────────────────────────────────────────────

import { Intent, IntentStatus, QuoteResult, Rail } from '../types';

// Timeout thresholds per rail before marking STUCK
const STUCK_THRESHOLDS_MS: Record<Rail, number> = {
  [Rail.CCTP]:      3  * 60 * 1000,  // 3 min (normally 25s)
  [Rail.VIA_LABS]:  8  * 60 * 1000,  // 8 min (normally 3 min)
  [Rail.AXELAR]:    10 * 60 * 1000,  // 10 min (normally 90s)
  [Rail.LAYERZERO]: 10 * 60 * 1000,  // 10 min (normally 2 min)
  [Rail.WORMHOLE]:  10 * 60 * 1000,  // 10 min
  [Rail.THORCHAIN]: 20 * 60 * 1000,  // 20 min incl. native-chain confirmation latency
};

export class IntentEngine {
  // In-memory store for Tier 1-2. Replace with DB calls at Tier 3.
  private intents = new Map<string, Intent>();
  private listeners: Array<(intent: Intent) => void> = [];

  // ── Create ─────────────────────────────────────────────────────────────────

  create(quote: QuoteResult, userAddress: string): Intent {
    const intent: Intent = {
      intentId:   quote.intentId,
      status:     IntentStatus.QUOTED,
      quote,
      userAddress,
      createdAt:  Date.now(),
      updatedAt:  Date.now(),
      retryCount: 0,
    };
    this.intents.set(intent.intentId, intent);
    this._emit(intent);
    return intent;
  }

  // ── State Transitions ──────────────────────────────────────────────────────

  markSubmitted(intentId: string, srcTxHash: string): Intent {
    return this._transition(intentId, IntentStatus.SUBMITTED, { srcTxHash });
  }

  markInTransit(intentId: string, railTxId: string): Intent {
    return this._transition(intentId, IntentStatus.IN_TRANSIT, { railTxId });
  }

  markDestinationReceived(intentId: string, dstTxHash: string): Intent {
    return this._transition(intentId, IntentStatus.DESTINATION_RECEIVED, { dstTxHash });
  }

  markSettled(intentId: string, dstTxHash: string): Intent {
    return this._transition(intentId, IntentStatus.SETTLED, { dstTxHash });
  }

  markStuck(intentId: string, reason: string): Intent {
    return this._transition(intentId, IntentStatus.STUCK, { errorMessage: reason });
  }

  markRecovering(intentId: string, fallbackRail: Rail): Intent {
    const intent = this._get(intentId);
    return this._transition(intentId, IntentStatus.RECOVERING, {
      fallbackRail,
      retryCount: intent.retryCount + 1,
    });
  }

  markFailed(intentId: string, reason: string): Intent {
    return this._transition(intentId, IntentStatus.FAILED, { errorMessage: reason });
  }

  // ── Stuck Detection ────────────────────────────────────────────────────────

  /// @notice Called by a periodic check (every 30s). Returns intents that
  ///         have been IN_TRANSIT past their rail's timeout threshold.
  findStuckIntents(): Intent[] {
    const now = Date.now();
    return [...this.intents.values()].filter(intent => {
      if (intent.status !== IntentStatus.IN_TRANSIT) return false;
      const threshold = STUCK_THRESHOLDS_MS[intent.quote.rail];
      return (now - intent.updatedAt) > threshold;
    });
  }

  // ── Query ──────────────────────────────────────────────────────────────────

  get(intentId: string): Intent | undefined {
    return this.intents.get(intentId);
  }

  getByStatus(status: IntentStatus): Intent[] {
    return [...this.intents.values()].filter(i => i.status === status);
  }

  // Subscribe to all state changes (used by EventMonitor, StatusAPI websocket)
  onStateChange(fn: (intent: Intent) => void): void {
    this.listeners.push(fn);
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private _transition(intentId: string, newStatus: IntentStatus, patch: Partial<Intent>): Intent {
    const intent = this._get(intentId);
    const updated: Intent = { ...intent, ...patch, status: newStatus, updatedAt: Date.now() };
    this.intents.set(intentId, updated);
    this._emit(updated);
    return updated;
  }

  private _get(intentId: string): Intent {
    const intent = this.intents.get(intentId);
    if (!intent) throw new Error(`Intent not found: ${intentId}`);
    return intent;
  }

  private _emit(intent: Intent): void {
    this.listeners.forEach(fn => fn(intent));
  }
}
