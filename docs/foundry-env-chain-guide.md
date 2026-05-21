# Foundry Env Guide (Chain-by-Chain)

This guide explains how to maintain env variables for:

- `config/foundry/scripts/DeployAll.s.sol`
- `config/foundry/scripts/ConfigureAll.s.sol`

Related runtime registries:

- [deploymentRegistry.ts](/Users/ganadhish/code/work/ruflo/src/vps/config/deploymentRegistry.ts)
- [routeMetadata.ts](/Users/ganadhish/code/work/ruflo/src/vps/config/routeMetadata.ts)

It is written to replace scattered chain-specific notes like `docs/root-notes/currentEnvOnBaseSepolia.md` and `docs/root-notes/currentEnvOnArbSepolia.md`.

## 1) Important: How These Scripts Read Env

Both scripts read **flat, unprefixed env keys** from the currently loaded shell/.env values.

Examples:

- `RPC_URL`
- `OWNER`
- `CCTP_PLUGIN`
- `AXELAR_ROUTE_CHAIN_ID`

They do **not** read `CHAIN_<id>_*` keys directly.

`CHAIN_<id>_*` keys are used by VPS runtime config, not by these Foundry scripts.

Deployed contract addresses should now live primarily in [deploymentRegistry.ts](/Users/ganadhish/code/work/ruflo/src/vps/config/deploymentRegistry.ts:1).  
Foundry still uses flat env for the active execution context, but the VPS runtime and route-config planner read the typed registry first.

## 2) Recommended Maintenance Model

Use one `.env` file with:

1. A per-chain inventory section (source of truth).
2. One small "ACTIVE CHAIN" section that you update before each run.

This keeps all chain data in one place and avoids managing multiple separate markdown env files.

## 3) DeployAll.s.sol Env Reference

### Required for every deploy run

- `DEPLOYER_PRIVATE_KEY`
- `OWNER`
- `FEE_RECIPIENT`
- `WETH`

### Optional deploy modules

- Paymaster:
- `ENTRYPOINT`, `PAYMASTER_SIGNER`

- Swap plugins:
- `EMPSEAL_ROUTER`
- `UNIV2_ROUTER`
- `UNIV3_ROUTER`

- Rail plugin token inputs (recommended rail-specific):
- `CCTP_USDC`
- `AXELAR_USDC`
- `LAYERZERO_USDC` (or `LZ_USDC`)
- `THOR_USDC`, `THOR_USDT`
- Legacy fallback: `USDC`, `USDT`

- Rail infra dependencies:
- CCTP: `TOKEN_MESSENGER`
- Axelar: `AXELAR_GAS_SERVICE`, `AXELAR_ITS`
- Axelar adapter: `AXELAR_GATEWAY`
- LayerZero: `LZ_ENDPOINT`, `LZ_OFT`
- THOR: `THOR_ROUTER`

## 4) ConfigureAll.s.sol Env Reference

`ConfigureAll` is block-based and opt-in. A block runs only if its enable flag is `true` (or if the block has no flag and required addresses are non-zero).

### Baseline required

- `DEPLOYER_PRIVATE_KEY`

### A) Registry wiring

- `PLUGIN_REGISTRY`
- `RAIL_PLUGIN_CCTP`
- `RAIL_PLUGIN_AXELAR`
- `RAIL_PLUGIN_LAYERZERO`
- `RAIL_PLUGIN_THORCHAIN`
- `SWAP_PLUGIN_EMPSEAL`
- `SWAP_PLUGIN_UNIV2`
- `SWAP_PLUGIN_UNIV3`

### B) Receiver approvals

- `RECEIVER_V1`
- `RECEIVER_APPROVED_CALLER_1..5`

Use these for local inbound callers on this chain:

- Axelar flow: local `AxelarReceiverAdapter`
- LayerZero flow: local `LayerZeroReceiverAdapter`

### C) Router fee recipient update (optional)

- `ROUTER_SET_FEE_RECIPIENT=true`
- `ROUTER_V1`
- `ROUTER_NEW_FEE_RECIPIENT`

### D) Paymaster updates (optional)

- `PAYMASTER`
- `PAYMASTER_SET_SIGNER`, `PAYMASTER_NEW_SIGNER`
- `PAYMASTER_SET_TOKEN_RATE`, `PAYMASTER_RATE_TOKEN`, `PAYMASTER_RATE_VALUE`

### E) CCTP route config

- `CCTP_SET_ROUTE=true`
- `CCTP_PLUGIN`
- `CCTP_ROUTE_CHAIN_ID`
- `CCTP_ROUTE_DOMAIN`
- `CCTP_ROUTE_RECEIVER`
- `CCTP_ROUTE_CALLER` (optional; set `0x0` to allow any relayer)

### F) Axelar route config

- `AXELAR_SET_ROUTE=true`
- `AXELAR_PLUGIN`
- `AXELAR_ROUTE_CHAIN_ID`
- `AXELAR_ROUTE_NAME`
- `AXELAR_ROUTE_RECEIVER`

This is pair-scoped on the source chain. There is no per-asset Axelar source route row anymore.

### G) LayerZero route config

- `LZ_SET_ROUTE=true`
- `LZ_PLUGIN`
- `LZ_ROUTE_CHAIN_ID`
- `LZ_ROUTE_EID`
- `LZ_ROUTE_RECEIVER`
- `LZ_ROUTE_FAMILY`
- `LZ_ROUTE_OPTIONS`

This is pair + family scoped on the source chain. There is no per-asset `LZ_ROUTE_OFT` or `LZ_ROUTE_TOKEN` in source route config anymore.

### H) THOR config

- `THOR_PLUGIN`
- `THOR_SET_VAULT`, `THOR_VAULT_CHAIN_ID`, `THOR_VAULT_ADDRESS`
- `THOR_SET_ROUTER`, `THOR_ROUTER`

### I) Axelar adapter trust

- `AXELAR_ADAPTER_SET_TRUSTED_SOURCE=true`
- `AXELAR_ADAPTER` (local chain adapter)
- `AXELAR_SOURCE_CHAIN` (remote chain Axelar name)
- `AXELAR_SOURCE_ADDRESS` (remote chain AxelarRailPlugin address)
- `AXELAR_SOURCE_TRUSTED=true`
- `AXELAR_TRUSTED_TOKEN_ID`
- `AXELAR_TRUSTED_TOKEN`

### J) LayerZero adapter trust

- `LZ_ADAPTER_SET_TRUSTED_PEER=true`
- `LZ_ADAPTER`
- `LZ_SOURCE_EID`
- `LZ_SOURCE_PEER`

### K) LayerZero adapter asset registry

- `LZ_ADAPTER_SET_ASSET=true`
- `LZ_ADAPTER`
- `LZ_SOURCE_EID`
- `LZ_SETTLEMENT_TOKEN`
- `LZ_COMPOSE_SENDER`

## 5) Chain-Wise Update Workflow

Do this for each chain pass.

1. Choose active local chain.
2. Set active core vars:
- `RPC_URL`, `WETH`, token inputs (`CCTP_USDC`, `AXELAR_USDC`, etc.)
- infra addresses (`TOKEN_MESSENGER`, `AXELAR_*`, `LZ_*`)
3. Run deploy:
- `npm run sol:deploy:all`
4. Fill active configure vars with deployed local addresses:
- `PLUGIN_REGISTRY`, `ROUTER_V1`, `RECEIVER_V1`, `RAIL_PLUGIN_*`, `SWAP_PLUGIN_*`
5. Add route to remote chain:
- CCTP route fields targeting remote chain IDs and receiver/adapters.
- Axelar pair config on the source chain.
- LayerZero family config on the source chain.
6. Add local receiver approvals:
- set local adapter(s) in `RECEIVER_APPROVED_CALLER_*`.
7. Configure destination trust and asset rows:
- Axelar trusted source + trusted tokens.
- LayerZero trusted peer + destination asset registry rows.
8. Run configure:
- `npm run sol:configure:all`
9. Switch active block to next chain and repeat.

## 6) Base Sepolia ↔ Arbitrum Sepolia Direction Guide

### If active local chain is Base Sepolia (84532)

- Remote chain is Arbitrum Sepolia (`421614`)
- `AXELAR_ROUTE_CHAIN_ID=421614`
- `AXELAR_ROUTE_NAME=arbitrum-sepolia`
- `AXELAR_ADAPTER` = Base AxelarReceiverAdapter
- `AXELAR_SOURCE_CHAIN=arbitrum-sepolia`
- `AXELAR_SOURCE_ADDRESS` = Arbitrum AxelarRailPlugin
- `RECEIVER_APPROVED_CALLER_1` = Base AxelarReceiverAdapter

### If active local chain is Arbitrum Sepolia (421614)

- Remote chain is Base Sepolia (`84532`)
- `AXELAR_ROUTE_CHAIN_ID=84532`
- `AXELAR_ROUTE_NAME=base-sepolia`
- `AXELAR_ADAPTER` = Arbitrum AxelarReceiverAdapter
- `AXELAR_SOURCE_CHAIN=base-sepolia`
- `AXELAR_SOURCE_ADDRESS` = Base AxelarRailPlugin
- `RECEIVER_APPROVED_CALLER_1` = Arbitrum AxelarReceiverAdapter

## 7) What Usually Breaks

- Mixing local and remote addresses in adapter trust fields.
- Using adapter address instead of remote AxelarRailPlugin for `AXELAR_SOURCE_ADDRESS`.
- Forgetting to set `RECEIVER_APPROVED_CALLER_*` for local adapters.
- Leaving old chain values in active vars when switching chain.
- Providing wrong Axelar chain name spelling (`base-sepolia`, `arbitrum-sepolia`).
- Forgetting `AXELAR_TRUSTED_TOKEN_ID` / `AXELAR_TRUSTED_TOKEN` on the destination chain.
- Forgetting `LZ_ROUTE_FAMILY` for LayerZero source config.
- Forgetting `LZ_SETTLEMENT_TOKEN` / `LZ_COMPOSE_SENDER` on the destination chain.

## 8) Minimal "Active Block" Template

Use this as the part you edit each pass.

```bash
# Active chain
RPC_URL=
WETH=
DEPLOYER_PRIVATE_KEY=
OWNER=
FEE_RECIPIENT=

# Active local deploy dependencies
CCTP_USDC=
AXELAR_USDC=
LAYERZERO_USDC=
TOKEN_MESSENGER=
AXELAR_GAS_SERVICE=
AXELAR_ITS=
AXELAR_GATEWAY=
LZ_ENDPOINT=
LZ_OFT=

# Active local deployed addresses
PLUGIN_REGISTRY=
ROUTER_V1=
RECEIVER_V1=
RAIL_PLUGIN_CCTP=
RAIL_PLUGIN_AXELAR=
RAIL_PLUGIN_LAYERZERO=
SWAP_PLUGIN_UNIV2=
SWAP_PLUGIN_UNIV3=

# Receiver approvals (local callers)
RECEIVER_APPROVED_CALLER_1=
RECEIVER_APPROVED_CALLER_2=0x0000000000000000000000000000000000000000

# Route toggles and values
CCTP_SET_ROUTE=false
AXELAR_SET_ROUTE=false
LZ_SET_ROUTE=false

# CCTP route
CCTP_PLUGIN=
CCTP_ROUTE_CHAIN_ID=
CCTP_ROUTE_DOMAIN=
CCTP_ROUTE_RECEIVER=
CCTP_ROUTE_CALLER=0x0000000000000000000000000000000000000000

# Axelar route
AXELAR_PLUGIN=
AXELAR_ROUTE_CHAIN_ID=
AXELAR_ROUTE_NAME=
AXELAR_ROUTE_RECEIVER=

# LayerZero route
LZ_PLUGIN=
LZ_ROUTE_CHAIN_ID=
LZ_ROUTE_EID=
LZ_ROUTE_RECEIVER=
LZ_ROUTE_FAMILY=
LZ_ROUTE_OPTIONS=

# Axelar trust (destination chain)
AXELAR_ADAPTER_SET_TRUSTED_SOURCE=false
AXELAR_ADAPTER=
AXELAR_SOURCE_CHAIN=
AXELAR_SOURCE_ADDRESS=
AXELAR_SOURCE_TRUSTED=true
AXELAR_TRUSTED_TOKEN_ID=
AXELAR_TRUSTED_TOKEN=

# LayerZero trust / destination asset registry
LZ_ADAPTER_SET_TRUSTED_PEER=false
LZ_ADAPTER_SET_ASSET=false
LZ_ADAPTER=
LZ_SOURCE_EID=
LZ_SOURCE_PEER_ADDRESS=
LZ_SETTLEMENT_TOKEN=
LZ_COMPOSE_SENDER=
```
