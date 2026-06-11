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
                    CHECK (rail IN ('CCTP','AXELAR','LAYERZERO','VIA_LABS','WORMHOLE','THORCHAIN','GASZIP','HYPERLANE_NEXUS','CHAINFLIP','MAYA','TELESWAP')),
  fallback_rail      TEXT
                    CHECK (fallback_rail IS NULL OR fallback_rail IN ('CCTP','AXELAR','LAYERZERO','VIA_LABS','WORMHOLE','THORCHAIN','GASZIP','HYPERLANE_NEXUS','CHAINFLIP','MAYA','TELESWAP')),

  quote              JSONB NOT NULL,
  src_tx_hash        TEXT,
  rail_tx_id         TEXT,
  dst_tx_hash        TEXT,

  retry_count        INTEGER NOT NULL DEFAULT 0,
  error_message      TEXT,

  partner_api_key    CITEXT,
  partner_id         TEXT,
  integrator_id      TEXT,
  agent_id           TEXT,
  route_source       TEXT,
  parent_basket_id   TEXT,
  solver_id          TEXT,
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
CREATE INDEX IF NOT EXISTS idx_intents_integrator_updated
  ON intents(integrator_id, updated_at DESC)
  WHERE integrator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_intents_partner_updated
  ON intents(partner_id, updated_at DESC)
  WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_intents_agent_updated
  ON intents(agent_id, updated_at DESC)
  WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_intents_lz_value_transfer_quote_id
  ON intents((quote->>'layerZeroValueTransferApiQuoteId'))
  WHERE quote ? 'layerZeroValueTransferApiQuoteId';
CREATE INDEX IF NOT EXISTS idx_intents_parent_basket
  ON intents(parent_basket_id, partner_id)
  WHERE parent_basket_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_intents_updated_at ON intents;
CREATE TRIGGER trg_intents_updated_at
BEFORE UPDATE ON intents
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMENT ON COLUMN intents.parent_basket_id IS
  'When this intent is one leg of a multi-leg basket, the opaque basket id returned by the basket quote/execute flow.';

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

DROP TRIGGER IF EXISTS trg_intent_refund_cases_updated_at ON intent_refund_cases;
CREATE TRIGGER trg_intent_refund_cases_updated_at
BEFORE UPDATE ON intent_refund_cases
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 2c) intent_provider_transfers: provider-direct rail status snapshots
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intent_provider_transfers (
  id                     BIGSERIAL PRIMARY KEY,
  intent_id              TEXT NOT NULL REFERENCES intents(intent_id) ON DELETE CASCADE,

  provider               TEXT NOT NULL
                         CHECK (provider IN ('layerzero_value_transfer_api','thorchain_api','hyperlane_explorer','chainflip_broker','maya_midgard','teleswap_api')),
  provider_quote_id      TEXT NOT NULL,

  status                 TEXT NOT NULL DEFAULT 'CREATED'
                         CHECK (status IN (
                           'CREATED','USER_STEPS_BUILT','SUBMITTED','IN_TRANSIT',
                           'SETTLED','FAILED','EXPIRED'
                         )),

  source_tx_hash         TEXT,
  source_signature       TEXT,
  destination_tx_hash    TEXT,
  latest_provider_status TEXT,
  route_step_types       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  metadata               JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_error_payload      JSONB,
  last_polled_at         TIMESTAMPTZ,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_intent_provider_transfer UNIQUE (intent_id, provider, provider_quote_id)
);

CREATE INDEX IF NOT EXISTS idx_intent_provider_transfers_intent
  ON intent_provider_transfers(intent_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_intent_provider_transfers_provider_status
  ON intent_provider_transfers(provider, status, updated_at DESC);

DROP TRIGGER IF EXISTS trg_intent_provider_transfers_updated_at ON intent_provider_transfers;
CREATE TRIGGER trg_intent_provider_transfers_updated_at
BEFORE UPDATE ON intent_provider_transfers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 2d) solvers: external solver registry / control plane
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS solvers (
  id                 TEXT PRIMARY KEY,
  type               TEXT NOT NULL
                    CHECK (type IN ('internal','external','third-party')),
  display_name       TEXT NOT NULL,
  contact_email      CITEXT,
  capabilities       JSONB NOT NULL DEFAULT '{}'::jsonb,
  reliability        JSONB,
  active             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_solvers_updated_at ON solvers;
CREATE TRIGGER trg_solvers_updated_at
BEFORE UPDATE ON solvers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_solvers_type_active
  ON solvers(type, active);

-- -----------------------------------------------------------------------------
-- 2e) intent_baskets: durable basket quote / execution records
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intent_baskets (
  basket_id           TEXT PRIMARY KEY,
  mode                TEXT NOT NULL,
  basket_payload      JSONB NOT NULL,
  quote_payload       JSONB,
  execution_plan      JSONB,
  user_address        CITEXT,
  partner_id          TEXT,
  integrator_id       TEXT,
  agent_id            TEXT,
  route_source        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_intent_baskets_updated_at ON intent_baskets;
CREATE TRIGGER trg_intent_baskets_updated_at
BEFORE UPDATE ON intent_baskets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_intent_baskets_partner_time
  ON intent_baskets(partner_id, updated_at DESC)
  WHERE partner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_intent_baskets_user_time
  ON intent_baskets(user_address, updated_at DESC)
  WHERE user_address IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3) intent_rail_attempts: each submit/fallback attempt per intent
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS intent_rail_attempts (
  id                 BIGSERIAL PRIMARY KEY,
  intent_id          TEXT NOT NULL REFERENCES intents(intent_id) ON DELETE CASCADE,
  attempt_no         INTEGER NOT NULL,

  rail               TEXT NOT NULL
                    CHECK (rail IN ('CCTP','AXELAR','LAYERZERO','VIA_LABS','WORMHOLE','THORCHAIN','GASZIP','HYPERLANE_NEXUS','CHAINFLIP','MAYA','TELESWAP')),

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

DROP TRIGGER IF EXISTS trg_chain_event_offsets_updated_at ON chain_event_offsets;
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

DROP TRIGGER IF EXISTS trg_task_outbox_updated_at ON task_outbox;
CREATE TRIGGER trg_task_outbox_updated_at
BEFORE UPDATE ON task_outbox
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 8) route_outcomes: durable reliability history
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS route_outcomes (
  id                 BIGSERIAL PRIMARY KEY,
  intent_id          TEXT        NOT NULL,
  route_signature    TEXT        NOT NULL,
  rail               TEXT        NOT NULL,
  src_chain_id       INTEGER     NOT NULL,
  dst_chain_id       INTEGER     NOT NULL,
  src_token          TEXT        NOT NULL,
  dst_token          TEXT        NOT NULL,
  quoted_out         NUMERIC(80,0),
  quoted_eta_s       INTEGER,
  quoted_fee_usd     DOUBLE PRECISION,
  actual_out         NUMERIC(80,0),
  actual_eta_s       INTEGER,
  actual_fee_usd     DOUBLE PRECISION,
  status             TEXT        NOT NULL CHECK (status IN ('SETTLED', 'FAILED', 'STUCK')),
  failure_reason     TEXT,
  partner_id         TEXT,
  integrator_id      TEXT,
  agent_id           TEXT,
  route_source       TEXT,
  solver_id          TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at         TIMESTAMPTZ,
  observed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  execution_mode     TEXT,
  offer_type         TEXT
);

CREATE INDEX IF NOT EXISTS idx_route_outcomes_signature_time
  ON route_outcomes(route_signature, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_route_outcomes_rail_time
  ON route_outcomes(rail, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_route_outcomes_integrator_time
  ON route_outcomes(integrator_id, observed_at DESC)
  WHERE integrator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_route_outcomes_partner_time
  ON route_outcomes(partner_id, observed_at DESC)
  WHERE partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_route_outcomes_agent_time
  ON route_outcomes(agent_id, observed_at DESC)
  WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_route_outcomes_solver_time
  ON route_outcomes(solver_id, observed_at DESC)
  WHERE solver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_route_outcomes_intent_id
  ON route_outcomes(intent_id);

-- -----------------------------------------------------------------------------
-- 9) relayer_nonces: cross-instance relayer nonce reservation
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS relayer_nonces (
  chain_id           INTEGER NOT NULL,
  signer_address     CITEXT  NOT NULL,
  nonce              BIGINT  NOT NULL,
  intent_id          TEXT,
  tx_hash            TEXT,
  status             TEXT NOT NULL DEFAULT 'reserved'
                    CHECK (status IN ('reserved','broadcast','confirmed','failed')),
  reserved_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  broadcast_at       TIMESTAMPTZ,
  confirmed_at       TIMESTAMPTZ,
  PRIMARY KEY (chain_id, signer_address, nonce)
);

CREATE INDEX IF NOT EXISTS idx_relayer_nonces_signer_status
  ON relayer_nonces(chain_id, signer_address, status);
CREATE INDEX IF NOT EXISTS idx_relayer_nonces_intent
  ON relayer_nonces(intent_id) WHERE intent_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS relayer_nonce_cursor (
  chain_id           INTEGER NOT NULL,
  signer_address     CITEXT  NOT NULL,
  high_water_mark    BIGINT  NOT NULL DEFAULT 0,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_id, signer_address)
);

COMMIT;
