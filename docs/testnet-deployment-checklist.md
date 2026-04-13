# Testnet Deployment Checklist (DApp-Only)

This checklist is optimized for your current codebase and a **2-chain rollout** (for example Base Sepolia `84532` and Arbitrum Sepolia `421614`).

## 1) Contracts to deploy per chain

1. `PluginRegistry`
2. `RouterV1`
3. `ReceiverV1`
4. Rail plugins you want active on testnet (for example `CCTPRailPlugin`, `AxelarRailPlugin`, `LayerZeroRailPlugin`)
5. Swap plugin for testnet DEX path:
   `UniswapV2SwapPlugin` (new)

## 2) Registry wiring (per chain)

1. Register each rail plugin in `PluginRegistry.registerRailPlugin`.
2. Register `UniswapV2SwapPlugin` in `PluginRegistry.registerSwapPlugin`.
3. Confirm plugin IDs:
   - `EMPSEAL_V1`: `0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6`
   - `UNISWAP_V2_V1`: `0xd7099269d6f03dcf43069b0eaaa4e0cf1c11e826eeb6895af3e6dc361969a8f7`

## 3) Environment config

Set these for each testnet chain:

1. RPC and contracts:
   - `CHAIN_<id>_RPC_URL`
   - `CHAIN_<id>_RPC_FALLBACK`
   - `CHAIN_<id>_ROUTER_V1`
   - `CHAIN_<id>_RECEIVER_V1`
2. Swap capability + plugin:
   - `CHAIN_<id>_HAS_AGGREGATOR=true`
   - `CHAIN_<id>_SWAP_PLUGIN_KIND=UNIV2` (or explicit `CHAIN_<id>_SWAP_PLUGIN_ID`)
   - `CHAIN_<id>_UNIV2_ROUTER=<router>`
3. Settlement token addresses:
   - `CHAIN_<id>_TOKEN_USDC=...`
   - `CHAIN_<id>_TOKEN_USDT=...` (if needed)
   - `CHAIN_<id>_TOKEN_ETH=...` (if needed)

## 4) Infra boot (self-hosted)

1. Copy `.env.example` to `.env` and fill values.
2. Start stack:

```bash
docker compose -f config/docker/docker-compose.testnet.yml up --build -d
```

3. API health:

```bash
curl http://localhost:8787/health
```

## 5) Quote + intent smoke tests

1. Request quote:

```bash
curl -X POST http://localhost:8787/quote \\
  -H 'content-type: application/json' \\
  -d '{
    "srcChainId": 84532,
    "dstChainId": 421614,
    "tokenIn": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "tokenOut": "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    "amountIn": "1000000",
    "userAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9"
  }'
```

2. Verify response includes:
   - `intentId`
   - `integration.contractAddress`
   - `integration.calldata`
3. Submit calldata from wallet to source `RouterV1`.
4. Poll:

```bash
curl http://localhost:8787/intent/<intentId>
```

## 6) Bidirectional mesh check (A↔B)

Run the same flow twice:

1. `84532 -> 421614`
2. `421614 -> 84532`

Pass criteria:

1. Quotes returned for both directions.
2. Source tx emits `IntentInitiated`.
3. Destination emits `IntentSettled` or `DirectDelivery`.
4. VPS status transitions to `SETTLED`.

## 7) Minimum pre-mainnet gates

1. Non-zero DEX liquidity on both testnets for target pairs.
2. Rail fee + gas fee estimation sanity-checked.
3. Recovery path tested by intentionally pausing one rail.
4. Plugin deactivation flow validated in `PluginRegistry`.
5. Postgres + Redis persistence verified after container restart.
