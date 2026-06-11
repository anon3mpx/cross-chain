ALTER TABLE intents
  ADD COLUMN IF NOT EXISTS parent_basket_id TEXT;

CREATE INDEX IF NOT EXISTS idx_intents_parent_basket
  ON intents(parent_basket_id, partner_id)
  WHERE parent_basket_id IS NOT NULL;

COMMENT ON COLUMN intents.parent_basket_id IS
  'When this intent is one leg of a multi-leg basket, the opaque basket id returned by the basket quote/execute flow.';

CREATE TABLE IF NOT EXISTS solvers (
  id                 TEXT PRIMARY KEY,
  type               TEXT NOT NULL CHECK (type IN ('internal','external','third-party')),
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
