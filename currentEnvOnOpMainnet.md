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
RAIL_PLUGIN_CCTP=0x1b7eb489eb0ae102720442fe15b0e08653a13404
RAIL_PLUGIN_CCTP_FAST=0x050c6c2555c2d54aba01420fbc02ff0f1d10e8df
EMPSEAL_ROUTER=0x686c652d079A370eC97F93B2b4805Ee06aE25d04
# Optional plugin registration vars
SWAP_PLUGIN_EMPSEAL=0x1cb21a8a39e760e97c587b323d891927f3d006e9                      # local swap plugin on OP
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

## Additional Peer Config: OP <-> Base

Leave the `OP <-> Arbitrum` section above unchanged.
Use this additional section when you are configuring `OP -> Base` routes or `Base -> OP` trust on the local OP contracts.

Important:

- These route keys reuse the same `CCTP_*`, `CCTP_FAST_*`, and `LZ_*` env names as the section above.
- Configure `OP -> Arbitrum` and `OP -> Base` in separate runs of `npm run sol:configure:all`.
- Do not try to enable both peer sections in one env export at the same time.

### Peer Summary

- Local chain: `Optimism` (`10`)
- Remote peer: `Base` (`8453`)
- Local `CCTPRailPlugin`: `0x1b7eb489eb0ae102720442fe15b0e08653a13404`
- Local `CCTPFastRailPlugin`: `0x050c6c2555c2d54aba01420fbc02ff0f1d10e8df`
- Local `LayerZeroRailPlugin`: `0xdb403792c55bfe26beaef235986d4f106e40ee6f`
- Local `LayerZeroReceiverAdapter`: `0x845cd50644a9592de43bcac0212656480744aaca`
- Remote `ReceiverV1` on Base: `0x3aef79e7455843a33e4c46d5cf283a809bf50970`
- Remote `LayerZeroRailPlugin` on Base: `0x347a213c8f511c7da06c3f0484b74309ba34f882`
- Remote `LayerZeroReceiverAdapter` on Base: `0x6f7cd979bcbd03c2fd593c5beec3b2628514392b`

### OP <-> Base Route Vars

```bash
# ------------------------------------------------------------
# CCTP standard source route config on OP for OP -> BASE
# These vars are written to the local OP CCTPRailPlugin.
# Remote fields below point to Base.
# ------------------------------------------------------------
CCTP_SET_ROUTE=true
CCTP_PLUGIN=0x1b7eb489eb0ae102720442fe15b0e08653a13404
CCTP_ROUTE_CHAIN_ID=8453
CCTP_ROUTE_DOMAIN=6
CCTP_ROUTE_RECEIVER=0x3aef79e7455843a33e4c46d5cf283a809bf50970      # remote Base ReceiverV1
CCTP_ROUTE_CALLER=0x05F8cC8753D90d67DBB8c02118440b8283F941c9         # destination caller on Base

# ------------------------------------------------------------
# CCTP fast source route config on OP for OP -> BASE
# These vars are written to the local OP CCTPFastRailPlugin.
# Remote fields below point to Base.
# ------------------------------------------------------------
CCTP_FAST_SET_ROUTE=true
CCTP_FAST_PLUGIN=0x050c6c2555c2d54aba01420fbc02ff0f1d10e8df
CCTP_FAST_ROUTE_CHAIN_ID=8453
CCTP_FAST_ROUTE_DOMAIN=6
CCTP_FAST_ROUTE_RECEIVER=0x3aef79e7455843a33e4c46d5cf283a809bf50970 # remote Base ReceiverV1
CCTP_FAST_ROUTE_CALLER=0x05F8cC8753D90d67DBB8c02118440b8283F941c9    # destination caller on Base
CCTP_FAST_MAX_FEE_BPS_CAP=100

# ------------------------------------------------------------
# LayerZero source route config on OP for OP -> BASE
# These vars are written to the local OP LayerZeroRailPlugin.
# Remote fields below point to Base.
# ------------------------------------------------------------
LZ_SET_ROUTE=true
LZ_PLUGIN=0xdb403792c55bfe26beaef235986d4f106e40ee6f                # local LayerZeroRailPlugin on OP
LZ_ROUTE_CHAIN_ID=8453                                              # remote destination chain = Base
LZ_ROUTE_EID=30184                                                  # remote destination EID = Base
LZ_ROUTE_RECEIVER=0x6f7cd979bcbd03c2fd593c5beec3b2628514392b        # remote Base LayerZeroReceiverAdapter
LZ_ROUTE_OPTIONS=0x00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a80
LZ_ROUTE_FAMILY=lz_stargate_pool                                    # route family selected for this USDC path
LZ_ROUTE_TOKEN=0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85           # local source route token on OP = USDC
LZ_ROUTE_OFT=0xcE8CcA271Ebc0533920C83d39F417ED6A0abB7D0             # local OP LayerZero USDC asset contract

# ------------------------------------------------------------
# LayerZero destination trust on OP for inbound BASE -> OP
# These vars are written to the local OP LayerZeroReceiverAdapter.
# Here, Base is the remote source chain.
# ------------------------------------------------------------
LZ_ADAPTER_SET_TRUSTED_PEER=true
LZ_ADAPTER=0x845cd50644a9592de43bcac0212656480744aaca               # local LayerZeroReceiverAdapter on OP
LZ_SOURCE_EID=30184                                                 # remote source EID = Base
LZ_SOURCE_PEER_ADDRESS=0x347a213c8f511c7da06c3f0484b74309ba34f882   # remote Base LayerZeroRailPlugin

# ------------------------------------------------------------
# LayerZero destination asset registry on OP for inbound BASE -> OP
# LZ_SETTLEMENT_TOKEN is the token that arrives locally on OP.
# LZ_COMPOSE_SENDER is the remote Base asset contract allowed to send it.
# ------------------------------------------------------------
LZ_ADAPTER_SET_ASSET=true
LZ_SETTLEMENT_TOKEN=0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85       # local OP USDC that ReceiverV1 will receive
LZ_COMPOSE_SENDER=0x27a16dc786820B16E5c9028b75B99F6f604b5d26         # remote Base LayerZero USDC asset contract
```
