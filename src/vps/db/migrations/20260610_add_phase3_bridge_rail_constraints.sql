BEGIN;

ALTER TABLE intents
  DROP CONSTRAINT IF EXISTS intents_rail_check,
  ADD CONSTRAINT intents_rail_check
    CHECK (rail IN (
      'CCTP','AXELAR','LAYERZERO','VIA_LABS','WORMHOLE',
      'THORCHAIN','GASZIP','HYPERLANE_NEXUS','CHAINFLIP','MAYA','TELESWAP'
    ));

ALTER TABLE intents
  DROP CONSTRAINT IF EXISTS intents_fallback_rail_check,
  ADD CONSTRAINT intents_fallback_rail_check
    CHECK (fallback_rail IS NULL OR fallback_rail IN (
      'CCTP','AXELAR','LAYERZERO','VIA_LABS','WORMHOLE',
      'THORCHAIN','GASZIP','HYPERLANE_NEXUS','CHAINFLIP','MAYA','TELESWAP'
    ));

ALTER TABLE intent_rail_attempts
  DROP CONSTRAINT IF EXISTS intent_rail_attempts_rail_check,
  ADD CONSTRAINT intent_rail_attempts_rail_check
    CHECK (rail IN (
      'CCTP','AXELAR','LAYERZERO','VIA_LABS','WORMHOLE',
      'THORCHAIN','GASZIP','HYPERLANE_NEXUS','CHAINFLIP','MAYA','TELESWAP'
    ));

ALTER TABLE intent_provider_transfers
  DROP CONSTRAINT IF EXISTS intent_provider_transfers_provider_check,
  ADD CONSTRAINT intent_provider_transfers_provider_check
    CHECK (provider IN (
      'layerzero_value_transfer_api',
      'thorchain_api',
      'hyperlane_explorer',
      'chainflip_broker',
      'maya_midgard',
      'teleswap_api'
    ));

COMMIT;
