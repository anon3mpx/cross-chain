import { IntentStatus, type Intent } from '../types';
import type { BasketRepository } from '../db/BasketRepository';

export type BasketCompositeStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'PARTIAL_SETTLED'
  | 'PARTIAL_FAILED'
  | 'SETTLED'
  | 'FAILED'
  | 'STUCK';

export interface BasketLegStatus {
  legIntentId: string;
  status: IntentStatus;
  srcChainId: number;
  dstChainId: number;
  srcTxHash?: string;
  dstTxHash?: string;
  estimatedOut?: string;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export interface BasketStatusView {
  basketId: string;
  composite: BasketCompositeStatus;
  counts: {
    total: number;
    settled: number;
    failed: number;
    inTransit: number;
    stuck: number;
    quoted: number;
  };
  legs: BasketLegStatus[];
  generatedAt: number;
}

export class BasketStatusEngine {
  constructor(
    private readonly repo: { findIntentsByBasket(basketId: string, partnerId?: string): Promise<Intent[]> },
    private readonly basketRepo?: BasketRepository,
  ) {}

  async getStatus(basketId: string, partnerId?: string): Promise<BasketStatusView> {
    const basket = await this.basketRepo?.get(basketId);
    const intents = await this.repo.findIntentsByBasket(basketId, partnerId);
    if (intents.length === 0) {
      return {
        basketId,
        composite: basket?.executionPlan ? 'IN_PROGRESS' : 'PENDING',
        counts: {
          total: basket?.executionPlan?.legs.length ?? basket?.quote?.legs.length ?? 0,
          settled: 0,
          failed: 0,
          inTransit: 0,
          stuck: 0,
          quoted: basket?.executionPlan?.legs.length ?? basket?.quote?.legs.length ?? 0,
        },
        legs: (basket?.executionPlan?.legs ?? []).map((leg) => ({
          legIntentId: leg.intentId ?? `same-chain:${leg.legIndex}`,
          status: IntentStatus.QUOTED,
          srcChainId: 0,
          dstChainId: 0,
          errorMessage: leg.error,
          createdAt: basket.createdAt,
          updatedAt: basket.updatedAt,
        })),
        generatedAt: Date.now(),
      };
    }

    let settled = 0;
    let failed = 0;
    let stuck = 0;
    let inTransit = 0;
    let quoted = 0;
    const legs: BasketLegStatus[] = intents.map((intent) => {
      switch (intent.status) {
        case IntentStatus.SETTLED:
          settled += 1;
          break;
        case IntentStatus.FAILED:
        case IntentStatus.CANCELLED:
          failed += 1;
          break;
        case IntentStatus.STUCK:
          stuck += 1;
          break;
        case IntentStatus.QUOTED:
          quoted += 1;
          break;
        default:
          inTransit += 1;
          break;
      }

      return {
        legIntentId: intent.intentId,
        status: intent.status,
        srcChainId: intent.quote.srcChainId,
        dstChainId: intent.quote.dstChainId,
        srcTxHash: intent.srcTxHash,
        dstTxHash: intent.dstTxHash,
        estimatedOut: intent.quote.estimatedOut.toString(),
        errorMessage: intent.errorMessage,
        createdAt: intent.createdAt,
        updatedAt: intent.updatedAt,
      };
    });

    return {
      basketId,
      composite: computeComposite({ total: intents.length, settled, failed, stuck, inTransit, quoted }),
      counts: { total: intents.length, settled, failed, inTransit, stuck, quoted },
      legs,
      generatedAt: Date.now(),
    };
  }
}

function computeComposite(counts: {
  total: number;
  settled: number;
  failed: number;
  stuck: number;
  inTransit: number;
  quoted: number;
}): BasketCompositeStatus {
  if (counts.total === 0) return 'PENDING';
  if (counts.settled === counts.total) return 'SETTLED';
  if (counts.failed === counts.total) return 'FAILED';
  if (counts.stuck > 0 && counts.settled + counts.failed < counts.total) return 'STUCK';
  if (counts.settled > 0 && counts.failed > 0) return 'PARTIAL_FAILED';
  if (counts.settled > 0 && counts.inTransit + counts.quoted + counts.stuck > 0) return 'PARTIAL_SETTLED';
  return 'IN_PROGRESS';
}
