-- EMPX VPS Postgres schema (self-host friendly)
-- This schema is designed for the current VPS services:
--   IntentEngine, EventMonitor, RecoveryEngine, QuoteEngine

BEGIN;

-- Optional but useful for case-insensitive addresses/keys.
CREATE EXTENSION IF NOT EXISTS citext;

-- Shared trigger for updated_at maintenance.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 1) intents: latest state snapshot for each intent
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intents (
  intent_id          TEXT PRIMARY KEY
                    CHECK (intent_id ~ '^0x[0-9a-fA-F]{64}$'),

  status             TEXT NOT NULL
                    CHECK (status IN (
                      'CREATED','QUOTED','CANCELLED','SUBMITTED','IN_TRANSIT','DESTINATION_RECEIVED',
                      'SETTLED','STUCK','RECOVERING','FAILED'
                    )),

  user_address       CITEXT NOT NULL,
  src_chain_id       INTEGER NOT NULL,
  dst_chain_id       INTEGER NOT NULL,

  rail               TEXT NOT NULL
                    CHECK (rail IN ('CCTP','AXELAR','LAYERZERO','VIA_LABS','WORMHOLE','THORCHAIN')),
  fallback_rail      TEXT
                    CHECK (fallback_rail IS NULL OR fallback_rail IN ('CCTP','AXELAR','LAYERZERO','VIA_LABS','WORMHOLE','THORCHAIN')),

  quote              JSONB NOT NULL,
  src_tx_hash        TEXT,
  rail_tx_id         TEXT,
  dst_tx_hash        TEXT,

  retry_count        INTEGER NOT NULL DEFAULT 0,
  error_message      TEXT,

  partner_api_key    CITEXT,
  version            BIGINT NOT NULL DEFAULT 0,

  created_at         TIMESTAMPTZ NOT NULL,
  updated_at         TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_intents_status_updated_at
  ON intents(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_intents_created_at
  ON intents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intents_src_dst
  ON intents(src_chain_id, dst_chain_id);
CREATE INDEX IF NOT EXISTS idx_intents_user_address
  ON intents(user_address);

CREATE TRIGGER trg_intents_updated_at
BEFORE UPDATE ON intents
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 2) intent_events: immutable state transitions / audit trail
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intent_events (
  id                 BIGSERIAL PRIMARY KEY,
  intent_id          TEXT NOT NULL REFERENCES intents(intent_id) ON DELETE CASCADE,

  prev_status        TEXT,
  new_status         TEXT NOT NULL
                    CHECK (new_status IN (
                      'CREATED','QUOTED','CANCELLED','SUBMITTED','IN_TRANSIT','DESTINATION_RECEIVED',
                      'SETTLED','STUCK','RECOVERING','FAILED'
                    )),

  patch              JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor              TEXT NOT NULL DEFAULT 'system',
  event_source       TEXT NOT NULL DEFAULT 'intent-engine',

  chain_id           INTEGER,
  tx_hash            TEXT,
  log_index          INTEGER,

  idempotency_key    TEXT,
  occurred_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_intent_event_idempotency UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_intent_events_intent_time
  ON intent_events(intent_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_intent_events_chain_tx
  ON intent_events(chain_id, tx_hash, log_index);

-- -----------------------------------------------------------------------------
-- 2b) intent_refund_cases: manual review / rescue / reimbursement workflow
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intent_refund_cases (
  intent_id          TEXT PRIMARY KEY REFERENCES intents(intent_id) ON DELETE CASCADE,
  status             TEXT NOT NULL
                    CHECK (status IN (
                      'REQUESTED','UNDER_REVIEW','APPROVED','REJECTED','PROCESSING','COMPLETED'
                    )),

  reason             TEXT NOT NULL,
  requested_by       CITEXT,
  requested_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  reviewed_by        TEXT,
  reviewed_at        TIMESTAMPTZ,
  review_notes       TEXT,
  admin_notes        TEXT,

  custody_location   TEXT NOT NULL DEFAULT 'UNKNOWN'
                    CHECK (custody_location IN (
                      'UNKNOWN','ROUTER','RECEIVER','AXELAR_ADAPTER','LAYERZERO_ADAPTER',
                      'THORCHAIN_ROUTER','CCTP_PROTOCOL','AXELAR_PROTOCOL','LAYERZERO_PROTOCOL',
                      'EXTERNAL_PROTOCOL'
                    )),
  resolution_kind    TEXT
                    CHECK (resolution_kind IS NULL OR resolution_kind IN (
                      'ONCHAIN_RESCUE','OFFCHAIN_COMPENSATION','PROTOCOL_RECOVERY'
                    )),

  rescue_contract    CITEXT,
  rescue_token       CITEXT,
  rescue_amount      TEXT,
  rescue_tx_hash     TEXT,
  payout_address     CITEXT,
  payout_tx_hash     TEXT,

  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intent_refund_cases_status
  ON intent_refund_cases(status, updated_at DESC);

CREATE TRIGGER trg_intent_refund_cases_updated_at
BEFORE UPDATE ON intent_refund_cases
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 3) intent_rail_attempts: each submit/fallback attempt per intent
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intent_rail_attempts (
  id                 BIGSERIAL PRIMARY KEY,
  intent_id          TEXT NOT NULL REFERENCES intents(intent_id) ON DELETE CASCADE,
  attempt_no         INTEGER NOT NULL,

  rail               TEXT NOT NULL
                    CHECK (rail IN ('CCTP','AXELAR','LAYERZERO','VIA_LABS','WORMHOLE','THORCHAIN')),

  status             TEXT NOT NULL
                    CHECK (status IN ('PENDING','SUBMITTED','IN_TRANSIT','SETTLED','FAILED','CANCELLED')),

  reason             TEXT,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at        TIMESTAMPTZ,

  CONSTRAINT uq_attempt_per_intent UNIQUE (intent_id, attempt_no)
);

CREATE INDEX IF NOT EXISTS idx_intent_rail_attempts_intent
  ON intent_rail_attempts(intent_id, attempt_no DESC);

-- -----------------------------------------------------------------------------
-- 4) chain_events: normalized on-chain logs observed by EventMonitor
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chain_events (
  id                 BIGSERIAL PRIMARY KEY,
  chain_id           INTEGER NOT NULL,
  block_number       BIGINT NOT NULL,
  tx_hash            TEXT NOT NULL,
  log_index          INTEGER NOT NULL,

  contract_address   CITEXT NOT NULL,
  event_name         TEXT NOT NULL,
  intent_id          TEXT REFERENCES intents(intent_id) ON DELETE SET NULL,

  payload            JSONB NOT NULL,
  observed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_chain_event UNIQUE (chain_id, tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_chain_events_intent
  ON chain_events(intent_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_chain_events_chain_block
  ON chain_events(chain_id, block_number DESC);

-- -----------------------------------------------------------------------------
-- 5) chain_event_offsets: checkpoints for resumable scanners/listeners
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chain_event_offsets (
  chain_id           INTEGER NOT NULL,
  contract_address   CITEXT NOT NULL,
  event_name         TEXT NOT NULL,

  last_block         BIGINT NOT NULL,
  last_tx_hash       TEXT,
  last_log_index     INTEGER,

  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_id, contract_address, event_name)
);

CREATE TRIGGER trg_chain_event_offsets_updated_at
BEFORE UPDATE ON chain_event_offsets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 6) idempotency_keys: protects quote/submit/recovery from duplicate processing
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS idempotency_keys (
  scope              TEXT NOT NULL,
  idempotency_key    TEXT NOT NULL,
  intent_id          TEXT REFERENCES intents(intent_id) ON DELETE SET NULL,

  response           JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at         TIMESTAMPTZ NOT NULL,

  PRIMARY KEY (scope, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at
  ON idempotency_keys(expires_at);

-- -----------------------------------------------------------------------------
-- 7) task_outbox: reliable async jobs (webhooks, reconciliation, retries)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_outbox (
  id                 BIGSERIAL PRIMARY KEY,
  task_type          TEXT NOT NULL,
  intent_id          TEXT REFERENCES intents(intent_id) ON DELETE SET NULL,

  payload            JSONB NOT NULL,
  status             TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','RUNNING','DONE','FAILED','CANCELLED')),

  retry_count        INTEGER NOT NULL DEFAULT 0,
  max_retries        INTEGER NOT NULL DEFAULT 10,
  run_after          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error         TEXT,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_outbox_runnable
  ON task_outbox(status, run_after);

CREATE TRIGGER trg_task_outbox_updated_at
BEFORE UPDATE ON task_outbox
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;
