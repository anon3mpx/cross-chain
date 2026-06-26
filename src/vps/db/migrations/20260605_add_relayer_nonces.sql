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
