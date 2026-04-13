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

# ------------------------------------------------------------------
# Redis cache (optional but recommended)
# ------------------------------------------------------------------
# REDIS_ENABLED=true
# REDIS_URL=redis://127.0.0.1:6379

# ------------------------------------------------------------------
# Testnet chain configuration examples (Base Sepolia ↔ Arbitrum Sepolia)
# ------------------------------------------------------------------
# CHAIN_84532_RPC_URL=https://base-sepolia-rpc.example
# CHAIN_84532_RPC_FALLBACK=https://base-sepolia-rpc-backup.example
# CHAIN_84532_ROUTER_V1=0xYourRouterOnBaseSepolia
# CHAIN_84532_RECEIVER_V1=0xYourReceiverOnBaseSepolia
# CHAIN_84532_HAS_AGGREGATOR=true
# CHAIN_84532_SWAP_PLUGIN_KIND=UNIV2
# CHAIN_84532_UNIV2_ROUTER=0xYourUniswapV2RouterOnBaseSepolia
# CHAIN_84532_TOKEN_USDC=0xYourUSDCOnBaseSepolia

# CHAIN_421614_RPC_URL=https://arbitrum-sepolia-rpc.example
# CHAIN_421614_RPC_FALLBACK=https://arbitrum-sepolia-rpc-backup.example
# CHAIN_421614_ROUTER_V1=0xYourRouterOnArbitrumSepolia
# CHAIN_421614_RECEIVER_V1=0xYourReceiverOnArbitrumSepolia
# CHAIN_421614_HAS_AGGREGATOR=true
# CHAIN_421614_SWAP_PLUGIN_KIND=UNIV2
# CHAIN_421614_UNIV2_ROUTER=0xYourUniswapV2RouterOnArbitrumSepolia
# CHAIN_421614_TOKEN_USDC=0xYourUSDCOnArbitrumSepolia

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
RPC_URL=https://sepolia.base.org
# RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
DEPLOYER_PRIVATE_KEY=0x3fcdea5d460ea75021bf6e2ca52028b5138033e4635e1ac1f063c89850ca3383
OWNER=0x05F8cC8753D90d67DBB8c02118440b8283F941c9
# FEE_RECIPIENT=0x05F8cC8753D90d67DBB8c02118440b8283F941c9
# WETH=0x4200000000000000000000000000000000000006 # Base Sepolia canonical WETH
# WETH=0x980B62Da83eFf3D4576C647993b0c1D7faf17c73 # Arbitrum Sepolia canonical WETH

# Optional deploy dependencies (set only if you want those components deployed)
# USDC=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d # Arbitrum Sepolia USDC
# USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e # Base Sepolia USDC
# USDT=0xUSDTOnThisChain
# UNIV2_ROUTER=0xUniswapV2RouterOnThisChain
# UNIV3_ROUTER=0xUniswapV3SwapRouterOnThisChain
# EMPSEAL_ROUTER=0xEmpsealRouterIfAvailable
# TOKEN_MESSENGER=0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa
# AXELAR_GAS_SERVICE=0xbE406F0189A0B4cf3A05C286473D23791Dd44Cc6
# AXELAR_ITS=0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C
# AXELAR_GATEWAY=0xe1cE95479C84e9809269227C7F8524aE051Ae77a
# LZ_ENDPOINT=0x6EDCE65403992e310A62460808c4b910D972f10f
# LZ_OFT=0xLayerZeroOFT
# THOR_ROUTER=0xThorRouter
# ENTRYPOINT=0xEIP4337EntryPoint
# PAYMASTER_SIGNER=0xPaymasterSigner

# Configure: plugin registration
PLUGIN_REGISTRY=0xb71d8b4769f66b4ca4d92b627f75b67dbb0dd344
RECEIVER_V1=0x0234a6fe0f7d577e2ece168896277a56ba313ffe

RAIL_PLUGIN_CCTP=0x4966e2dee5a908586e58c5776b3996c108804fb5
RAIL_PLUGIN_AXELAR=0xe227b51f5d7079faa07b7621657e3aa5906d2185

RAIL_PLUGIN_LAYERZERO=0x0000000000000000000000000000000000000000
RAIL_PLUGIN_THORCHAIN=0x0000000000000000000000000000000000000000
SWAP_PLUGIN_UNIV2=0x0000000000000000000000000000000000000000
SWAP_PLUGIN_UNIV3=0x0000000000000000000000000000000000000000
SWAP_PLUGIN_EMPSEAL=0x0000000000000000000000000000000000000000

# Configure: receiver approvals
RECEIVER_APPROVED_CALLER_1=0xa311bcaaa3fed89b62453dd516f90a37e997f066
RECEIVER_APPROVED_CALLER_2=0x0000000000000000000000000000000000000000
RECEIVER_APPROVED_CALLER_3=0x0000000000000000000000000000000000000000
RECEIVER_APPROVED_CALLER_4=0x0000000000000000000000000000000000000000
RECEIVER_APPROVED_CALLER_5=0x0000000000000000000000000000000000000000

# Configure: optional router fee recipient update
# ROUTER_SET_FEE_RECIPIENT=false
# ROUTER_V1=0x2c6832ce5e56be5253b5b0ba90f2d7258f4197ce
# ROUTER_NEW_FEE_RECIPIENT=0xNewFeeRecipient

# Configure: optional paymaster updates
# PAYMASTER=0xRufloPaymaster
# PAYMASTER_SET_SIGNER=false
# PAYMASTER_NEW_SIGNER=0xNewSigner
# PAYMASTER_SET_TOKEN_RATE=false
# PAYMASTER_RATE_TOKEN=0xUSDC
# PAYMASTER_RATE_VALUE=3000000000000000000000

# Configure: CCTP route (set true when applying)
CCTP_SET_ROUTE=true
CCTP_PLUGIN=0x4966e2dee5a908586e58c5776b3996c108804fb5
CCTP_ROUTE_CHAIN_ID=421614
CCTP_ROUTE_DOMAIN=3
CCTP_ROUTE_RECEIVER=0xe0ce1f340dc88f575f1afec742bdfd220af06f74

# Configure: Axelar route
AXELAR_SET_ROUTE=true
AXELAR_PLUGIN=0xe227b51f5d7079faa07b7621657e3aa5906d2185
AXELAR_ROUTE_CHAIN_ID=421614
AXELAR_ROUTE_NAME=arbitrum-sepolia
AXELAR_ROUTE_RECEIVER=0x0f63a9dfa5f0c711e0cf9411e42ee17ccec8b4c8
AXELAR_ROUTE_TOKEN_ID=0x8f709b1b855776b4b59998cdbc16a25da06fa45245f3c3e529171bbd76a2ea72

# Configure: LayerZero route
# LZ_SET_ROUTE=false
# LZ_PLUGIN=0xLayerZeroRailPlugin
# LZ_ROUTE_CHAIN_ID=421614
# LZ_ROUTE_EID=40231
# LZ_ROUTE_RECEIVER=0xReceiverOnDestination
# LZ_ROUTE_OPTIONS=0x

# Configure: THOR settings
# THOR_PLUGIN=0xTHORChainRailPlugin
# THOR_SET_VAULT=false
# THOR_VAULT_CHAIN_ID=1
# THOR_VAULT_ADDRESS=0xThorInboundVault
# THOR_SET_ROUTER=false
# THOR_ROUTER=0xThorRouter

# Configure: Axelar adapter trust
AXELAR_ADAPTER_SET_TRUSTED_SOURCE=true
AXELAR_ADAPTER=0x0f63a9dfa5f0c711e0cf9411e42ee17ccec8b4c8
AXELAR_SOURCE_CHAIN=arbitrum-sepolia
AXELAR_SOURCE_ADDRESS=0xf283a5df86fbc521cb4f5508db167c6d476a7ab9
AXELAR_SOURCE_TRUSTED=true

# Configure: LayerZero adapter trust
# LZ_ADAPTER_SET_TRUSTED_PEER=false
# LZ_ADAPTER=0xLayerZeroReceiverAdapter
# LZ_SOURCE_EID=40245
# LZ_SOURCE_PEER=0x0000000000000000000000000000000000000000000000000000000000000000
