import { IntentRepository, IntentTransitionOptions, RefundCaseUpsert } from '../db/IntentRepository';
import { randomBytes } from 'crypto';
import {
  Intent,
  IntentRefundCase,
  IntentStatus,
  QuoteResult,
  Rail,
  RailOffer,
  RefundCaseStatus,
} from '../types';
import { IntentEngine } from './IntentEngine';
import { inferRefundCustodyLocation } from '../rails/registry';

const STUCK_THRESHOLDS_MS: Record<Rail, number> = {
  [Rail.CCTP]: 3 * 60 * 1000,
  [Rail.VIA_LABS]: 8 * 60 * 1000,
  [Rail.AXELAR]: 10 * 60 * 1000,
  [Rail.LAYERZERO]: 10 * 60 * 1000,
  [Rail.WORMHOLE]: 10 * 60 * 1000,
  [Rail.GASZIP]: 10 * 60 * 1000,
  [Rail.THORCHAIN]: 20 * 60 * 1000,
};

const TERMINAL_STATUSES = new Set<IntentStatus>([
  IntentStatus.CANCELLED,
  IntentStatus.SETTLED,
  IntentStatus.FAILED,
]);

export class IntentLifecycleError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 400,
  ) {
    super(message);
  }
}

export class IntentService {
  constructor(
    private readonly intentEngine: IntentEngine,
    private readonly intentRepo?: IntentRepository,
  ) {}

  async createQuotedIntent(quote: QuoteResult, userAddress: string, partnerApiKey?: string): Promise<Intent> {
    const intent: Intent = {
      intentId: quote.intentId,
      status: IntentStatus.QUOTED,
      quote,
      userAddress,
      partnerApiKey,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retryCount: 0,
    };

    if (this.intentRepo) {
      await this.intentRepo.createIntent(intent, {
        actor: 'system',
        eventSource: 'quote-api',
      });
    }

    this.intentEngine.upsert(intent, true);
    return intent;
  }

  async createQuotedIntentFromOffer(offer: RailOffer, userAddress: string, partnerApiKey?: string): Promise<Intent> {
    const quote = this.materializeSelectedOfferQuote(offer);
    return this.createQuotedIntent(quote, userAddress, partnerApiKey);
  }

  async getIntent(intentId: string): Promise<Intent | null> {
    if (this.intentRepo) {
      const persisted = await this.intentRepo.getIntent(intentId);
      if (persisted) {
        this.intentEngine.upsert(persisted);
        return persisted;
      }
    }
    return this.intentEngine.get(intentId) ?? null;
  }

  async countIntentsByStatus(): Promise<Record<IntentStatus, number>> {
    if (this.intentRepo) return this.intentRepo.countIntentsByStatus();

    return Object.values(IntentStatus).reduce((acc, status) => {
      acc[status] = this.intentEngine.getByStatus(status).length;
      return acc;
    }, {} as Record<IntentStatus, number>);
  }

  async listIntentsByStatuses(statuses: IntentStatus[], limit = 500): Promise<Intent[]> {
    const uniqueStatuses = [...new Set(statuses)];
    if (uniqueStatuses.length === 0 || limit <= 0) return [];

    if (this.intentRepo) {
      const groups = await Promise.all(
        uniqueStatuses.map((status) => this.intentRepo!.listIntentsByStatus(status, limit)),
      );
      return groups
        .flat()
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, limit);
    }

    return uniqueStatuses
      .flatMap((status) => this.intentEngine.getByStatus(status))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }

  async markSubmitted(intentId: string, srcTxHash: string, options: IntentTransitionOptions = {}): Promise<Intent> {
    return this.transition(intentId, IntentStatus.SUBMITTED, { srcTxHash }, {
      ...options,
      allowedFrom: options.allowedFrom ?? [IntentStatus.QUOTED],
    });
  }

  async markInTransit(intentId: string, railTxId: string, options: IntentTransitionOptions = {}): Promise<Intent> {
    return this.transition(intentId, IntentStatus.IN_TRANSIT, { railTxId }, {
      ...options,
      allowedFrom: options.allowedFrom ?? [IntentStatus.QUOTED, IntentStatus.SUBMITTED, IntentStatus.RECOVERING],
    });
  }

  async markDestinationReceived(intentId: string, dstTxHash: string, options: IntentTransitionOptions = {}): Promise<Intent> {
    return this.transition(intentId, IntentStatus.DESTINATION_RECEIVED, { dstTxHash }, {
      ...options,
      allowedFrom: options.allowedFrom ?? [IntentStatus.IN_TRANSIT, IntentStatus.RECOVERING],
    });
  }

  async markSettled(intentId: string, dstTxHash: string, options: IntentTransitionOptions = {}): Promise<Intent> {
    return this.transition(intentId, IntentStatus.SETTLED, { dstTxHash }, {
      ...options,
      allowedFrom: options.allowedFrom ?? [IntentStatus.IN_TRANSIT, IntentStatus.DESTINATION_RECEIVED, IntentStatus.RECOVERING],
    });
  }

  async markStuck(intentId: string, reason: string, options: IntentTransitionOptions = {}): Promise<Intent> {
    return this.transition(intentId, IntentStatus.STUCK, { errorMessage: reason }, {
      ...options,
      allowedFrom: options.allowedFrom ?? [IntentStatus.IN_TRANSIT],
    });
  }

  async markRecovering(intentId: string, fallbackRail: Rail, options: IntentTransitionOptions = {}): Promise<Intent> {
    const current = await this.requireIntent(intentId);
    return this.transition(intentId, IntentStatus.RECOVERING, {
      fallbackRail,
      retryCount: current.retryCount + 1,
    }, {
      ...options,
      allowedFrom: options.allowedFrom ?? [IntentStatus.STUCK],
    });
  }

  async markFailed(intentId: string, reason: string, options: IntentTransitionOptions = {}): Promise<Intent> {
    return this.transition(intentId, IntentStatus.FAILED, { errorMessage: reason }, {
      ...options,
      allowedFrom: options.allowedFrom ?? [
        IntentStatus.QUOTED,
        IntentStatus.SUBMITTED,
        IntentStatus.IN_TRANSIT,
        IntentStatus.DESTINATION_RECEIVED,
        IntentStatus.STUCK,
        IntentStatus.RECOVERING,
      ],
    });
  }

  async markCancelled(intentId: string, reason: string, options: IntentTransitionOptions = {}): Promise<Intent> {
    return this.transition(intentId, IntentStatus.CANCELLED, {
      errorMessage: reason,
    }, {
      ...options,
      allowedFrom: options.allowedFrom ?? [IntentStatus.CREATED, IntentStatus.QUOTED, IntentStatus.SUBMITTED],
    });
  }

  async cancel(intentId: string, userAddress: string, reason?: string): Promise<Intent> {
    const intent = await this.requireIntent(intentId);
    if (intent.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
      throw new IntentLifecycleError('UNAUTHORIZED_INTENT', 'Intent does not belong to the provided wallet.', 403);
    }

    if (intent.status === IntentStatus.CANCELLED) return intent;
    if (intent.status !== IntentStatus.QUOTED && intent.status !== IntentStatus.CREATED) {
      throw new IntentLifecycleError(
        'INTENT_NOT_CANCELLABLE',
        'Intent can only be cancelled before source-chain submission. After signing or mining, cancellation must happen in the wallet or move into refund review.',
        409,
      );
    }

    return this.markCancelled(intentId, reason?.trim() || 'Cancelled by user before submission', {
      actor: userAddress,
      eventSource: 'cancel-api',
      allowedFrom: [IntentStatus.CREATED, IntentStatus.QUOTED],
    });
  }

  async requestRefund(intentId: string, userAddress: string, reason: string): Promise<IntentRefundCase> {
    const intent = await this.requireIntent(intentId);
    if (intent.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
      throw new IntentLifecycleError('UNAUTHORIZED_INTENT', 'Intent does not belong to the provided wallet.', 403);
    }

    if ([IntentStatus.CREATED, IntentStatus.QUOTED, IntentStatus.CANCELLED, IntentStatus.SETTLED].includes(intent.status)) {
      throw new IntentLifecycleError(
        'REFUND_NOT_AVAILABLE',
        `Refund review is not available while intent is ${intent.status}.`,
        409,
      );
    }

    const existing = this.intentRepo ? await this.intentRepo.getRefundCase(intentId) : null;
    if (existing) return existing;
    if (!this.intentRepo) {
      throw new IntentLifecycleError('REFUND_STORE_UNAVAILABLE', 'Refund tracking requires Postgres.', 503);
    }

    return this.intentRepo.upsertRefundCase({
      intentId,
      status: RefundCaseStatus.REQUESTED,
      reason: reason.trim(),
      requestedBy: userAddress,
      custodyLocation: inferRefundCustodyLocation(intent),
    });
  }

  async getRefundCase(intentId: string): Promise<IntentRefundCase | null> {
    if (!this.intentRepo) return null;
    return this.intentRepo.getRefundCase(intentId);
  }

  async adminUpdateRefund(input: RefundCaseUpsert): Promise<IntentRefundCase> {
    if (!this.intentRepo) {
      throw new IntentLifecycleError('REFUND_STORE_UNAVAILABLE', 'Refund tracking requires Postgres.', 503);
    }
    await this.requireIntent(input.intentId);
    return this.intentRepo.upsertRefundCase(input);
  }

  async findStuckIntents(limit = 500): Promise<Intent[]> {
    const now = Date.now();
    const intents = this.intentRepo
      ? await this.intentRepo.listIntentsByStatus(IntentStatus.IN_TRANSIT, limit)
      : this.intentEngine.findStuckIntents();

    return intents.filter((intent) => (now - intent.updatedAt) > STUCK_THRESHOLDS_MS[intent.quote.rail]);
  }

  isTerminal(status: IntentStatus): boolean {
    return TERMINAL_STATUSES.has(status);
  }

  canCancel(status: IntentStatus): boolean {
    return status === IntentStatus.CREATED || status === IntentStatus.QUOTED;
  }

  canRequestRefund(status: IntentStatus): boolean {
    return ![IntentStatus.CREATED, IntentStatus.QUOTED, IntentStatus.CANCELLED, IntentStatus.SETTLED].includes(status);
  }

  private materializeSelectedOfferQuote(offer: RailOffer): QuoteResult {
    const executionQuote = offer.execution?.quote;
    if (!executionQuote || typeof executionQuote !== 'object') {
      throw new IntentLifecycleError(
        'INVALID_OFFER_SELECTION',
        `Selected offer ${offer.offerId} is missing its execution quote payload.`,
      );
    }

    return {
      ...(executionQuote as QuoteResult),
      intentId: this.makeIntentId(),
      selectedByUser: true,
    };
  }

  private makeIntentId(): string {
    return `0x${randomBytes(32).toString('hex')}`;
  }

  private async transition(
    intentId: string,
    newStatus: IntentStatus,
    patch: Partial<Intent>,
    options: IntentTransitionOptions,
  ): Promise<Intent> {
    if (this.intentRepo) {
      const updated = await this.intentRepo.transitionIntent(intentId, newStatus, patch, options);
      this.intentEngine.upsert(updated, true);
      return updated;
    }

    let updated: Intent;
    switch (newStatus) {
      case IntentStatus.SUBMITTED:
        updated = this.intentEngine.markSubmitted(intentId, patch.srcTxHash ?? '');
        break;
      case IntentStatus.IN_TRANSIT:
        updated = this.intentEngine.markInTransit(intentId, patch.railTxId ?? '');
        break;
      case IntentStatus.DESTINATION_RECEIVED:
        updated = this.intentEngine.markDestinationReceived(intentId, patch.dstTxHash ?? '');
        break;
      case IntentStatus.SETTLED:
        updated = this.intentEngine.markSettled(intentId, patch.dstTxHash ?? '');
        break;
      case IntentStatus.STUCK:
        updated = this.intentEngine.markStuck(intentId, patch.errorMessage ?? 'Stuck');
        break;
      case IntentStatus.RECOVERING:
        updated = this.intentEngine.markRecovering(intentId, patch.fallbackRail as Rail);
        break;
      case IntentStatus.FAILED:
        updated = this.intentEngine.markFailed(intentId, patch.errorMessage ?? 'Failed');
        break;
      case IntentStatus.CANCELLED: {
        const intent = await this.requireIntent(intentId);
        updated = this.intentEngine.upsert({
          ...intent,
          status: IntentStatus.CANCELLED,
          errorMessage: patch.errorMessage,
          updatedAt: Date.now(),
        }, true);
        break;
      }
      default:
        throw new IntentLifecycleError('UNSUPPORTED_TRANSITION', `Unsupported transition ${newStatus}`);
    }
    return updated;
  }

  private async requireIntent(intentId: string): Promise<Intent> {
    const intent = await this.getIntent(intentId);
    if (!intent) throw new IntentLifecycleError('INTENT_NOT_FOUND', `Intent not found: ${intentId}`, 404);
    return intent;
  }
}
