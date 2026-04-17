import { IntentEngine } from '../services/IntentEngine';
import { Intent, IntentStatus } from '../types';
import { IntentRepository } from './IntentRepository';
import { toDbJson } from './json';

export interface IntentPersistenceOptions {
  onError?: (err: unknown, context: { intentId: string; stage: string }) => void;
}

export class IntentPersistence {
  private prev = new Map<string, IntentStatus>();

  constructor(
    private readonly intentEngine: IntentEngine,
    private readonly repo: IntentRepository,
    private readonly opts: IntentPersistenceOptions = {},
  ) {}

  start(): void {
    this.intentEngine.onStateChange((intent) => {
      void this.persist(intent);
    });
  }

  async persist(intent: Intent): Promise<void> {
    const previous = this.prev.get(intent.intentId);

    try {
      await this.repo.upsertIntent(intent);
    } catch (err) {
      this.opts.onError?.(err, { intentId: intent.intentId, stage: 'upsertIntent' });
      return;
    }

    if (previous !== intent.status) {
      try {
        await this.repo.appendIntentEvent({
          intentId: intent.intentId,
          prevStatus: previous,
          newStatus: intent.status,
          patch: {
            srcTxHash: intent.srcTxHash,
            railTxId: intent.railTxId,
            dstTxHash: intent.dstTxHash,
            retryCount: intent.retryCount,
            fallbackRail: intent.fallbackRail,
            errorMessage: intent.errorMessage,
            updatedAt: intent.updatedAt,
            quote: toDbJson(intent.quote),
          },
          eventSource: 'intent-engine',
        });
      } catch (err) {
        this.opts.onError?.(err, { intentId: intent.intentId, stage: 'appendIntentEvent' });
      }
    }

    this.prev.set(intent.intentId, intent.status);
  }
}
