// ─────────────────────────────────────────────────────────
// EMPX-Cross-Chain VPS — Recovery Engine
// Detects stuck intents and either retries on same rail
// or falls over to the next best rail automatically.
// Runs on a 30s polling interval — lightweight, no chain I/O.
// ─────────────────────────────────────────────────────────

import { IntentEngine } from './IntentEngine';
import { RailSelector } from './RailSelector';
import { Intent, Rail, IntentStatus } from '../types';

const MAX_RETRIES = 3;

// Fallback priority if primary rail is stuck
const FALLBACK_ORDER: Record<Rail, Rail[]> = {
  [Rail.CCTP]:      [Rail.VIA_LABS,  Rail.AXELAR,    Rail.LAYERZERO],
  [Rail.VIA_LABS]:  [Rail.AXELAR,    Rail.LAYERZERO,  Rail.CCTP],
  [Rail.AXELAR]:    [Rail.LAYERZERO, Rail.VIA_LABS,   Rail.CCTP],
  [Rail.LAYERZERO]: [Rail.AXELAR,    Rail.VIA_LABS,   Rail.CCTP],
  [Rail.WORMHOLE]:  [Rail.AXELAR,    Rail.LAYERZERO],
  // THORChain: liquidity rail — no messaging fallback (different delivery model)
  [Rail.THORCHAIN]: [],
};

export class RecoveryEngine {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private intentEngine: IntentEngine,
    private railSelector: RailSelector,
    private onResubmit: (intent: Intent, fallbackRail: Rail) => Promise<void>,
  ) {}

  start(intervalMs = 30_000): void {
    this.timer = setInterval(() => this._runCycle(), intervalMs);
    console.log('[RecoveryEngine] Started — checking every', intervalMs / 1000, 's');
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async _runCycle(): Promise<void> {
    const stuck = this.intentEngine.findStuckIntents();
    if (stuck.length === 0) return;

    console.log(`[RecoveryEngine] Found ${stuck.length} stuck intent(s)`);

    for (const intent of stuck) {
      await this._recover(intent);
    }
  }

  private async _recover(intent: Intent): Promise<void> {
    // Mark as stuck first
    this.intentEngine.markStuck(intent.intentId, `Rail ${intent.quote.rail} timed out`);

    if (intent.retryCount >= MAX_RETRIES) {
      this.intentEngine.markFailed(intent.intentId, `Max retries (${MAX_RETRIES}) exceeded`);
      console.error(`[RecoveryEngine] Intent ${intent.intentId} FAILED after ${MAX_RETRIES} retries`);
      return;
    }

    // Find next available fallback rail
    const fallbacks = FALLBACK_ORDER[intent.quote.rail] ?? [];
    const usedRails = new Set<Rail>([intent.quote.rail, ...(intent.fallbackRail ? [intent.fallbackRail] : [])]);
    const nextRail = fallbacks.find(r => !usedRails.has(r));

    if (!nextRail) {
      this.intentEngine.markFailed(intent.intentId, 'No more fallback rails available');
      return;
    }

    this.intentEngine.markRecovering(intent.intentId, nextRail);
    console.log(`[RecoveryEngine] Retrying ${intent.intentId} via ${nextRail} (attempt ${intent.retryCount + 1})`);

    try {
      await this.onResubmit(intent, nextRail);
    } catch (err) {
      console.error(`[RecoveryEngine] Resubmit failed for ${intent.intentId}:`, err);
      this.intentEngine.markFailed(intent.intentId, String(err));
    }
  }
}
