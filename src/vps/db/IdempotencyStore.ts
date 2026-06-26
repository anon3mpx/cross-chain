// ─────────────────────────────────────────────────────────────────────────────
// IdempotencyStore — DB-backed lease lock over `idempotency_keys`.
//
// Audit fixes addressed:
//   V1  CCTP attestation worker double-relay (two workers / restart could
//       both submit the destination receiveMessage, double-minting USDC).
//   A4 / A32  Concurrent /quote/select calls on same offerId duplicating
//       intent creation.
//   V2  Recovery engine cross-instance re-entrancy.
//
// Semantics:
//   • acquire(scope, key, ttlMs) — atomic.  Returns { acquired: true } when
//     this caller wins the lock, { acquired: false } when someone else holds
//     it (or held it within the cooldown).
//   • release(scope, key) — best-effort cleanup so the row can be reclaimed
//     before its TTL.  Failing to release is non-fatal (the TTL takes over).
//   • Multi-instance safe: relies on Postgres' INSERT…ON CONFLICT DO NOTHING
//     RETURNING contract.  No advisory lock state held on the connection.
//
// Storage notes:
//   • Re-uses the existing idempotency_keys table (schema.sql §6).
//   • TTL acts as an upper bound; release() clears the row earlier.
//   • A nightly housekeeping job should prune `expires_at < now()` to keep
//     the table small.  Cheap; deferred to Sprint 4 ops work.
// ─────────────────────────────────────────────────────────────────────────────

import type { Pool, PoolClient } from 'pg';

export type IdempotencyScope =
  | 'cctp:relay'           // V1 — CCTP destination relay lock per intent
  | 'recovery:cycle'       // V2 — RecoveryEngine cycle lease (multi-instance)
  | 'offer:select'         // A32 — POST /partner/quote/select dedup
  | 'webhook:dispatch'     // Sprint 4 — partner webhook dispatch dedup
  | 'admin:refund';        // Sprint 4 — admin refund mutation dedup

export interface AcquireResult {
  acquired: boolean;
  /** When acquired === false, the existing row's expiry (informational). */
  heldUntilMs?: number;
}

export interface IdempotencyStore {
  acquire(scope: IdempotencyScope, key: string, ttlMs: number, intentId?: string): Promise<AcquireResult>;
  release(scope: IdempotencyScope, key: string): Promise<void>;
}

export class PostgresIdempotencyStore implements IdempotencyStore {
  constructor(private readonly pool: Pool) {}

  async acquire(
    scope: IdempotencyScope,
    key: string,
    ttlMs: number,
    intentId?: string,
  ): Promise<AcquireResult> {
    if (ttlMs <= 0) throw new Error('IdempotencyStore.acquire: ttlMs must be > 0');

    // Try-insert.  ON CONFLICT DO NOTHING means: if a row already exists for
    // this (scope, key), the INSERT is a no-op and `xmax = 0` on RETURNING
    // tells us nothing came back.  The follow-up SELECT then differentiates
    // "another holder, alive" from "another holder, expired" — and in the
    // expired case we forcibly take it over with UPDATE.

    return this.withTransactionalClient(async (client) => {
      const insert = await client.query(
        `INSERT INTO idempotency_keys (scope, idempotency_key, intent_id, created_at, expires_at)
         VALUES ($1, $2, $3, NOW(), NOW() + ($4::bigint * INTERVAL '1 millisecond'))
         ON CONFLICT (scope, idempotency_key) DO NOTHING
         RETURNING expires_at`,
        [scope, key, intentId ?? null, ttlMs.toString()],
      );
      if (insert.rowCount && insert.rowCount > 0) {
        return { acquired: true };
      }

      // Lock already held — check whether it's still alive.
      const sel = await client.query(
        `SELECT expires_at FROM idempotency_keys
         WHERE scope = $1 AND idempotency_key = $2
         FOR UPDATE`,
        [scope, key],
      );
      if (sel.rowCount === 0) {
        // Edge case: row vanished between insert and select.  Retry insert.
        const retry = await client.query(
          `INSERT INTO idempotency_keys (scope, idempotency_key, intent_id, created_at, expires_at)
           VALUES ($1, $2, $3, NOW(), NOW() + ($4::bigint * INTERVAL '1 millisecond'))
           ON CONFLICT (scope, idempotency_key) DO NOTHING`,
          [scope, key, intentId ?? null, ttlMs.toString()],
        );
        return { acquired: (retry.rowCount ?? 0) > 0 };
      }
      const heldUntilMs = new Date(sel.rows[0].expires_at).getTime();
      if (heldUntilMs > Date.now()) {
        return { acquired: false, heldUntilMs };
      }

      // Expired — reclaim.
      await client.query(
        `UPDATE idempotency_keys
            SET intent_id   = $3,
                created_at  = NOW(),
                expires_at  = NOW() + ($4::bigint * INTERVAL '1 millisecond')
          WHERE scope = $1 AND idempotency_key = $2`,
        [scope, key, intentId ?? null, ttlMs.toString()],
      );
      return { acquired: true };
    });
  }

  async release(scope: IdempotencyScope, key: string): Promise<void> {
    try {
      await this.pool.query(
        `DELETE FROM idempotency_keys WHERE scope = $1 AND idempotency_key = $2`,
        [scope, key],
      );
    } catch (err) {
      // Best-effort — TTL will clean up.
      console.warn('[IdempotencyStore] release failed', err);
    }
  }

  private async withTransactionalClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const r = await fn(client);
      await client.query('COMMIT');
      return r;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

/** No-op implementation for tests / JSON-store mode (single-instance only). */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly held = new Map<string, number>();
  async acquire(scope: IdempotencyScope, key: string, ttlMs: number): Promise<AcquireResult> {
    const k = `${scope}:${key}`;
    const now = Date.now();
    const heldUntil = this.held.get(k);
    if (heldUntil && heldUntil > now) {
      return { acquired: false, heldUntilMs: heldUntil };
    }
    this.held.set(k, now + ttlMs);
    return { acquired: true };
  }
  async release(scope: IdempotencyScope, key: string): Promise<void> {
    this.held.delete(`${scope}:${key}`);
  }
}
