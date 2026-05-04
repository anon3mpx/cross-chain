npm run sol:configure:all

> sol:configure:all
> set -a; [ -f .env ] && . ./.env; set +a; test -n "$RPC_URL" || (echo "RPC_URL is required (set env or .env)" && exit 1); forge script config/foundry/scripts/ConfigureAll.s.sol:ConfigureAll --config-path config/foundry.toml --rpc-url "$RPC_URL" --broadcast -vvv

[⠊] Compiling...
No files changed, compilation skipped
Traces:
  [3683961] → new ConfigureAll@0x9f7cF1d1F558E57ef88a59ac3D47214eF25B6A06
    └─ ← [Return] 18399 bytes of code

  [7972545] ConfigureAll::run()
    ├─ [0] VM::envUint("DEPLOYER_PRIVATE_KEY")
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::startBroadcast(<pk>)
    │   └─ ← [Return]
    ├─ [0] VM::envOr("PLUGIN_REGISTRY", 0x0000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("RAIL_PLUGIN_CCTP", 0x0000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [241] 0xae72a52f4A6B36d65cC971dF9FdEFfa07ab5Db5E::railId() [staticcall]
    │   └─ ← [Return] 0xb148ea5f936a28661e11743b1650193f1b14a2322b9541503bf6815a84a1a6e9
    ├─ [4884] 0x84c05502EE5EE8cb2ef43273F300439caD0c4020::plugins(0xb148ea5f936a28661e11743b1650193f1b14a2322b9541503bf6815a84a1a6e9) [staticcall]
    │   └─ ← [Return] 0xae72a52f4A6B36d65cC971dF9FdEFfa07ab5Db5E, 0, true, 1776703332 [1.776e9]
    ├─ [0] VM::envOr("RAIL_PLUGIN_CCTP_FAST", 0x0000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("RAIL_PLUGIN_AXELAR", 0x0000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [262] 0xd00e7ce0ac312138dE62610eD950E814e12d3F89::railId() [staticcall]
    │   └─ ← [Return] 0xdee0b34b74b60e53553685c32477090103c2b806eb925a8cd000efa92bef3e8b
    ├─ [4884] 0x84c05502EE5EE8cb2ef43273F300439caD0c4020::plugins(0xdee0b34b74b60e53553685c32477090103c2b806eb925a8cd000efa92bef3e8b) [staticcall]
    │   └─ ← [Return] 0xd00e7ce0ac312138dE62610eD950E814e12d3F89, 0, true, 1776703332 [1.776e9]
    ├─ [0] VM::envOr("RAIL_PLUGIN_LAYERZERO", 0x0000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [262] 0x05C5a9DfF519Bbb26E206d02e90aA9ca5105a327::railId() [staticcall]
    │   └─ ← [Return] 0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc
    ├─ [4884] 0x84c05502EE5EE8cb2ef43273F300439caD0c4020::plugins(0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc) [staticcall]
    │   └─ ← [Return] 0x05C5a9DfF519Bbb26E206d02e90aA9ca5105a327, 0, true, 1776703332 [1.776e9]
    ├─ [0] VM::envOr("RAIL_PLUGIN_THORCHAIN", 0x0000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("SWAP_PLUGIN_EMPSEAL", 0x0000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("SWAP_PLUGIN_UNIV2", 0x0000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("SWAP_PLUGIN_UNIV3", 0x0000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("RECEIVER_V1", 0x0000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("RECEIVER_APPROVED_CALLER_1", 0x0000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [24771] 0xB006c9609b8FE8d52d2a16B4463446eDa853264b::addApprovedCaller(0x5fd1F6DB09C8d64f2230415d8F0f9E87f5462fa3)
    │   └─ ← [Stop]
    ├─ emit ScriptLogAddress(label: 0x7f3dff72bd0f6a586b34c6ea273e3a9503ff198b3e5f936a571a6402a956b88a, value: 0x5fd1F6DB09C8d64f2230415d8F0f9E87f5462fa3)
    ├─ [0] VM::envOr("RECEIVER_APPROVED_CALLER_2", 0x0000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [22771] 0xB006c9609b8FE8d52d2a16B4463446eDa853264b::addApprovedCaller(0x4e5d1Ff12514cC396aA37757878A02433887EDe0)
    │   └─ ← [Stop]
    ├─ emit ScriptLogAddress(label: 0x7f3dff72bd0f6a586b34c6ea273e3a9503ff198b3e5f936a571a6402a956b88a, value: 0x4e5d1Ff12514cC396aA37757878A02433887EDe0)
    ├─ [0] VM::envOr("RECEIVER_APPROVED_CALLER_3", 0x0000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("RECEIVER_APPROVED_CALLER_4", 0x0000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("RECEIVER_APPROVED_CALLER_5", 0x0000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envAddress("ROUTER_V1")
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("ROUTER_SET_FEE_RECIPIENT", false)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("ROUTER_SET_INTENT_SIGNER", false)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("PAYMASTER", 0x0000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("CCTP_SET_ROUTE", false)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envAddress("CCTP_PLUGIN")
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envUint("CCTP_ROUTE_CHAIN_ID")
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envUint("CCTP_ROUTE_DOMAIN")
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envAddress("CCTP_ROUTE_RECEIVER")
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("CCTP_ROUTE_CALLER", 0x0000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [4922] 0xae72a52f4A6B36d65cC971dF9FdEFfa07ab5Db5E::setChainDomain(11155420 [1.115e7], 2)
    │   └─ ← [Stop]
    ├─ [2846] 0xae72a52f4A6B36d65cC971dF9FdEFfa07ab5Db5E::setDestinationReceiver(11155420 [1.115e7], 0x000000000000000000000000bc4cbd47e7bf5eec5ede5f3a805c8dcc20d843a0)
    │   └─ ← [Stop]
    ├─ [2780] 0xae72a52f4A6B36d65cC971dF9FdEFfa07ab5Db5E::setDestinationCaller(11155420 [1.115e7], 0x00000000000000000000000005f8cc8753d90d67dbb8c02118440b8283f941c9)
    │   └─ ← [Stop]
    ├─ [0] VM::envOr("CCTP_FAST_SET_ROUTE", false)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("AXELAR_SET_ROUTE", false)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envAddress("AXELAR_PLUGIN")
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envUint("AXELAR_ROUTE_CHAIN_ID")
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envString("AXELAR_ROUTE_NAME")
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envAddress("AXELAR_ROUTE_RECEIVER")
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("AXELAR_ROUTE_TOKEN_ID", 0x0000000000000000000000000000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [10074] 0xd00e7ce0ac312138dE62610eD950E814e12d3F89::setRouteConfig(11155420 [1.115e7], "optimism-sepolia", 0xd8016e376e15b20Fc321a37fD69DC42cfDf951Bb, 0x4d2fdc120be87ecf5661b7a75144d5d4b507b525eeb8c9c85c346a255e3b9663)
    │   └─ ← [Stop]
    ├─ [0] VM::envOr("LZ_SET_ROUTE", false)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envAddress("LZ_PLUGIN")
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envUint("LZ_ROUTE_CHAIN_ID")
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envUint("LZ_ROUTE_EID")
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envAddress("LZ_ROUTE_RECEIVER")
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("LZ_ROUTE_OPTIONS", 0x)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("LZ_ROUTE_FAMILY", "lz_oft")
    │   └─ ← [Return] <env var value>
    ├─ [14861] 0x05C5a9DfF519Bbb26E206d02e90aA9ca5105a327::setRouteConfig(11155420 [1.115e7], 40232 [4.023e4], 0x96e67D7295A0Bca3E57c7DE9a1A9bF28fd56FFDc, 0x00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a80)
    │   └─ ← [Stop]
    ├─ [0] VM::envOr("THOR_PLUGIN", 0x0000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("AXELAR_ADAPTER_SET_TRUSTED_SOURCE", false)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envAddress("AXELAR_ADAPTER")
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envString("AXELAR_SOURCE_CHAIN")
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("AXELAR_SOURCE_TRUSTED", true)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("AXELAR_SOURCE_ADDRESS_BYTES", 0x)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envAddress("AXELAR_SOURCE_ADDRESS")
    │   └─ ← [Return] <env var value>
    ├─ [9327] 0x5fd1F6DB09C8d64f2230415d8F0f9E87f5462fa3::setTrustedSourceAddress("optimism-sepolia", 0xA73776c0aAE79382d8003B1fC7648B5ab32889D0, true)
    │   ├─ emit TrustedSourceSet(sourceChain: "optimism-sepolia", sourceAddress: 0xa73776c0aae79382d8003b1fc7648b5ab32889d0, trusted: true)
    │   └─ ← [Stop]
    ├─ [0] VM::envOr("AXELAR_TRUSTED_TOKEN_ID", 0x0000000000000000000000000000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("AXELAR_TRUSTED_TOKEN", 0x0000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [4856] 0x5fd1F6DB09C8d64f2230415d8F0f9E87f5462fa3::setTrustedToken(0x4d2fdc120be87ecf5661b7a75144d5d4b507b525eeb8c9c85c346a255e3b9663, 0x2f2A9DbFd8c503a0aC56413B774e39030df85331, true)
    │   ├─ emit TrustedTokenSet(tokenId: 0x4d2fdc120be87ecf5661b7a75144d5d4b507b525eeb8c9c85c346a255e3b9663, token: 0x2f2A9DbFd8c503a0aC56413B774e39030df85331, trusted: true)
    │   └─ ← [Stop]
    ├─ [0] VM::envOr("LZ_ADAPTER_SET_TRUSTED_PEER", false)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("LZ_ADAPTER_SET_ASSET", false)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envAddress("LZ_ADAPTER")
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envUint("LZ_SOURCE_EID")
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("LZ_SOURCE_PEER_ADDRESS", 0x0000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [6422] 0x4e5d1Ff12514cC396aA37757878A02433887EDe0::setTrustedPeerAddress(40232 [4.023e4], 0x55cC592be7E49c4020e67a895FEe9474C7D71dbc)
    │   ├─ emit TrustedPeerSet(srcEid: 40232 [4.023e4], peer: 0x00000000000000000000000055cc592be7e49c4020e67a895fee9474c7d71dbc)
    │   └─ ← [Stop]
    ├─ [0] VM::envUint("LZ_SOURCE_EID")
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envAddress("LZ_SETTLEMENT_TOKEN")
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envAddress("LZ_COMPOSE_SENDER")
    │   └─ ← [Return] <env var value>
    ├─ [190] 0x4e5d1Ff12514cC396aA37757878A02433887EDe0::setSettlementToken(0xd8364a952b144064fb3e5685a24c59ac2c26938583da19c951e02bcc2a42f1e7, 0x1500116D88B6583E63E2Fa9D4199f2edDf72149b)
    │   └─ ← [Revert] EvmError: Revert
    └─ ← [Revert] EvmError: Revert


Error: script failed: <empty revert data>