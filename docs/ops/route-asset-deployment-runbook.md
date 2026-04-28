# Route Asset Deployment Runbook

This runbook is the operational guide for deploying and rolling out the route-asset maximum-coverage model.

It covers:

- on-chain deployment for messaging rails
- off-chain VPS configuration
- token allowlisting
- per-pair route configuration
- LayerZero family selection
- THORChain API-direct rollout
- testnet smoke testing
- rollback

This document assumes the current codebase state where:

- messaging rails use `RouterV1` + `ReceiverV1`
- Axelar source config is pair-scoped: `dstChainId -> { chainName, receiver }`
- LayerZero source config is pair + family scoped: `dstChainId + family -> { dstEid, receiver, options }`
- LayerZero destination execution is multi-asset through `LayerZeroReceiverAdapter`
- `routeAssetId` is derived on-chain from `keccak256(abi.encode(localChainId, localRouteToken))`
- `dstGasLimit` is signed inside the intent
- THORChain is provider-direct and does not require destination deployments

Related references:

- [DeployAll.s.sol](/Users/ganadhish/code/work/ruflo/config/foundry/scripts/DeployAll.s.sol)
- [ConfigureAll.s.sol](/Users/ganadhish/code/work/ruflo/config/foundry/scripts/ConfigureAll.s.sol)
- [deploymentRegistry.ts](/Users/ganadhish/code/work/ruflo/src/vps/config/deploymentRegistry.ts)
- [routeExecution.ts](/Users/ganadhish/code/work/ruflo/src/vps/config/routeExecution.ts)
- [foundry-env-chain-guide.md](/Users/ganadhish/code/work/ruflo/docs/foundry-env-chain-guide.md)
- [thorchain-api-direct.md](/Users/ganadhish/code/work/ruflo/docs/ops/thorchain-api-direct.md)

## 1. Deployment Model

There are now two deployment surfaces:

1. Messaging rails

- `CCTP`
- `Axelar`
- `LayerZero`
- `VIA_LABS` if you wire it later through the same messaging flow

These require Ruflo contracts on the chains where you want to originate intents, and also on destination chains where Ruflo receiver execution is needed.

2. Provider-direct rails

- `THORCHAIN`

These do not require Ruflo destination deployments for native THOR destinations like BTC, SOL, Cosmos, DOGE, LTC, BCH.

## 2. What Must Match

There are four layers that must all agree.

1. Off-chain allowlist

- Which route assets a rail is allowed to quote.

2. Off-chain provider metadata

- Token addresses
- Axelar destination token IDs
- LayerZero OFT / OFTAdapter / Stargate metadata

3. Off-chain deployment registry

- Router / receiver addresses
- plugin registry
- rail plugin addresses
- receiver adapter addresses

4. On-chain route configuration

- Axelar source chain: one pair config per destination chain
- LayerZero source chain: one family config per destination chain and route family
- Axelar destination chain: one trusted token row per supported asset
- LayerZero destination chain: one settlement token row and one compose-sender row per supported asset

5. Runtime signing and execution

- `ROUTER_INTENT_SIGNER` used in the deployed `RouterV1`
- `VPS_INTENT_SIGNER_PRIVATE_KEY` used by the VPS to sign intents

These must correspond to the same signer.

## 3. Pre-Deployment Inventory

Before deploying anything, prepare a chain-pair inventory table outside the codebase.

For every local chain and every destination chain, list:

- chain ID
- RPC URL
- WETH address
- USDC address
- USDT address if used
- swap router addresses for local DEX plugins
- CCTP token messenger and Circle domain
- Axelar gas service and ITS address
- Axelar destination chain name
- Axelar destination token IDs per route asset
- LayerZero endpoint
- LayerZero OFT/OFTAdapter/Stargate contract address per asset
- LayerZero destination EID
- LayerZero extra options per destination and asset, if customized
- destination `ReceiverV1` address for messaging rails
- local adapter addresses
- remote trusted source identities

If this inventory is incomplete, deployment will stall later.

## 4. Off-Chain Allowlisting

The first gate is the VPS route-asset allowlist in [routeExecution.ts](/Users/ganadhish/code/work/ruflo/src/vps/config/routeExecution.ts:10).

Current model:

```ts
export const ROUTE_ASSET_ALLOWLISTS = {
  [Rail.CCTP]: ['USDC'],
  [Rail.AXELAR]: ['USDC', 'USDT', 'WETH'],
  [Rail.LAYERZERO]: ['USDC', 'USDT', 'WETH'],
  [Rail.VIA_LABS]: ['USDC', 'USDT', 'WETH'],
  [Rail.THORCHAIN]: ['USDC', 'USDT', 'WETH'],
};
```

Rules:

- `CCTP` should normally remain `USDC` only.
- `AXELAR` can expose any alias that you also provide metadata for.
- `LAYERZERO` can expose `USDC`, `USDT`, `WETH`, or more if you extend aliases and metadata.
- `THORCHAIN` should start small and canary-gated.

Alias rules in this repo:

- `USDC`
- `USDT`
- `WETH`
- `BTC.BTC`
- `SOL.SOL`
- `ETH.ETH`
- `DOGE.DOGE`

Do not add an alias to the allowlist unless all required token and provider metadata exists.

## 5. Destination Gas Configuration

`dstGasLimit` is no longer hardcoded in contracts. The VPS signs it into the intent, and messaging rails enforce it.

Configure it in [routeExecution.ts](/Users/ganadhish/code/work/ruflo/src/vps/config/routeExecution.ts:18).

Current defaults:

- `CCTP`: `200000`
- `Axelar direct`: `220000`
- `Axelar dst swap`: `260000`
- `LayerZero lz_oft`: `220000`
- `LayerZero lz_oft_adapter`: `230000`
- `LayerZero lz_stargate_pool`: `240000`
- `LayerZero lz_stargate_oft`: `240000`
- `THORCHAIN`: `0`

Guidance:

- Raise gas only if destination execution truly needs more.
- Keep `THORCHAIN` at `0`.
- Do not set messaging rails to `0`; `RouterV1` rejects that.

## 6. VPS Runtime Configuration

The VPS quote engine uses rail-scoped token env keys from [contracts.ts](/Users/ganadhish/code/work/ruflo/src/vps/config/contracts.ts:40).

### 6.1 Required token address keys

Pattern:

- `CHAIN_<chainId>_TOKEN_<RAIL>_<TOKEN>`

Examples:

```bash
CHAIN_84532_TOKEN_CCTP_USDC=0x...
CHAIN_84532_TOKEN_AXELAR_USDC=0x...
CHAIN_84532_TOKEN_AXELAR_USDT=0x...
CHAIN_84532_TOKEN_AXELAR_ETH=0x...
CHAIN_84532_TOKEN_LAYERZERO_USDC=0x...
CHAIN_84532_TOKEN_LAYERZERO_USDT=0x...
CHAIN_84532_TOKEN_LAYERZERO_ETH=0x...
CHAIN_84532_TOKEN_THORCHAIN_USDC=0x...
CHAIN_84532_TOKEN_THORCHAIN_USDT=0x...
CHAIN_84532_TOKEN_THORCHAIN_ETH=0x...
```

Notes:

- `ETH` is the key used for wrapped ETH route tokens in env naming.
- `WETH` is the route-asset alias exposed to users and quote logic.
- `getSettlementTokenAddress()` resolves rail-scoped keys first, then legacy `CHAIN_<id>_TOKEN_<TOKEN>`.

### 6.2 Router / receiver addresses for VPS

Preferred source of truth is now [deploymentRegistry.ts](/Users/ganadhish/code/work/ruflo/src/vps/config/deploymentRegistry.ts:1).

The VPS resolves:

1. `deploymentRegistry.ts`
2. env fallback

You should keep deployed addresses in the registry file and use env only for temporary overrides.

Registry shape includes:

- `routerV1`
- `routerV1Abi`
- `receiverV1`
- `pluginRegistry`
- `railPlugins`
- `receiverAdapters`

Env fallback still works with keys like:

```bash
CHAIN_84532_ROUTER_V1=0x...
CHAIN_84532_ROUTER_V1_ABI=current
CHAIN_421614_RECEIVER_V1=0x...
```

Use `current` for all fresh deployments in this clean-break rollout.

### 6.3 Intent signer

These must align:

```bash
ROUTER_INTENT_SIGNER=0xSignerAddressUsedAtDeployTime
VPS_INTENT_SIGNER_PRIVATE_KEY=0xPrivateKeyForThatSameSigner
```

If they do not match, user-selected offers will quote but calldata submission will fail signature verification.

## 7. Provider Metadata: Axelar

Axelar route discovery requires destination token IDs in env.

Pattern:

- `CHAIN_<dstChainId>_AXELAR_TOKEN_ID_<ALIAS>`

Examples:

```bash
CHAIN_421614_AXELAR_TOKEN_ID_USDC=0x...
CHAIN_421614_AXELAR_TOKEN_ID_USDT=0x...
CHAIN_421614_AXELAR_TOKEN_ID_WETH=0x...
CHAIN_421614_AXELAR_TOKEN_ID_ETH=0x...
```

Notes:

- `WETH` and `ETH` aliases may both be used by helper resolution.
- The token ID is the Axelar ITS token identifier for the destination route token.

Optional direct-route preference:

```bash
AXELAR_DIRECT_ROUTE_ASSETS=WETH
```

This tells the VPS which Axelar assets should be labeled as `axelar_direct` instead of `axelar_dst_swap`.

## 8. Provider Metadata: LayerZero

LayerZero route discovery requires three categories of env.

### 8.1 OFT / OFTAdapter / Stargate contract on the source chain

Pattern:

- `CHAIN_<srcChainId>_LZ_OFT_<ALIAS>`

Examples:

```bash
CHAIN_84532_LZ_OFT_USDC=0x...
CHAIN_84532_LZ_OFT_USDT=0x...
CHAIN_84532_LZ_OFT_WETH=0x...
CHAIN_84532_LZ_OFT_ETH=0x...
```

### 8.2 Destination EID

Pattern:

- `CHAIN_<dstChainId>_DST_EID_LAYERZERO`

Example:

```bash
CHAIN_421614_DST_EID_LAYERZERO=40231
```

### 8.3 Optional extra options

Pattern:

- `CHAIN_<dstChainId>_LAYERZERO_EXTRA_OPTIONS_<ALIAS>`
- fallback: `CHAIN_<dstChainId>_LAYERZERO_EXTRA_OPTIONS`

Examples:

```bash
CHAIN_421614_LAYERZERO_EXTRA_OPTIONS_USDC=0x...
CHAIN_421614_LAYERZERO_EXTRA_OPTIONS_WETH=0x...
CHAIN_421614_LAYERZERO_EXTRA_OPTIONS=0x...
```

### 8.4 Route-family override

The VPS now supports distinct LayerZero offer families.

Supported values:

- `lz_oft`
- `lz_oft_adapter`
- `lz_stargate_pool`
- `lz_stargate_oft`

Recommended env:

```bash
LAYERZERO_ROUTE_FAMILY_USDC=lz_stargate_pool
LAYERZERO_ROUTE_FAMILY_USDT=lz_oft_adapter
LAYERZERO_ROUTE_FAMILY_WETH=lz_oft
```

If you add more assets later, define them explicitly.

## 9. Messaging-Rail Deployment

Use one active chain at a time.

Scripts:

```bash
npm run sol:deploy:all
npm run sol:configure:all
```

These scripts use flat active env keys, not `CHAIN_<id>_*` keys.

### 9.1 Required deploy env

From [DeployAll.s.sol](/Users/ganadhish/code/work/ruflo/config/foundry/scripts/DeployAll.s.sol:23):

```bash
RPC_URL=
DEPLOYER_PRIVATE_KEY=
OWNER=
FEE_RECIPIENT=
WETH=
ROUTER_INTENT_SIGNER=
```

Optional deploy modules:

```bash
USDC=
USDT=
CCTP_USDC=
TOKEN_MESSENGER=
AXELAR_GAS_SERVICE=
AXELAR_ITS=
LZ_ENDPOINT=
LZ_OFT=
THOR_ROUTER=
EMPSEAL_ROUTER=
UNIV2_ROUTER=
UNIV3_ROUTER=
ENTRYPOINT=
PAYMASTER_SIGNER=
```

### 9.2 What gets deployed

Normally on each messaging chain you want:

- `PluginRegistry`
- `RouterV1`
- `ReceiverV1`
- swap plugin(s)
- `CCTPRailPlugin`
- `CCTPFastRailPlugin`
- `AxelarRailPlugin`
- `LayerZeroRailPlugin`
- `AxelarReceiverAdapter`
- `LayerZeroReceiverAdapter`

THOR plugin deployment is optional in the current inline-execution direction and is not required for THOR provider-direct quoting.

## 10. Post-Deploy Local Wiring

After each local deploy, capture the deployed addresses and feed them into `ConfigureAll`.

Minimum local configure env:

```bash
DEPLOYER_PRIVATE_KEY=
PLUGIN_REGISTRY=
ROUTER_V1=
RECEIVER_V1=
RAIL_PLUGIN_CCTP=
RAIL_PLUGIN_CCTP_FAST=
RAIL_PLUGIN_AXELAR=
RAIL_PLUGIN_LAYERZERO=
RAIL_PLUGIN_THORCHAIN=
SWAP_PLUGIN_EMPSEAL=
SWAP_PLUGIN_UNIV2=
SWAP_PLUGIN_UNIV3=
```

Receiver approved callers must include local adapters:

```bash
RECEIVER_APPROVED_CALLER_1=<local AxelarReceiverAdapter>
RECEIVER_APPROVED_CALLER_2=<local LayerZeroReceiverAdapter>
```

Registering plugins is idempotent, so `ConfigureAll` can be rerun safely.

## 11. How `routeAssetId` Works

Operators do not configure `routeAssetId` anymore for Axelar or LayerZero routes.

The messaging rail plugins derive it internally from:

- local source chain ID
- local source route token address

Formula:

`routeAssetId = keccak256(abi.encode(localChainId, localRouteToken))`

This still matters for:

- VPS quote generation
- signed intent integrity
- destination `ReceiverV1` verification
- debugging mismatches

### Example using `cast`

For Base Sepolia local route token `0x1234...`:

```bash
ENCODED=$(cast abi-encode "f(uint256,address)" 84532 0x1234567890123456789012345678901234567890)
cast keccak "$ENCODED"
```

Use this only to verify what the contracts and VPS should derive. Do not pass it into `ConfigureAll`.

## 12. Per-Pair Route Configuration

You must configure each direction separately.

Base -> Arbitrum and Arbitrum -> Base are two separate route configs.

### 12.1 CCTP standard

```bash
CCTP_SET_ROUTE=true
CCTP_PLUGIN=<local CCTPRailPlugin>
CCTP_ROUTE_CHAIN_ID=<remote EVM chain id>
CCTP_ROUTE_DOMAIN=<remote Circle domain>
CCTP_ROUTE_RECEIVER=<remote ReceiverV1>
CCTP_ROUTE_CALLER=0x0000000000000000000000000000000000000000
```

### 12.2 CCTP fast

```bash
CCTP_FAST_SET_ROUTE=true
CCTP_FAST_PLUGIN=<local CCTPFastRailPlugin>
CCTP_FAST_ROUTE_CHAIN_ID=<remote EVM chain id>
CCTP_FAST_ROUTE_DOMAIN=<remote Circle domain>
CCTP_FAST_ROUTE_RECEIVER=<remote ReceiverV1>
CCTP_FAST_ROUTE_CALLER=0x0000000000000000000000000000000000000000
CCTP_FAST_MAX_FEE_BPS_CAP=100
```

### 12.3 Metadata-driven planning

Use the TS metadata planner first:

```bash
npm run vps:route-config-plan -- --src-chain-id 8453 --dst-chain-id 42161
```

Useful variants:

```bash
npm run vps:route-config-plan -- --src-chain-id 8453 --dst-chain-id 42161 --assets USDC,WETH
npm run vps:route-config-plan -- --src-chain-id 8453 --dst-chain-id 42161 --json
```

The planner reads:

- [deploymentRegistry.ts](/Users/ganadhish/code/work/ruflo/src/vps/config/deploymentRegistry.ts)
- [routeMetadata.ts](/Users/ganadhish/code/work/ruflo/src/vps/config/routeMetadata.ts)
- [routeExecution.ts](/Users/ganadhish/code/work/ruflo/src/vps/config/routeExecution.ts)

It emits:

- the single Axelar pair config needed on the source chain
- the LayerZero family configs needed on the source chain
- the Axelar trusted-token rows needed on the destination chain
- the LayerZero destination asset registry rows needed on the destination chain

When the deployment registry has the relevant plugin / adapter addresses, the planner prints them directly instead of placeholders.

This should be your default workflow. `ConfigureAll` remains the low-level writer, but operators should stop reasoning about each asset manually.

### 12.4 Axelar

```bash
AXELAR_SET_ROUTE=true
AXELAR_PLUGIN=<local AxelarRailPlugin>
AXELAR_ROUTE_CHAIN_ID=<remote EVM chain id>
AXELAR_ROUTE_NAME=<remote Axelar chain name>
AXELAR_ROUTE_RECEIVER=<remote AxelarReceiverAdapter>
```

This now runs once per destination chain on the source chain, not once per asset.

Then on the destination chain, trust each supported asset:

```bash
AXELAR_ADAPTER_SET_TRUSTED_SOURCE=true
AXELAR_ADAPTER=<local AxelarReceiverAdapter>
AXELAR_SOURCE_CHAIN=<remote Axelar chain name>
AXELAR_SOURCE_ADDRESS=<remote AxelarRailPlugin address>
AXELAR_SOURCE_TRUSTED=true
AXELAR_TRUSTED_TOKEN_ID=<token id for this asset>
AXELAR_TRUSTED_TOKEN=<local destination token for this asset>
```

Repeat the destination trusted-token write once per asset:

- USDC
- USDT
- WETH

if you want all of them live on Axelar.

### 12.5 LayerZero

```bash
LZ_SET_ROUTE=true
LZ_PLUGIN=<local LayerZeroRailPlugin>
LZ_ROUTE_CHAIN_ID=<remote EVM chain id>
LZ_ROUTE_EID=<remote LayerZero EID>
LZ_ROUTE_RECEIVER=<remote LayerZeroReceiverAdapter>
LZ_ROUTE_FAMILY=<lz_oft|lz_oft_adapter|lz_stargate_pool|lz_stargate_oft>
LZ_ROUTE_OPTIONS=<hex bytes or empty>
```

This now runs once per destination chain and family on the source chain.

With the current default curated set, that usually means:

- USDC as `lz_stargate_pool`
- USDT as `lz_oft_adapter`
- WETH as `lz_oft`

Then on the destination chain, configure the peer and per-asset registry:

```bash
LZ_ADAPTER_SET_TRUSTED_PEER=true
LZ_ADAPTER=<local LayerZeroReceiverAdapter>
LZ_SOURCE_EID=<remote source eid>
LZ_SOURCE_PEER_ADDRESS=<remote LayerZeroReceiverAdapter>
```

```bash
LZ_ADAPTER_SET_ASSET=true
LZ_ADAPTER=<local LayerZeroReceiverAdapter>
LZ_SOURCE_EID=<remote source eid>
LZ_SETTLEMENT_TOKEN=<local destination route token for this asset>
LZ_COMPOSE_SENDER=<remote source OFT/OFTAdapter/Stargate contract for this asset>
```

Repeat the asset-registry write once per supported asset.

## 13. Adapter Trust Configuration

### 13.1 Axelar adapter trust

Run on the local chain.

```bash
AXELAR_ADAPTER_SET_TRUSTED_SOURCE=true
AXELAR_ADAPTER=<local AxelarReceiverAdapter>
AXELAR_SOURCE_CHAIN=<remote Axelar chain name>
AXELAR_SOURCE_ADDRESS=<remote AxelarRailPlugin address>
AXELAR_SOURCE_TRUSTED=true
AXELAR_TRUSTED_TOKEN_ID=<remote token id if needed>
AXELAR_TRUSTED_TOKEN=<remote/local mapped token if needed>
```

Important:

- `AXELAR_SOURCE_ADDRESS` is the remote `AxelarRailPlugin`, not the remote adapter.

### 13.2 LayerZero adapter trust

Run on the local chain.

```bash
LZ_ADAPTER_SET_TRUSTED_PEER=true
LZ_ADAPTER=<local LayerZeroReceiverAdapter>
LZ_SOURCE_EID=<remote source eid>
LZ_SOURCE_PEER=<remote LayerZeroRailPlugin as bytes32>
```

Or use:

```bash
LZ_SOURCE_PEER_ADDRESS=<remote LayerZeroRailPlugin>
```

### 13.3 LayerZero OFT peer trust

If the OFT itself needs peer setup:

```bash
LZ_OFT_SET_PEER=true
LZ_OFT=<local OFT contract>
LZ_OFT_PEER_EID=<remote eid>
LZ_OFT_PEER_ADDRESS=<remote OFT contract>
```

## 14. THORChain Runtime Rollout

THORChain is off-chain quote + direct execution.

Recommended initial flags:

```bash
ENABLE_THORCHAIN_WORKER=true
ENABLE_THORCHAIN_QUOTE_WORKER=true
ENABLE_THORCHAIN_CANARY=true
THORCHAIN_CANARY_ALLOWLIST=84532:0:BASE.ETH:BTC.BTC,84532:99:BASE.ETH:SOL.SOL
THORCHAIN_BASE_URL=https://thornode.ninerealms.com
```

See:

- [thorchain-api-direct.md](/Users/ganadhish/code/work/ruflo/docs/ops/thorchain-api-direct.md)
- [thorchain-mainnet-canary.md](/Users/ganadhish/code/work/ruflo/docs/ops/thorchain-mainnet-canary.md)

Do not expose wide THOR coverage on day one.

## 15. Recommended Rollout Order

### Phase 1: Local code / config

1. Finalize `ROUTE_ASSET_ALLOWLISTS`.
2. Finalize `DESTINATION_GAS_LIMITS`.
3. Decide LayerZero family mapping per asset.
4. Decide Axelar direct-route assets.

### Phase 2: Messaging-chain deployment

1. Deploy on chain A.
2. Deploy on chain B.
3. Register plugins and receiver callers on chain A.
4. Register plugins and receiver callers on chain B.
5. Configure route pairs A -> B asset-by-asset.
6. Configure route pairs B -> A asset-by-asset.
7. Configure adapter trust in both directions.

### Phase 3: VPS metadata

1. Add `CHAIN_<id>_TOKEN_<RAIL>_<TOKEN>` keys.
2. Add Axelar token IDs.
3. Add LayerZero OFT / EID / options keys.
4. Add `CHAIN_<id>_ROUTER_V1`, `CHAIN_<id>_ROUTER_V1_ABI=current`, and `CHAIN_<id>_RECEIVER_V1`.

### Phase 4: THOR canary

1. Turn on quote worker.
2. Turn on monitor worker.
3. Keep allowlist tiny.
4. Expand only after successful testnet or low-notional runs.

## 16. Pre-Launch Validation

Run these every time before opening routes:

```bash
node --import tsx --test tests/vps/*.test.ts
forge test --config-path config/foundry.toml
```

Then do real route smoke tests.

### Required smoke tests

1. CCTP standard

- source token already USDC
- no src swap
- no dst swap

2. CCTP fast

- same path with urgency forcing fast

3. Axelar destination swap

- example: source WETH -> destination USDC, where Axelar settles in route token and receiver swaps out

4. LayerZero Stargate pool

- USDC route

5. LayerZero OFTAdapter

- USDT route

6. LayerZero OFT

- WETH route

7. THOR provider-direct

- one canary pair only

For each smoke test, verify:

- quote returned
- selected offer integration returned
- signature accepted
- source tx submitted
- destination receipt observed
- final amount within expected slippage
- no stuck intent

## 17. Example Testnet Sequence

For `Base Sepolia (84532) -> Arbitrum Sepolia (421614)`:

1. Deploy on Base Sepolia.
2. Deploy on Arbitrum Sepolia.
3. Configure Base local routes targeting Arbitrum.
4. Configure Arbitrum local routes targeting Base.
5. Trust Base remote sources on Arbitrum adapters.
6. Trust Arbitrum remote sources on Base adapters.
7. Add VPS chain-scoped token/env keys for both chains.
8. Run quote smoke tests:
   - Base USDC -> Arbitrum USDC through CCTP
   - Base WETH -> Arbitrum ETH through LayerZero OFT
   - Base WETH -> Arbitrum USDC through Axelar destination swap

## 18. What Usually Breaks

- `ROUTER_INTENT_SIGNER` and `VPS_INTENT_SIGNER_PRIVATE_KEY` do not match.
- VPS derived `routeAssetId` from the wrong local route token.
- wrong Axelar destination token ID trusted on the destination chain.
- wrong LayerZero family configured for the destination chain.
- wrong `LZ_COMPOSE_SENDER` configured for a destination asset row.
- local `ReceiverV1` missing approved local adapter caller.
- adapter trust configured with remote adapter instead of remote rail plugin.
- `CHAIN_<id>_TOKEN_<RAIL>_<TOKEN>` env missing for one direction.
- LayerZero family override says `lz_oft_adapter` but `CHAIN_<src>_LZ_OFT_<ALIAS>` points at the wrong contract.
- THOR canary allowlist too broad too early.

## 19. Rollback

### Messaging rails

To stop quoting an asset on a rail:

1. Remove the alias from `ROUTE_ASSET_ALLOWLISTS`.
2. Redeploy VPS.

To stop a single route pair:

1. Remove or invalidate the provider metadata env for that pair.
2. Redeploy VPS.
3. Optionally disable on-chain route config administratively in a follow-up patch if you want hard shutdown at the plugin level.

### THORChain

To stop THOR offers immediately:

```bash
ENABLE_THORCHAIN_QUOTE_WORKER=false
```

To stop THOR monitoring too:

```bash
ENABLE_THORCHAIN_WORKER=false
```

To narrow exposure without full shutdown:

```bash
ENABLE_THORCHAIN_CANARY=true
THORCHAIN_CANARY_ALLOWLIST=<smaller list>
```

## 20. Minimum Done Definition

You are ready to widen rollout only when all of the following are true:

- all required contracts are deployed on every messaging chain in scope
- plugins and adapters are registered and trusted in both directions
- every quoted asset has matching VPS token metadata
- every quoted Axelar and LayerZero asset has a configured on-chain route
- `node --import tsx --test tests/vps/*.test.ts` passes
- `forge test --config-path config/foundry.toml` passes
- end-to-end testnet smoke passes for every rail family you plan to expose
