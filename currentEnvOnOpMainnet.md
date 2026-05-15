# Current Env On OP Mainnet

This file is for the case where:

- `OP` is the local chain you are configuring
- `Arbitrum` is the remote chain

Use this as a reference sheet, not as a guaranteed final `.env`.
The LayerZero asset values here are specifically for the `USDC` route.
Every address below is labeled as either `local OP` or `remote Arbitrum`.

Important for this mainnet setup:

- `LZ_SET_ROUTE`, `LZ_ADAPTER_SET_TRUSTED_PEER`, and `LZ_ADAPTER_SET_ASSET` should be enabled.
- `LZ_OFT_SET_PEER` should stay disabled for protocol-owned Stargate/LayerZero USDC asset contracts unless you control that OFT contract and can call `setPeer(...)` on it.

## Local and Remote Contracts

- Local chain: `Optimism` (`10`)
- Remote chain: `Arbitrum` (`42161`)
- Local `LayerZeroRailPlugin`: `0xdb403792c55bfe26beaef235986d4f106e40ee6f`
- Local `LayerZeroReceiverAdapter`: `0x845cd50644a9592de43bcac0212656480744aaca`
- Local `ReceiverV1`: `0x65642ac8fd57eff8dd4651cb76be48814c8bf386`
- Remote `LayerZeroRailPlugin` on Arbitrum: `0x8fb6314678a9287f9b47b96e54122444e43dde1f`
- Remote `LayerZeroReceiverAdapter` on Arbitrum: `0xcdbc01b0dddac2729263a7ff4318a1b17b2eedb3`
- Remote `ReceiverV1` on Arbitrum: `0xa10914363664e46154328e6e787961641ea6e3de`

## LayerZero Mainnet Constants

- OP EID: `30111`
- Arbitrum EID: `30110`
- LayerZero Endpoint V2 on both chains: `0x1a44076050125825900e736c501f859c50fE728c`

## OP Mainnet Variables

```bash
# ------------------------------------------------------------
# Local OP mainnet chain context
# ------------------------------------------------------------
RPC_URL=<OP_MAINNET_RPC>
DEPLOYER_PRIVATE_KEY=
OWNER=0x05F8cC8753D90d67DBB8c02118440b8283F941c9
FEE_RECIPIENT=0x05F8cC8753D90d67DBB8c02118440b8283F941c9

WETH=0x4200000000000000000000000000000000000006                     # local OP WETH
LAYERZERO_USDC=0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85           # local OP USDC (settlement token)
LZ_ENDPOINT=0x1a44076050125825900e736c501f859c50fE728c              # local LayerZero endpoint on OP
LZ_OFT=0xcE8CcA271Ebc0533920C83d39F417ED6A0abB7D0                   # local OP LayerZero USDC asset contract

# ------------------------------------------------------------
# Local Ruflo contracts on OP
# ------------------------------------------------------------
PLUGIN_REGISTRY=0x367ec0c092d32f3883c4cacbfb6c9c3594062e90          # local PluginRegistry on OP
ROUTER_V1=0xe6ef55853f548b7edfa403056f91f85fd3b3f086                # local RouterV1 on OP
RECEIVER_V1=0x65642ac8fd57eff8dd4651cb76be48814c8bf386              # local ReceiverV1 on OP
RAIL_PLUGIN_LAYERZERO=0xdb403792c55bfe26beaef235986d4f106e40ee6f    # local LayerZeroRailPlugin on OP
LZ_ADAPTER=0x845cd50644a9592de43bcac0212656480744aaca               # local LayerZeroReceiverAdapter on OP

# Optional plugin registration vars
SWAP_PLUGIN_EMPSEAL=<OP_SWAP_PLUGIN_IF_NEEDED>                      # local swap plugin on OP
SWAP_PLUGIN_UNIV2=
SWAP_PLUGIN_UNIV3=

# ------------------------------------------------------------
# Receiver approved callers on OP
# ------------------------------------------------------------
RECEIVER_APPROVED_CALLER_1=0x845cd50644a9592de43bcac0212656480744aaca # local LayerZeroReceiverAdapter on OP
RECEIVER_APPROVED_CALLER_2=
RECEIVER_APPROVED_CALLER_3=
RECEIVER_APPROVED_CALLER_4=
RECEIVER_APPROVED_CALLER_5=

# ------------------------------------------------------------
# LayerZero source route config on OP for OP -> ARB
# These vars are written to the local OP LayerZeroRailPlugin.
# Remote fields below point to Arbitrum.
# ------------------------------------------------------------
LZ_SET_ROUTE=true
LZ_PLUGIN=0xdb403792c55bfe26beaef235986d4f106e40ee6f                # local LayerZeroRailPlugin on OP
LZ_ROUTE_CHAIN_ID=42161                                             # remote destination chain = Arbitrum
LZ_ROUTE_EID=30110                                                  # remote destination EID = Arbitrum
LZ_ROUTE_RECEIVER=0xcdbc01b0dddac2729263a7ff4318a1b17b2eedb3        # remote Arbitrum LayerZeroReceiverAdapter
LZ_ROUTE_OPTIONS=0x00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a80
LZ_ROUTE_FAMILY=lz_stargate_pool                                    # route family selected for this USDC path
LZ_ROUTE_TOKEN=0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85           # local source route token on OP = USDC
LZ_ROUTE_OFT=0xcE8CcA271Ebc0533920C83d39F417ED6A0abB7D0             # local OP LayerZero USDC asset contract

# ------------------------------------------------------------
# LayerZero destination trust on OP for inbound ARB -> OP
# These vars are written to the local OP LayerZeroReceiverAdapter.
# Here, Arbitrum is the remote source chain.
# ------------------------------------------------------------
LZ_ADAPTER_SET_TRUSTED_PEER=true
LZ_ADAPTER=0x845cd50644a9592de43bcac0212656480744aaca               # local LayerZeroReceiverAdapter on OP
LZ_SOURCE_EID=30110                                                 # remote source EID = Arbitrum
LZ_SOURCE_PEER_ADDRESS=0x8fb6314678a9287f9b47b96e54122444e43dde1f   # remote Arbitrum LayerZeroRailPlugin

# ------------------------------------------------------------
# LayerZero destination asset registry on OP for inbound ARB -> OP
# LZ_SETTLEMENT_TOKEN is the token that arrives locally on OP.
# LZ_COMPOSE_SENDER is the remote Arbitrum asset contract allowed to send it.
# ------------------------------------------------------------
LZ_ADAPTER_SET_ASSET=true
LZ_SETTLEMENT_TOKEN=0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85       # local OP USDC that ReceiverV1 will receive
LZ_COMPOSE_SENDER=0xe8CDF27AcD73a434D661C84887215F7598e7d0d3         # remote Arbitrum LayerZero USDC asset contract

# ------------------------------------------------------------
# LayerZero OFT/Stargate peer wiring on OP
# Keep this disabled for protocol-owned mainnet USDC asset contracts.
# Only enable it if Ruflo controls the local OFT and is authorized to call setPeer(...).
# ------------------------------------------------------------
LZ_OFT_SET_PEER=false
# LZ_OFT=0xcE8CcA271Ebc0533920C83d39F417ED6A0abB7D0                 # local OP LayerZero USDC asset contract
# LZ_OFT_PEER_EID=30110                                             # remote peer EID = Arbitrum
# LZ_OFT_PEER_ADDRESS=0xe8CDF27AcD73a434D661C84887215F7598e7d0d3     # remote Arbitrum LayerZero USDC asset contract
```

## Simple Meaning

- `LZ_SETTLEMENT_TOKEN`
  - local token on OP that lands before `ReceiverV1.execute()`
- `LZ_COMPOSE_SENDER`
  - remote Arbitrum LayerZero asset contract allowed to send that token into OP
- `LZ_SOURCE_PEER_ADDRESS`
  - remote Arbitrum Ruflo `LayerZeroRailPlugin`
- `LZ_OFT_PEER_ADDRESS`
  - remote Arbitrum LayerZero asset contract that the local OP asset contract trusts as peer

For VPS quotes and `/quote/select`, load this OP `CHAIN_10_*` block together with the matching Arbitrum `CHAIN_42161_*` block in the same runtime env.

CHAIN_10_RPC_URL=https://mainnet.optimism.io
CHAIN_10_RPC_FALLBACK=https://mainnet.optimism.io
CHAIN_10_ROUTER_V1=0xe6ef55853f548b7edfa403056f91f85fd3b3f086
CHAIN_10_RECEIVER_V1=0x65642ac8fd57eff8dd4651cb76be48814c8bf386
CHAIN_10_HAS_AGGREGATOR=true
CHAIN_10_SWAP_PLUGIN_KIND=EMPSEAL
CHAIN_10_TOKEN_CCTP_USDC=0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85
CHAIN_10_CCTP_DOMAIN=2
CHAIN_10_TOKEN_LAYERZERO_USDC=0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85
CHAIN_10_LZ_OFT_USDC=0xcE8CcA271Ebc0533920C83d39F417ED6A0abB7D0
CHAIN_10_LZ_DST_EID=30111
CHAIN_10_LZ_EXTRA_OPTIONS_USDC=0x00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a80
CHAIN_10_TOKEN_USDC=0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85
