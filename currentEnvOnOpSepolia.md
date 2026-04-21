# EMPX-Cross-Chain V3 - Multi-Provider LLM Configuration
# Copy to .env and fill in your API keys

# Provider API Keys (free tier endpoints)
GROQ_API_KEY=your_groq_api_key_here
NVIDIA_API_KEY=your_nvidia_nim_api_key_here
MISTRAL_API_KEY=your_mistral_api_key_here
MOONSHOT_API_KEY=your_moonshot_api_key_here
ZHIPU_API_KEY=your_zhipu_glm_api_key_here

# Optional: Anthropic (for Claude Code itself)
# ANTHROPIC_API_KEY=your_anthropic_key_here

# ------------------------------------------------------------------
# VPS Self-Hosted Postgres
# ------------------------------------------------------------------
# Preferred:
# DATABASE_URL=postgres://user:pass@host:5432/dbname
#
# Optional split config:
# PGHOST=127.0.0.1
# PGPORT=5432
# PGUSER=postgres
# PGPASSWORD=postgres
# PGDATABASE=bridge
# PGSSL=false
# PGPOOL_MAX=20
# PG_IDLE_TIMEOUT_MS=30000
# PG_CONNECTION_TIMEOUT_MS=10000

# ------------------------------------------------------------------
# VPS runtime
# ------------------------------------------------------------------
# VPS_API_HOST=0.0.0.0
# VPS_API_PORT=8787
# ENABLE_PARTNER_API=false
# ENABLE_EVENT_MONITOR=true
# ENABLE_RECOVERY_ENGINE=true
# RECOVERY_INTERVAL_MS=30000

ENABLE_CCTP_RELAY=false
CCTP_RELAYER_PRIVATE_KEY=
CCTP_ATTESTATION_BASE_URL=https://iris-api-sandbox.circle.com
CCTP_ATTESTATION_POLL_MS=4000
CCTP_ATTESTATION_TIMEOUT_MS=600000
CCTP_RELAY_LOOKBACK_BLOCKS=4000
CCTP_MESSAGE_TRANSMITTER=0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275

# ------------------------------------------------------------------
# Redis cache (optional but recommended)
# ------------------------------------------------------------------
# REDIS_ENABLED=true
# REDIS_URL=redis://127.0.0.1:6379

# ------------------------------------------------------------------
# Testnet chain configuration examples (Base Sepolia ↔ Arbitrum Sepolia)
# ------------------------------------------------------------------
CHAIN_84532_RPC_URL=https://sepolia.base.org
# CHAIN_84532_RPC_FALLBACK=https://base-sepolia-rpc-backup.example
CHAIN_84532_ROUTER_V1=0xd11bd7b46f10477fe61134fddd6538a383f8978e
CHAIN_84532_RECEIVER_V1=0x9e01c29643f5ea0a8fa6056494c3b6d4bba48247
CHAIN_84532_HAS_AGGREGATOR=false
# CHAIN_84532_SWAP_PLUGIN_KIND=UNIV2
# CHAIN_84532_SWAP_PLUGIN_ID=0xYourSwapPluginIdOnBaseSepolia
# CHAIN_84532_UNIV2_ROUTER=0xYourUniswapV2RouterOnBaseSepolia
# CHAIN_84532_UNIV3_ROUTER=0xYourUniswapV3RouterOnBaseSepolia
CHAIN_84532_CCTP_DOMAIN=6
CHAIN_84532_TOKEN_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
CHAIN_84532_TOKEN_CCTP_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
CHAIN_84532_TOKEN_AXELAR_USDC=0x254d06f33bDc5b8ee05b2ea472107E300226659A # Axelar USDC on Base Sepolia
# CHAIN_84532_TOKEN_LAYERZERO_USDC=0xYourLzOFTTokenOnBaseSepolia
# CHAIN_84532_TOKEN_USDC=0xLegacyFallbackIfRailSpecificMissing
CHAIN_84532_TOKEN_MESSENGER=0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa
CHAIN_84532_CCTP_MESSAGE_TRANSMITTER=0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275

CHAIN_421614_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
# CHAIN_421614_RPC_FALLBACK=https://arbitrum-sepolia-rpc-backup.example
CHAIN_421614_ROUTER_V1=0x2c6832ce5e56be5253b5b0ba90f2d7258f4197ce
CHAIN_421614_RECEIVER_V1=0xb2abe546163021d539e4cc991354c29a124b38ce
CHAIN_421614_HAS_AGGREGATOR=false
# CHAIN_421614_SWAP_PLUGIN_KIND=UNIV2
# CHAIN_421614_SWAP_PLUGIN_ID=0xYourSwapPluginIdOnArbitrumSepolia
# CHAIN_421614_UNIV2_ROUTER=0xYourUniswapV2RouterOnArbitrumSepolia
# CHAIN_421614_UNIV3_ROUTER=0xYourUniswapV3RouterOnArbitrumSepolia
CHAIN_421614_CCTP_DOMAIN=3
CHAIN_421614_TOKEN_USDC=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
CHAIN_421614_TOKEN_CCTP_USDC=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
CHAIN_421614_TOKEN_AXELAR_USDC=0xA2Ba06a76eC793d1Faf23Cc8220A887402b27331 # Axelar USDC on Arbitrum Sepolia
# CHAIN_421614_TOKEN_LAYERZERO_USDC=0xYourLzOFTTokenOnArbitrumSepolia
# CHAIN_421614_TOKEN_USDC=0xLegacyFallbackIfRailSpecificMissing
CHAIN_421614_TOKEN_MESSENGER=0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa
CHAIN_421614_CCTP_MESSAGE_TRANSMITTER=0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275

# ------------------------------------------------------------------
# Foundry Contract Deploy + Configure (chain-by-chain)
# ------------------------------------------------------------------
# Use these for:
#   npm run sol:deploy:all
#   npm run sol:configure:all
#
# Important:
# - Set these values for ONE chain at a time, run deploy/config, then switch.
# - Keep OWNER as multisig (or safe owner) for non-test environments.

# Shared
# RPC_URL=https://sepolia.base.org
# RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
RPC_URL=https://sepolia.optimism.io

DEPLOYER_PRIVATE_KEY=
OWNER=0x05F8cC8753D90d67DBB8c02118440b8283F941c9
FEE_RECIPIENT=0x05F8cC8753D90d67DBB8c02118440b8283F941c9

# WETH=0x4200000000000000000000000000000000000006 # Base Sepolia canonical WETH
# WETH=0x980B62Da83eFf3D4576C647993b0c1D7faf17c73 # Arbitrum Sepolia canonical WETH
WETH=0x4200000000000000000000000000000000000006 # Optimism Sepolia canonical WETH


# Optional deploy dependencies (set only if you want those components deployed)
# USDC=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d # Arbitrum Sepolia USDC
# USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e # Base Sepolia USDC
# USDC=0xLegacyFallbackUSDCOnThisChain
# USDT=0xUSDTOnThisChain

CCTP_USDC=0x5fd84259d66Cd46123540766Be93DFE6D43130D7 # CCTP USDC on op sepolia
AXELAR_USDC=0x2f2A9DbFd8c503a0aC56413B774e39030df85331 # Axelar USDC on op Sepolia
LAYERZERO_USDC=0xC1d9A1f64291CF47e703eab6b27fA0660cAE7324 # LayerZero USDC on optimism Sepolia
# LZ_USDC=0x488327236B65C61A6c083e8d811a4E0D3d1D4268
# THOR_USDC=0xTHORSettlementUSDCOnThisChain
# THOR_USDT=0xTHORSettlementUSDTOnThisChain

# UNIV2_ROUTER=0xUniswapV2RouterOnThisChain
# UNIV3_ROUTER=0xUniswapV3SwapRouterOnThisChain
# EMPSEAL_ROUTER=0xEmpsealRouterIfAvailable

TOKEN_MESSENGER=0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa

AXELAR_GAS_SERVICE=0xbE406F0189A0B4cf3A05C286473D23791Dd44Cc6
AXELAR_ITS=0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C
AXELAR_GATEWAY=0xe432150cce91c13a887f7D836923d5597adD8E31

# Axelar ITS (Interchain Token) - OP Sepolia / chain-scoped refs
# Source of infra addresses: references/axelar-chain-configs-testnet.json
ITS_FACTORY=0x83a93500d23Fbc3e82B410aD07A6a9F7A0670D66
ITS_FACTORY_84532=0x83a93500d23Fbc3e82B410aD07A6a9F7A0670D66
ITS_FACTORY_11155420=0x83a93500d23Fbc3e82B410aD07A6a9F7A0670D66
AXELAR_ITS_84532=0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C
AXELAR_ITS_11155420=0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C

# Token params (provided)
ITS_SALT=0xc8b381b55deda609bc41d9b3157b5f2952f87c9304179cd5e3960537e74d46c6
ITS_TOKEN_NAME=aUSDC
ITS_TOKEN_SYMBOL=aUSDC
ITS_TOKEN_DECIMALS=6
ITS_INITIAL_SUPPLY=1000000000000
ITS_MINTER=0x05F8cC8753D90d67DBB8c02118440b8283F941c9

# ITS flow for your current setup:
# - Deploy local + deploy remote MUST be executed from Base Sepolia file.
# - Do not run `npm run sol:deploy:its` from this OP file for this flow.
# ITS_ACTION=
# ITS_ACTION_11155420=
# ITS_CALL_VALUE=
# ITS_GAS_VALUE=

# OP-side verification helpers (fill after Base remote deploy succeeds):
ITS_DEPLOYER=0x05F8cC8753D90d67DBB8c02118440b8283F941c9
ITS_DESTINATION_CHAIN=optimism-sepolia
# ITS_TOKEN_ID=<paste tokenId emitted from Base deployment tx>
# ITS_REGISTERED_TOKEN_OP=<paste cast result from OP ITS.registeredTokenAddress(tokenId)>
# ITS_TOKEN_MANAGER_OP=<paste cast result from OP ITS.tokenManagerAddress(tokenId)>

LZ_ENDPOINT=0x6EDCE65403992e310A62460808c4b910D972f10f # LayerZero Endpoint on Optimism Sepolia for USDC
LZ_OFT=0xC1d9A1f64291CF47e703eab6b27fA0660cAE7324 # LayerZero Custom OFT on Optimism Sepolia for USDC

# THOR_ROUTER=0xThorRouter
# ENTRYPOINT=0xEIP4337EntryPoint
# PAYMASTER_SIGNER=0xPaymasterSigner

# Configure: plugin registration
PLUGIN_REGISTRY=0x5e8297763d7448718917b16b88347766b0920af9
RECEIVER_V1=0xbc4cbd47e7bf5eec5ede5f3a805c8dcc20d843a0 # Receiver on Optimism Sepolia (for all routes in this example)

RAIL_PLUGIN_CCTP=0x0000000000000000000000000000000000000000
RAIL_PLUGIN_AXELAR=0xa73776c0aae79382d8003b1fc7648b5ab32889d0
RAIL_PLUGIN_LAYERZERO=0x0000000000000000000000000000000000000000

RAIL_PLUGIN_THORCHAIN=0x0000000000000000000000000000000000000000
SWAP_PLUGIN_UNIV2=0x0000000000000000000000000000000000000000
SWAP_PLUGIN_UNIV3=0x0000000000000000000000000000000000000000
SWAP_PLUGIN_EMPSEAL=0x0000000000000000000000000000000000000000

# Configure: receiver approvals
RECEIVER_APPROVED_CALLER_1=0xd8016e376e15b20fc321a37fd69dc42cfdf951bb # Axelar Receiver adapter on op Sepolia
RECEIVER_APPROVED_CALLER_2=0x0000000000000000000000000000000000000000
RECEIVER_APPROVED_CALLER_3=0x0000000000000000000000000000000000000000
RECEIVER_APPROVED_CALLER_4=0x0000000000000000000000000000000000000000
RECEIVER_APPROVED_CALLER_5=0x0000000000000000000000000000000000000000

# Configure: optional router fee recipient update
# ROUTER_SET_FEE_RECIPIENT=false
ROUTER_V1=0x78546a4ace4529582d7ddf4356baf110fa343701 # Router on Optimism Sepolia
# ROUTER_NEW_FEE_RECIPIENT=0xNewFeeRecipient

# Configure: optional paymaster updates
# PAYMASTER=0xRufloPaymaster
# PAYMASTER_SET_SIGNER=false
# PAYMASTER_NEW_SIGNER=0xNewSigner
# PAYMASTER_SET_TOKEN_RATE=false
# PAYMASTER_RATE_TOKEN=0xUSDC
# PAYMASTER_RATE_VALUE=3000000000000000000000

# Configure: CCTP route (set true when applying)
CCTP_SET_ROUTE=false
CCTP_PLUGIN=0xb1b9c30c08c37af935cda3be0e3f124a580cb1a6
CCTP_ROUTE_CHAIN_ID=84532
CCTP_ROUTE_DOMAIN=6
CCTP_ROUTE_RECEIVER=0x8fb0438d0799c52920515b31310f53452c33e066 # ReceiverV1 on Base Sepolia
# Open relay caller for CCTP receiveMessage (recommended with worker flow):
CCTP_ROUTE_CALLER=0x0000000000000000000000000000000000000000

# Configure: CCTP Fast route (set true when applying)
CCTP_FAST_SET_ROUTE=false
CCTP_FAST_PLUGIN=0x6a790bf1991d3a53b81bb9316fb3b3e8217c5699
CCTP_FAST_ROUTE_CHAIN_ID=84532 # destination chain
CCTP_FAST_ROUTE_DOMAIN=6
CCTP_FAST_ROUTE_RECEIVER=0x8fb0438d0799c52920515b31310f53452c33e066
CCTP_FAST_ROUTE_CALLER=0x0000000000000000000000000000000000000000
CCTP_FAST_MAX_FEE_BPS_CAP=100

# Configure: Axelar route
AXELAR_SET_ROUTE=true
AXELAR_PLUGIN=0xa73776c0aae79382d8003b1fc7648b5ab32889d0
AXELAR_ROUTE_CHAIN_ID=84532
AXELAR_ROUTE_NAME=base-sepolia
AXELAR_ROUTE_RECEIVER=0x5fd1f6db09c8d64f2230415d8f0f9e87f5462fa3 # Axelar Receiver adapter on Base Sepolia (destination)
AXELAR_ROUTE_TOKEN_ID=0x4d2fdc120be87ecf5661b7a75144d5d4b507b525eeb8c9c85c346a255e3b9663

# Configure: LayerZero route
LZ_SET_ROUTE=false
LZ_PLUGIN=0x55cc592be7e49c4020e67a895fee9474c7d71dbc # LayerZero plugin on Optimism Sepolia
LZ_ROUTE_CHAIN_ID=84532 # LayerZero chain ID for Op Sepolia
LZ_ROUTE_EID=40245 # LayerZero Endpoint ID for Op Sepolia
LZ_ROUTE_RECEIVER=0x4e5d1ff12514cc396aa37757878a02433887ede0 # LZ receiver adapter on base Sepolia
LZ_ROUTE_OPTIONS=0x00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a80 # Options LzReceive + LzCompose with specific gas limits (see src/vps/scripts/optionsBuilder.ts for how to generate this)

# Configure: THOR settings
# THOR_PLUGIN=0xTHORChainRailPlugin
# THOR_SET_VAULT=false
# THOR_VAULT_CHAIN_ID=1
# THOR_VAULT_ADDRESS=0xThorInboundVault
# THOR_SET_ROUTER=false
# THOR_ROUTER=0xThorRouter

# Configure: Axelar adapter trust
AXELAR_ADAPTER_SET_TRUSTED_SOURCE=true
AXELAR_ADAPTER=0xd8016e376e15b20fc321a37fd69dc42cfdf951bb # AxelarReceiverAdapter on Optimism Sepolia (local)
AXELAR_SOURCE_CHAIN=base-sepolia
AXELAR_SOURCE_ADDRESS=0xd00e7ce0ac312138de62610ed950e814e12d3f89 # AxelarRailPlugin on Base Sepolia (source)
AXELAR_SOURCE_TRUSTED=true
AXELAR_TRUSTED_TOKEN_ID=0x4d2fdc120be87ecf5661b7a75144d5d4b507b525eeb8c9c85c346a255e3b9663
AXELAR_TRUSTED_TOKEN=0x2f2A9DbFd8c503a0aC56413B774e39030df85331

# Configure: LayerZero adapter trust
LZ_ADAPTER_SET_TRUSTED_PEER=false
LZ_ADAPTER=0x4e5d1ff12514cc396aa37757878a02433887ede0 # LayerZeroReceiverAdapter on destination Sepolia 
LZ_SOURCE_EID=40232 # LayerZero Endpoint ID for Optimism sepolia
LZ_SOURCE_PEER_ADDRESS=0x55cc592be7e49c4020e67a895fee9474c7d71dbc # LayerZero plugin on Optimism Sepolia
LZ_SOURCE_PEER=0x0000000000000000000000000000000000000000000000000000000000000000
