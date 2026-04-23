// ─────────────────────────────────────────────────────────
// EMPX-Cross-Chain VPS — Recovery Engine
// Detects stuck intents and either retries on same rail
// or falls over to the next best rail automatically.
// Runs on a 30s polling interval — lightweight, no chain I/O.
// ─────────────────────────────────────────────────────────

import { RailSelector } from './RailSelector';
import { Intent, Rail, IntentStatus } from '../types';
import { IntentService } from './IntentService';
import { getFallbackRails } from '../rails/registry';

const MAX_RETRIES = 3;

export class RecoveryEngine {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private intentService: IntentService,
    private railSelector: RailSelector,
    private onResubmit: (intent: Intent, fallbackRail: Rail) => Promise<void>,
  ) {}

  start(intervalMs = 30_000): void {
    this.timer = setInterval(() => {
      void this._runCycle().catch((err) => {
        console.error('[RecoveryEngine] Cycle failed', err);
      });
    }, intervalMs);
    console.log('[RecoveryEngine] Started — checking every', intervalMs / 1000, 's');
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async _runCycle(): Promise<void> {
    const stuck = await this.intentService.findStuckIntents();
    if (stuck.length === 0) return;

    console.log(`[RecoveryEngine] Found ${stuck.length} stuck intent(s)`);

    for (const intent of stuck) {
      await this._recover(intent);
    }
  }

  private async _recover(intent: Intent): Promise<void> {
    // Mark as stuck first
    await this.intentService.markStuck(intent.intentId, `Rail ${intent.quote.rail} timed out`, {
      actor: 'system',
      eventSource: 'recovery-engine',
    });

    if (intent.retryCount >= MAX_RETRIES) {
      await this.intentService.markFailed(intent.intentId, `Max retries (${MAX_RETRIES}) exceeded`, {
        actor: 'system',
        eventSource: 'recovery-engine',
      });
      console.error(`[RecoveryEngine] Intent ${intent.intentId} FAILED after ${MAX_RETRIES} retries`);
      return;
    }

    // Find next available fallback rail
    const fallbacks = getFallbackRails(intent.quote.rail);
    const usedRails = new Set<Rail>([intent.quote.rail, ...(intent.fallbackRail ? [intent.fallbackRail] : [])]);
    const nextRail = fallbacks.find(r => !usedRails.has(r));

    if (!nextRail) {
      await this.intentService.markFailed(intent.intentId, 'No more fallback rails available', {
        actor: 'system',
        eventSource: 'recovery-engine',
      });
      return;
    }

    await this.intentService.markRecovering(intent.intentId, nextRail, {
      actor: 'system',
      eventSource: 'recovery-engine',
    });
    console.log(`[RecoveryEngine] Retrying ${intent.intentId} via ${nextRail} (attempt ${intent.retryCount + 1})`);

    try {
      await this.onResubmit(intent, nextRail);
    } catch (err) {
      console.error(`[RecoveryEngine] Resubmit failed for ${intent.intentId}:`, err);
      await this.intentService.markFailed(intent.intentId, String(err), {
        actor: 'system',
        eventSource: 'recovery-engine',
      });
    }
  }
}
