# Current Env On Base Mainnet

This file is for the case where:

- `Base` is the local chain you are configuring
- `OP` and `Arbitrum` are peer remote chains

Use this as a reference sheet, not as a guaranteed final `.env`.
The LayerZero asset values here are specifically for the `USDC` route.
Each peer section below is a separate configure run that reuses the same `CCTP_*`, `CCTP_FAST_*`, and `LZ_*` env names.
Every address below is labeled as either `local Base` or a remote peer.

Important for this mainnet setup:

- `CCTP_SET_ROUTE`, `CCTP_FAST_SET_ROUTE`, `LZ_SET_ROUTE`, `LZ_ADAPTER_SET_TRUSTED_PEER`, and `LZ_ADAPTER_SET_ASSET` should be enabled when configuring the Base side.
- `LZ_OFT_SET_PEER` should stay disabled for protocol-owned Stargate/LayerZero USDC asset contracts unless you control that OFT contract and can call `setPeer(...)` on it.

## Local and Remote Contracts

- Local chain: `Base` (`8453`)
- Remote chain: `Optimism` (`10`)
- Local `CCTPRailPlugin`: `0xe1b589fcd71541099dd861a68a104f31e5ffebed`
- Local `CCTPFastRailPlugin`: `0xf788dc2af6a35339028df57d92a3d6221547d991`
- Local `LayerZeroRailPlugin`: `0x347a213c8f511c7da06c3f0484b74309ba34f882`
- Local `LayerZeroReceiverAdapter`: `0x6f7cd979bcbd03c2fd593c5beec3b2628514392b`
- Local `ReceiverV1`: `0x3aef79e7455843a33e4c46d5cf283a809bf50970`
- Remote `LayerZeroRailPlugin` on OP: `0xdb403792c55bfe26beaef235986d4f106e40ee6f`
- Remote `LayerZeroReceiverAdapter` on OP: `0x845cd50644a9592de43bcac0212656480744aaca`
- Remote `ReceiverV1` on OP: `0x65642ac8fd57eff8dd4651cb76be48814c8bf386`

## CCTP Mainnet Constants

- Base domain: `6`
- OP domain: `2`
- Arbitrum domain: `3`
- TokenMessengerV2 on both chains: `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d`
- MessageTransmitterV2 on both chains: `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64`

## LayerZero Mainnet Constants

- Base EID: `30184`
- OP EID: `30111`
- Arbitrum EID: `30110`
- LayerZero Endpoint V2 on both chains: `0x1a44076050125825900e736c501f859c50fE728c`

## Base Mainnet Variables

```bash
# ------------------------------------------------------------
# Local Base mainnet chain context
# ------------------------------------------------------------
RPC_URL=https://base.api.pocket.network
DEPLOYER_PRIVATE_KEY=
OWNER=0x05F8cC8753D90d67DBB8c02118440b8283F941c9
FEE_RECIPIENT=0x05F8cC8753D90d67DBB8c02118440b8283F941c9

WETH=0x4200000000000000000000000000000000000006                     # local Base WETH
CCTP_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913                # local Base USDC for CCTP
LAYERZERO_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913           # local Base USDC (settlement token)
TOKEN_MESSENGER=0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d          # local CCTP TokenMessengerV2 on Base
CCTP_MESSAGE_TRANSMITTER=0x81D40F21F12A8F0E3252Bccb954D722d4c464B64 # local CCTP MessageTransmitterV2 on Base
LZ_ENDPOINT=0x1a44076050125825900e736c501f859c50fE728c              # local LayerZero endpoint on Base
LZ_OFT=0x27a16dc786820B16E5c9028b75B99F6f604b5d26                   # local Base LayerZero USDC asset contract
EMPSEAL_ROUTER=0xB12b7C117434B58B7623f994F4D0b4af7BC0Ac37

# ------------------------------------------------------------
# Local Ruflo contracts on Base
# ------------------------------------------------------------
PLUGIN_REGISTRY=0x39c586ec7f4df4a3b5cb5603e6ac6a6f4b950a49          # local PluginRegistry on Base
ROUTER_V1=0x10c9db3761056d752bc41ac817f730f9e4348bb0                # local RouterV1 on Base
RECEIVER_V1=0x3aef79e7455843a33e4c46d5cf283a809bf50970              # local ReceiverV1 on Base
RAIL_PLUGIN_CCTP=0xe1b589fcd71541099dd861a68a104f31e5ffebed         # local CCTPRailPlugin on Base
RAIL_PLUGIN_CCTP_FAST=0xf788dc2af6a35339028df57d92a3d6221547d991    # local CCTPFastRailPlugin on Base
RAIL_PLUGIN_LAYERZERO=0x347a213c8f511c7da06c3f0484b74309ba34f882    # local LayerZeroRailPlugin on Base
LZ_ADAPTER=0x6f7cd979bcbd03c2fd593c5beec3b2628514392b               # local LayerZeroReceiverAdapter on Base

# Optional plugin registration vars
SWAP_PLUGIN_EMPSEAL=0xb4d497e97ff3966c9c6c6dcd78bdb7e4f3cd940a      # local swap plugin on Base
SWAP_PLUGIN_UNIV2=
SWAP_PLUGIN_UNIV3=

# ------------------------------------------------------------
# Receiver approved callers on Base
# ------------------------------------------------------------
RECEIVER_APPROVED_CALLER_1=0x6f7cd979bcbd03c2fd593c5beec3b2628514392b # local LayerZeroReceiverAdapter on Base
RECEIVER_APPROVED_CALLER_2=
RECEIVER_APPROVED_CALLER_3=
RECEIVER_APPROVED_CALLER_4=
RECEIVER_APPROVED_CALLER_5=

# ------------------------------------------------------------
# CCTP standard source route config on Base for BASE -> OP
# These vars are written to the local Base CCTPRailPlugin.
# Remote fields below point to OP.
# ------------------------------------------------------------
CCTP_SET_ROUTE=true
CCTP_PLUGIN=0xe1b589fcd71541099dd861a68a104f31e5ffebed
CCTP_ROUTE_CHAIN_ID=10
CCTP_ROUTE_DOMAIN=2
CCTP_ROUTE_RECEIVER=0x65642ac8fd57eff8dd4651cb76be48814c8bf386      # remote OP ReceiverV1
CCTP_ROUTE_CALLER=0x05F8cC8753D90d67DBB8c02118440b8283F941c9         # destination caller on OP

# ------------------------------------------------------------
# CCTP fast source route config on Base for BASE -> OP
# These vars are written to the local Base CCTPFastRailPlugin.
# Remote fields below point to OP.
# ------------------------------------------------------------
CCTP_FAST_SET_ROUTE=true
CCTP_FAST_PLUGIN=0xf788dc2af6a35339028df57d92a3d6221547d991
CCTP_FAST_ROUTE_CHAIN_ID=10
CCTP_FAST_ROUTE_DOMAIN=2
CCTP_FAST_ROUTE_RECEIVER=0x65642ac8fd57eff8dd4651cb76be48814c8bf386 # remote OP ReceiverV1
CCTP_FAST_ROUTE_CALLER=0x05F8cC8753D90d67DBB8c02118440b8283F941c9    # destination caller on OP
CCTP_FAST_MAX_FEE_BPS_CAP=100

# ------------------------------------------------------------
# LayerZero source route config on Base for BASE -> OP
# These vars are written to the local Base LayerZeroRailPlugin.
# Remote fields below point to OP.
# ------------------------------------------------------------
LZ_SET_ROUTE=true
LZ_PLUGIN=0x347a213c8f511c7da06c3f0484b74309ba34f882                # local LayerZeroRailPlugin on Base
LZ_ROUTE_CHAIN_ID=10                                                # remote destination chain = OP
LZ_ROUTE_EID=30111                                                  # remote destination EID = OP
LZ_ROUTE_RECEIVER=0x845cd50644a9592de43bcac0212656480744aaca        # remote OP LayerZeroReceiverAdapter
LZ_ROUTE_OPTIONS=0x00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a80
LZ_ROUTE_FAMILY=lz_stargate_pool                                    # route family selected for this USDC path
LZ_ROUTE_TOKEN=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913           # local source route token on Base = USDC
LZ_ROUTE_OFT=0x27a16dc786820B16E5c9028b75B99F6f604b5d26             # local Base LayerZero USDC asset contract

# ------------------------------------------------------------
# LayerZero destination trust on Base for inbound OP -> BASE
# These vars are written to the local Base LayerZeroReceiverAdapter.
# Here, OP is the remote source chain.
# ------------------------------------------------------------
LZ_ADAPTER_SET_TRUSTED_PEER=true
LZ_ADAPTER=0x6f7cd979bcbd03c2fd593c5beec3b2628514392b               # local LayerZeroReceiverAdapter on Base
LZ_SOURCE_EID=30111                                                 # remote source EID = OP
LZ_SOURCE_PEER_ADDRESS=0xdb403792c55bfe26beaef235986d4f106e40ee6f   # remote OP LayerZeroRailPlugin

# ------------------------------------------------------------
# LayerZero destination asset registry on Base for inbound OP -> BASE
# LZ_SETTLEMENT_TOKEN is the token that arrives locally on Base.
# LZ_COMPOSE_SENDER is the remote OP asset contract allowed to send it.
# ------------------------------------------------------------
LZ_ADAPTER_SET_ASSET=true
LZ_SETTLEMENT_TOKEN=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913       # local Base USDC that ReceiverV1 will receive
LZ_COMPOSE_SENDER=0xcE8CcA271Ebc0533920C83d39F417ED6A0abB7D0         # remote OP LayerZero USDC asset contract

# ------------------------------------------------------------
# LayerZero OFT/Stargate peer wiring on Base
# Keep this disabled for protocol-owned mainnet USDC asset contracts.
# Only enable it if Ruflo controls the local OFT and is authorized to call setPeer(...).
# ------------------------------------------------------------
LZ_OFT_SET_PEER=false
# LZ_OFT=0x27a16dc786820B16E5c9028b75B99F6f604b5d26                 # local Base LayerZero USDC asset contract
# LZ_OFT_PEER_EID=30111                                             # remote peer EID = OP
# LZ_OFT_PEER_ADDRESS=0xcE8CcA271Ebc0533920C83d39F417ED6A0abB7D0     # remote OP LayerZero USDC asset contract
```

## Simple Meaning

- `CCTP_ROUTE_RECEIVER`
  - remote OP `ReceiverV1` that receives and executes the CCTP settlement
- `CCTP_ROUTE_CALLER`
  - destination OP EOA allowed to call Circle receive flow into that receiver
- `LZ_SETTLEMENT_TOKEN`
  - local token on Base that lands before `ReceiverV1.execute()`
- `LZ_COMPOSE_SENDER`
  - remote OP LayerZero asset contract allowed to send that token into Base
- `LZ_SOURCE_PEER_ADDRESS`
  - remote OP Ruflo `LayerZeroRailPlugin`
- `LZ_OFT_PEER_ADDRESS`
  - remote OP LayerZero asset contract that the local Base asset contract trusts as peer

For VPS quotes and `/quote/select`, load this Base `CHAIN_8453_*` block together with the matching OP `CHAIN_10_*` block in the same runtime env.

```bash
CHAIN_8453_RPC_URL=https://base.api.pocket.network
CHAIN_8453_RPC_FALLBACK=https://base.api.pocket.network
CHAIN_8453_ROUTER_V1=0x10c9db3761056d752bc41ac817f730f9e4348bb0
CHAIN_8453_RECEIVER_V1=0x3aef79e7455843a33e4c46d5cf283a809bf50970
CHAIN_8453_HAS_AGGREGATOR=true
CHAIN_8453_SWAP_PLUGIN_KIND=EMPSEAL
CHAIN_8453_TOKEN_CCTP_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
CHAIN_8453_CCTP_DOMAIN=6
CHAIN_8453_TOKEN_MESSENGER=0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d
CHAIN_8453_CCTP_MESSAGE_TRANSMITTER=0x81D40F21F12A8F0E3252Bccb954D722d4c464B64
CHAIN_8453_TOKEN_LAYERZERO_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
CHAIN_8453_LZ_OFT_USDC=0x27a16dc786820B16E5c9028b75B99F6f604b5d26
CHAIN_8453_LZ_DST_EID=30184
CHAIN_8453_LZ_EXTRA_OPTIONS_USDC=0x00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a80
CHAIN_8453_TOKEN_USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
CHAIN_8453_EMPSEAL_ROUTER=0xB12b7C117434B58B7623f994F4D0b4af7BC0Ac37
```

## Additional Peer Config: Base <-> Arbitrum

Leave the `Base <-> OP` section above as one peer configuration.
Use this additional section when you are configuring `Base -> Arbitrum` routes or `Arbitrum -> Base` trust on the local Base contracts.

Important:

- These route keys reuse the same `CCTP_*`, `CCTP_FAST_*`, and `LZ_*` env names as the `Base <-> OP` section above.
- Configure `Base -> OP` and `Base -> Arbitrum` in separate runs of `npm run sol:configure:all`.
- Do not try to enable both peer sections in one env export at the same time.

### Peer Summary

- Local chain: `Base` (`8453`)
- Remote peer: `Arbitrum` (`42161`)
- Local `CCTPRailPlugin`: `0xe1b589fcd71541099dd861a68a104f31e5ffebed`
- Local `CCTPFastRailPlugin`: `0xf788dc2af6a35339028df57d92a3d6221547d991`
- Local `LayerZeroRailPlugin`: `0x347a213c8f511c7da06c3f0484b74309ba34f882`
- Local `LayerZeroReceiverAdapter`: `0x6f7cd979bcbd03c2fd593c5beec3b2628514392b`
- Remote `ReceiverV1` on Arbitrum: `0xa10914363664e46154328e6e787961641ea6e3de`
- Remote `LayerZeroRailPlugin` on Arbitrum: `0x8fb6314678a9287f9b47b96e54122444e43dde1f`
- Remote `LayerZeroReceiverAdapter` on Arbitrum: `0xcdbc01b0dddac2729263a7ff4318a1b17b2eedb3`

### Base <-> Arbitrum Route Vars

```bash
# ------------------------------------------------------------
# CCTP standard source route config on Base for BASE -> ARB
# These vars are written to the local Base CCTPRailPlugin.
# Remote fields below point to Arbitrum.
# ------------------------------------------------------------
CCTP_SET_ROUTE=true
CCTP_PLUGIN=0xe1b589fcd71541099dd861a68a104f31e5ffebed
CCTP_ROUTE_CHAIN_ID=42161
CCTP_ROUTE_DOMAIN=3
CCTP_ROUTE_RECEIVER=0xa10914363664e46154328e6e787961641ea6e3de      # remote Arbitrum ReceiverV1
CCTP_ROUTE_CALLER=0x05F8cC8753D90d67DBB8c02118440b8283F941c9         # destination caller on Arbitrum

# ------------------------------------------------------------
# CCTP fast source route config on Base for BASE -> ARB
# These vars are written to the local Base CCTPFastRailPlugin.
# Remote fields below point to Arbitrum.
# ------------------------------------------------------------
CCTP_FAST_SET_ROUTE=true
CCTP_FAST_PLUGIN=0xf788dc2af6a35339028df57d92a3d6221547d991
CCTP_FAST_ROUTE_CHAIN_ID=42161
CCTP_FAST_ROUTE_DOMAIN=3
CCTP_FAST_ROUTE_RECEIVER=0xa10914363664e46154328e6e787961641ea6e3de # remote Arbitrum ReceiverV1
CCTP_FAST_ROUTE_CALLER=0x05F8cC8753D90d67DBB8c02118440b8283F941c9    # destination caller on Arbitrum
CCTP_FAST_MAX_FEE_BPS_CAP=100

# ------------------------------------------------------------
# LayerZero source route config on Base for BASE -> ARB
# These vars are written to the local Base LayerZeroRailPlugin.
# Remote fields below point to Arbitrum.
# ------------------------------------------------------------
LZ_SET_ROUTE=true
LZ_PLUGIN=0x347a213c8f511c7da06c3f0484b74309ba34f882                # local LayerZeroRailPlugin on Base
LZ_ROUTE_CHAIN_ID=42161                                             # remote destination chain = Arbitrum
LZ_ROUTE_EID=30110                                                  # remote destination EID = Arbitrum
LZ_ROUTE_RECEIVER=0xcdbc01b0dddac2729263a7ff4318a1b17b2eedb3        # remote Arbitrum LayerZeroReceiverAdapter
LZ_ROUTE_OPTIONS=0x00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a80
LZ_ROUTE_FAMILY=lz_stargate_pool                                    # route family selected for this USDC path
LZ_ROUTE_TOKEN=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913           # local source route token on Base = USDC
LZ_ROUTE_OFT=0x27a16dc786820B16E5c9028b75B99F6f604b5d26             # local Base LayerZero USDC asset contract

# ------------------------------------------------------------
# LayerZero destination trust on Base for inbound ARB -> BASE
# These vars are written to the local Base LayerZeroReceiverAdapter.
# Here, Arbitrum is the remote source chain.
# ------------------------------------------------------------
LZ_ADAPTER_SET_TRUSTED_PEER=true
LZ_ADAPTER=0x6f7cd979bcbd03c2fd593c5beec3b2628514392b               # local LayerZeroReceiverAdapter on Base
LZ_SOURCE_EID=30110                                                 # remote source EID = Arbitrum
LZ_SOURCE_PEER_ADDRESS=0x8fb6314678a9287f9b47b96e54122444e43dde1f   # remote Arbitrum LayerZeroRailPlugin

# ------------------------------------------------------------
# LayerZero destination asset registry on Base for inbound ARB -> BASE
# LZ_SETTLEMENT_TOKEN is the token that arrives locally on Base.
# LZ_COMPOSE_SENDER is the remote Arbitrum asset contract allowed to send it.
# ------------------------------------------------------------
LZ_ADAPTER_SET_ASSET=true
LZ_SETTLEMENT_TOKEN=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913       # local Base USDC that ReceiverV1 will receive
LZ_COMPOSE_SENDER=0xe8CDF27AcD73a434D661C84887215F7598e7d0d3         # remote Arbitrum LayerZero USDC asset contract
```
