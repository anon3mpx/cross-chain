ALTER TABLE intents
  ADD COLUMN IF NOT EXISTS solver_id TEXT;

ALTER TABLE route_outcomes
  ADD COLUMN IF NOT EXISTS solver_id TEXT;

CREATE INDEX IF NOT EXISTS idx_route_outcomes_solver_time
  ON route_outcomes(solver_id, observed_at DESC)
  WHERE solver_id IS NOT NULL;

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
