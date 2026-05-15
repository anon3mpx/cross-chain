# Phase 1 Mainnet Deployment Config Sheet

This sheet is the working deployment and configuration artifact for the first Ruflo mainnet rollout.

It is scoped to these chains:

- `Arbitrum` (`42161`)
- `Base` (`8453`)
- `BSC` (`56`)
- `OP` (`10`)
- `Monad` (`143`)
- `HyperEVM` (`999`)

It assumes:

- `Axelar` is not part of phase-1 deployment
- `CCTP standard` on `Arbitrum`, `Base`, `OP`, `Monad`, `HyperEVM`
- `CCTP fast` on `Arbitrum`, `Base`, `OP`
- `LayerZero` on `Arbitrum`, `Base`, `BSC`, `OP`, `Monad`, `HyperEVM`
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
| `CCTP standard` | `Arbitrum`, `Base`, `OP`, `Monad`, `HyperEVM` | `USDC` only |
| `CCTP fast` | `Arbitrum`, `Base`, `OP` | `USDC` only |
| `LayerZero` | `Arbitrum`, `Base`, `BSC`, `OP`, `Monad`, `HyperEVM` | start with `USDC`, `USDT`, `WETH` route assets |

### 1.2 Important rollout constraints

- `Axelar` is dropped from this deployment phase.
- `Avalanche` is removed from this deployment phase.
- `BSC` is excluded from the `CCTP` rollout.
- `Monad` is `CCTP standard` only in this rollout.
- `CCTP fast` phase-1 source set is only `Arbitrum`, `Base`, `OP`.

### 1.3 Mesh counts

| Rail | Participating chains | Directed source->destination entries |
|---|---:|---:|
| `CCTP standard` | 5 | 20 |
| `CCTP fast` | 3 | 6 |
| `LayerZero` | 6 | 30 |

## 2. Chain Inventory

Fill one row per chain before starting deploy/config.

| Chain | Chain ID | Native settlement bias | CCTP domain | Has DEX aggregator | RPC | Explorer |
|---|---:|---|---|---|---|---|
| `Arbitrum` | `42161` | `USDC` | `3` | `yes` | `<RPC_ARB>` | `<EXPLORER_ARB>` |
| `Base` | `8453` | `USDC` | `6` | `yes` | `<RPC_BASE>` | `<EXPLORER_BASE>` |
| `BSC` | `56` | `USDT` | `n/a` | `yes` | `<RPC_BSC>` | `<EXPLORER_BSC>` |
| `OP` | `10` | `USDC` | `2` | `yes` | `<RPC_OP>` | `<EXPLORER_OP>` |
| `Monad` | `143` | `USDC` | `15` | `yes` | `<RPC_MONAD>` | `<EXPLORER_MONAD>` |
| `HyperEVM` | `999` | `USDC` | `19` | `yes` | `<RPC_HYPEREVM>` | `<EXPLORER_HYPEREVM>` |

## 3. Per-Chain Deployment Sheet

Record the deployed local Ruflo stack for every chain.

### 3.1 Contracts to record

- `PLUGIN_REGISTRY`
- `ROUTER_V1`
- `RECEIVER_V1`
- `RAIL_PLUGIN_CCTP`
- `RAIL_PLUGIN_CCTP_FAST`
- `RAIL_PLUGIN_LAYERZERO`
- `LZ_ADAPTER`
- `SWAP_PLUGIN_ID`
- `SWAP_PLUGIN_KIND`

### 3.2 Sheet

| Chain | PLUGIN_REGISTRY | ROUTER_V1 | RECEIVER_V1 | CCTP plugin | CCTP fast plugin | LZ plugin | LZ adapter | Swap plugin ID |
|---|---|---|---|---|---|---|---|---|
| `Arbitrum` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` |
| `Base` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` |
| `BSC` | `<...>` | `<...>` | `<...>` | `n/a` | `n/a` | `<...>` | `<...>` | `<...>` |
| `OP` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` | `<...>` |
| `Monad` | `<...>` | `<...>` | `<...>` | `<...>` | `n/a` | `<...>` | `<...>` | `<...>` |
| `HyperEVM` | `<...>` | `<...>` | `<...>` | `<...>` | `n/a` | `<...>` | `<...>` | `<...>` |

## 4. Settlement Asset Policy

Recommended initial phase-1 settlement asset allowlists:

| Rail | Initial route assets |
|---|---|
| `CCTP standard` | `USDC` |
| `CCTP fast` | `USDC` |
| `LayerZero` | `USDC`, `USDT`, `WETH` |

Notes:

- `BSC` should be treated as `USDT`-dominant operationally for non-CCTP rails.
- `LayerZero` metadata is required only for the route assets and route families you enable.

## 5. CCTP Standard Mesh

This mesh is only among:

- `Arbitrum`
- `Base`
- `OP`
- `Monad`
- `HyperEVM`

Every source chain below needs local CCTP route config for each listed destination chain.

### 5.1 Directed route matrix

| Source | Destination chains |
|---|---|
| `Arbitrum` | `Base`, `OP`, `Monad`, `HyperEVM` |
| `Base` | `Arbitrum`, `OP`, `Monad`, `HyperEVM` |
| `OP` | `Arbitrum`, `Base`, `Monad`, `HyperEVM` |
| `Monad` | `Arbitrum`, `Base`, `OP`, `HyperEVM` |
| `HyperEVM` | `Arbitrum`, `Base`, `OP`, `Monad` |

### 5.2 Per-route values required on the source chain

For each directed pair `SRC -> DST`, fill:

- `CCTP_ROUTE_CHAIN_ID`
- `CCTP_ROUTE_DOMAIN`
- `CCTP_ROUTE_RECEIVER`
- `CCTP_ROUTE_CALLER`

### 5.3 Pair sheet

| Source | Destination | DST chain ID | DST domain | DST ReceiverV1 | DST allowed caller / relayer |
|---|---|---:|---|---|---|
| `Arbitrum` | `Base` | `8453` | `6` | `<RECEIVER_BASE>` | `<CALLER_BASE>` |
| `Arbitrum` | `OP` | `10` | `2` | `<RECEIVER_OP>` | `<CALLER_OP>` |
| `Arbitrum` | `Monad` | `143` | `15` | `<RECEIVER_MONAD>` | `<CALLER_MONAD>` |
| `Arbitrum` | `HyperEVM` | `999` | `19` | `<RECEIVER_HYPEREVM>` | `<CALLER_HYPEREVM>` |
| `Base` | `Arbitrum` | `42161` | `3` | `<RECEIVER_ARB>` | `<CALLER_ARB>` |
| `Base` | `OP` | `10` | `2` | `<RECEIVER_OP>` | `<CALLER_OP>` |
| `Base` | `Monad` | `143` | `15` | `<RECEIVER_MONAD>` | `<CALLER_MONAD>` |
| `Base` | `HyperEVM` | `999` | `19` | `<RECEIVER_HYPEREVM>` | `<CALLER_HYPEREVM>` |
| `OP` | `Arbitrum` | `42161` | `3` | `<RECEIVER_ARB>` | `<CALLER_ARB>` |
| `OP` | `Base` | `8453` | `6` | `<RECEIVER_BASE>` | `<CALLER_BASE>` |
| `OP` | `Monad` | `143` | `15` | `<RECEIVER_MONAD>` | `<CALLER_MONAD>` |
| `OP` | `HyperEVM` | `999` | `19` | `<RECEIVER_HYPEREVM>` | `<CALLER_HYPEREVM>` |
| `Monad` | `Arbitrum` | `42161` | `3` | `<RECEIVER_ARB>` | `<CALLER_ARB>` |
| `Monad` | `Base` | `8453` | `6` | `<RECEIVER_BASE>` | `<CALLER_BASE>` |
| `Monad` | `OP` | `10` | `2` | `<RECEIVER_OP>` | `<CALLER_OP>` |
| `Monad` | `HyperEVM` | `999` | `19` | `<RECEIVER_HYPEREVM>` | `<CALLER_HYPEREVM>` |
| `HyperEVM` | `Arbitrum` | `42161` | `3` | `<RECEIVER_ARB>` | `<CALLER_ARB>` |
| `HyperEVM` | `Base` | `8453` | `6` | `<RECEIVER_BASE>` | `<CALLER_BASE>` |
| `HyperEVM` | `OP` | `10` | `2` | `<RECEIVER_OP>` | `<CALLER_OP>` |
| `HyperEVM` | `Monad` | `143` | `15` | `<RECEIVER_MONAD>` | `<CALLER_MONAD>` |

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

## 7. LayerZero Full Mesh

This mesh is only among:

- `Arbitrum`
- `Base`
- `BSC`
- `OP`
- `Monad`
- `HyperEVM`

### 7.1 Directed source route matrix

| Source | Destination chains |
|---|---|
| `Arbitrum` | `Base`, `BSC`, `OP`, `Monad`, `HyperEVM` |
| `Base` | `Arbitrum`, `BSC`, `OP`, `Monad`, `HyperEVM` |
| `BSC` | `Arbitrum`, `Base`, `OP`, `Monad`, `HyperEVM` |
| `OP` | `Arbitrum`, `Base`, `BSC`, `Monad`, `HyperEVM` |
| `Monad` | `Arbitrum`, `Base`, `BSC`, `OP`, `HyperEVM` |
| `HyperEVM` | `Arbitrum`, `Base`, `BSC`, `OP`, `Monad` |

### 7.2 What must be configured

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

### 7.3 Source route sheet

| Source | Destination | LZ_ROUTE_CHAIN_ID | LZ_ROUTE_EID | LZ_ROUTE_RECEIVER | LZ route family set |
|---|---|---:|---:|---|---|
| `Arbitrum` | `Base` | `8453` | `<LZ_EID_BASE>` | `<LZ_ADAPTER_BASE>` | `<USDC/USDT/WETH families>` |
| `Arbitrum` | `BSC` | `56` | `<LZ_EID_BSC>` | `<LZ_ADAPTER_BSC>` | `<USDC/USDT/WETH families>` |
| `Arbitrum` | `OP` | `10` | `<LZ_EID_OP>` | `<LZ_ADAPTER_OP>` | `<USDC/USDT/WETH families>` |
| `Arbitrum` | `Monad` | `143` | `<LZ_EID_MONAD>` | `<LZ_ADAPTER_MONAD>` | `<USDC/USDT/WETH families>` |
| `Arbitrum` | `HyperEVM` | `999` | `<LZ_EID_HYPEREVM>` | `<LZ_ADAPTER_HYPEREVM>` | `<USDC/USDT/WETH families>` |
| `Base` | `Arbitrum` | `42161` | `<LZ_EID_ARB>` | `<LZ_ADAPTER_ARB>` | `<USDC/USDT/WETH families>` |
| `Base` | `BSC` | `56` | `<LZ_EID_BSC>` | `<LZ_ADAPTER_BSC>` | `<USDC/USDT/WETH families>` |
| `Base` | `OP` | `10` | `<LZ_EID_OP>` | `<LZ_ADAPTER_OP>` | `<USDC/USDT/WETH families>` |
| `Base` | `Monad` | `143` | `<LZ_EID_MONAD>` | `<LZ_ADAPTER_MONAD>` | `<USDC/USDT/WETH families>` |
| `Base` | `HyperEVM` | `999` | `<LZ_EID_HYPEREVM>` | `<LZ_ADAPTER_HYPEREVM>` | `<USDC/USDT/WETH families>` |
| `BSC` | `Arbitrum` | `42161` | `<LZ_EID_ARB>` | `<LZ_ADAPTER_ARB>` | `<USDC/USDT/WETH families>` |
| `BSC` | `Base` | `8453` | `<LZ_EID_BASE>` | `<LZ_ADAPTER_BASE>` | `<USDC/USDT/WETH families>` |
| `BSC` | `OP` | `10` | `<LZ_EID_OP>` | `<LZ_ADAPTER_OP>` | `<USDC/USDT/WETH families>` |
| `BSC` | `Monad` | `143` | `<LZ_EID_MONAD>` | `<LZ_ADAPTER_MONAD>` | `<USDC/USDT/WETH families>` |
| `BSC` | `HyperEVM` | `999` | `<LZ_EID_HYPEREVM>` | `<LZ_ADAPTER_HYPEREVM>` | `<USDC/USDT/WETH families>` |
| `OP` | `Arbitrum` | `42161` | `<LZ_EID_ARB>` | `<LZ_ADAPTER_ARB>` | `<USDC/USDT/WETH families>` |
| `OP` | `Base` | `8453` | `<LZ_EID_BASE>` | `<LZ_ADAPTER_BASE>` | `<USDC/USDT/WETH families>` |
| `OP` | `BSC` | `56` | `<LZ_EID_BSC>` | `<LZ_ADAPTER_BSC>` | `<USDC/USDT/WETH families>` |
| `OP` | `Monad` | `143` | `<LZ_EID_MONAD>` | `<LZ_ADAPTER_MONAD>` | `<USDC/USDT/WETH families>` |
| `OP` | `HyperEVM` | `999` | `<LZ_EID_HYPEREVM>` | `<LZ_ADAPTER_HYPEREVM>` | `<USDC/USDT/WETH families>` |
| `Monad` | `Arbitrum` | `42161` | `<LZ_EID_ARB>` | `<LZ_ADAPTER_ARB>` | `<USDC/USDT/WETH families>` |
| `Monad` | `Base` | `8453` | `<LZ_EID_BASE>` | `<LZ_ADAPTER_BASE>` | `<USDC/USDT/WETH families>` |
| `Monad` | `BSC` | `56` | `<LZ_EID_BSC>` | `<LZ_ADAPTER_BSC>` | `<USDC/USDT/WETH families>` |
| `Monad` | `OP` | `10` | `<LZ_EID_OP>` | `<LZ_ADAPTER_OP>` | `<USDC/USDT/WETH families>` |
| `Monad` | `HyperEVM` | `999` | `<LZ_EID_HYPEREVM>` | `<LZ_ADAPTER_HYPEREVM>` | `<USDC/USDT/WETH families>` |
| `HyperEVM` | `Arbitrum` | `42161` | `<LZ_EID_ARB>` | `<LZ_ADAPTER_ARB>` | `<USDC/USDT/WETH families>` |
| `HyperEVM` | `Base` | `8453` | `<LZ_EID_BASE>` | `<LZ_ADAPTER_BASE>` | `<USDC/USDT/WETH families>` |
| `HyperEVM` | `BSC` | `56` | `<LZ_EID_BSC>` | `<LZ_ADAPTER_BSC>` | `<USDC/USDT/WETH families>` |
| `HyperEVM` | `OP` | `10` | `<LZ_EID_OP>` | `<LZ_ADAPTER_OP>` | `<USDC/USDT/WETH families>` |
| `HyperEVM` | `Monad` | `143` | `<LZ_EID_MONAD>` | `<LZ_ADAPTER_MONAD>` | `<USDC/USDT/WETH families>` |

### 7.4 Destination asset sheet

Fill once per destination chain per asset family you enable.

| Destination chain | Asset alias | LZ settlement token | OFT / route token | Compose sender | Route family | Default options |
|---|---|---|---|---|---|---|
| `Arbitrum` | `USDC` | `<ARB_LZ_USDC>` | `<ARB_LZ_OFT_USDC>` | `<ARB_COMPOSE_SENDER_USDC>` | `<family>` | `<options>` |
| `Arbitrum` | `USDT` | `<ARB_LZ_USDT>` | `<ARB_LZ_OFT_USDT>` | `<ARB_COMPOSE_SENDER_USDT>` | `<family>` | `<options>` |
| `Arbitrum` | `WETH` | `<ARB_LZ_WETH>` | `<ARB_LZ_OFT_WETH>` | `<ARB_COMPOSE_SENDER_WETH>` | `<family>` | `<options>` |
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
| `HyperEVM` | `USDC` | `<HYPEREVM_LZ_USDC>` | `<HYPEREVM_LZ_OFT_USDC>` | `<HYPEREVM_COMPOSE_SENDER_USDC>` | `<family>` | `<options>` |
| `HyperEVM` | `USDT` | `<HYPEREVM_LZ_USDT>` | `<HYPEREVM_LZ_OFT_USDT>` | `<HYPEREVM_COMPOSE_SENDER_USDT>` | `<family>` | `<options>` |
| `HyperEVM` | `WETH` | `<HYPEREVM_LZ_WETH>` | `<HYPEREVM_LZ_OFT_WETH>` | `<HYPEREVM_COMPOSE_SENDER_WETH>` | `<family>` | `<options>` |

## 8. VPS Configuration Sheet

### 8.1 Chain-local runtime keys

Fill these for every chain:

```bash
CHAIN_<id>_RPC_URL=
CHAIN_<id>_ROUTER_V1=
CHAIN_<id>_RECEIVER_V1=
CHAIN_<id>_SWAP_PLUGIN_ID=
CHAIN_<id>_SWAP_PLUGIN_KIND=
```

### 8.2 Settlement token keys

Fill the rail-specific token addresses you actually enable.

Examples:

```bash
CHAIN_42161_TOKEN_CCTP_USDC=
CHAIN_42161_TOKEN_LAYERZERO_USDC=
CHAIN_42161_TOKEN_LAYERZERO_USDT=
CHAIN_42161_TOKEN_LAYERZERO_ETH=
```

### 8.3 CCTP runtime keys

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

### 8.4 LayerZero metadata keys

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

## 9. Deployment Order

Recommended order:

1. Deploy local Ruflo stack on all 6 chains.
2. Record all deployed addresses in Section 3.
3. Configure `ReceiverV1` approved callers on all 6 chains.
4. Configure `CCTP standard` mesh.
5. Configure `CCTP fast` mesh.
6. Configure `LayerZero` source routes on its 6 participating chains.
7. Configure `LayerZero` destination trusted peers and settlement assets on its 6 participating chains.
8. Populate VPS deployment registry and runtime env.
9. Run per-pair smoke tests before opening production traffic.

## 10. Minimum Smoke-Test Matrix

Run at least one end-to-end test for each rail shape:

- `Arbitrum -> Base` via `CCTP standard`
- `Arbitrum -> Base` via `CCTP fast`
- `Monad -> OP` via `CCTP standard`
- `HyperEVM -> Base` via `CCTP standard`
- `Base -> BSC` via `LayerZero`
- `OP -> Monad` via `LayerZero`
- `HyperEVM -> Arbitrum` via `LayerZero`

For at least one route on each rail, test:

- direct settlement delivery
- destination swap out
- source swap in + destination swap out

## 11. Open Items To Fill

- final RPC URLs
- final deployed contract addresses
- final `HyperEVM` CCTP domain
- final LayerZero EIDs
- final LayerZero route families per asset per chain
- final LayerZero OFT / Stargate addresses
- final `LZ_ROUTE_OPTIONS`
- final `CCTP_ROUTE_CALLER` / `CCTP_FAST_ROUTE_CALLER`
- final swap plugin IDs and kind per chain

## 12. External References

These should be rechecked before production broadcast:

- Circle CCTP supported chains and domains: [developers.circle.com/cctp/cctp-supported-blockchains](https://developers.circle.com/cctp/cctp-supported-blockchains/)
- Circle required block confirmations and fast-transfer notes: [developers.circle.com/cctp/required-block-confirmations](https://developers.circle.com/cctp/required-block-confirmations)
- LayerZero network / mesh concepts: [docs.layerzero.network/v2/concepts/protocol/mesh-network](https://docs.layerzero.network/v2/concepts/protocol/mesh-network)
- LayerZero adding networks guide: [docs.layerzero.network/v2/get-started/create-lz-oapp/adding-networks](https://docs.layerzero.network/v2/get-started/create-lz-oapp/adding-networks)
