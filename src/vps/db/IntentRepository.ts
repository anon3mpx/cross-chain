import { Pool, PoolClient } from 'pg';
import {
  Intent,
  IntentRefundCase,
  IntentStatus,
  RefundCaseStatus,
  RefundCustodyLocation,
  RefundResolutionKind,
} from '../types';
import { reviveQuote, toDbJson, toIntentRow } from './json';

export interface IntentEventWrite {
  intentId: string;
  prevStatus?: IntentStatus;
  newStatus: IntentStatus;
  patch?: Record<string, unknown>;
  actor?: string;
  eventSource?: string;
  chainId?: number;
  txHash?: string;
  logIndex?: number;
  idempotencyKey?: string;
  occurredAt?: Date;
}

export interface IntentTransitionOptions {
  actor?: string;
  eventSource?: string;
  chainId?: number;
  txHash?: string;
  logIndex?: number;
  idempotencyKey?: string;
  occurredAt?: Date;
  allowedFrom?: IntentStatus[];
}

export interface RefundCaseUpsert {
  intentId: string;
  status: RefundCaseStatus;
  reason: string;
  requestedBy?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  adminNotes?: string;
  custodyLocation?: RefundCustodyLocation;
  resolutionKind?: RefundResolutionKind;
  rescueContract?: string;
  rescueToken?: string;
  rescueAmount?: string;
  rescueTxHash?: string;
  payoutAddress?: string;
  payoutTxHash?: string;
}

const TERMINAL_INTENT_STATUSES = new Set<IntentStatus>([
  IntentStatus.CANCELLED,
  IntentStatus.SETTLED,
  IntentStatus.FAILED,
]);

export class IntentRepository {
  constructor(private readonly pool: Pool) {}

  async countIntentsByStatus(): Promise<Record<IntentStatus, number>> {
    const counts = Object.values(IntentStatus).reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {} as Record<IntentStatus, number>);

    const { rows } = await this.pool.query(
      `SELECT status, COUNT(*)::int AS count
       FROM intents
       GROUP BY status`,
    );

    for (const row of rows) {
      const status = row.status as IntentStatus;
      if (!(status in counts)) continue;
      counts[status] = Number(row.count);
    }

    return counts;
  }

  async createIntent(
    intent: Intent,
    options: Pick<IntentTransitionOptions, 'actor' | 'eventSource' | 'occurredAt'> = {},
  ): Promise<Intent> {
    return this.withTransaction(async (client) => {
      await this.upsertIntentWithClient(client, intent);
      await this.appendIntentEventWithClient(client, {
        intentId: intent.intentId,
        newStatus: intent.status,
        patch: {
          srcTxHash: intent.srcTxHash,
          railTxId: intent.railTxId,
          dstTxHash: intent.dstTxHash,
          retryCount: intent.retryCount,
          fallbackRail: intent.fallbackRail,
          errorMessage: intent.errorMessage,
          partnerApiKey: intent.partnerApiKey,
          quote: toDbJson(intent.quote),
          createdAt: intent.createdAt,
          updatedAt: intent.updatedAt,
        },
        actor: options.actor,
        eventSource: options.eventSource ?? 'intent-service',
        occurredAt: options.occurredAt,
      });
      return intent;
    });
  }

  async transitionIntent(
    intentId: string,
    newStatus: IntentStatus,
    patch: Partial<Intent> = {},
    options: IntentTransitionOptions = {},
  ): Promise<Intent> {
    return this.withTransaction(async (client) => {
      const current = await this.getIntentForUpdate(client, intentId);
      if (!current) throw new Error(`Intent not found: ${intentId}`);

      const updated: Intent = {
        ...current,
        ...patch,
        intentId: current.intentId,
        status: newStatus,
        quote: patch.quote ?? current.quote,
        userAddress: patch.userAddress ?? current.userAddress,
        retryCount: patch.retryCount ?? current.retryCount,
        createdAt: current.createdAt,
        updatedAt: Date.now(),
      };

      if (current.status === newStatus) {
        if (this.hasIntentDiff(current, updated)) {
          await this.upsertIntentWithClient(client, updated);
          return updated;
        }
        return current;
      }

      if (options.allowedFrom && !options.allowedFrom.includes(current.status)) {
        throw new Error(`Intent ${intentId} cannot transition from ${current.status} to ${newStatus}`);
      }

      if (TERMINAL_INTENT_STATUSES.has(current.status) && current.status !== newStatus) {
        throw new Error(`Intent ${intentId} is terminal in status ${current.status}`);
      }

      await this.upsertIntentWithClient(client, updated);
      await this.appendIntentEventWithClient(client, {
        intentId,
        prevStatus: current.status,
        newStatus,
        patch: {
          srcTxHash: updated.srcTxHash,
          railTxId: updated.railTxId,
          dstTxHash: updated.dstTxHash,
          retryCount: updated.retryCount,
          fallbackRail: updated.fallbackRail,
          errorMessage: updated.errorMessage,
          partnerApiKey: updated.partnerApiKey,
          updatedAt: updated.updatedAt,
        },
        actor: options.actor,
        eventSource: options.eventSource ?? 'intent-service',
        chainId: options.chainId,
        txHash: options.txHash,
        logIndex: options.logIndex,
        idempotencyKey: options.idempotencyKey,
        occurredAt: options.occurredAt,
      });
      return updated;
    });
  }

  async upsertIntent(intent: Intent): Promise<void> {
    await this.upsertIntentWithClient(this.pool, intent);
  }

  async appendIntentEvent(event: IntentEventWrite): Promise<void> {
    await this.appendIntentEventWithClient(this.pool, event);
  }

  async getIntent(intentId: string): Promise<Intent | null> {
    const { rows } = await this.pool.query(
      `SELECT intent_id, status, quote, user_address,
              src_tx_hash, rail_tx_id, dst_tx_hash,
              created_at, updated_at, retry_count, fallback_rail,
              error_message, partner_api_key
       FROM intents
       WHERE intent_id = $1`,
      [intentId],
    );

    if (rows.length === 0) return null;
    return this.rowToIntent(rows[0]);
  }

  async listIntentsByStatus(status: IntentStatus, limit = 500): Promise<Intent[]> {
    const { rows } = await this.pool.query(
      `SELECT intent_id, status, quote, user_address,
              src_tx_hash, rail_tx_id, dst_tx_hash,
              created_at, updated_at, retry_count, fallback_rail,
              error_message, partner_api_key
       FROM intents
       WHERE status = $1
       ORDER BY updated_at DESC
       LIMIT $2`,
      [status, limit],
    );

    return rows.map((row) => this.rowToIntent(row));
  }

  async getRefundCase(intentId: string): Promise<IntentRefundCase | null> {
    const { rows } = await this.pool.query(
      `SELECT intent_id, status, reason, requested_by, requested_at,
              reviewed_by, reviewed_at, review_notes, admin_notes,
              custody_location, resolution_kind, rescue_contract, rescue_token,
              rescue_amount, rescue_tx_hash, payout_address, payout_tx_hash,
              updated_at
       FROM intent_refund_cases
       WHERE intent_id = $1`,
      [intentId],
    );

    if (rows.length === 0) return null;
    return this.rowToRefundCase(rows[0]);
  }

  async upsertRefundCase(input: RefundCaseUpsert): Promise<IntentRefundCase> {
    const { rows } = await this.pool.query(
      `INSERT INTO intent_refund_cases (
         intent_id, status, reason, requested_by, reviewed_by, reviewed_at, review_notes,
         admin_notes, custody_location, resolution_kind, rescue_contract,
         rescue_token, rescue_amount, rescue_tx_hash, payout_address, payout_tx_hash
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11,
         $12, $13, $14, $15, $16
       )
       ON CONFLICT (intent_id)
       DO UPDATE SET
         status = EXCLUDED.status,
         reason = EXCLUDED.reason,
         requested_by = COALESCE(EXCLUDED.requested_by, intent_refund_cases.requested_by),
         reviewed_by = COALESCE(EXCLUDED.reviewed_by, intent_refund_cases.reviewed_by),
         reviewed_at = CASE
           WHEN EXCLUDED.reviewed_by IS NOT NULL THEN NOW()
           ELSE intent_refund_cases.reviewed_at
         END,
         review_notes = COALESCE(EXCLUDED.review_notes, intent_refund_cases.review_notes),
         admin_notes = COALESCE(EXCLUDED.admin_notes, intent_refund_cases.admin_notes),
         custody_location = EXCLUDED.custody_location,
         resolution_kind = COALESCE(EXCLUDED.resolution_kind, intent_refund_cases.resolution_kind),
         rescue_contract = COALESCE(EXCLUDED.rescue_contract, intent_refund_cases.rescue_contract),
         rescue_token = COALESCE(EXCLUDED.rescue_token, intent_refund_cases.rescue_token),
         rescue_amount = COALESCE(EXCLUDED.rescue_amount, intent_refund_cases.rescue_amount),
         rescue_tx_hash = COALESCE(EXCLUDED.rescue_tx_hash, intent_refund_cases.rescue_tx_hash),
         payout_address = COALESCE(EXCLUDED.payout_address, intent_refund_cases.payout_address),
         payout_tx_hash = COALESCE(EXCLUDED.payout_tx_hash, intent_refund_cases.payout_tx_hash),
        updated_at = NOW()
       RETURNING intent_id, status, reason, requested_by, requested_at,
                 reviewed_by, reviewed_at, review_notes, admin_notes,
                 custody_location, resolution_kind, rescue_contract, rescue_token,
                 rescue_amount, rescue_tx_hash, payout_address, payout_tx_hash,
                 updated_at`,
      [
        input.intentId,
        input.status,
        input.reason,
        input.requestedBy ?? null,
        input.reviewedBy ?? null,
        input.reviewedBy ? new Date() : null,
        input.reviewNotes ?? null,
        input.adminNotes ?? null,
        input.custodyLocation ?? RefundCustodyLocation.UNKNOWN,
        input.resolutionKind ?? null,
        input.rescueContract ?? null,
        input.rescueToken ?? null,
        input.rescueAmount ?? null,
        input.rescueTxHash ?? null,
        input.payoutAddress ?? null,
        input.payoutTxHash ?? null,
      ],
    );

    return this.rowToRefundCase(rows[0]);
  }

  private async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private async getIntentForUpdate(client: PoolClient, intentId: string): Promise<Intent | null> {
    const { rows } = await client.query(
      `SELECT intent_id, status, quote, user_address,
              src_tx_hash, rail_tx_id, dst_tx_hash,
              created_at, updated_at, retry_count, fallback_rail,
              error_message, partner_api_key
       FROM intents
       WHERE intent_id = $1
       FOR UPDATE`,
      [intentId],
    );

    if (rows.length === 0) return null;
    return this.rowToIntent(rows[0]);
  }

  private async upsertIntentWithClient(client: Pool | PoolClient, intent: Intent): Promise<void> {
    const row = toIntentRow(intent);
    await client.query(
      `INSERT INTO intents (
         intent_id, status, user_address, src_chain_id, dst_chain_id,
         rail, fallback_rail, quote, src_tx_hash, rail_tx_id, dst_tx_hash,
         retry_count, error_message, partner_api_key, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8::jsonb, $9, $10, $11,
         $12, $13, $14, $15, $16
       )
       ON CONFLICT (intent_id)
       DO UPDATE SET
         status = EXCLUDED.status,
         user_address = EXCLUDED.user_address,
         src_chain_id = EXCLUDED.src_chain_id,
         dst_chain_id = EXCLUDED.dst_chain_id,
         rail = EXCLUDED.rail,
         fallback_rail = EXCLUDED.fallback_rail,
         quote = EXCLUDED.quote,
         src_tx_hash = EXCLUDED.src_tx_hash,
         rail_tx_id = EXCLUDED.rail_tx_id,
         dst_tx_hash = EXCLUDED.dst_tx_hash,
         retry_count = EXCLUDED.retry_count,
         error_message = EXCLUDED.error_message,
         partner_api_key = EXCLUDED.partner_api_key,
         updated_at = EXCLUDED.updated_at,
         version = intents.version + 1`,
      [
        row.intent_id,
        row.status,
        row.user_address,
        row.src_chain_id,
        row.dst_chain_id,
        row.rail,
        row.fallback_rail,
        JSON.stringify(row.quote),
        row.src_tx_hash,
        row.rail_tx_id,
        row.dst_tx_hash,
        row.retry_count,
        row.error_message,
        row.partner_api_key,
        row.created_at,
        row.updated_at,
      ],
    );
  }

  private async appendIntentEventWithClient(client: Pool | PoolClient, event: IntentEventWrite): Promise<void> {
    await client.query(
      `INSERT INTO intent_events (
         intent_id, prev_status, new_status, patch, actor, event_source,
         chain_id, tx_hash, log_index, idempotency_key, occurred_at
       ) VALUES (
         $1, $2, $3, $4::jsonb, $5, $6,
         $7, $8, $9, $10, COALESCE($11, NOW())
       )
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        event.intentId,
        event.prevStatus ?? null,
        event.newStatus,
        JSON.stringify(toDbJson(event.patch ?? {})),
        event.actor ?? 'system',
        event.eventSource ?? 'intent-service',
        event.chainId ?? null,
        event.txHash ?? null,
        event.logIndex ?? null,
        event.idempotencyKey ?? null,
        event.occurredAt ?? null,
      ],
    );
  }

  private rowToIntent(row: any): Intent {
    return {
      intentId: row.intent_id,
      status: row.status as IntentStatus,
      quote: reviveQuote(row.quote),
      userAddress: row.user_address,
      srcTxHash: row.src_tx_hash ?? undefined,
      railTxId: row.rail_tx_id ?? undefined,
      dstTxHash: row.dst_tx_hash ?? undefined,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
      retryCount: Number(row.retry_count ?? 0),
      fallbackRail: row.fallback_rail ?? undefined,
      errorMessage: row.error_message ?? undefined,
      partnerApiKey: row.partner_api_key ?? undefined,
    };
  }

  private rowToRefundCase(row: any): IntentRefundCase {
    return {
      intentId: row.intent_id,
      status: row.status as RefundCaseStatus,
      reason: row.reason,
      requestedBy: row.requested_by ?? undefined,
      requestedAt: new Date(row.requested_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
      reviewedBy: row.reviewed_by ?? undefined,
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).getTime() : undefined,
      reviewNotes: row.review_notes ?? undefined,
      adminNotes: row.admin_notes ?? undefined,
      custodyLocation: row.custody_location as RefundCustodyLocation,
      resolutionKind: row.resolution_kind as RefundResolutionKind | undefined,
      rescueContract: row.rescue_contract ?? undefined,
      rescueToken: row.rescue_token ?? undefined,
      rescueAmount: row.rescue_amount ?? undefined,
      rescueTxHash: row.rescue_tx_hash ?? undefined,
      payoutAddress: row.payout_address ?? undefined,
      payoutTxHash: row.payout_tx_hash ?? undefined,
    };
  }

  private hasIntentDiff(current: Intent, updated: Intent): boolean {
    const normalize = (intent: Intent) => JSON.stringify({
      intentId: intent.intentId,
      status: intent.status,
      quote: toDbJson(intent.quote),
      userAddress: intent.userAddress,
      srcTxHash: intent.srcTxHash ?? null,
      railTxId: intent.railTxId ?? null,
      dstTxHash: intent.dstTxHash ?? null,
      retryCount: intent.retryCount,
      fallbackRail: intent.fallbackRail ?? null,
      errorMessage: intent.errorMessage ?? null,
      partnerApiKey: intent.partnerApiKey ?? null,
    });

    return normalize(current) !== normalize(updated);
  }
}
