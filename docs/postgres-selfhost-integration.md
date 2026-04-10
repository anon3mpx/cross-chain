# Postgres Schema + Integration Plan (Self-Hosted VPS)

This document maps the new Postgres schema to the current EMPX VPS code.

## Files Added
- `src/vps/db/schema.sql`
- `src/vps/db/postgres.ts`
- `src/vps/db/json.ts`
- `src/vps/db/IntentRepository.ts`
- `src/vps/db/IntentPersistence.ts`
- `src/vps/db/bootstrap.ts`
- `src/vps/db/index.ts`

## How Many Tables and Why

The schema uses **7 tables**.

1. `intents`
- Latest snapshot per intent.
- Primary key: `intent_id`.
- Used for fast status lookups and operational dashboards.

2. `intent_events`
- Immutable transition history (`QUOTED -> SUBMITTED -> IN_TRANSIT ...`).
- Foreign key: `intent_id -> intents.intent_id`.
- Source for audit/replay/reconciliation.

3. `intent_rail_attempts`
- One row per rail attempt/fallback attempt.
- Foreign key: `intent_id -> intents.intent_id`.
- Useful for RecoveryEngine analytics and retry control.

4. `chain_events`
- Normalized on-chain logs captured by EventMonitor.
- Optional foreign key: `intent_id -> intents.intent_id`.
- De-dup key: `(chain_id, tx_hash, log_index)`.

5. `chain_event_offsets`
- Scanner/listener checkpoints per chain+contract+event.
- Lets workers resume after restart without replay storms.

6. `idempotency_keys`
- Prevent duplicate quote/submit/recovery processing.
- Useful for HTTP retries and worker retries.

7. `task_outbox`
- Reliable async jobs (webhooks, reconciliation, delayed retries).
- Optional foreign key: `intent_id -> intents.intent_id`.

## Table Relationships
- `intents (1) -> (many) intent_events`
- `intents (1) -> (many) intent_rail_attempts`
- `intents (0/1) -> (many) chain_events`
- `intents (0/1) -> (many) idempotency_keys`
- `intents (0/1) -> (many) task_outbox`

`chain_event_offsets` is independent and keyed by `(chain_id, contract_address, event_name)`.

## How This Connects to Existing Files

## Intent lifecycle
- Existing producer: `src/vps/services/IntentEngine.ts`
- New adapter: `src/vps/db/IntentPersistence.ts`
- New repository: `src/vps/db/IntentRepository.ts`

Flow:
1. IntentEngine changes state in memory.
2. IntentPersistence listens via `onStateChange`.
3. Repository writes:
   - upsert snapshot to `intents`
   - append transition to `intent_events`

This gives durable storage **without forcing an immediate refactor** of all call paths.

## Event monitor
- Existing producer: `src/vps/services/EventMonitor.ts`
- Recommended next step: insert each observed on-chain log into `chain_events`, update `chain_event_offsets`.

## Recovery
- Existing producer: `src/vps/services/RecoveryEngine.ts`
- Recommended next step: write per-attempt rows to `intent_rail_attempts`.

## APIs
- Existing readers: `src/vps/api/StatusAPI.ts`, `src/vps/api/PartnerAPI.ts`
- Current mode: reads from in-memory IntentEngine.
- Recommended cutover:
  1. Keep writes dual-path (memory + Postgres) initially.
  2. Add DB-backed read paths in API.
  3. Then remove in-memory dependence if desired.

## Wiring It in Bootstrap

In your server bootstrap (where IntentEngine is created), add:

```ts
import { IntentEngine } from './services/IntentEngine';
import { attachPostgresIntentPersistence } from './db';

const intentEngine = new IntentEngine();

const { pool } = attachPostgresIntentPersistence(intentEngine, {
  onError: (err, ctx) => {
    console.error('[IntentPersistence]', ctx, err);
  },
});

process.on('SIGTERM', async () => {
  await pool.end();
});
```

## Migration Command

Use psql against your self-hosted Postgres:

```bash
psql "$DATABASE_URL" -f src/vps/db/schema.sql
```

## Env Variables (Self-Hosted)

- `DATABASE_URL` (preferred)
or
- `PGHOST`
- `PGPORT`
- `PGUSER`
- `PGPASSWORD`
- `PGDATABASE`
- `PGSSL=true|false`
- `PGPOOL_MAX`
- `PG_IDLE_TIMEOUT_MS`
- `PG_CONNECTION_TIMEOUT_MS`

## Recommended Rollout to Production

1. Deploy schema first.
2. Enable dual-write via `IntentPersistence`.
3. Verify parity between in-memory and DB for a soak period.
4. Move API reads to DB.
5. Add chain event + attempt logging.
6. Add retention/archival jobs.

## Retention Guidance

- `quote cache`: keep in Redis only.
- `intents + intent_events`: 12-24 months online minimum.
- Archive older records to cheaper storage if needed.
