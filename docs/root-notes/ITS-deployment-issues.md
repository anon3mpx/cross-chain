npm run sol:deploy:its

> sol:deploy:its
> set -a; [ -f .env ] && . ./.env; set +a; test -n "$RPC_URL" || (echo "RPC_URL is required (set env or .env)" && exit 1); forge script config/foundry/scripts/DeployITS.s.sol:DeployITS --config-path config/foundry.toml --rpc-url "$RPC_URL" --broadcast -vvv

[⠊] Compiling...
No files changed, compilation skipped
Traces:
  [2065392] → new DeployITS@0x9f7cF1d1F558E57ef88a59ac3D47214eF25B6A06
    └─ ← [Return] 10316 bytes of code

  [102672] DeployITS::run()
    ├─ [0] VM::envUint("DEPLOYER_PRIVATE_KEY")
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("ITS_ACTION", "")
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("ITS_ACTION_84532", "DEPLOY_REMOTE_INTERCHAIN_TOKEN")
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("ITS_FACTORY", 0x0000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("ITS_FACTORY_84532", 0x83a93500d23Fbc3e82B410aD07A6a9F7A0670D66)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("AXELAR_ITS", 0x0000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("AXELAR_ITS_84532", 0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("ITS_CALL_VALUE", 0)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("ITS_CALL_VALUE_84532", 7000000000000000 [7e15])
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::startBroadcast(<pk>)
    │   └─ ← [Return]
    ├─ [0] VM::envOr("ITS_SALT", 0x0000000000000000000000000000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("ITS_SALT_84532", 0xc8b381b55deda609bc41d9b3157b5f2952f87c9304179cd5e3960537e74d46c6)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("ITS_DESTINATION_CHAIN", "")
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("ITS_DESTINATION_CHAIN_84532", "optimism-sepolia")
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("ITS_GAS_VALUE", 0)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("ITS_GAS_VALUE_84532", 7000000000000000 [7e15])
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("ITS_MINTER", 0x0000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("ITS_MINTER_84532", 0x05F8cC8753D90d67DBB8c02118440b8283F941c9)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("ITS_DESTINATION_MINTER_BYTES", 0x)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("ITS_DESTINATION_MINTER_BYTES_84532", 0x)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("ITS_DESTINATION_MINTER", 0x0000000000000000000000000000000000000000)
    │   └─ ← [Return] <env var value>
    ├─ [0] VM::envOr("ITS_DESTINATION_MINTER_84532", 0x05F8cC8753D90d67DBB8c02118440b8283F941c9)
    │   └─ ← [Return] <env var value>
    ├─ [32086] 0x83a93500d23Fbc3e82B410aD07A6a9F7A0670D66::deployRemoteInterchainTokenWithMinter{value: 7000000000000000}(0xc8b381b55deda609bc41d9b3157b5f2952f87c9304179cd5e3960537e74d46c6, 0x05F8cC8753D90d67DBB8c02118440b8283F941c9, "optimism-sepolia", 0x05f8cc8753d90d67dbb8c02118440b8283f941c9, 7000000000000000 [7e15])
    │   ├─ [27133] 0xe833E9662cb0A811AA3b1746280AB43507B61946::deployRemoteInterchainTokenWithMinter{value: 7000000000000000}(0xc8b381b55deda609bc41d9b3157b5f2952f87c9304179cd5e3960537e74d46c6, 0x05F8cC8753D90d67DBB8c02118440b8283F941c9, "optimism-sepolia", 0x05f8cc8753d90d67dbb8c02118440b8283f941c9, 7000000000000000 [7e15]) [delegatecall]
    │   │   ├─ [5606] 0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C::interchainTokenId(0x0000000000000000000000000000000000000000, 0x6d2f2af5f322779c68c7398953aaf2acf7cb29aa8d2a22e5607fd288ee0be5df) [staticcall]
    │   │   │   ├─ [696] 0x1B13a9BaF8d3116C56CCDF3aa9049ad532a9C03d::interchainTokenId(0x0000000000000000000000000000000000000000, 0x6d2f2af5f322779c68c7398953aaf2acf7cb29aa8d2a22e5607fd288ee0be5df) [delegatecall]
    │   │   │   │   └─ ← [Return] 0x93e0937af3b1c3b2fe6a6d0c62347af46eb037c8d01e751766527c8007fd6870
    │   │   │   └─ ← [Return] 0x93e0937af3b1c3b2fe6a6d0c62347af46eb037c8d01e751766527c8007fd6870
    │   │   ├─ [4973] 0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C::registeredTokenAddress(0x93e0937af3b1c3b2fe6a6d0c62347af46eb037c8d01e751766527c8007fd6870) [staticcall]
    │   │   │   ├─ [4566] 0x1B13a9BaF8d3116C56CCDF3aa9049ad532a9C03d::registeredTokenAddress(0x93e0937af3b1c3b2fe6a6d0c62347af46eb037c8d01e751766527c8007fd6870) [delegatecall]
    │   │   │   │   ├─ [215] 0x7E4Ff5205AC1ccE5D99A0c85509A85c528eA25Cf::tokenAddress() [staticcall]
    │   │   │   │   │   └─ ← [Return] 0x0000000000000000000000008a1bd5076b4b316b6855647d914bf24a92101c44
    │   │   │   │   └─ ← [Return] 0x8A1bd5076b4B316B6855647D914BF24a92101C44
    │   │   │   └─ ← [Return] 0x8A1bd5076b4B316B6855647D914BF24a92101C44
    │   │   ├─ [5553] 0x8A1bd5076b4B316B6855647D914BF24a92101C44::isMinter(0x05F8cC8753D90d67DBB8c02118440b8283F941c9) [staticcall]
    │   │   │   ├─ [2881] 0x7F9F70Da4af54671a6abAc58e705b5634cac8819::isMinter(0x05F8cC8753D90d67DBB8c02118440b8283F941c9) [delegatecall]
    │   │   │   │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000001
    │   │   │   └─ ← [Return] 0x0000000000000000000000000000000000000000000000000000000000000001
    │   │   └─ ← [Revert] custom error 0x4e9f6b57
    │   └─ ← [Revert] custom error 0x4e9f6b57
    └─ ← [Revert] custom error 0x4e9f6b57


Error: script failed: custom error 0x4e9f6b57