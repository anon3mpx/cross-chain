ALTER TABLE intents
  DROP CONSTRAINT IF EXISTS intents_rail_check;

ALTER TABLE intents
  ADD CONSTRAINT intents_rail_check
  CHECK (rail IN ('CCTP','AXELAR','LAYERZERO','VIA_LABS','WORMHOLE','THORCHAIN','GASZIP','HYPERLANE_NEXUS'));

ALTER TABLE intents
  DROP CONSTRAINT IF EXISTS intents_fallback_rail_check;

ALTER TABLE intents
  ADD CONSTRAINT intents_fallback_rail_check
  CHECK (fallback_rail IS NULL OR fallback_rail IN ('CCTP','AXELAR','LAYERZERO','VIA_LABS','WORMHOLE','THORCHAIN','GASZIP','HYPERLANE_NEXUS'));

ALTER TABLE intent_rail_attempts
  DROP CONSTRAINT IF EXISTS intent_rail_attempts_rail_check;

ALTER TABLE intent_rail_attempts
  ADD CONSTRAINT intent_rail_attempts_rail_check
  CHECK (rail IN ('CCTP','AXELAR','LAYERZERO','VIA_LABS','WORMHOLE','THORCHAIN','GASZIP','HYPERLANE_NEXUS'));
