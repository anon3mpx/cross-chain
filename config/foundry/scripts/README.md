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

3. `DeployOFT.s.sol`
- Deploys `EmpxOFT` (LayerZero OFT token) on the current chain
- Supports chain-scoped env keys using suffixes, for example `LZ_ENDPOINT_421614`

4. `DeployITS.s.sol`
- Deploys/configures Axelar Interchain Tokens via ITS factory actions
- Supports chain-scoped env keys using suffixes, for example `ITS_ACTION_84532`

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

# Deploy custom OFT (writes tx on selected chain)
forge script config/foundry/scripts/DeployOFT.s.sol:DeployOFT \
  --config-path config/foundry.toml \
  --rpc-url "$RPC_URL" \
  --broadcast -vvv

# Deploy/configure Axelar ITS token action (writes tx on selected chain)
forge script config/foundry/scripts/DeployITS.s.sol:DeployITS \
  --config-path config/foundry.toml \
  --rpc-url "$RPC_URL" \
  --broadcast -vvv
```

## OFT Deploy Env Keys

Required:
- `DEPLOYER_PRIVATE_KEY`
- `OFT_NAME` or `OFT_NAME_<CHAIN_ID>`
- `OFT_SYMBOL` or `OFT_SYMBOL_<CHAIN_ID>`
- `LZ_ENDPOINT` or `LZ_ENDPOINT_<CHAIN_ID>`
- `OFT_OWNER` or `OFT_OWNER_<CHAIN_ID>`

Optional:
- `OFT_INITIAL_SUPPLY` or `OFT_INITIAL_SUPPLY_<CHAIN_ID>`
- `OFT_INITIAL_SUPPLY_RECIPIENT` or `OFT_INITIAL_SUPPLY_RECIPIENT_<CHAIN_ID>`

## ITS Deploy Env Keys

Required:
- `DEPLOYER_PRIVATE_KEY`
- `ITS_ACTION` or `ITS_ACTION_<CHAIN_ID>`
- `ITS_FACTORY` or `AXELAR_ITS` (factory is inferred from ITS if omitted)

Supported `ITS_ACTION` values:
- `DEPLOY_INTERCHAIN_TOKEN`
- `REGISTER_CANONICAL`
- `DEPLOY_REMOTE_INTERCHAIN_TOKEN`
- `DEPLOY_REMOTE_CANONICAL`
- `REGISTER_CUSTOM_TOKEN`
- `LINK_TOKEN`
- `APPROVE_REMOTE_MINTER`
- `REVOKE_REMOTE_MINTER`

Common optional:
- `ITS_CALL_VALUE` (msg.value sent to factory call)
- `ITS_GAS_VALUE` (cross-chain gas arg used by remote actions)

Action-specific:
- `DEPLOY_INTERCHAIN_TOKEN`: `ITS_SALT`, `ITS_TOKEN_NAME`, `ITS_TOKEN_SYMBOL`, `ITS_TOKEN_DECIMALS`, optional `ITS_INITIAL_SUPPLY`, `ITS_MINTER`
- `REGISTER_CANONICAL`: `ITS_TOKEN_ADDRESS`
- `DEPLOY_REMOTE_INTERCHAIN_TOKEN`: `ITS_SALT`, `ITS_DESTINATION_CHAIN`, optional `ITS_MINTER`, `ITS_DESTINATION_MINTER` or `ITS_DESTINATION_MINTER_BYTES`
- `DEPLOY_REMOTE_CANONICAL`: `ITS_TOKEN_ADDRESS`, `ITS_DESTINATION_CHAIN`
- `REGISTER_CUSTOM_TOKEN`: `ITS_SALT`, `ITS_TOKEN_ADDRESS`, `ITS_TOKEN_MANAGER_TYPE`, optional `ITS_OPERATOR`
- `LINK_TOKEN`: `ITS_SALT`, `ITS_DESTINATION_CHAIN`, `ITS_DESTINATION_TOKEN_ADDRESS` or `ITS_DESTINATION_TOKEN_BYTES`, `ITS_TOKEN_MANAGER_TYPE`, optional `ITS_LINK_PARAMS`
- `APPROVE_REMOTE_MINTER` / `REVOKE_REMOTE_MINTER`: `ITS_DEPLOYER`, `ITS_SALT`, `ITS_DESTINATION_CHAIN` (`APPROVE` also needs destination minter)

`ITS_TOKEN_MANAGER_TYPE` accepted values:
- `NATIVE_INTERCHAIN_TOKEN`
- `MINT_BURN_FROM`
- `LOCK_UNLOCK`
- `LOCK_UNLOCK_FEE`
- `MINT_BURN`

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

### LayerZero OFT trusted peer
- `LZ_OFT_SET_PEER=true`
- `LZ_OFT`
- `LZ_OFT_PEER_EID`
- `LZ_OFT_PEER_ADDRESS` (or `LZ_OFT_PEER` as bytes32)

## Notes

- `ConfigureAll` is idempotent for plugin registration (skips if already registered).
- Re-run `ConfigureAll` per route pair / chain as needed.
- Keep owner keys in multisig/secure signer flow for production.
