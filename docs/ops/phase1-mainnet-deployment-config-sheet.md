# Phase 1 Mainnet Deployment Config Sheet

This sheet is the working deployment and configuration artifact for the first Ruflo mainnet rollout.

It is scoped to these chains:

- `Arbitrum` (`42161`)
- `Avalanche` (`43114`)
- `Base` (`8453`)
- `BSC` (`56`)
- `OP` (`10`)
- `Monad` (`143`)

It assumes:

- full bidirectional mesh for `Axelar` and `LayerZero`
- `CCTP standard` on `Arbitrum`, `Avalanche`, `Base`, `OP`, `Monad`
- `CCTP fast` on `Arbitrum`, `Base`, `OP`
- your DEX aggregator / swap plugin infrastructure is already deployed on all six chains

This sheet does not replace the full runbook. It is the phase-1 execution matrix you can fill and operate from.

Related docs:

- [DEPLOYMENT.md](/Users/ganadhish/code/work/ruflo/DEPLOYMENT.md)
- [route-asset-deployment-runbook.md](/Users/ganadhish/code/work/ruflo/docs/ops/route-asset-deployment-runbook.md)
- [chains.ts](/Users/ganadhish/code/work/ruflo/src/vps/config/chains.ts)
- [routeExecution.ts](/Users/ganadhish/code/work/ruflo/src/vps/config/routeExecution.ts)
- [contracts.ts](/Users/ganadhish/code/work/ruflo/src/vps/config/contracts.ts)

## 1. Scope Summary

### 1.1 Rail footprint

| Rail | Phase 1 chains | Notes |
|---|---|---|
| `CCTP standard` | `Arbitrum`, `Avalanche`, `Base`, `OP`, `Monad` | `USDC` only |
| `CCTP fast` | `Arbitrum`, `Base`, `OP` | `USDC` only |
| `Axelar` | all 6 chains | start with `USDC`, `USDT`, `WETH` route assets |
| `LayerZero` | all 6 chains | start with `USDC`, `USDT`, `WETH` route assets |

### 1.2 Important provider constraints

- `BSC` is excluded from the `CCTP USDC` rollout.
- `Avalanche` is `CCTP standard` only in this rollout.
- `Monad` is `CCTP standard` only in this rollout.
- `CCTP fast` phase-1 source set is only `Arbitrum`, `Base`, `OP`.

### 1.3 Mesh counts

| Rail | Participating chains | Directed source->destination entries |
|---|---:|---:|
| `CCTP standard` | 5 | 20 |
| `CCTP fast` | 3 | 6 |
| `Axelar` | 6 | 30 |
| `LayerZero` | 6 | 30 |

## 2. Chain Inventory

Fill one row per chain before starting deploy/config.

| Chain | Chain ID | Native settlement bias | CCTP domain | Has DEX aggregator | RPC | Explorer |
|---|---:|---|---:|---|---|---|
| `Arbitrum` | `42161` | `USDC` | `3` | `yes` | `<RPC_ARB>` | `<EXPLORER_ARB>` |
| `Avalanche` | `43114` | `USDC` | `1` | `yes` | `<RPC_AVAX>` | `<EXPLORER_AVAX>` |
| `Base` | `8453` | `USDC` | `6` | `yes` | `<RPC_BASE>` | `<EXPLORER_BASE>` |
| `BSC` | `56` | `USDT` | `n/a` | `yes` | `<RPC_BSC>` | `<EXPLORER_BSC>` |
| `OP` | `10` | `USDC` | `2` | `yes` | `<RPC_OP>` | `<EXPLORER_OP>` |
| `Monad` | `143` | `USDC` | `15` | `yes` | `<RPC_MONAD>` | `<EXPLORER_MONAD>` |

## 3. Per-Chain Deployment Sheet

Record the deployed local Ruflo stack for every chain.

### 3.1 Contracts to record

- `PLUGIN_REGISTRY`
- `ROUTER_V1`
- `RECEIVER_V1`
- `RAIL_PLUGIN_CCTP`
- `RAIL_PLUGIN_CCTP_FAST`
- `RAIL_PLUGIN_AXELAR`
- `RAIL_PLUGIN_LAYERZERO`
- `AXELAR_ADAPTER`
- `LZ_ADAPTER`
- `SWAP_PLUGIN_ID`
- `SWAP_PLUGIN_KIND`

### 3.2 Sheet

| Chain | PLUGIN_REGISTRY | ROUTER_V1 | RECEIVER_V1 | CCTP plugin | CCTP fast plugin | Axelar plugin | LZ plugin | Axelar adapter | LZ adapter | Swap plugin ID |
|---|---|---|---|---|---|---|---|---|---|---|
| `Arbitrum` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` |
| `Avalanche` | `<...>` | `<...>` | `<...>` | `<...>` | `n/a` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` |
| `Base` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` |
| `BSC` | `<...>` | `<...>` | `<...>` | `n/a` | `n/a` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` |
| `OP` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` |
| `Monad` | `<...>` | `<...>` | `<...>` | `<...>` | `n/a` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` |

## 4. Settlement Asset Policy

Recommended initial phase-1 settlement asset allowlists:

| Rail | Initial route assets |
|---|---|
| `CCTP standard` | `USDC` |
| `CCTP fast` | `USDC` |
| `Axelar` | `USDC`, `USDT`, `WETH` |
| `LayerZero` | `USDC`, `USDT`, `WETH` |

Notes:

- `BSC` should be treated as `USDT`-dominant operationally for non-CCTP rails.
- `Axelar token IDs` are needed only for the route assets you whitelist, not for arbitrary user `tokenIn` or `tokenOut`.
- `LayerZero` metadata is required only for the route assets and route families you enable.

## 5. CCTP Standard Mesh

This mesh is only among:

- `Arbitrum`
- `Avalanche`
- `Base`
- `OP`
- `Monad`

Every source chain below needs local CCTP route config for each listed destination chain.

### 5.1 Directed route matrix

| Source | Destination chains |
|---|---|
| `Arbitrum` | `Avalanche`, `Base`, `OP`, `Monad` |
| `Avalanche` | `Arbitrum`, `Base`, `OP`, `Monad` |
| `Base` | `Arbitrum`, `Avalanche`, `OP`, `Monad` |
| `OP` | `Arbitrum`, `Avalanche`, `Base`, `Monad` |
| `Monad` | `Arbitrum`, `Avalanche`, `Base`, `OP` |

### 5.2 Per-route values required on the source chain

For each directed pair `SRC -> DST`, fill:

- `CCTP_ROUTE_CHAIN_ID`
- `CCTP_ROUTE_DOMAIN`
- `CCTP_ROUTE_RECEIVER`
- `CCTP_ROUTE_CALLER`

### 5.3 Pair sheet

| Source | Destination | DST chain ID | DST domain | DST ReceiverV1 | DST allowed caller / relayer |
|---|---|---:|---:|---|---|
| `Arbitrum` | `Avalanche` | `43114` | `1` | `<RECEIVER_AVAX>` | `<CALLER_AVAX>` |
| `Arbitrum` | `Base` | `8453` | `6` | `<RECEIVER_BASE>` | `<CALLER_BASE>` |
| `Arbitrum` | `OP` | `10` | `2` | `<RECEIVER_OP>` | `<CALLER_OP>` |
| `Arbitrum` | `Monad` | `143` | `15` | `<RECEIVER_MONAD>` | `<CALLER_MONAD>` |
| `Avalanche` | `Arbitrum` | `42161` | `3` | `<RECEIVER_ARB>` | `<CALLER_ARB>` |
| `Avalanche` | `Base` | `8453` | `6` | `<RECEIVER_BASE>` | `<CALLER_BASE>` |
| `Avalanche` | `OP` | `10` | `2` | `<RECEIVER_OP>` | `<CALLER_OP>` |
| `Avalanche` | `Monad` | `143` | `15` | `<RECEIVER_MONAD>` | `<CALLER_MONAD>` |
| `Base` | `Arbitrum` | `42161` | `3` | `<RECEIVER_ARB>` | `<CALLER_ARB>` |
| `Base` | `Avalanche` | `43114` | `1` | `<RECEIVER_AVAX>` | `<CALLER_AVAX>` |
| `Base` | `OP` | `10` | `2` | `<RECEIVER_OP>` | `<CALLER_OP>` |
| `Base` | `Monad` | `143` | `15` | `<RECEIVER_MONAD>` | `<CALLER_MONAD>` |
| `OP` | `Arbitrum` | `42161` | `3` | `<RECEIVER_ARB>` | `<CALLER_ARB>` |
| `OP` | `Avalanche` | `43114` | `1` | `<RECEIVER_AVAX>` | `<CALLER_AVAX>` |
| `OP` | `Base` | `8453` | `6` | `<RECEIVER_BASE>` | `<CALLER_BASE>` |
| `OP` | `Monad` | `143` | `15` | `<RECEIVER_MONAD>` | `<CALLER_MONAD>` |
| `Monad` | `Arbitrum` | `42161` | `3` | `<RECEIVER_ARB>` | `<CALLER_ARB>` |
| `Monad` | `Avalanche` | `43114` | `1` | `<RECEIVER_AVAX>` | `<CALLER_AVAX>` |
| `Monad` | `Base` | `8453` | `6` | `<RECEIVER_BASE>` | `<CALLER_BASE>` |
| `Monad` | `OP` | `10` | `2` | `<RECEIVER_OP>` | `<CALLER_OP>` |

## 6. CCTP Fast Mesh

This mesh is only among:

- `Arbitrum`
- `Base`
- `OP`

### 6.1 Directed route matrix

| Source | Destination chains |
|---|---|
| `Arbitrum` | `Base`, `OP` |
| `Base` | `Arbitrum`, `OP` |
| `OP` | `Arbitrum`, `Base` |

### 6.2 Per-route values required on the source chain

For each directed pair `SRC -> DST`, fill:

- `CCTP_FAST_ROUTE_CHAIN_ID`
- `CCTP_FAST_ROUTE_DOMAIN`
- `CCTP_FAST_ROUTE_RECEIVER`
- `CCTP_FAST_ROUTE_CALLER`
- `CCTP_FAST_MAX_FEE_BPS_CAP`

### 6.3 Pair sheet

| Source | Destination | DST chain ID | DST domain | DST ReceiverV1 | DST allowed caller / relayer | Max fee bps cap |
|---|---|---:|---:|---|---|---:|
| `Arbitrum` | `Base` | `8453` | `6` | `<RECEIVER_BASE>` | `<CALLER_BASE>` | `<FAST_CAP_BPS>` |
| `Arbitrum` | `OP` | `10` | `2` | `<RECEIVER_OP>` | `<CALLER_OP>` | `<FAST_CAP_BPS>` |
| `Base` | `Arbitrum` | `42161` | `3` | `<RECEIVER_ARB>` | `<CALLER_ARB>` | `<FAST_CAP_BPS>` |
| `Base` | `OP` | `10` | `2` | `<RECEIVER_OP>` | `<CALLER_OP>` | `<FAST_CAP_BPS>` |
| `OP` | `Arbitrum` | `42161` | `3` | `<RECEIVER_ARB>` | `<CALLER_ARB>` | `<FAST_CAP_BPS>` |
| `OP` | `Base` | `8453` | `6` | `<RECEIVER_BASE>` | `<CALLER_BASE>` | `<FAST_CAP_BPS>` |

## 7. Axelar Full Mesh

All six chains participate.

### 7.1 Directed source route matrix

| Source | Destination chains |
|---|---|
| `Arbitrum` | `Avalanche`, `Base`, `BSC`, `OP`, `Monad` |
| `Avalanche` | `Arbitrum`, `Base`, `BSC`, `OP`, `Monad` |
| `Base` | `Arbitrum`, `Avalanche`, `BSC`, `OP`, `Monad` |
| `BSC` | `Arbitrum`, `Avalanche`, `Base`, `OP`, `Monad` |
| `OP` | `Arbitrum`, `Avalanche`, `Base`, `BSC`, `Monad` |
| `Monad` | `Arbitrum`, `Avalanche`, `Base`, `BSC`, `OP` |

### 7.2 What must be configured

For every directed pair `SRC -> DST`:

On the source chain:

- `AXELAR_ROUTE_CHAIN_ID`
- `AXELAR_ROUTE_NAME`
- `AXELAR_ROUTE_RECEIVER`
- `AXELAR_ROUTE_TOKEN_ID` for each route asset you enable

On the destination chain:

- `AXELAR_ADAPTER_SET_TRUSTED_SOURCE`
- `AXELAR_SOURCE_CHAIN`
- `AXELAR_SOURCE_ADDRESS`
- `AXELAR_TRUSTED_TOKEN_ID`
- `AXELAR_TRUSTED_TOKEN`

Operationally:

- route config is pair-scoped
- trusted source is pair-scoped
- trusted token rows are asset-scoped, not arbitrary-token-scoped

### 7.3 Source route sheet

| Source | Destination | AXELAR_ROUTE_CHAIN_ID | AXELAR_ROUTE_NAME | AXELAR_ROUTE_RECEIVER |
|---|---|---:|---|---|
| `Arbitrum` | `Avalanche` | `43114` | `<axelar-avalanche-name>` | `<AXELAR_ADAPTER_AVAX>` |
| `Arbitrum` | `Base` | `8453` | `<axelar-base-name>` | `<AXELAR_ADAPTER_BASE>` |
| `Arbitrum` | `BSC` | `56` | `<axelar-bsc-name>` | `<AXELAR_ADAPTER_BSC>` |
| `Arbitrum` | `OP` | `10` | `<axelar-op-name>` | `<AXELAR_ADAPTER_OP>` |
| `Arbitrum` | `Monad` | `143` | `<axelar-monad-name>` | `<AXELAR_ADAPTER_MONAD>` |
| `Avalanche` | `Arbitrum` | `42161` | `<axelar-arbitrum-name>` | `<AXELAR_ADAPTER_ARB>` |
| `Avalanche` | `Base` | `8453` | `<axelar-base-name>` | `<AXELAR_ADAPTER_BASE>` |
| `Avalanche` | `BSC` | `56` | `<axelar-bsc-name>` | `<AXELAR_ADAPTER_BSC>` |
| `Avalanche` | `OP` | `10` | `<axelar-op-name>` | `<AXELAR_ADAPTER_OP>` |
| `Avalanche` | `Monad` | `143` | `<axelar-monad-name>` | `<AXELAR_ADAPTER_MONAD>` |
| `Base` | `Arbitrum` | `42161` | `<axelar-arbitrum-name>` | `<AXELAR_ADAPTER_ARB>` |
| `Base` | `Avalanche` | `43114` | `<axelar-avalanche-name>` | `<AXELAR_ADAPTER_AVAX>` |
| `Base` | `BSC` | `56` | `<axelar-bsc-name>` | `<AXELAR_ADAPTER_BSC>` |
| `Base` | `OP` | `10` | `<axelar-op-name>` | `<AXELAR_ADAPTER_OP>` |
| `Base` | `Monad` | `143` | `<axelar-monad-name>` | `<AXELAR_ADAPTER_MONAD>` |
| `BSC` | `Arbitrum` | `42161` | `<axelar-arbitrum-name>` | `<AXELAR_ADAPTER_ARB>` |
| `BSC` | `Avalanche` | `43114` | `<axelar-avalanche-name>` | `<AXELAR_ADAPTER_AVAX>` |
| `BSC` | `Base` | `8453` | `<axelar-base-name>` | `<AXELAR_ADAPTER_BASE>` |
| `BSC` | `OP` | `10` | `<axelar-op-name>` | `<AXELAR_ADAPTER_OP>` |
| `BSC` | `Monad` | `143` | `<axelar-monad-name>` | `<AXELAR_ADAPTER_MONAD>` |
| `OP` | `Arbitrum` | `42161` | `<axelar-arbitrum-name>` | `<AXELAR_ADAPTER_ARB>` |
| `OP` | `Avalanche` | `43114` | `<axelar-avalanche-name>` | `<AXELAR_ADAPTER_AVAX>` |
| `OP` | `Base` | `8453` | `<axelar-base-name>` | `<AXELAR_ADAPTER_BASE>` |
| `OP` | `BSC` | `56` | `<axelar-bsc-name>` | `<AXELAR_ADAPTER_BSC>` |
| `OP` | `Monad` | `143` | `<axelar-monad-name>` | `<AXELAR_ADAPTER_MONAD>` |
| `Monad` | `Arbitrum` | `42161` | `<axelar-arbitrum-name>` | `<AXELAR_ADAPTER_ARB>` |
| `Monad` | `Avalanche` | `43114` | `<axelar-avalanche-name>` | `<AXELAR_ADAPTER_AVAX>` |
| `Monad` | `Base` | `8453` | `<axelar-base-name>` | `<AXELAR_ADAPTER_BASE>` |
| `Monad` | `BSC` | `56` | `<axelar-bsc-name>` | `<AXELAR_ADAPTER_BSC>` |
| `Monad` | `OP` | `10` | `<axelar-op-name>` | `<AXELAR_ADAPTER_OP>` |

### 7.4 Destination trusted-token sheet

Fill once per destination chain per whitelisted route asset.

| Destination chain | Asset alias | AXELAR_TRUSTED_TOKEN_ID | AXELAR_TRUSTED_TOKEN |
|---|---|---|---|
| `Arbitrum` | `USDC` | `<ARB_AXELAR_USDC_TOKEN_ID>` | `<ARB_AXELAR_USDC>` |
| `Arbitrum` | `USDT` | `<ARB_AXELAR_USDT_TOKEN_ID>` | `<ARB_AXELAR_USDT>` |
| `Arbitrum` | `WETH` | `<ARB_AXELAR_WETH_TOKEN_ID>` | `<ARB_AXELAR_WETH>` |
| `Avalanche` | `USDC` | `<AVAX_AXELAR_USDC_TOKEN_ID>` | `<AVAX_AXELAR_USDC>` |
| `Avalanche` | `USDT` | `<AVAX_AXELAR_USDT_TOKEN_ID>` | `<AVAX_AXELAR_USDT>` |
| `Avalanche` | `WETH` | `<AVAX_AXELAR_WETH_TOKEN_ID>` | `<AVAX_AXELAR_WETH>` |
| `Base` | `USDC` | `<BASE_AXELAR_USDC_TOKEN_ID>` | `<BASE_AXELAR_USDC>` |
| `Base` | `USDT` | `<BASE_AXELAR_USDT_TOKEN_ID>` | `<BASE_AXELAR_USDT>` |
| `Base` | `WETH` | `<BASE_AXELAR_WETH_TOKEN_ID>` | `<BASE_AXELAR_WETH>` |
| `BSC` | `USDC` | `<BSC_AXELAR_USDC_TOKEN_ID>` | `<BSC_AXELAR_USDC>` |
| `BSC` | `USDT` | `<BSC_AXELAR_USDT_TOKEN_ID>` | `<BSC_AXELAR_USDT>` |
| `BSC` | `WETH` | `<BSC_AXELAR_WETH_TOKEN_ID>` | `<BSC_AXELAR_WETH>` |
| `OP` | `USDC` | `<OP_AXELAR_USDC_TOKEN_ID>` | `<OP_AXELAR_USDC>` |
| `OP` | `USDT` | `<OP_AXELAR_USDT_TOKEN_ID>` | `<OP_AXELAR_USDT>` |
| `OP` | `WETH` | `<OP_AXELAR_WETH_TOKEN_ID>` | `<OP_AXELAR_WETH>` |
| `Monad` | `USDC` | `<MONAD_AXELAR_USDC_TOKEN_ID>` | `<MONAD_AXELAR_USDC>` |
| `Monad` | `USDT` | `<MONAD_AXELAR_USDT_TOKEN_ID>` | `<MONAD_AXELAR_USDT>` |
| `Monad` | `WETH` | `<MONAD_AXELAR_WETH_TOKEN_ID>` | `<MONAD_AXELAR_WETH>` |

## 8. LayerZero Full Mesh

All six chains participate.

### 8.1 Directed source route matrix

| Source | Destination chains |
|---|---|
| `Arbitrum` | `Avalanche`, `Base`, `BSC`, `OP`, `Monad` |
| `Avalanche` | `Arbitrum`, `Base`, `BSC`, `OP`, `Monad` |
| `Base` | `Arbitrum`, `Avalanche`, `BSC`, `OP`, `Monad` |
| `BSC` | `Arbitrum`, `Avalanche`, `Base`, `OP`, `Monad` |
| `OP` | `Arbitrum`, `Avalanche`, `Base`, `BSC`, `Monad` |
| `Monad` | `Arbitrum`, `Avalanche`, `Base`, `BSC`, `OP` |

### 8.2 What must be configured

For every directed pair `SRC -> DST`:

On the source chain:

- `LZ_ROUTE_CHAIN_ID`
- `LZ_ROUTE_EID`
- `LZ_ROUTE_RECEIVER`
- `LZ_ROUTE_OPTIONS`
- route family metadata for each enabled asset

On the destination chain:

- `LZ_ADAPTER_SET_TRUSTED_PEER`
- `LZ_SOURCE_EID`
- `LZ_SOURCE_PEER_ADDRESS`
- `LZ_SETTLEMENT_TOKEN`
- `LZ_COMPOSE_SENDER`

Potentially also:

- `LZ_OFT_SET_PEER`
- `LZ_OFT_PEER_EID`
- `LZ_OFT_PEER_ADDRESS`

Operationally:

- route config is pair + family scoped
- trusted peer is pair scoped
- settlement token and compose sender are asset scoped

### 8.3 Source route sheet

| Source | Destination | LZ_ROUTE_CHAIN_ID | LZ_ROUTE_EID | LZ_ROUTE_RECEIVER | LZ route family set |
|---|---|---:|---:|---|---|
| `Arbitrum` | `Avalanche` | `43114` | `<LZ_EID_AVAX>` | `<LZ_ADAPTER_AVAX>` | `<USDC/USDT/WETH families>` |
| `Arbitrum` | `Base` | `8453` | `<LZ_EID_BASE>` | `<LZ_ADAPTER_BASE>` | `<USDC/USDT/WETH families>` |
| `Arbitrum` | `BSC` | `56` | `<LZ_EID_BSC>` | `<LZ_ADAPTER_BSC>` | `<USDC/USDT/WETH families>` |
| `Arbitrum` | `OP` | `10` | `<LZ_EID_OP>` | `<LZ_ADAPTER_OP>` | `<USDC/USDT/WETH families>` |
| `Arbitrum` | `Monad` | `143` | `<LZ_EID_MONAD>` | `<LZ_ADAPTER_MONAD>` | `<USDC/USDT/WETH families>` |
| `Avalanche` | `Arbitrum` | `42161` | `<LZ_EID_ARB>` | `<LZ_ADAPTER_ARB>` | `<USDC/USDT/WETH families>` |
| `Avalanche` | `Base` | `8453` | `<LZ_EID_BASE>` | `<LZ_ADAPTER_BASE>` | `<USDC/USDT/WETH families>` |
| `Avalanche` | `BSC` | `56` | `<LZ_EID_BSC>` | `<LZ_ADAPTER_BSC>` | `<USDC/USDT/WETH families>` |
| `Avalanche` | `OP` | `10` | `<LZ_EID_OP>` | `<LZ_ADAPTER_OP>` | `<USDC/USDT/WETH families>` |
| `Avalanche` | `Monad` | `143` | `<LZ_EID_MONAD>` | `<LZ_ADAPTER_MONAD>` | `<USDC/USDT/WETH families>` |
| `Base` | `Arbitrum` | `42161` | `<LZ_EID_ARB>` | `<LZ_ADAPTER_ARB>` | `<USDC/USDT/WETH families>` |
| `Base` | `Avalanche` | `43114` | `<LZ_EID_AVAX>` | `<LZ_ADAPTER_AVAX>` | `<USDC/USDT/WETH families>` |
| `Base` | `BSC` | `56` | `<LZ_EID_BSC>` | `<LZ_ADAPTER_BSC>` | `<USDC/USDT/WETH families>` |
| `Base` | `OP` | `10` | `<LZ_EID_OP>` | `<LZ_ADAPTER_OP>` | `<USDC/USDT/WETH families>` |
| `Base` | `Monad` | `143` | `<LZ_EID_MONAD>` | `<LZ_ADAPTER_MONAD>` | `<USDC/USDT/WETH families>` |
| `BSC` | `Arbitrum` | `42161` | `<LZ_EID_ARB>` | `<LZ_ADAPTER_ARB>` | `<USDC/USDT/WETH families>` |
| `BSC` | `Avalanche` | `43114` | `<LZ_EID_AVAX>` | `<LZ_ADAPTER_AVAX>` | `<USDC/USDT/WETH families>` |
| `BSC` | `Base` | `8453` | `<LZ_EID_BASE>` | `<LZ_ADAPTER_BASE>` | `<USDC/USDT/WETH families>` |
| `BSC` | `OP` | `10` | `<LZ_EID_OP>` | `<LZ_ADAPTER_OP>` | `<USDC/USDT/WETH families>` |
| `BSC` | `Monad` | `143` | `<LZ_EID_MONAD>` | `<LZ_ADAPTER_MONAD>` | `<USDC/USDT/WETH families>` |
| `OP` | `Arbitrum` | `42161` | `<LZ_EID_ARB>` | `<LZ_ADAPTER_ARB>` | `<USDC/USDT/WETH families>` |
| `OP` | `Avalanche` | `43114` | `<LZ_EID_AVAX>` | `<LZ_ADAPTER_AVAX>` | `<USDC/USDT/WETH families>` |
| `OP` | `Base` | `8453` | `<LZ_EID_BASE>` | `<LZ_ADAPTER_BASE>` | `<USDC/USDT/WETH families>` |
| `OP` | `BSC` | `56` | `<LZ_EID_BSC>` | `<LZ_ADAPTER_BSC>` | `<USDC/USDT/WETH families>` |
| `OP` | `Monad` | `143` | `<LZ_EID_MONAD>` | `<LZ_ADAPTER_MONAD>` | `<USDC/USDT/WETH families>` |
| `Monad` | `Arbitrum` | `42161` | `<LZ_EID_ARB>` | `<LZ_ADAPTER_ARB>` | `<USDC/USDT/WETH families>` |
| `Monad` | `Avalanche` | `43114` | `<LZ_EID_AVAX>` | `<LZ_ADAPTER_AVAX>` | `<USDC/USDT/WETH families>` |
| `Monad` | `Base` | `8453` | `<LZ_EID_BASE>` | `<LZ_ADAPTER_BASE>` | `<USDC/USDT/WETH families>` |
| `Monad` | `BSC` | `56` | `<LZ_EID_BSC>` | `<LZ_ADAPTER_BSC>` | `<USDC/USDT/WETH families>` |
| `Monad` | `OP` | `10` | `<LZ_EID_OP>` | `<LZ_ADAPTER_OP>` | `<USDC/USDT/WETH families>` |

### 8.4 Destination asset sheet

Fill once per destination chain per asset family you enable.

| Destination chain | Asset alias | LZ settlement token | OFT / route token | Compose sender | Route family | Default options |
|---|---|---|---|---|---|---|
| `Arbitrum` | `USDC` | `<ARB_LZ_USDC>` | `<ARB_LZ_OFT_USDC>` | `<ARB_COMPOSE_SENDER_USDC>` | `<family>` | `<options>` |
| `Arbitrum` | `USDT` | `<ARB_LZ_USDT>` | `<ARB_LZ_OFT_USDT>` | `<ARB_COMPOSE_SENDER_USDT>` | `<family>` | `<options>` |
| `Arbitrum` | `WETH` | `<ARB_LZ_WETH>` | `<ARB_LZ_OFT_WETH>` | `<ARB_COMPOSE_SENDER_WETH>` | `<family>` | `<options>` |
| `Avalanche` | `USDC` | `<AVAX_LZ_USDC>` | `<AVAX_LZ_OFT_USDC>` | `<AVAX_COMPOSE_SENDER_USDC>` | `<family>` | `<options>` |
| `Avalanche` | `USDT` | `<AVAX_LZ_USDT>` | `<AVAX_LZ_OFT_USDT>` | `<AVAX_COMPOSE_SENDER_USDT>` | `<family>` | `<options>` |
| `Avalanche` | `WETH` | `<AVAX_LZ_WETH>` | `<AVAX_LZ_OFT_WETH>` | `<AVAX_COMPOSE_SENDER_WETH>` | `<family>` | `<options>` |
| `Base` | `USDC` | `<BASE_LZ_USDC>` | `<BASE_LZ_OFT_USDC>` | `<BASE_COMPOSE_SENDER_USDC>` | `<family>` | `<options>` |
| `Base` | `USDT` | `<BASE_LZ_USDT>` | `<BASE_LZ_OFT_USDT>` | `<BASE_COMPOSE_SENDER_USDT>` | `<family>` | `<options>` |
| `Base` | `WETH` | `<BASE_LZ_WETH>` | `<BASE_LZ_OFT_WETH>` | `<BASE_COMPOSE_SENDER_WETH>` | `<family>` | `<options>` |
| `BSC` | `USDC` | `<BSC_LZ_USDC>` | `<BSC_LZ_OFT_USDC>` | `<BSC_COMPOSE_SENDER_USDC>` | `<family>` | `<options>` |
| `BSC` | `USDT` | `<BSC_LZ_USDT>` | `<BSC_LZ_OFT_USDT>` | `<BSC_COMPOSE_SENDER_USDT>` | `<family>` | `<options>` |
| `BSC` | `WETH` | `<BSC_LZ_WETH>` | `<BSC_LZ_OFT_WETH>` | `<BSC_COMPOSE_SENDER_WETH>` | `<family>` | `<options>` |
| `OP` | `USDC` | `<OP_LZ_USDC>` | `<OP_LZ_OFT_USDC>` | `<OP_COMPOSE_SENDER_USDC>` | `<family>` | `<options>` |
| `OP` | `USDT` | `<OP_LZ_USDT>` | `<OP_LZ_OFT_USDT>` | `<OP_COMPOSE_SENDER_USDT>` | `<family>` | `<options>` |
| `OP` | `WETH` | `<OP_LZ_WETH>` | `<OP_LZ_OFT_WETH>` | `<OP_COMPOSE_SENDER_WETH>` | `<family>` | `<options>` |
| `Monad` | `USDC` | `<MONAD_LZ_USDC>` | `<MONAD_LZ_OFT_USDC>` | `<MONAD_COMPOSE_SENDER_USDC>` | `<family>` | `<options>` |
| `Monad` | `USDT` | `<MONAD_LZ_USDT>` | `<MONAD_LZ_OFT_USDT>` | `<MONAD_COMPOSE_SENDER_USDT>` | `<family>` | `<options>` |
| `Monad` | `WETH` | `<MONAD_LZ_WETH>` | `<MONAD_LZ_OFT_WETH>` | `<MONAD_COMPOSE_SENDER_WETH>` | `<family>` | `<options>` |

## 9. VPS Configuration Sheet

### 9.1 Chain-local runtime keys

Fill these for every chain:

```bash
CHAIN_<id>_RPC_URL=
CHAIN_<id>_ROUTER_V1=
CHAIN_<id>_RECEIVER_V1=
CHAIN_<id>_SWAP_PLUGIN_ID=
CHAIN_<id>_SWAP_PLUGIN_KIND=
```

### 9.2 Settlement token keys

Fill the rail-specific token addresses you actually enable.

Examples:

```bash
CHAIN_42161_TOKEN_CCTP_USDC=
CHAIN_42161_TOKEN_AXELAR_USDC=
CHAIN_42161_TOKEN_AXELAR_USDT=
CHAIN_42161_TOKEN_AXELAR_ETH=
CHAIN_42161_TOKEN_LAYERZERO_USDC=
CHAIN_42161_TOKEN_LAYERZERO_USDT=
CHAIN_42161_TOKEN_LAYERZERO_ETH=
```

### 9.3 CCTP runtime keys

Fill for CCTP chains:

```bash
ENABLE_CCTP_FAST=true
CCTP_FAST_PLUGIN_ID=
CCTP_RELAYER_PRIVATE_KEY=
CCTP_ATTESTATION_BASE_URL=
CCTP_MESSAGE_TRANSMITTER=
CHAIN_<id>_CCTP_DOMAIN=
CHAIN_<id>_CCTP_MESSAGE_TRANSMITTER=
```

### 9.4 Axelar metadata keys

Fill per destination chain per whitelisted route asset:

```bash
CHAIN_<dstId>_AXELAR_TOKEN_ID_USDC=
CHAIN_<dstId>_AXELAR_TOKEN_ID_USDT=
CHAIN_<dstId>_AXELAR_TOKEN_ID_WETH=
```

### 9.5 LayerZero metadata keys

Fill per chain:

```bash
CHAIN_<id>_LZ_DST_EID=
CHAIN_<id>_LZ_OFT_USDC=
CHAIN_<id>_LZ_OFT_USDT=
CHAIN_<id>_LZ_OFT_WETH=
CHAIN_<id>_LZ_EXTRA_OPTIONS_USDC=
CHAIN_<id>_LZ_EXTRA_OPTIONS_USDT=
CHAIN_<id>_LZ_EXTRA_OPTIONS_WETH=
```

## 10. Deployment Order

Recommended order:

1. Deploy local Ruflo stack on all 6 chains.
2. Record all deployed addresses in Section 3.
3. Configure `ReceiverV1` approved callers on all 6 chains.
4. Configure `CCTP standard` mesh.
5. Configure `CCTP fast` mesh.
6. Configure `Axelar` source routes on all 6 chains.
7. Configure `Axelar` destination trusted sources and trusted tokens on all 6 chains.
8. Configure `LayerZero` source routes on all 6 chains.
9. Configure `LayerZero` destination trusted peers and settlement assets on all 6 chains.
10. Populate VPS deployment registry and runtime env.
11. Run per-pair smoke tests before opening production traffic.

## 11. Minimum Smoke-Test Matrix

Run at least one end-to-end test for each rail shape:

- `Arbitrum -> Base` via `CCTP standard`
- `Arbitrum -> Base` via `CCTP fast`
- `Avalanche -> Base` via `CCTP standard`
- `Monad -> OP` via `CCTP standard`
- `BSC -> Base` via `Axelar`
- `Base -> Monad` via `Axelar`
- `Base -> BSC` via `LayerZero`
- `OP -> Avalanche` via `LayerZero`

For at least one route on each rail, test:

- direct settlement delivery
- destination swap out
- source swap in + destination swap out

## 12. Open Items To Fill

- final RPC URLs
- final deployed contract addresses
- final Axelar chain names
- final Axelar token IDs for `USDC`, `USDT`, `WETH`
- final LayerZero EIDs
- final LayerZero route families per asset per chain
- final LayerZero OFT / Stargate addresses
- final `LZ_ROUTE_OPTIONS`
- final `CCTP_ROUTE_CALLER` / `CCTP_FAST_ROUTE_CALLER`
- final swap plugin IDs and kind per chain

## 13. External References

These should be rechecked before production broadcast:

- Circle CCTP supported chains and domains: [developers.circle.com/cctp/cctp-supported-blockchains](https://developers.circle.com/cctp/cctp-supported-blockchains/)
- Circle required block confirmations and fast-transfer notes: [developers.circle.com/cctp/required-block-confirmations](https://developers.circle.com/cctp/required-block-confirmations)
- LayerZero network / mesh concepts: [docs.layerzero.network/v2/concepts/protocol/mesh-network](https://docs.layerzero.network/v2/concepts/protocol/mesh-network)
- LayerZero adding networks guide: [docs.layerzero.network/v2/get-started/create-lz-oapp/adding-networks](https://docs.layerzero.network/v2/get-started/create-lz-oapp/adding-networks)

