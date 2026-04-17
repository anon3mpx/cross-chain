import { Pool } from 'pg';
import { Intent, IntentStatus } from '../types';
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

export class IntentRepository {
  constructor(private readonly pool: Pool) {}

  async upsertIntent(intent: Intent): Promise<void> {
    const row = toIntentRow(intent);
    await this.pool.query(
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

  async appendIntentEvent(event: IntentEventWrite): Promise<void> {
    await this.pool.query(
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
        event.eventSource ?? 'intent-engine',
        event.chainId ?? null,
        event.txHash ?? null,
        event.logIndex ?? null,
        event.idempotencyKey ?? null,
        event.occurredAt ?? null,
      ],
    );
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

    return rows.map(r => this.rowToIntent(r));
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
}
