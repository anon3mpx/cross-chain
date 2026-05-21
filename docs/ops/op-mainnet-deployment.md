# OP Mainnet Deployment (Phase 1)

This document is the execution runbook for starting phase-1 mainnet deployment from `Optimism` (`OP`, chain ID `10`).

It is derived from [phase1-mainnet-deployment-config-sheet.md](/Users/ganadhish/code/work/ruflo/docs/ops/phase1-mainnet-deployment-config-sheet.md) and scoped to everything required to bring `OP` online first.

Related docs:

- [phase1-mainnet-deployment-config-sheet.md](/Users/ganadhish/code/work/ruflo/docs/ops/phase1-mainnet-deployment-config-sheet.md)
- [DEPLOYMENT.md](/Users/ganadhish/code/work/ruflo/docs/root-notes/DEPLOYMENT.md)
- [route-asset-deployment-runbook.md](/Users/ganadhish/code/work/ruflo/docs/ops/route-asset-deployment-runbook.md)
- [chains.ts](/Users/ganadhish/code/work/ruflo/src/vps/config/chains.ts)
- [routeExecution.ts](/Users/ganadhish/code/work/ruflo/src/vps/config/routeExecution.ts)
- [contracts.ts](/Users/ganadhish/code/work/ruflo/src/vps/config/contracts.ts)
- [deploymentRegistry.ts](/Users/ganadhish/code/work/ruflo/src/vps/config/deploymentRegistry.ts)

## 1. OP Scope in Phase 1

`OP` is included in all enabled phase-1 rails:

- `CCTP standard` (`USDC` only)
- `CCTP fast` (`USDC` only)
- `LayerZero` (`USDC`, `USDT`, `WETH`)

OP constants:

- chain: `Optimism`
- chain ID: `10`
- Circle CCTP domain: `2`
- settlement bias: `USDC`

## 2. Pre-Flight Checklist (Required)

Complete before broadcast:

- `npm install`
- `npm run sol:test`
- `npm run sol:build`
- `git status --short` is reviewed and intentional
- `RPC_OP` and deployer wallet are funded for deployment + route config txs
- final mainnet protocol addresses are verified from primary sources:
- Circle CCTP (`USDC`, `TokenMessenger`, `MessageTransmitter`, domain)
- LayerZero (`Endpoint`, EIDs, OFT / Stargate / adapter metadata)
- DEX aggregator / swap plugin infra for OP is already deployed
- `OWNER` is production signer flow (multisig/timelock or controlled signer process)

## 3. Required Script Params (OP Mainnet)

This section is the exact env surface for:

- [DeployAll.s.sol](/Users/ganadhish/code/work/ruflo/config/foundry/scripts/DeployAll.s.sol)
- [ConfigureAll.s.sol](/Users/ganadhish/code/work/ruflo/config/foundry/scripts/ConfigureAll.s.sol)

### 3.1 DeployAll.s.sol

Required:

```bash
DEPLOYER_PRIVATE_KEY=
OWNER=
FEE_RECIPIENT=
WETH=
ROUTER_INTENT_SIGNER=
```

Optional component-gated params:

```bash
USDC=
CCTP_USDC=                 # defaults to USDC when omitted
TOKEN_MESSENGER=           # deploys CCTP + CCTP fast plugins when paired with CCTP_USDC
LZ_ENDPOINT=               # deploys LayerZero plugin + LayerZeroReceiverAdapter
EMPSEAL_ROUTER=            # deploys EmpsealSwapPlugin
UNIV2_ROUTER=              # deploys UniswapV2SwapPlugin
UNIV3_ROUTER=              # deploys UniswapV3SwapPlugin
ENTRYPOINT=                # with PAYMASTER_SIGNER deploys Paymaster
PAYMASTER_SIGNER=
```

### 3.2 ConfigureAll.s.sol

Required:

```bash
DEPLOYER_PRIVATE_KEY=
ROUTER_V1=0xe6ef55853f548b7edfa403056f91f85fd3b3f086                 # script reads this key directly; set it for OP
```

Registry configuration (`PLUGIN_REGISTRY` + any plugin addresses to register):

```bash
PLUGIN_REGISTRY=0x367ec0c092d32f3883c4cacbfb6c9c3594062e90
RAIL_PLUGIN_CCTP=0x1b7eb489eb0ae102720442fe15b0e08653a13404
RAIL_PLUGIN_CCTP_FAST=0x050c6c2555c2d54aba01420fbc02ff0f1d10e8df
RAIL_PLUGIN_LAYERZERO=0xdb403792c55bfe26beaef235986d4f106e40ee6f
LZ_RECEIVER_ADAPTER=0x845cd50644a9592de43bcac0212656480744aaca
SWAP_PLUGIN_EMPSEAL=0x1cb21a8a39e760e97c587b323d891927f3d006e9
SWAP_PLUGIN_UNIV2=
SWAP_PLUGIN_UNIV3=
```

Receiver caller approval:

```bash
RECEIVER_V1=0x65642ac8fd57eff8dd4651cb76be48814c8bf386
RECEIVER_APPROVED_CALLER_1=
RECEIVER_APPROVED_CALLER_2=
RECEIVER_APPROVED_CALLER_3=
RECEIVER_APPROVED_CALLER_4=
RECEIVER_APPROVED_CALLER_5=
```

Router updates (only when toggled):

```bash
ROUTER_SET_FEE_RECIPIENT=true
ROUTER_NEW_FEE_RECIPIENT=

ROUTER_SET_INTENT_SIGNER=true
ROUTER_NEW_INTENT_SIGNER=
```

Paymaster updates (only when toggled):

```bash
PAYMASTER=
PAYMASTER_SET_SIGNER=true
PAYMASTER_NEW_SIGNER=

PAYMASTER_SET_TOKEN_RATE=true
PAYMASTER_RATE_TOKEN=
PAYMASTER_RATE_VALUE=
```

CCTP standard route set (one `SRC -> DST` pair per run):

```bash
CCTP_SET_ROUTE=true
CCTP_PLUGIN=
CCTP_ROUTE_CHAIN_ID=
CCTP_ROUTE_DOMAIN=
CCTP_ROUTE_RECEIVER=
CCTP_ROUTE_CALLER=
```

CCTP fast route set (one `SRC -> DST` pair per run):

```bash
CCTP_FAST_SET_ROUTE=true
CCTP_FAST_PLUGIN=
CCTP_FAST_ROUTE_CHAIN_ID=
CCTP_FAST_ROUTE_DOMAIN=
CCTP_FAST_ROUTE_RECEIVER=
CCTP_FAST_ROUTE_CALLER=
CCTP_FAST_MAX_FEE_BPS_CAP=
```

LayerZero source route set (one `SRC -> DST` pair/family per run):

```bash
LZ_SET_ROUTE=true
LZ_PLUGIN=
LZ_ROUTE_CHAIN_ID=
LZ_ROUTE_EID=
LZ_ROUTE_RECEIVER=
LZ_ROUTE_OPTIONS=
LZ_ROUTE_FAMILY=           # default: lz_oft
LZ_ROUTE_TOKEN=            # required by plugin variants with OFT-aware setters
LZ_ROUTE_OFT=              # required by plugin variants with OFT-aware setters
```

LayerZero destination trusted-peer / asset set:

```bash
LZ_ADAPTER=0xff4fc287702fe63b44fb3e81ee0a75432897a95c
LZ_ADAPTER_SET_TRUSTED_PEER=true
LZ_SOURCE_EID=
LZ_SOURCE_PEER_ADDRESS=    # or LZ_SOURCE_PEER (bytes32)

LZ_ADAPTER_SET_ASSET=true
LZ_SETTLEMENT_TOKEN=
LZ_COMPOSE_SENDER=
```

LayerZero OFT peer set (when needed):

```bash
LZ_OFT_SET_PEER=true
LZ_OFT=
LZ_OFT_PEER_EID=
LZ_OFT_PEER_ADDRESS=       # or LZ_OFT_PEER (bytes32)
```

## 4. OP Chain Inventory Row

Fill this first:

| Chain | Chain ID | Native settlement bias | CCTP domain | Has DEX aggregator | RPC | Explorer |
|---|---:|---|---:|---|---|---|
| `OP` | `10` | `USDC` | `2` | `yes` | `<RPC_OP>` | `<EXPLORER_OP>` |

## 5. OP Local Deployment Sheet

Record deployed OP contract addresses:

| Field | Value |
|---|---|
| `PLUGIN_REGISTRY` | `<...>` |
| `ROUTER_V1` | `<...>` |
| `RECEIVER_V1` | `<...>` |
| `RAIL_PLUGIN_CCTP` | `<...>` |
| `RAIL_PLUGIN_CCTP_FAST` | `<...>` |
| `RAIL_PLUGIN_LAYERZERO` | `<...>` |
| `LZ_ADAPTER` | `<...>` |
| `SWAP_PLUGIN_ID` | `<...>` |
| `SWAP_PLUGIN_KIND` | `<...>` |

Also record optional supporting addresses if used by your deployment path:

- `UNIV2_ROUTER`
- `UNIV3_ROUTER`
- `EMPSEAL_ROUTER`

## 6. ReceiverV1 Approved Caller Requirements on OP

Before enabling traffic, approve OP callers that can execute destination intents:

- OP CCTP relayer/executor caller
- OP CCTP fast relayer/executor caller
- OP `LayerZeroReceiverAdapter`
- any additional trusted adapter used in your OP path

Track final values:

| Caller type | Address |
|---|---|
| `CCTP_ROUTE_CALLER` (for OP destination) | `<...>` |
| `CCTP_FAST_ROUTE_CALLER` (for OP destination) | `<...>` |
| `LZ trusted execution caller / adapter` | `<...>` |

## 7. CCTP Standard Config from OP (Source)

Required OP source routes:

| Source | Destination | DST chain ID | DST domain | DST ReceiverV1 | DST allowed caller / relayer |
|---|---|---:|---:|---|---|
| `OP` | `Arbitrum` | `42161` | `3` | `<RECEIVER_ARB>` | `<CALLER_ARB>` |
| `OP` | `Base` | `8453` | `6` | `<RECEIVER_BASE>` | `<CALLER_BASE>` |
| `OP` | `Monad` | `143` | `15` | `<RECEIVER_MONAD>` | `<CALLER_MONAD>` |
| `OP` | `HyperEVM` | `999` | `19` | `<RECEIVER_HYPEREVM>` | `<CALLER_HYPEREVM>` |

For each OP `SRC -> DST` pair, fill:

- `CCTP_ROUTE_CHAIN_ID`
- `CCTP_ROUTE_DOMAIN`
- `CCTP_ROUTE_RECEIVER`
- `CCTP_ROUTE_CALLER`

## 8. CCTP Fast Config from OP (Source)

Required OP source routes:

| Source | Destination | DST chain ID | DST domain | DST ReceiverV1 | DST allowed caller / relayer | Max fee bps cap |
|---|---|---:|---:|---|---|---:|
| `OP` | `Arbitrum` | `42161` | `3` | `<RECEIVER_ARB>` | `<CALLER_ARB>` | `<FAST_CAP_BPS>` |
| `OP` | `Base` | `8453` | `6` | `<RECEIVER_BASE>` | `<CALLER_BASE>` | `<FAST_CAP_BPS>` |

For each OP fast `SRC -> DST` pair, fill:

- `CCTP_FAST_ROUTE_CHAIN_ID`
- `CCTP_FAST_ROUTE_DOMAIN`
- `CCTP_FAST_ROUTE_RECEIVER`
- `CCTP_FAST_ROUTE_CALLER`
- `CCTP_FAST_MAX_FEE_BPS_CAP`

## 9. LayerZero Config from OP (Source)

Required OP source routes:

| Source | Destination | LZ_ROUTE_CHAIN_ID | LZ_ROUTE_EID | LZ_ROUTE_RECEIVER | LZ route family set |
|---|---|---:|---:|---|---|
| `OP` | `Arbitrum` | `42161` | `<LZ_EID_ARB>` | `<LZ_ADAPTER_ARB>` | `<USDC/USDT/WETH families>` |
| `OP` | `Base` | `8453` | `<LZ_EID_BASE>` | `<LZ_ADAPTER_BASE>` | `<USDC/USDT/WETH families>` |
| `OP` | `BSC` | `56` | `<LZ_EID_BSC>` | `<LZ_ADAPTER_BSC>` | `<USDC/USDT/WETH families>` |
| `OP` | `Monad` | `143` | `<LZ_EID_MONAD>` | `<LZ_ADAPTER_MONAD>` | `<USDC/USDT/WETH families>` |
| `OP` | `HyperEVM` | `999` | `<LZ_EID_HYPEREVM>` | `<LZ_ADAPTER_HYPEREVM>` | `<USDC/USDT/WETH families>` |

Per OP source route, fill:

- `LZ_ROUTE_CHAIN_ID`
- `LZ_ROUTE_EID`
- `LZ_ROUTE_RECEIVER`
- `LZ_ROUTE_OPTIONS`
- route family metadata for enabled assets

## 10. LayerZero Config on OP (Destination)

For inbound traffic to OP, configure trusted peers from each source chain and OP asset rows.

### 10.1 Trusted peers into OP

| Destination | Source chain | LZ_SOURCE_EID | LZ_SOURCE_PEER_ADDRESS |
|---|---|---:|---|
| `OP` | `Arbitrum` | `<LZ_EID_ARB>` | `<LZ_ADAPTER_ARB>` |
| `OP` | `Base` | `<LZ_EID_BASE>` | `<LZ_ADAPTER_BASE>` |
| `OP` | `BSC` | `<LZ_EID_BSC>` | `<LZ_ADAPTER_BSC>` |
| `OP` | `Monad` | `<LZ_EID_MONAD>` | `<LZ_ADAPTER_MONAD>` |
| `OP` | `HyperEVM` | `<LZ_EID_HYPEREVM>` | `<LZ_ADAPTER_HYPEREVM>` |

### 10.2 OP destination asset rows

| Destination chain | Asset alias | LZ settlement token | OFT / route token | Compose sender | Route family | Default options |
|---|---|---|---|---|---|---|
| `OP` | `USDC` | `<OP_LZ_USDC>` | `<OP_LZ_OFT_USDC>` | `<OP_COMPOSE_SENDER_USDC>` | `<family>` | `<options>` |
| `OP` | `USDT` | `<OP_LZ_USDT>` | `<OP_LZ_OFT_USDT>` | `<OP_COMPOSE_SENDER_USDT>` | `<family>` | `<options>` |
| `OP` | `WETH` | `<OP_LZ_WETH>` | `<OP_LZ_OFT_WETH>` | `<OP_COMPOSE_SENDER_WETH>` | `<family>` | `<options>` |

## 11. VPS and Runtime Keys for OP

### 11.1 Chain runtime keys

```bash
CHAIN_10_RPC_URL=
CHAIN_10_ROUTER_V1=
CHAIN_10_RECEIVER_V1=
CHAIN_10_SWAP_PLUGIN_ID=
CHAIN_10_SWAP_PLUGIN_KIND=
```

### 11.2 OP settlement token keys

```bash
CHAIN_10_TOKEN_CCTP_USDC=
CHAIN_10_TOKEN_LAYERZERO_USDC=
CHAIN_10_TOKEN_LAYERZERO_USDT=
CHAIN_10_TOKEN_LAYERZERO_ETH=
```

### 11.3 CCTP runtime keys used by OP flows

```bash
ENABLE_CCTP_FAST=true
CCTP_FAST_PLUGIN_ID=
CCTP_RELAYER_PRIVATE_KEY=
CCTP_ATTESTATION_BASE_URL=
CCTP_MESSAGE_TRANSMITTER=
CHAIN_10_CCTP_DOMAIN=2
CHAIN_10_CCTP_MESSAGE_TRANSMITTER=
```

### 11.4 LayerZero metadata keys for OP

```bash
CHAIN_10_LZ_DST_EID=
CHAIN_10_LZ_OFT_USDC=
CHAIN_10_LZ_OFT_USDT=
CHAIN_10_LZ_OFT_WETH=
CHAIN_10_LZ_EXTRA_OPTIONS_USDC=
CHAIN_10_LZ_EXTRA_OPTIONS_USDT=
CHAIN_10_LZ_EXTRA_OPTIONS_WETH=
```

## 12. Suggested Execution Order (Start With OP)

1. Deploy OP local Ruflo stack and record all addresses from Section 5.
2. Configure OP `ReceiverV1` approved callers (Section 6).
3. Configure OP CCTP standard source routes (Section 7).
4. Configure OP CCTP fast source routes (Section 8).
5. Configure OP LayerZero source routes (Section 9).
6. Configure OP LayerZero destination trusted peers and OP settlement asset rows (Section 10).
7. Update VPS deployment registry + env keys for chain `10` (Section 11).
8. Run OP-centered smoke tests before production traffic.

## 13. Minimum OP Smoke Tests

Run these at minimum:

- `OP -> Arbitrum` via `CCTP standard`
- `OP -> Base` via `CCTP fast`
- `OP -> Monad` via `CCTP standard`
- `OP -> BSC` via `LayerZero`
- `Base -> OP` via `LayerZero` (OP as destination)

For at least one OP route on each enabled rail, verify:

- direct settlement delivery
- destination swap out
- source swap in + destination swap out

## 14. Open Items (Blockers to Close)

- final OP RPC URL and explorer values
- final OP deployed contract addresses
- final LayerZero EIDs for all OP peers
- final OP LayerZero route families by asset
- final OP OFT / Stargate / adapter addresses
- final OP `LZ_ROUTE_OPTIONS` values
- final OP caller / relayer addresses for CCTP and CCTP fast
- final OP swap plugin ID and kind

## 15. External References

- Circle CCTP supported chains and domains: [developers.circle.com/cctp/cctp-supported-blockchains](https://developers.circle.com/cctp/cctp-supported-blockchains/)
- Circle required block confirmations and fast-transfer notes: [developers.circle.com/cctp/required-block-confirmations](https://developers.circle.com/cctp/required-block-confirmations)
- LayerZero mesh concepts: [docs.layerzero.network/v2/concepts/protocol/mesh-network](https://docs.layerzero.network/v2/concepts/protocol/mesh-network)
- LayerZero adding networks guide: [docs.layerzero.network/v2/get-started/create-lz-oapp/adding-networks](https://docs.layerzero.network/v2/get-started/create-lz-oapp/adding-networks)

--------------------------------------------------------------------------

RPC_URL=https://mainnet.optimism.io

export DEPLOYER_PRIVATE_KEY=
export VPS_INTENT_SIGNER_PRIVATE_KEY=

export ROUTER_INTENT_SIGNER=0x05F8cC8753D90d67DBB8c02118440b8283F941c9
OWNER=0x05F8cC8753D90d67DBB8c02118440b8283F941c9
FEE_RECIPIENT=0x05F8cC8753D90d67DBB8c02118440b8283F941c9

WETH=0x4200000000000000000000000000000000000006 # Optimism mainnet canonical WETH

# WETH=0x4200000000000000000000000000000000000006 # Base Sepolia canonical WETH
# WETH=0x980B62Da83eFf3D4576C647993b0c1D7faf17c73 # Arbitrum Sepolia canonical WETH
# WETH=0x4200000000000000000000000000000000000006 # Optimism Sepolia canonical WETH

CCTP_USDC=0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85 # CCTP USDC on op mainnet (can be same as USDC if using canonical)
# AXELAR_USDC=0x2f2A9DbFd8c503a0aC56413B774e39030df85331 # Custom AXelar USDC on base sepolia
LAYERZERO_USDC=0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85

# UNIV2_ROUTER=0xUniswapV2RouterOnThisChain
# UNIV3_ROUTER=0xUniswapV3SwapRouterOnThisChain
# EMPSEAL_ROUTER=0xEmpsealRouterIfAvailable

TOKEN_MESSENGER=0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d

LZ_ENDPOINT=0x1a44076050125825900e736c501f859c50fE728c # LayerZero Endpoint on Optimism Sepolia for USDC
LZ_OFT=0xcE8CcA271Ebc0533920C83d39F417ED6A0abB7D0 # LayerZero Custom OFT on Optimism Sepolia for USDC

EMPSEAL_ROUTER=0x686c652d079A370eC97F93B2b4805Ee06aE25d04 
UNIV2_ROUTER=0x0000000000000000000000000000000000000000
UNIV3_ROUTER=0x0000000000000000000000000000000000000000

# ENTRYPOINT=0xEIP4337EntryPoint
# PAYMASTER_SIGNER=0xPaymasterSigner
