ALTER TABLE intents
  ADD COLUMN IF NOT EXISTS integrator_id  TEXT,
  ADD COLUMN IF NOT EXISTS agent_id       TEXT,
  ADD COLUMN IF NOT EXISTS partner_id     TEXT,
  ADD COLUMN IF NOT EXISTS route_source   TEXT;

CREATE INDEX IF NOT EXISTS idx_intents_integrator_updated
  ON intents(integrator_id, updated_at DESC)
  WHERE integrator_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_intents_partner_updated
  ON intents(partner_id, updated_at DESC)
  WHERE partner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_intents_agent_updated
  ON intents(agent_id, updated_at DESC)
  WHERE agent_id IS NOT NULL;

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
CREATE INDEX IF NOT EXISTS idx_route_outcomes_intent_id
  ON route_outcomes(intent_id);
