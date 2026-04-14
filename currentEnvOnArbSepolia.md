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
CHAIN_84532_RPC_URL=https://sepolia.base.org
# CHAIN_84532_RPC_FALLBACK=https://base-sepolia-rpc-backup.example
CHAIN_84532_ROUTER_V1=0xf9ec3860e935503532fd7ab04edb558fa951452f
CHAIN_84532_RECEIVER_V1=0xf87b70151ccb80fdd2c2d6bb9dc8a1055e34106b
CHAIN_84532_HAS_AGGREGATOR=false
# CHAIN_84532_SWAP_PLUGIN_KIND=UNIV2
# CHAIN_84532_UNIV2_ROUTER=0xYourUniswapV2RouterOnBaseSepolia
CHAIN_84532_TOKEN_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
CHAIN_84532_TOKEN_CCTP_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
CHAIN_84532_TOKEN_AXELAR_USDC=0x254d06f33bDc5b8ee05b2ea472107E300226659A # Axelar USDC on Base Sepolia
# CHAIN_84532_TOKEN_LAYERZERO_USDC=0xYourLzOFTTokenOnBaseSepolia
# CHAIN_84532_TOKEN_USDC=0xLegacyFallbackIfRailSpecificMissing

CHAIN_421614_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
# CHAIN_421614_RPC_FALLBACK=https://arbitrum-sepolia-rpc-backup.example
CHAIN_421614_ROUTER_V1=0x2c6832ce5e56be5253b5b0ba90f2d7258f4197ce
CHAIN_421614_RECEIVER_V1=0xe0ce1f340dc88f575f1afec742bdfd220af06f74
CHAIN_421614_HAS_AGGREGATOR=false
# CHAIN_421614_SWAP_PLUGIN_KIND=UNIV2
# CHAIN_421614_UNIV2_ROUTER=0xYourUniswapV2RouterOnArbitrumSepolia
CHAIN_421614_TOKEN_USDC=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
CHAIN_421614_TOKEN_CCTP_USDC=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
CHAIN_421614_TOKEN_AXELAR_USDC=0xA2Ba06a76eC793d1Faf23Cc8220A887402b27331 # Axelar USDC on Arbitrum Sepolia
# CHAIN_421614_TOKEN_LAYERZERO_USDC=0xYourLzOFTTokenOnArbitrumSepolia
# CHAIN_421614_TOKEN_USDC=0xLegacyFallbackIfRailSpecificMissing

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
RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
DEPLOYER_PRIVATE_KEY=
OWNER=0x05F8cC8753D90d67DBB8c02118440b8283F941c9
FEE_RECIPIENT=0x05F8cC8753D90d67DBB8c02118440b8283F941c9
# WETH=0x4200000000000000000000000000000000000006 # Base Sepolia canonical WETH
WETH=0x980B62Da83eFf3D4576C647993b0c1D7faf17c73 # Arbitrum Sepolia canonical WETH

# Optional deploy dependencies (set only if you want those components deployed)
# USDC=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d # Arbitrum Sepolia USDC
# USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e # Base Sepolia USDC
# USDC=0xLegacyFallbackUSDCOnThisChain
# USDT=0xUSDTOnThisChain

CCTP_USDC=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
AXELAR_USDC=0xA2Ba06a76eC793d1Faf23Cc8220A887402b27331 # Axelar USDC on arb Sepolia
# LAYERZERO_USDC=0xLayerZeroOFTTokenOnThisChain
# LZ_USDC=0xAliasForLayerZeroToken
# THOR_USDC=0xTHORSettlementUSDCOnThisChain
# THOR_USDT=0xTHORSettlementUSDTOnThisChain

# UNIV2_ROUTER=0xUniswapV2RouterOnThisChain
# UNIV3_ROUTER=0xUniswapV3SwapRouterOnThisChain
# EMPSEAL_ROUTER=0xEmpsealRouterIfAvailable
TOKEN_MESSENGER=0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa
AXELAR_GAS_SERVICE=0xbE406F0189A0B4cf3A05C286473D23791Dd44Cc6
AXELAR_ITS=0xB5FB4BE02232B1bBA4dC8f81dc24C26980dE9e3C
AXELAR_GATEWAY=0xe1cE95479C84e9809269227C7F8524aE051Ae77a
# LZ_ENDPOINT=0x6EDCE65403992e310A62460808c4b910D972f10f
# LZ_OFT=0xLayerZeroOFT
# THOR_ROUTER=0xThorRouter
# ENTRYPOINT=0xEIP4337EntryPoint
# PAYMASTER_SIGNER=0xPaymasterSigner

# Configure: plugin registration
PLUGIN_REGISTRY=0x65642ac8fd57eff8dd4651cb76be48814c8bf386
RECEIVER_V1=0x1b7eb489eb0ae102720442fe15b0e08653a13404 # Receiver on Arbitrum Sepolia (for all routes in this example)

RAIL_PLUGIN_CCTP=0x050c6c2555c2d54aba01420fbc02ff0f1d10e8df
RAIL_PLUGIN_AXELAR=0xdb403792c55bfe26beaef235986d4f106e40ee6f

RAIL_PLUGIN_LAYERZERO=0x0000000000000000000000000000000000000000
RAIL_PLUGIN_THORCHAIN=0x0000000000000000000000000000000000000000
SWAP_PLUGIN_UNIV2=0x0000000000000000000000000000000000000000
SWAP_PLUGIN_UNIV3=0x0000000000000000000000000000000000000000
SWAP_PLUGIN_EMPSEAL=0x0000000000000000000000000000000000000000

# Configure: receiver approvals
RECEIVER_APPROVED_CALLER_1=0x845cd50644a9592de43bcac0212656480744aaca # AxelarReceiverAdapter on Arbitrum Sepolia
RECEIVER_APPROVED_CALLER_2=0x0000000000000000000000000000000000000000
RECEIVER_APPROVED_CALLER_3=0x0000000000000000000000000000000000000000
RECEIVER_APPROVED_CALLER_4=0x0000000000000000000000000000000000000000
RECEIVER_APPROVED_CALLER_5=0x0000000000000000000000000000000000000000

# Configure: optional router fee recipient update
# ROUTER_SET_FEE_RECIPIENT=false
ROUTER_V1=0x1cb21a8a39e760e97c587b323d891927f3d006e9
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
CCTP_PLUGIN=0x050c6c2555c2d54aba01420fbc02ff0f1d10e8df
CCTP_ROUTE_CHAIN_ID=84532
CCTP_ROUTE_DOMAIN=6
CCTP_ROUTE_RECEIVER=0xf87b70151ccb80fdd2c2d6bb9dc8a1055e34106b # Receiver on Base Sepolia

# Configure: Axelar route
AXELAR_SET_ROUTE=true
AXELAR_PLUGIN=0xdb403792c55bfe26beaef235986d4f106e40ee6f
AXELAR_ROUTE_CHAIN_ID=84532
AXELAR_ROUTE_NAME=base-sepolia
AXELAR_ROUTE_RECEIVER=0xf87b70151ccb80fdd2c2d6bb9dc8a1055e34106b # Receiver on Base Sepolia
AXELAR_ROUTE_TOKEN_ID=0x8351ce1d9b08b0ec2add9de7e893e4a216235576cd4074bbacb0b9fb9b8f68c6

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
AXELAR_ADAPTER=0x845cd50644a9592de43bcac0212656480744aaca # AxelarReceiverAdapter on Arbitrum Sepolia
AXELAR_SOURCE_CHAIN=base-sepolia
AXELAR_SOURCE_ADDRESS=0xcc89d8bedfb39170fa74bcf1d28c9e399b82ccb2 # Axelar plugin on Base Sepolia
AXELAR_SOURCE_TRUSTED=true

# Configure: LayerZero adapter trust
# LZ_ADAPTER_SET_TRUSTED_PEER=false
# LZ_ADAPTER=0xLayerZeroReceiverAdapter
# LZ_SOURCE_EID=40245
# LZ_SOURCE_PEER=0x0000000000000000000000000000000000000000000000000000000000000000
