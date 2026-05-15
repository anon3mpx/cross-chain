# Current Env On Arbitrum Mainnet

This file is for the case where:

- `Arbitrum` is the local chain you are configuring
- `OP` is the remote chain

Use this as a reference sheet, not as a guaranteed final `.env`.
The LayerZero asset values here are specifically for the `USDC` route.
Every address below is labeled as either `local Arbitrum` or `remote OP`.

Important for this mainnet setup:

- `LZ_SET_ROUTE`, `LZ_ADAPTER_SET_TRUSTED_PEER`, and `LZ_ADAPTER_SET_ASSET` should be enabled.
- `LZ_OFT_SET_PEER` should stay disabled for protocol-owned Stargate/LayerZero USDC asset contracts unless you control that OFT contract and can call `setPeer(...)` on it.

## Local and Remote Contracts

- Local chain: `Arbitrum` (`42161`)
- Remote chain: `Optimism` (`10`)
- Local `LayerZeroRailPlugin`: `0x8fb6314678a9287f9b47b96e54122444e43dde1f`
- Local `LayerZeroReceiverAdapter`: `0xcdbc01b0dddac2729263a7ff4318a1b17b2eedb3`
- Local `ReceiverV1`: `0xa10914363664e46154328e6e787961641ea6e3de`
- Remote `LayerZeroRailPlugin` on OP: `0xdb403792c55bfe26beaef235986d4f106e40ee6f`
- Remote `LayerZeroReceiverAdapter` on OP: `0x845cd50644a9592de43bcac0212656480744aaca`
- Remote `ReceiverV1` on OP: `0x65642ac8fd57eff8dd4651cb76be48814c8bf386`

## LayerZero Mainnet Constants

- Arbitrum EID: `30110`
- OP EID: `30111`
- LayerZero Endpoint V2 on both chains: `0x1a44076050125825900e736c501f859c50fE728c`

## Arbitrum Mainnet Variables

```bash
# ------------------------------------------------------------
# Local Arbitrum mainnet chain context
# ------------------------------------------------------------
RPC_URL=https://arb1.arbitrum.io/rpc
DEPLOYER_PRIVATE_KEY=
OWNER=0x05F8cC8753D90d67DBB8c02118440b8283F941c9
FEE_RECIPIENT=0x05F8cC8753D90d67DBB8c02118440b8283F941c9

WETH=0x82aF49447D8a07e3bd95BD0d56f35241523fBab1                     # local Arbitrum WETH
LAYERZERO_USDC=0xaf88d065e77c8cC2239327C5EDb3A432268e5831           # local Arbitrum USDC (settlement token)
LZ_ENDPOINT=0x1a44076050125825900e736c501f859c50fE728c              # local LayerZero endpoint on Arbitrum
LZ_OFT=0xe8CDF27AcD73a434D661C84887215F7598e7d0d3                   # local Arbitrum LayerZero USDC asset contract

# ------------------------------------------------------------
# Local Ruflo contracts on Arbitrum
# ------------------------------------------------------------
PLUGIN_REGISTRY=0x1725e2c27e428eb4a18ed121b459f4055ef2cc5b          # local PluginRegistry on Arbitrum
ROUTER_V1=0x465fa155c8623dd3dce1e5e134d86f1d47b8fcf4                # local RouterV1 on Arbitrum
RECEIVER_V1=0xa10914363664e46154328e6e787961641ea6e3de              # local ReceiverV1 on Arbitrum
RAIL_PLUGIN_LAYERZERO=0x8fb6314678a9287f9b47b96e54122444e43dde1f    # local LayerZeroRailPlugin on Arbitrum
LZ_ADAPTER=0xcdbc01b0dddac2729263a7ff4318a1b17b2eedb3               # local LayerZeroReceiverAdapter on Arbitrum

# Optional plugin registration vars
SWAP_PLUGIN_EMPSEAL=0xA7772cDBA7739F19dcaE85fe0357929790FD23F9       # local swap plugin on Arbitrum
SWAP_PLUGIN_UNIV2=
SWAP_PLUGIN_UNIV3=

# ------------------------------------------------------------
# Receiver approved callers on Arbitrum
# ------------------------------------------------------------
RECEIVER_APPROVED_CALLER_1=0xcdbc01b0dddac2729263a7ff4318a1b17b2eedb3 # local LayerZeroReceiverAdapter on Arbitrum
RECEIVER_APPROVED_CALLER_2=
RECEIVER_APPROVED_CALLER_3=
RECEIVER_APPROVED_CALLER_4=
RECEIVER_APPROVED_CALLER_5=

# ------------------------------------------------------------
# LayerZero source route config on Arbitrum for ARB -> OP
# These vars are written to the local Arbitrum LayerZeroRailPlugin.
# Remote fields below point to OP.
# ------------------------------------------------------------
LZ_SET_ROUTE=true
LZ_PLUGIN=0x8fb6314678a9287f9b47b96e54122444e43dde1f                # local LayerZeroRailPlugin on Arbitrum
LZ_ROUTE_CHAIN_ID=10                                                # remote destination chain = OP
LZ_ROUTE_EID=30111                                                  # remote destination EID = OP
LZ_ROUTE_RECEIVER=0x845cd50644a9592de43bcac0212656480744aaca        # remote OP LayerZeroReceiverAdapter
LZ_ROUTE_OPTIONS=0x00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a80
LZ_ROUTE_FAMILY=lz_stargate_pool                                    # route family selected for this USDC path
LZ_ROUTE_TOKEN=0xaf88d065e77c8cC2239327C5EDb3A432268e5831           # local source route token on Arbitrum = USDC
LZ_ROUTE_OFT=0xe8CDF27AcD73a434D661C84887215F7598e7d0d3             # local Arbitrum LayerZero USDC asset contract

# ------------------------------------------------------------
# LayerZero destination trust on Arbitrum for inbound OP -> ARB
# These vars are written to the local Arbitrum LayerZeroReceiverAdapter.
# Here, OP is the remote source chain.
# ------------------------------------------------------------
LZ_ADAPTER_SET_TRUSTED_PEER=true
LZ_ADAPTER=0xcdbc01b0dddac2729263a7ff4318a1b17b2eedb3               # local LayerZeroReceiverAdapter on Arbitrum
LZ_SOURCE_EID=30111                                                 # remote source EID = OP
LZ_SOURCE_PEER_ADDRESS=0xdb403792c55bfe26beaef235986d4f106e40ee6f   # remote OP LayerZeroRailPlugin

# ------------------------------------------------------------
# LayerZero destination asset registry on Arbitrum for inbound OP -> ARB
# LZ_SETTLEMENT_TOKEN is the token that arrives locally on Arbitrum.
# LZ_COMPOSE_SENDER is the remote OP asset contract allowed to send it.
# ------------------------------------------------------------
LZ_ADAPTER_SET_ASSET=true
LZ_SETTLEMENT_TOKEN=0xaf88d065e77c8cC2239327C5EDb3A432268e5831       # local Arbitrum USDC that ReceiverV1 will receive
LZ_COMPOSE_SENDER=0xcE8CcA271Ebc0533920C83d39F417ED6A0abB7D0         # remote OP LayerZero USDC asset contract

# ------------------------------------------------------------
# LayerZero OFT/Stargate peer wiring on Arbitrum
# Keep this disabled for protocol-owned mainnet USDC asset contracts.
# Only enable it if Ruflo controls the local OFT and is authorized to call setPeer(...).
# ------------------------------------------------------------
LZ_OFT_SET_PEER=false
# LZ_OFT=0xe8CDF27AcD73a434D661C84887215F7598e7d0d3                 # local Arbitrum LayerZero USDC asset contract
# LZ_OFT_PEER_EID=30111                                             # remote peer EID = OP
# LZ_OFT_PEER_ADDRESS=0xcE8CcA271Ebc0533920C83d39F417ED6A0abB7D0     # remote OP LayerZero USDC asset contract
```

## Simple Meaning

- `LZ_SETTLEMENT_TOKEN`
  - local token on Arbitrum that lands before `ReceiverV1.execute()`
- `LZ_COMPOSE_SENDER`
  - remote OP LayerZero asset contract allowed to send that token into Arbitrum
- `LZ_SOURCE_PEER_ADDRESS`
  - remote OP Ruflo `LayerZeroRailPlugin`
- `LZ_OFT_PEER_ADDRESS`
  - remote OP LayerZero asset contract that the local Arbitrum asset contract trusts as peer

For VPS quotes and `/quote/select`, load this Arbitrum `CHAIN_42161_*` block together with the matching OP `CHAIN_10_*` block in the same runtime env.

CHAIN_42161_RPC_URL=https://arb1.arbitrum.io/rpc
CHAIN_42161_RPC_FALLBACK=https://arb1.arbitrum.io/rpc
CHAIN_42161_ROUTER_V1=0x465fa155c8623dd3dce1e5e134d86f1d47b8fcf4
CHAIN_42161_RECEIVER_V1=0xa10914363664e46154328e6e787961641ea6e3de
CHAIN_42161_HAS_AGGREGATOR=true
CHAIN_42161_SWAP_PLUGIN_KIND=EMPSEAL
CHAIN_42161_TOKEN_CCTP_USDC=0xaf88d065e77c8cC2239327C5EDb3A432268e5831
CHAIN_42161_CCTP_DOMAIN=3
CHAIN_42161_TOKEN_LAYERZERO_USDC=0xaf88d065e77c8cC2239327C5EDb3A432268e5831
CHAIN_42161_LZ_OFT_USDC=0xe8CDF27AcD73a434D661C84887215F7598e7d0d3
CHAIN_42161_LZ_DST_EID=30110
CHAIN_42161_LZ_EXTRA_OPTIONS_USDC=0x00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a80
CHAIN_42161_TOKEN_USDC=0xaf88d065e77c8cC2239327C5EDb3A432268e5831
