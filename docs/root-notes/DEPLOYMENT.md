# Deployment Guide

This document describes the end-to-end deployment flow for the Ruflo cross-chain contracts and the required post-deploy configuration for CCTP, Axelar ITS, LayerZero OFT/Stargate, THORChain, swap plugins, and the VPS.

## Mainnet Readiness

**Status: not mainnet deployment ready yet.**

The contracts compile and the Solidity test suite passes locally, including Axelar ITS and LayerZero composer adapter callback tests. That is necessary, but not enough for mainnet.

Before mainnet deployment, complete these gates:

1. Run full testnet end-to-end transfers on every route intended for mainnet.
2. Verify official protocol addresses from primary sources for every chain: Circle CCTP, Axelar ITS/Gas Service, LayerZero Endpoint/OFT/Stargate, THORChain routers/vaults.
3. Verify LayerZero `LZ_ROUTE_OPTIONS` includes enough `lzReceive` and `lzCompose` executor gas for the destination swap path.
4. Run at least one real Axelar ITS `callContractWithInterchainToken` transfer into `AxelarReceiverAdapter`.
5. Run at least one real LayerZero OFT/Stargate compose transfer into `LayerZeroReceiverAdapter`.
6. Run at least one real CCTP finalized transfer and one fast-transfer path if `CCTPFastRailPlugin` will be enabled.
7. Test failure recovery: stale quotes, underpaid native fees, failed destination swap, paused receiver/router, replayed intent, and already-settled intent.
8. Complete external security review or a dedicated internal audit pass before holding production user funds.
9. Put `OWNER` behind a multisig/timelock or equivalent production signer process.
10. Configure monitoring, alerting, and an incident pause process before enabling user traffic.

Mainnet deployment should be treated as a separate release after these gates pass on testnet.

## Contract Topology

Each EVM chain gets its own local stack:

- `PluginRegistry`
- `RouterV1`
- `ReceiverV1`
- Optional rails:
  - `CCTPRailPlugin`
  - `CCTPFastRailPlugin`
  - `AxelarRailPlugin`
  - `LayerZeroRailPlugin`
  - `THORChainRailPlugin`
- Optional destination adapters:
  - `AxelarReceiverAdapter`
  - `LayerZeroReceiverAdapter`
- Optional swap plugins:
  - `EmpsealSwapPlugin`
  - `UniswapV2SwapPlugin`
  - `UniswapV3SwapPlugin`
- Optional `RufloPaymaster`

Routes are configured on the source chain rail plugin and point at destination-chain contracts:

- CCTP and CCTP fast `destinationReceiver`: destination `ReceiverV1`.
- Axelar `destinationReceiver`: destination `AxelarReceiverAdapter`.
- LayerZero `destinationReceiver`: destination `LayerZeroReceiverAdapter`.
- THORChain route: configured via inbound vault/router settings.

`ReceiverV1` only accepts calls from approved callers. Add destination-side approved callers for every delivery path:

- CCTP relayer/executor address, if CCTP delivery calls `ReceiverV1.execute`.
- `AxelarReceiverAdapter`.
- `LayerZeroReceiverAdapter`.
- Any other trusted rail adapter or relay executor.

## Pre-Deployment Checks

Run these locally before every deployment:

```bash
npm install
npm run sol:test
npm run sol:build
```

Expected current result:

- `npm run sol:test`: all Solidity tests pass.
- `npm run sol:build`: compile succeeds. Existing Foundry lint/style warnings may remain, but there must be no compile errors.

Do not deploy from a dirty or unreviewed worktree unless you deliberately intend to deploy those changes.

```bash
git status --short
git diff -- src/contracts config/foundry/scripts tests/contracts .env.example
```

## Required External Addresses

Resolve these per chain from official protocol sources. Do not copy addresses from chat logs or stale docs.

Required for all deployed chains:

- `RPC_URL`
- `DEPLOYER_PRIVATE_KEY`
- `OWNER`
- `FEE_RECIPIENT`
- `WETH`

Optional by rail/plugin:

- `USDC`
- `USDT`
- `CCTP_USDC`
- `TOKEN_MESSENGER`
- `AXELAR_USDC`
- `AXELAR_GAS_SERVICE`
- `AXELAR_ITS`
- `LAYERZERO_USDC` or `LZ_USDC`
- `LZ_ENDPOINT`
- `LZ_OFT`
- `THOR_USDC`
- `THOR_USDT`
- `THOR_ROUTER`
- `EMPSEAL_ROUTER`
- `UNIV2_ROUTER`
- `UNIV3_ROUTER`
- `ENTRYPOINT`
- `PAYMASTER_SIGNER`

Use rail-specific settlement tokens where applicable. For example, `CCTP_USDC` should be Circle-native USDC, `AXELAR_USDC` should match the Axelar ITS token/token manager setup, and `LAYERZERO_USDC` should match the OFT/Stargate asset used by `LZ_OFT`.

## Deployment Command

Deployment is chain-by-chain. Set env values for one chain, run deploy, save emitted addresses, then switch env values for the next chain.

```bash
npm run sol:deploy:all
```

This runs:

```bash
forge script config/foundry/scripts/DeployAll.s.sol:DeployAll \
  --config-path config/foundry.toml \
  --rpc-url "$RPC_URL" \
  --broadcast -vvv
```

Deployment output emits addresses as events. Also inspect `config/broadcast/DeployAll.s.sol/<chainId>/run-latest.json`.

Record at minimum:

- `PLUGIN_REGISTRY`
- `ROUTER_V1`
- `RECEIVER_V1`
- `RAIL_PLUGIN_CCTP`
- `RAIL_PLUGIN_CCTP_FAST`
- `RAIL_PLUGIN_AXELAR`
- `RAIL_PLUGIN_LAYERZERO`
- `RAIL_PLUGIN_THORCHAIN`
- `AXELAR_ADAPTER`
- `LZ_ADAPTER`
- swap plugin addresses
- paymaster address, if deployed

## Configuration Command

Post-deployment configuration is also chain-by-chain. Configure one route or set of routes at a time.

```bash
npm run sol:configure:all
```

This runs:

```bash
forge script config/foundry/scripts/ConfigureAll.s.sol:ConfigureAll \
  --config-path config/foundry.toml \
  --rpc-url "$RPC_URL" \
  --broadcast -vvv
```

`ConfigureAll` is partially idempotent for plugin registration. Route and trust setters can be safely re-run when values are correct, but they overwrite route/trust values.

## Step 1: Deploy Each Chain

For each chain, set:

```bash
RPC_URL=
DEPLOYER_PRIVATE_KEY=
OWNER=
FEE_RECIPIENT=
WETH=
```

Then set only the optional dependency addresses for components you intend to deploy on that chain:

```bash
USDC=
CCTP_USDC=
TOKEN_MESSENGER=
AXELAR_USDC=
AXELAR_GAS_SERVICE=
AXELAR_ITS=
LAYERZERO_USDC=
LZ_ENDPOINT=
LZ_OFT=
THOR_USDC=
THOR_USDT=
THOR_ROUTER=
UNIV2_ROUTER=
UNIV3_ROUTER=
EMPSEAL_ROUTER=
```

Run:

```bash
npm run sol:deploy:all
```

Repeat for every source and destination chain.

## Step 2: Register Plugins

On each chain, set:

```bash
PLUGIN_REGISTRY=
RAIL_PLUGIN_CCTP=
RAIL_PLUGIN_CCTP_FAST=
RAIL_PLUGIN_AXELAR=
RAIL_PLUGIN_LAYERZERO=
RAIL_PLUGIN_THORCHAIN=
SWAP_PLUGIN_UNIV2=
SWAP_PLUGIN_UNIV3=
SWAP_PLUGIN_EMPSEAL=
```

Unset or leave empty anything not deployed on that chain.

Run:

```bash
npm run sol:configure:all
```

Verify registry state after configuration by reading plugin entries for each plugin id.

## Step 3: Approve Receiver Callers

On each destination chain, approve the contracts or executors allowed to call `ReceiverV1.execute`.

```bash
RECEIVER_V1=
RECEIVER_APPROVED_CALLER_1=0xAxelarReceiverAdapter
RECEIVER_APPROVED_CALLER_2=0xLayerZeroReceiverAdapter
RECEIVER_APPROVED_CALLER_3=0xCctpRelayerOrExecutor
RECEIVER_APPROVED_CALLER_4=
RECEIVER_APPROVED_CALLER_5=
```

Run:

```bash
npm run sol:configure:all
```

Verify:

```solidity
ReceiverV1.approvedCallers(caller) == true
```

## Step 4: Configure CCTP Routes

Configure this on each source chain that should send CCTP to a destination.

```bash
CCTP_SET_ROUTE=true
CCTP_PLUGIN=0xCCTPRailPluginOnSource
CCTP_ROUTE_CHAIN_ID=421614
CCTP_ROUTE_DOMAIN=3
CCTP_ROUTE_RECEIVER=0xReceiverV1OnDestination
CCTP_ROUTE_CALLER=0x0000000000000000000000000000000000000000
```

Notes:

- `CCTP_ROUTE_CHAIN_ID` is the destination EVM chain id.
- `CCTP_ROUTE_DOMAIN` is Circle's destination domain id.
- `CCTP_ROUTE_RECEIVER` should be destination `ReceiverV1` unless the CCTP delivery design changes.
- `CCTP_ROUTE_CALLER` restricts who can call Circle receive on destination. `0x0` leaves relay open.

Run:

```bash
npm run sol:configure:all
```

For fast CCTP:

```bash
CCTP_FAST_SET_ROUTE=true
CCTP_FAST_PLUGIN=0xCCTPFastRailPluginOnSource
CCTP_FAST_ROUTE_CHAIN_ID=421614
CCTP_FAST_ROUTE_DOMAIN=3
CCTP_FAST_ROUTE_RECEIVER=0xReceiverV1OnDestination
CCTP_FAST_ROUTE_CALLER=0x0000000000000000000000000000000000000000
CCTP_FAST_MAX_FEE_BPS_CAP=100
```

Fast CCTP requires signed `railData` in the intent:

```text
abi.encode(uint32 minFinalityThreshold, uint256 maxFee)
```

## Step 5: Configure Axelar Routes

Configure this on each source chain that should send through Axelar.

```bash
AXELAR_SET_ROUTE=true
AXELAR_PLUGIN=0xAxelarRailPluginOnSource
AXELAR_ROUTE_CHAIN_ID=421614
AXELAR_ROUTE_NAME=arbitrum-sepolia
AXELAR_ROUTE_RECEIVER=0xAxelarReceiverAdapterOnDestination
AXELAR_ROUTE_TOKEN_ID=0x...
```

Important:

- `AXELAR_ROUTE_RECEIVER` must be the destination `AxelarReceiverAdapter`, not `ReceiverV1`.
- `AXELAR_ROUTE_TOKEN_ID` must match the Axelar ITS token id for the settlement token on this route.
- Source `AxelarRailPlugin.bridge()` uses `callContractWithInterchainToken`.
- Destination `AxelarReceiverAdapter.executeWithInterchainToken()` validates source chain/source address and token id before forwarding.

Run:

```bash
npm run sol:configure:all
```

Then configure the destination adapter trust:

```bash
AXELAR_ADAPTER_SET_TRUSTED_SOURCE=true
AXELAR_ADAPTER=0xAxelarReceiverAdapterOnDestination
AXELAR_SOURCE_CHAIN=base-sepolia
AXELAR_SOURCE_ADDRESS=0xAxelarRailPluginOnSource
AXELAR_SOURCE_ADDRESS_BYTES=0x
AXELAR_TRUSTED_TOKEN_ID=0x...
AXELAR_TRUSTED_TOKEN=0xLocalAxelarSettlementToken
AXELAR_SOURCE_TRUSTED=true
```

Use `AXELAR_SOURCE_ADDRESS` for EVM source rail contracts. Use `AXELAR_SOURCE_ADDRESS_BYTES` only if the remote source address is not an EVM address encoding.

Verify:

```solidity
AxelarReceiverAdapter.trustedTokenById(tokenId) == localToken
```

## Step 6: Configure LayerZero Routes

Configure this on each **source chain** that should send through LayerZero.

Field meaning (explicit):

- `LZ_ROUTE_CHAIN_ID`: **destination EVM chain id** (the chain funds are going to).
- `LZ_ROUTE_EID`: **destination LayerZero endpoint id (EID)** for that same destination chain.
- `LZ_ROUTE_RECEIVER`: destination `LayerZeroReceiverAdapter` on the destination chain.
- `LZ_ROUTE_OPTIONS`: executor options for destination execution (`lzReceive` + `lzCompose` gas).
- `LZ_SOURCE_EID` (used later in adapter trust config): **source chain EID**.

```bash
LZ_SET_ROUTE=true
LZ_PLUGIN=0xLayerZeroRailPluginOnSource
LZ_ROUTE_CHAIN_ID=<DESTINATION_EVM_CHAIN_ID>
LZ_ROUTE_EID=<DESTINATION_EID>
LZ_ROUTE_RECEIVER=0xLayerZeroReceiverAdapterOnDestination
LZ_ROUTE_OPTIONS=0x...
```

Example mapping (source `Base Sepolia` -> destination `Arbitrum Sepolia`):

- Run `setRouteConfig` on **Base Sepolia**.
- Set `LZ_ROUTE_CHAIN_ID=421614` (Arbitrum Sepolia chain id).
- Set `LZ_ROUTE_EID=<Arbitrum Sepolia EID>`.
- Set `LZ_ROUTE_RECEIVER=<LayerZeroReceiverAdapter deployed on Arbitrum Sepolia>`.

Important behavior:

- `LZ_ROUTE_RECEIVER` must be destination `LayerZeroReceiverAdapter`, not `ReceiverV1`.
- `LZ_ROUTE_OPTIONS` must include compose gas. A plain token transfer option is not enough.
- `LayerZeroRailPlugin` uses `composeMsg = ReceiverV1 payload`.
- Destination `LayerZeroReceiverAdapter.lzCompose()` decodes the OFT compose envelope and forwards only the embedded payload to `ReceiverV1`.

The route options need to cover:

- destination `lzReceive` execution on the OFT/Stargate side
- destination `lzCompose` execution on `LayerZeroReceiverAdapter`

How to generate `LZ_ROUTE_OPTIONS` bytes:

1. Preferred: generate with LayerZero's official OApp/OFT options tooling in your LayerZero integration repo and paste resulting hex into `LZ_ROUTE_OPTIONS`.
2. Solidity method (same bytes format used by LayerZero):

```text
OptionsBuilder.newOptions()
  .addExecutorLzReceiveOption(receiveGas, receiveValue)
  .addExecutorLzComposeOption(0, composeGas, composeValue)
```

Practical defaults for first testnet pass:

- `receiveGas`: `200000`
- `composeGas`: `400000` to `700000` depending on destination swap path complexity
- `receiveValue`: `0`
- `composeValue`: `0`

If the destination compose/swap reverts on gas, increase `composeGas` and regenerate options.

After route config, configure destination adapter peer trust:

```bash
LZ_ADAPTER_SET_TRUSTED_PEER=true
LZ_ADAPTER=0xLayerZeroReceiverAdapterOnDestination
LZ_SOURCE_EID=<SOURCE_EID>
LZ_SOURCE_PEER_ADDRESS=0xLayerZeroRailPluginOnSource
LZ_SOURCE_PEER=0x0000000000000000000000000000000000000000000000000000000000000000
```

Source/destination rule for trusted peer:

- Run this on the **destination chain**.
- `LZ_SOURCE_EID` is the EID of the **source chain** that is allowed to compose into this destination adapter.
- `LZ_SOURCE_PEER_ADDRESS` is the source chain `LayerZeroRailPlugin` address.

Use `LZ_SOURCE_PEER_ADDRESS` for EVM source rail contracts. Use `LZ_SOURCE_PEER` if you already have a raw bytes32 peer.

Verify:

```solidity
LayerZeroReceiverAdapter.trustedPeers(srcEid) == bytes32(uint256(uint160(sourceRail)))
```

## Step 7: Configure THORChain

If using THORChain:

```bash
THOR_PLUGIN=0xTHORChainRailPlugin
THOR_SET_VAULT=true
THOR_VAULT_CHAIN_ID=1
THOR_VAULT_ADDRESS=0xThorInboundVault
THOR_SET_ROUTER=true
THOR_ROUTER=0xThorRouter
```

Run:

```bash
npm run sol:configure:all
```

Verify inbound vaults and router addresses from official THORChain sources before using production funds.

## Step 8: Configure VPS Runtime

After contract configuration, update VPS env for every deployed chain:

```bash
CHAIN_<chainId>_RPC_URL=
CHAIN_<chainId>_RPC_FALLBACK=
CHAIN_<chainId>_ROUTER_V1=
CHAIN_<chainId>_RECEIVER_V1=
CHAIN_<chainId>_HAS_AGGREGATOR=true
CHAIN_<chainId>_SWAP_PLUGIN_KIND=UNIV2
CHAIN_<chainId>_UNIV2_ROUTER=
CHAIN_<chainId>_UNIV3_ROUTER=
CHAIN_<chainId>_TOKEN_CCTP_USDC=
CHAIN_<chainId>_CCTP_DOMAIN=
CHAIN_<chainId>_TOKEN_AXELAR_USDC=
CHAIN_<chainId>_TOKEN_LAYERZERO_USDC=
CHAIN_<chainId>_TOKEN_USDC=
```

For CCTP relay:

```bash
ENABLE_CCTP_RELAY=true
CCTP_RELAYER_PRIVATE_KEY=
CCTP_ATTESTATION_BASE_URL=
CCTP_MESSAGE_TRANSMITTER=
CCTP_SOURCE_DOMAIN=
```

For CCTP fast quotes:

```bash
ENABLE_CCTP_FAST=true
CCTP_FAST_MAX_FEE_BUFFER_BPS=2
CCTP_FAST_PLUGIN_ID=0x9181644edfd36b07ccd623494a3681a4a6b9cd5d52611accda20264cd09259ac
```

Use the Circle Iris mainnet endpoint only for mainnet and sandbox endpoint only for testnet.

## Step 9: Testnet End-to-End Runbook

For each route pair:

1. Deploy both source and destination chain stacks.
2. Register plugins on both chains.
3. Approve destination `ReceiverV1` callers.
4. Configure source rail route to destination receiver/adapter.
5. Configure destination adapter trust, if using Axelar or LayerZero.
6. Configure VPS chain addresses.
7. Generate quote from VPS.
8. Submit a small transfer with a nonzero destination `minAmountOut`.
9. Confirm source `IntentInitiated`.
10. Confirm rail-specific source event:
    - CCTP `BridgeInitiated`
    - Axelar `AxelarBridgeInitiated`
    - LayerZero `LayerZeroBridgeInitiated`
11. Confirm destination event:
    - `ReceiverV1.IntentSettled`, or
    - `ReceiverV1.DirectDelivery`
12. Confirm final user balance.
13. Confirm no stuck funds remain in adapters, rail plugins, or `ReceiverV1`.
14. Repeat with underpaid native fee and verify source transaction reverts.
15. Repeat with unsupported route and verify source transaction reverts.
16. Repeat with intentionally untrusted adapter source and verify destination adapter rejects.

Do not proceed to mainnet until every intended route pair passes this runbook.

## Verification Checklist

After deploy/configure, verify all of the following on-chain:

- `PluginRegistry.getRailPlugin(pluginId)` returns the expected rail plugin.
- `PluginRegistry.getSwapPlugin(pluginId)` returns the expected swap plugin.
- `RouterV1.feeRecipient()` is correct.
- `ReceiverV1.approvedCallers(adapterOrRelayer)` is true.
- `CCTPRailPlugin.chainToDomain(dstChainId)` is correct.
- `CCTPRailPlugin.destinationReceivers(dstChainId)` is destination `ReceiverV1`.
- `CCTPFastRailPlugin.maxFeeBpsCap()` is acceptable.
- `AxelarRailPlugin.chainIdToAxelarName(dstChainId)` is correct.
- `AxelarRailPlugin.destinationReceivers(dstChainId)` is destination `AxelarReceiverAdapter`.
- `AxelarRailPlugin.destinationTokenIds(dstChainId)` is correct.
- `AxelarReceiverAdapter.trustedTokenById(tokenId)` is the local settlement token.
- `LayerZeroRailPlugin.chainIdToEid(dstChainId)` is correct.
- `LayerZeroRailPlugin.destinationReceivers(dstChainId)` is destination `LayerZeroReceiverAdapter`.
- `LayerZeroRailPlugin.sendOptionsByChain(dstChainId)` is nonempty and includes compose gas.
- `LayerZeroReceiverAdapter.oft()` is the local destination OFT/Stargate contract.
- `LayerZeroReceiverAdapter.settlementToken()` is the local settlement token.
- `LayerZeroReceiverAdapter.trustedPeers(srcEid)` is the source rail address encoded as bytes32.

## Operational Checklist

Before public traffic:

- Use a multisig or controlled owner process.
- Fund relayer/executor wallets.
- Configure native token balances for source-chain users or paymaster flow.
- Configure logs and alerts for:
  - source `IntentInitiated`
  - rail bridge events
  - adapter forwarding events
  - destination settlement events
  - failed/reverted relays
  - stuck balances
- Define pause policy:
  - who can call `RouterV1.pause`
  - who can call `ReceiverV1.pause`
  - when to pause
  - when to unpause
- Keep a runbook for refund/retry/recovery per rail.

## Mainnet Release Gate

Promote to mainnet only after:

1. Testnet routes pass for every enabled rail.
2. Deployment addresses are reviewed by a second operator.
3. Config transactions are reviewed by a second operator.
4. All official protocol addresses are verified on the deployment date.
5. VPS quote generation matches deployed plugin ids and settlement tokens.
6. Monitoring is live.
7. Pause and recovery permissions are confirmed.
8. Security review findings are resolved or explicitly accepted.

Until these are complete, the correct status is **testnet-ready, not mainnet-ready**.
