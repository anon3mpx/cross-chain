# Foundry Deployment Scripts

Directory: `config/foundry/scripts`

These scripts are fully env-driven. You add addresses/private key in your shell or `.env` before running.

## Scripts

1. `DeployAll.s.sol`
- Deploys core + optional components
- Always deploys: `PluginRegistry`, `RouterV1`, `ReceiverV1`
- Optionally deploys rails, adapters, swap plugins, paymaster when dependency env vars are set

2. `ConfigureAll.s.sol`
- Registers plugins in `PluginRegistry`
- Adds approved callers to `ReceiverV1`
- Configures route mappings for CCTP / Axelar / LayerZero / THORChain
- Configures trusted source/peer in adapters
- Configures paymaster signer/token rate
- Updates router fee recipient

## Required Env (Deploy)

- `DEPLOYER_PRIVATE_KEY`
- `OWNER`
- `FEE_RECIPIENT`
- `WETH`

## Optional Env (Deploy)

- `USDC`, `USDT` (legacy fallbacks)
- `CCTP_USDC` (Circle-native USDC for CCTP rail)
- `AXELAR_USDC` (aUSDC/axlUSDC for Axelar rail)
- `LAYERZERO_USDC` or `LZ_USDC` (LayerZero OFT settlement token)
- `THOR_USDC`, `THOR_USDT` (THOR settlement assets)
- `TOKEN_MESSENGER`
- `AXELAR_GAS_SERVICE`, `AXELAR_ITS`, `AXELAR_GATEWAY`
- `LZ_ENDPOINT`, `LZ_OFT`
- `THOR_ROUTER`
- `EMPSEAL_ROUTER`
- `UNIV2_ROUTER`
- `UNIV3_ROUTER`
- `ENTRYPOINT`, `PAYMASTER_SIGNER`

## Core Commands

```bash
# Deploy (writes txs on selected chain)
forge script config/foundry/scripts/DeployAll.s.sol:DeployAll \
  --config-path config/foundry.toml \
  --rpc-url "$RPC_URL" \
  --broadcast -vvv

# Configure (writes txs on selected chain)
forge script config/foundry/scripts/ConfigureAll.s.sol:ConfigureAll \
  --config-path config/foundry.toml \
  --rpc-url "$RPC_URL" \
  --broadcast -vvv
```

## Configure Script Env Keys

### Plugin Registry
- `PLUGIN_REGISTRY`
- `RAIL_PLUGIN_CCTP`
- `RAIL_PLUGIN_AXELAR`
- `RAIL_PLUGIN_LAYERZERO`
- `RAIL_PLUGIN_THORCHAIN`
- `SWAP_PLUGIN_EMPSEAL`
- `SWAP_PLUGIN_UNIV2`
- `SWAP_PLUGIN_UNIV3`

### Receiver approved callers
- `RECEIVER_V1`
- `RECEIVER_APPROVED_CALLER_1` ... `RECEIVER_APPROVED_CALLER_5`

### Router fee recipient
- `ROUTER_SET_FEE_RECIPIENT=true`
- `ROUTER_V1`
- `ROUTER_NEW_FEE_RECIPIENT`

### Paymaster
- `PAYMASTER`
- `PAYMASTER_SET_SIGNER=true`
- `PAYMASTER_NEW_SIGNER`
- `PAYMASTER_SET_TOKEN_RATE=true`
- `PAYMASTER_RATE_TOKEN`
- `PAYMASTER_RATE_VALUE`

### CCTP route
- `CCTP_SET_ROUTE=true`
- `CCTP_PLUGIN`
- `CCTP_ROUTE_CHAIN_ID`
- `CCTP_ROUTE_DOMAIN`
- `CCTP_ROUTE_RECEIVER`
- `CCTP_ROUTE_CALLER` (optional; `0x0` means any relayer can call `receiveMessage`)

### Axelar route
- `AXELAR_SET_ROUTE=true`
- `AXELAR_PLUGIN`
- `AXELAR_ROUTE_CHAIN_ID`
- `AXELAR_ROUTE_NAME`
- `AXELAR_ROUTE_RECEIVER`
- `AXELAR_ROUTE_TOKEN_ID`

### LayerZero route
- `LZ_SET_ROUTE=true`
- `LZ_PLUGIN`
- `LZ_ROUTE_CHAIN_ID`
- `LZ_ROUTE_EID`
- `LZ_ROUTE_RECEIVER`
- `LZ_ROUTE_OPTIONS` (hex bytes, optional)

### THORChain
- `THOR_PLUGIN`
- `THOR_SET_VAULT=true`
- `THOR_VAULT_CHAIN_ID`
- `THOR_VAULT_ADDRESS`
- `THOR_SET_ROUTER=true`
- `THOR_ROUTER`

### Axelar adapter trusted source
- `AXELAR_ADAPTER_SET_TRUSTED_SOURCE=true`
- `AXELAR_ADAPTER`
- `AXELAR_SOURCE_CHAIN`
- `AXELAR_SOURCE_ADDRESS`
- `AXELAR_SOURCE_TRUSTED=true`

### LayerZero adapter trusted peer
- `LZ_ADAPTER_SET_TRUSTED_PEER=true`
- `LZ_ADAPTER`
- `LZ_SOURCE_EID`
- `LZ_SOURCE_PEER`

## Notes

- `ConfigureAll` is idempotent for plugin registration (skips if already registered).
- Re-run `ConfigureAll` per route pair / chain as needed.
- Keep owner keys in multisig/secure signer flow for production.
