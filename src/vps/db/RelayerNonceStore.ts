// ─────────────────────────────────────────────────────────────────────────────
// RelayerNonceStore — durable nonce reservation for relayer EOAs.
//
// Audit fix V6: the CCTP relay worker's per-call nonce came from the
// stateless ethers Wallet.  Concurrent destination relays on the same EOA
// collided, manifesting as "nonce too low" / "replacement underpriced".
//
// Reservation flow (Postgres impl):
//   BEGIN;
//     SELECT high_water_mark FROM relayer_nonce_cursor
//       WHERE chain_id=$1 AND signer_address=$2 FOR UPDATE;
//     onChain := provider.getTransactionCount(signer, 'pending');
//     candidate := max(high_water_mark + 1, onChain);
//     INSERT INTO relayer_nonces(chain_id, signer_address, nonce, intent_id, status)
//       VALUES (chain, signer, candidate, intentId, 'reserved');
//     UPDATE relayer_nonce_cursor SET high_water_mark = candidate WHERE ...;
//   COMMIT;
// On success/failure the caller marks the row (broadcast / confirmed) or
// releases (delete) so a future worker can re-claim that nonce.
//
// For JSON-store / no-Postgres mode an in-memory implementation provides
// single-instance safety (a Map keyed on (chain, signer) holding the
// high-water mark behind a Mutex-ish promise chain).
// ─────────────────────────────────────────────────────────────────────────────

import type { Pool, PoolClient } from 'pg';

export interface NonceReservation {
  chainId: number;
  signerAddress: string;
  nonce: bigint;
  intentId?: string;
}

export interface RelayerNonceStore {
  /**
   * Atomically reserve the next nonce for (chainId, signer).
   * `getOnChainPendingNonce` is called inside the transaction so we never
   * issue a nonce LOWER than what the chain already accepts.
   */
  reserve(
    chainId: number,
    signerAddress: string,
    intentId: string | undefined,
    getOnChainPendingNonce: () => Promise<bigint>,
  ): Promise<NonceReservation>;

  /** Mark a reservation as broadcast (got a tx hash). */
  markBroadcast(reservation: NonceReservation, txHash: string): Promise<void>;

  /** Mark a reservation as confirmed (mined). */
  markConfirmed(reservation: NonceReservation): Promise<void>;

  /**
   * Release a reservation — caller failed to broadcast, future workers can
   * reuse the nonce.  Postgres impl deletes the row.
   */
  release(reservation: NonceReservation): Promise<void>;
}

export class PostgresRelayerNonceStore implements RelayerNonceStore {
  constructor(private readonly pool: Pool) {}

  async reserve(
    chainId: number,
    signerAddress: string,
    intentId: string | undefined,
    getOnChainPendingNonce: () => Promise<bigint>,
  ): Promise<NonceReservation> {
    const lower = signerAddress.toLowerCase();
    const onChain = await getOnChainPendingNonce();

    return this.withTx(async (client) => {
      // Ensure the cursor row exists, then lock it for update.
      await client.query(
        `INSERT INTO relayer_nonce_cursor (chain_id, signer_address, high_water_mark)
         VALUES ($1, $2, $3)
         ON CONFLICT (chain_id, signer_address) DO NOTHING`,
        [chainId, lower, onChain.toString()],
      );
      const cur = await client.query(
        `SELECT high_water_mark FROM relayer_nonce_cursor
         WHERE chain_id = $1 AND signer_address = $2
         FOR UPDATE`,
        [chainId, lower],
      );
      const hwm = BigInt(cur.rows[0].high_water_mark);
      const candidate = hwm >= onChain ? hwm + 1n : onChain;

      await client.query(
        `INSERT INTO relayer_nonces (chain_id, signer_address, nonce, intent_id, status)
         VALUES ($1, $2, $3, $4, 'reserved')`,
        [chainId, lower, candidate.toString(), intentId ?? null],
      );
      await client.query(
        `UPDATE relayer_nonce_cursor SET high_water_mark = $3, updated_at = NOW()
         WHERE chain_id = $1 AND signer_address = $2`,
        [chainId, lower, candidate.toString()],
      );

      return { chainId, signerAddress: lower, nonce: candidate, intentId };
    });
  }

  async markBroadcast(r: NonceReservation, txHash: string): Promise<void> {
    await this.pool.query(
      `UPDATE relayer_nonces SET status='broadcast', tx_hash=$4, broadcast_at=NOW()
       WHERE chain_id=$1 AND signer_address=$2 AND nonce=$3`,
      [r.chainId, r.signerAddress.toLowerCase(), r.nonce.toString(), txHash],
    );
  }

  async markConfirmed(r: NonceReservation): Promise<void> {
    await this.pool.query(
      `UPDATE relayer_nonces SET status='confirmed', confirmed_at=NOW()
       WHERE chain_id=$1 AND signer_address=$2 AND nonce=$3`,
      [r.chainId, r.signerAddress.toLowerCase(), r.nonce.toString()],
    );
  }

  async release(r: NonceReservation): Promise<void> {
    // Two-step: (a) delete the reservation row, (b) clamp the cursor back
    // to the previous high-water mark if THIS reservation was at the top.
    await this.withTx(async (client) => {
      await client.query(
        `DELETE FROM relayer_nonces
         WHERE chain_id=$1 AND signer_address=$2 AND nonce=$3`,
        [r.chainId, r.signerAddress.toLowerCase(), r.nonce.toString()],
      );
      // Clamp cursor to the max remaining reservation, or to on-chain.
      await client.query(
        `UPDATE relayer_nonce_cursor
            SET high_water_mark = COALESCE(
              (SELECT MAX(nonce) FROM relayer_nonces
               WHERE chain_id=$1 AND signer_address=$2),
              high_water_mark - 1
            ),
            updated_at = NOW()
          WHERE chain_id=$1 AND signer_address=$2 AND high_water_mark = $3`,
        [r.chainId, r.signerAddress.toLowerCase(), r.nonce.toString()],
      );
    });
  }

  private async withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const out = await fn(client);
      await client.query('COMMIT');
      return out;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

/** In-memory fallback for JSON-store mode (single-instance only). */
export class InMemoryRelayerNonceStore implements RelayerNonceStore {
  private readonly hwm = new Map<string, bigint>();
  // Promise-chained mutex per key — guarantees in-process serialisation.
  private readonly locks = new Map<string, Promise<unknown>>();

  private key(chainId: number, signer: string): string {
    return `${chainId}:${signer.toLowerCase()}`;
  }

  private async withLock<T>(k: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(k) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((r) => { release = r; });
    this.locks.set(k, prev.then(() => next));
    try { await prev; return await fn(); } finally { release(); }
  }

  async reserve(
    chainId: number,
    signerAddress: string,
    intentId: string | undefined,
    getOnChainPendingNonce: () => Promise<bigint>,
  ): Promise<NonceReservation> {
    const k = this.key(chainId, signerAddress);
    return this.withLock(k, async () => {
      const onChain = await getOnChainPendingNonce();
      const hwm = this.hwm.get(k) ?? 0n;
      const candidate = hwm >= onChain ? hwm + 1n : onChain;
      this.hwm.set(k, candidate);
      return { chainId, signerAddress: signerAddress.toLowerCase(), nonce: candidate, intentId };
    });
  }
  async markBroadcast(): Promise<void> { /* no-op in-memory */ }
  async markConfirmed(): Promise<void> { /* no-op in-memory */ }
  async release(r: NonceReservation): Promise<void> {
    const k = this.key(r.chainId, r.signerAddress);
    await this.withLock(k, async () => {
      const cur = this.hwm.get(k);
      if (cur === r.nonce) this.hwm.set(k, cur - 1n);
    });
  }
}
