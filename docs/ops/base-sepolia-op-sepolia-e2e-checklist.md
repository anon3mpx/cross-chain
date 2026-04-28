# Base Sepolia -> Optimism Sepolia E2E Checklist

This is the concrete operator guide for testing `Base Sepolia (84532)` and `Optimism Sepolia (11155420)` across:

- `CCTP`
- `Axelar`
- `LayerZero`

This guide assumes the current repo state and the checked-in Foundry env files:

- [base-sepolia.configure.env](/Users/ganadhish/code/work/ruflo/config/foundry/env/base-sepolia.configure.env)
- [op-sepolia.configure.env](/Users/ganadhish/code/work/ruflo/config/foundry/env/op-sepolia.configure.env)

## 1. Current Scope

For this exact chain pair, the checked-in route metadata currently supports `USDC` settlement on all three rails:

- [routeMetadata.ts](/Users/ganadhish/code/work/ruflo/src/vps/config/routeMetadata.ts)

That means:

- direct rail tests should use `USDC -> USDC`
- arbitrary user-facing tokens can still be tested if both chains have aggregator mode enabled and the swap path exists
- `WETH` or other settlement assets are not configured for this pair yet

## 2. Required Fix Before LayerZero Planning

`Base Sepolia` is currently missing its LayerZero EID in [routeMetadata.ts](/Users/ganadhish/code/work/ruflo/src/vps/config/routeMetadata.ts).

Before relying on the route planner for this pair, add:

```ts
84532: {
  // ...
  layerZero: {
    dstEid: 40245,
  },
}
```

Without that, `npm run vps:route-config-plan -- --src-chain-id 84532 --dst-chain-id 11155420` will warn that the LayerZero source EID is missing.

## 3. Preflight Checklist

1. Fill `DEPLOYER_PRIVATE_KEY` in:
   - [base-sepolia.configure.env](/Users/ganadhish/code/work/ruflo/config/foundry/env/base-sepolia.configure.env)
   - [op-sepolia.configure.env](/Users/ganadhish/code/work/ruflo/config/foundry/env/op-sepolia.configure.env)
2. Confirm the deployed addresses in those files are still the ones you want to test.
3. If you want the VPS route planner and runtime to reflect live deployments, populate:
   - [deploymentRegistry.ts](/Users/ganadhish/code/work/ruflo/src/vps/config/deploymentRegistry.ts)
4. If you want swap-in / swap-out tests on testnet, set these in the VPS runtime env:
   - `CHAIN_84532_HAS_AGGREGATOR=true`
   - `CHAIN_11155420_HAS_AGGREGATOR=true`
5. Make sure your VPS runtime signer matches the deployed router signer:
   - `VPS_INTENT_SIGNER_PRIVATE_KEY`
   - `ROUTER_INTENT_SIGNER`

## 4. Local Verification

Run this before touching testnet:

```bash
node --import tsx --test tests/vps/*.test.ts
forge test --config-path config/foundry.toml
```

## 5. Configure Base Sepolia

Run the checked-in Base config exactly as the active shell env:

```bash
set -a
. config/foundry/env/base-sepolia.configure.env
set +a
npm run sol:configure:all
```

This configures contracts on `Base Sepolia`.

### Base -> OP `CCTP`

```bash
CCTP_SET_ROUTE=true
CCTP_PLUGIN=0x397ba7b3bba9beca34c77cddd615e8a7229b9351
CCTP_ROUTE_CHAIN_ID=11155420
CCTP_ROUTE_DOMAIN=2
CCTP_ROUTE_RECEIVER=0x7307fee834ddc88a716904830c0cb356a4878be1
CCTP_ROUTE_CALLER=0x05F8cC8753D90d67DBB8c02118440b8283F941c9
```

### Base -> OP `CCTP Fast`

```bash
CCTP_FAST_SET_ROUTE=true
CCTP_FAST_PLUGIN=0xa1764f0e7e836fd5b8a04622191b49ed737cea97
CCTP_FAST_ROUTE_CHAIN_ID=11155420
CCTP_FAST_ROUTE_DOMAIN=2
CCTP_FAST_ROUTE_RECEIVER=0x7307fee834ddc88a716904830c0cb356a4878be1
CCTP_FAST_ROUTE_CALLER=0x05F8cC8753D90d67DBB8c02118440b8283F941c9
CCTP_FAST_MAX_FEE_BPS_CAP=100
```

### Base -> OP `Axelar`

```bash
AXELAR_SET_ROUTE=true
AXELAR_PLUGIN=0x10afefdb684ba1e7afaebbafe10e4117410a60e4
AXELAR_ROUTE_CHAIN_ID=11155420
AXELAR_ROUTE_NAME=optimism-sepolia
AXELAR_ROUTE_RECEIVER=0x50d03965ed30de5d246bdda18e7b10a8904b8cf1
```

### Base -> OP `LayerZero`

```bash
LZ_SET_ROUTE=true
LZ_PLUGIN=0x25ea20f5b3b0104dc65903a5fef5066ce018d6f0
LZ_ROUTE_CHAIN_ID=11155420
LZ_ROUTE_EID=40232
LZ_ROUTE_RECEIVER=0xf1c5241faefc0db9b9333d9e2196e992a20dfd3d
LZ_ROUTE_FAMILY=lz_stargate_pool
LZ_ROUTE_OPTIONS=0x00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a80
```

### OP -> Base trust wired on Base

```bash
RECEIVER_APPROVED_CALLER_1=0xe78c3473b59156416994b57bc261a51ffbeee4fa
RECEIVER_APPROVED_CALLER_2=0xc0fbb4b422204d4bd3aa98705650c8935b01f493

AXELAR_ADAPTER_SET_TRUSTED_SOURCE=true
AXELAR_ADAPTER=0xe78c3473b59156416994b57bc261a51ffbeee4fa
AXELAR_SOURCE_CHAIN=optimism-sepolia
AXELAR_SOURCE_ADDRESS=0xd0a943f871a4cbc0288ee2eaaae7092b68a1247a
AXELAR_TRUSTED_TOKEN_ID=0x4d2fdc120be87ecf5661b7a75144d5d4b507b525eeb8c9c85c346a255e3b9663
AXELAR_TRUSTED_TOKEN=0x2f2A9DbFd8c503a0aC56413B774e39030df85331

LZ_ADAPTER_SET_TRUSTED_PEER=true
LZ_ADAPTER=0xc0fbb4b422204d4bd3aa98705650c8935b01f493
LZ_SOURCE_EID=40232
LZ_SOURCE_PEER_ADDRESS=0x1f031f7a2652fd6f10f1fb37befaac8a69039f08

LZ_ADAPTER_SET_ASSET=true
LZ_ADAPTER=0xc0fbb4b422204d4bd3aa98705650c8935b01f493
LZ_SOURCE_EID=40232
LZ_SETTLEMENT_TOKEN=0x1500116D88B6583E63E2Fa9D4199f2edDf72149b
LZ_COMPOSE_SENDER=0xC1d9A1f64291CF47e703eab6b27fA0660cAE7324

LZ_OFT_SET_PEER=true
LZ_OFT=0x1500116D88B6583E63E2Fa9D4199f2edDf72149b
LZ_OFT_PEER_EID=40232
LZ_OFT_PEER_ADDRESS=0xC1d9A1f64291CF47e703eab6b27fA0660cAE7324
```

## 6. Configure Optimism Sepolia

Run the checked-in OP config exactly as the active shell env:

```bash
set -a
. config/foundry/env/op-sepolia.configure.env
set +a
npm run sol:configure:all
```

This configures contracts on `Optimism Sepolia`.

### OP -> Base `CCTP`

```bash
CCTP_SET_ROUTE=true
CCTP_PLUGIN=0x83be9b7b17b9600cb369ed7062f4980d5a2f6cdb
CCTP_ROUTE_CHAIN_ID=84532
CCTP_ROUTE_DOMAIN=6
CCTP_ROUTE_RECEIVER=0xb006c9609b8fe8d52d2a16b4463446eda853264b
CCTP_ROUTE_CALLER=0x05F8cC8753D90d67DBB8c02118440b8283F941c9
```

### OP -> Base `CCTP Fast`

```bash
CCTP_FAST_SET_ROUTE=true
CCTP_FAST_PLUGIN=0x1d64595c11a4727551cc11d12d2f7239a64e15f0
CCTP_FAST_ROUTE_CHAIN_ID=84532
CCTP_FAST_ROUTE_DOMAIN=6
CCTP_FAST_ROUTE_RECEIVER=0xb006c9609b8fe8d52d2a16b4463446eda853264b
CCTP_FAST_ROUTE_CALLER=0x05F8cC8753D90d67DBB8c02118440b8283F941c9
CCTP_FAST_MAX_FEE_BPS_CAP=100
```

### OP -> Base `Axelar`

```bash
AXELAR_SET_ROUTE=true
AXELAR_PLUGIN=0xd0a943f871a4cbc0288ee2eaaae7092b68a1247a
AXELAR_ROUTE_CHAIN_ID=84532
AXELAR_ROUTE_NAME=base-sepolia
AXELAR_ROUTE_RECEIVER=0xe78c3473b59156416994b57bc261a51ffbeee4fa
```

### OP -> Base `LayerZero`

```bash
LZ_SET_ROUTE=true
LZ_PLUGIN=0x1f031f7a2652fd6f10f1fb37befaac8a69039f08
LZ_ROUTE_CHAIN_ID=84532
LZ_ROUTE_EID=40245
LZ_ROUTE_RECEIVER=0xc0fbb4b422204d4bd3aa98705650c8935b01f493
LZ_ROUTE_FAMILY=lz_stargate_pool
LZ_ROUTE_OPTIONS=0x00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a80
```

### Base -> OP trust wired on OP

```bash
RECEIVER_APPROVED_CALLER_1=0x50d03965ed30de5d246bdda18e7b10a8904b8cf1
RECEIVER_APPROVED_CALLER_2=0xf1c5241faefc0db9b9333d9e2196e992a20dfd3d

AXELAR_ADAPTER_SET_TRUSTED_SOURCE=true
AXELAR_ADAPTER=0x50d03965ed30de5d246bdda18e7b10a8904b8cf1
AXELAR_SOURCE_CHAIN=base-sepolia
AXELAR_SOURCE_ADDRESS=0x10afefdb684ba1e7afaebbafe10e4117410a60e4
AXELAR_TRUSTED_TOKEN_ID=0x4d2fdc120be87ecf5661b7a75144d5d4b507b525eeb8c9c85c346a255e3b9663
AXELAR_TRUSTED_TOKEN=0x2f2A9DbFd8c503a0aC56413B774e39030df85331

LZ_ADAPTER_SET_TRUSTED_PEER=true
LZ_ADAPTER=0xf1c5241faefc0db9b9333d9e2196e992a20dfd3d
LZ_SOURCE_EID=40245
LZ_SOURCE_PEER_ADDRESS=0x25ea20f5b3b0104dc65903a5fef5066ce018d6f0

LZ_ADAPTER_SET_ASSET=true
LZ_ADAPTER=0xf1c5241faefc0db9b9333d9e2196e992a20dfd3d
LZ_SOURCE_EID=40245
LZ_SETTLEMENT_TOKEN=0xC1d9A1f64291CF47e703eab6b27fA0660cAE7324
LZ_COMPOSE_SENDER=0x1500116D88B6583E63E2Fa9D4199f2edDf72149b

LZ_OFT_SET_PEER=true
LZ_OFT=0xC1d9A1f64291CF47e703eab6b27fA0660cAE7324
LZ_OFT_PEER_EID=40245
LZ_OFT_PEER_ADDRESS=0x1500116D88B6583E63E2Fa9D4199f2edDf72149b
```

## 7. Optional Planner Check

After the `84532` LayerZero EID fix, the planner should work for this pair:

```bash
npm run vps:route-config-plan -- --src-chain-id 84532 --dst-chain-id 11155420 --assets USDC
npm run vps:route-config-plan -- --src-chain-id 11155420 --dst-chain-id 84532 --assets USDC
```

## 8. Start the VPS API

The API uses the public quote surface:

- `POST /quote`
- `POST /quote/select`
- `GET /intent/:id`

Start it with the runtime env you want:

```bash
VPS_API_PORT=8787 \
CHAIN_84532_RPC_URL=https://sepolia.base.org \
CHAIN_11155420_RPC_URL=https://sepolia.optimism.io \
CHAIN_84532_HAS_AGGREGATOR=true \
CHAIN_11155420_HAS_AGGREGATOR=true \
VPS_INTENT_SIGNER_PRIVATE_KEY=0x... \
npm run vps:api
```

If you only want direct `USDC -> USDC` rail tests and not swap-in / swap-out tests, you can omit the two `HAS_AGGREGATOR=true` overrides.

## 9. Base -> OP Quote and Execute

Set a user key only for approval and submission:

```bash
export USER_PRIVATE_KEY=0x...
export USER_ADDRESS=0x...
```

### 9.1 CCTP standard

Request a quote:

```bash
curl -s http://localhost:8787/quote \
  -H 'content-type: application/json' \
  -d '{
    "srcChainId": 84532,
    "dstChainId": 11155420,
    "tokenIn": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "tokenOut": "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
    "amountIn": "1000000",
    "userAddress": "'"$USER_ADDRESS"'"
  }' > /tmp/base-op-quote.json
```

Inspect available offers:

```bash
jq '.offerSet.offers[] | {offerId, rail, offerType, routeAsset: .routeAsset.canonicalAssetId}' /tmp/base-op-quote.json
```

Select the `cctp_standard` offer:

```bash
export OFFER_ID=$(jq -r '.offerSet.offers[] | select(.offerType=="cctp_standard") | .offerId' /tmp/base-op-quote.json)
export OFFER_SET_ID=$(jq -r '.offerSet.offerSetId' /tmp/base-op-quote.json)

curl -s http://localhost:8787/quote/select \
  -H 'content-type: application/json' \
  -d '{
    "offerSetId": "'"$OFFER_SET_ID"'",
    "offerId": "'"$OFFER_ID"'",
    "userAddress": "'"$USER_ADDRESS"'"
  }' > /tmp/base-op-cctp-select.json
```

Approve the Base router to pull USDC:

```bash
cast send 0x036CbD53842c5426634e7929541eC2318f3dCF7e \
  "approve(address,uint256)" \
  0x1dd7f1d4ebb5a1ad2a9d0d561b1ef3338cef58e8 \
  1000000 \
  --rpc-url https://sepolia.base.org \
  --private-key "$USER_PRIVATE_KEY"
```

Broadcast the router tx:

```bash
node src/vps/scripts/sendBridgeCalldata.js \
  --file /tmp/base-op-cctp-select.json \
  --rpc-url https://sepolia.base.org \
  --private-key "$USER_PRIVATE_KEY"
```

Poll the intent:

```bash
export INTENT_ID=$(jq -r '.intentId' /tmp/base-op-cctp-select.json)
curl -s "http://localhost:8787/intent/$INTENT_ID" | jq
```

### 9.2 Axelar

Repeat the same flow, but select `axelar_direct`:

```bash
export OFFER_ID=$(jq -r '.offerSet.offers[] | select(.offerType=="axelar_direct") | .offerId' /tmp/base-op-quote.json)
```

Then rerun the same `/quote/select`, `approve`, `sendBridgeCalldata`, and `GET /intent/:id` steps.

### 9.3 LayerZero

Repeat the same flow, but select `lz_stargate_pool`:

```bash
export OFFER_ID=$(jq -r '.offerSet.offers[] | select(.offerType=="lz_stargate_pool") | .offerId' /tmp/base-op-quote.json)
```

Then rerun the same `/quote/select`, `approve`, `sendBridgeCalldata`, and `GET /intent/:id` steps.

## 10. Base -> OP Different Asset Tests

With `CHAIN_84532_HAS_AGGREGATOR=true` and `CHAIN_11155420_HAS_AGGREGATOR=true`, you can test non-settlement user tokens as long as:

- the source token can swap into `USDC`
- the destination token can swap out of `USDC`
- your deployed swap plugin and underlying liquidity actually support the pair

Example shape:

- source swap: `ANON -> USDC`
- rail: `USDC`
- destination swap: `USDC -> TOKEN_OUT`

Only the quote request changes:

```bash
curl -s http://localhost:8787/quote \
  -H 'content-type: application/json' \
  -d '{
    "srcChainId": 84532,
    "dstChainId": 11155420,
    "tokenIn": "<BASE_TOKEN_IN_ADDRESS>",
    "tokenOut": "<OP_TOKEN_OUT_ADDRESS>",
    "amountIn": "<RAW_AMOUNT>",
    "userAddress": "'"$USER_ADDRESS"'"
  }'
```

If no offer appears, the failure is usually one of:

- no swap path on source or destination
- testnet chains still running with `HAS_AGGREGATOR=false`
- token unsupported by the swap router

## 11. Pass Criteria

Each rail is only considered good when all of these are true:

1. `/quote` returns an offer for the expected rail.
2. `/quote/select` returns valid `integration`.
3. source approval succeeds.
4. router tx submits successfully.
5. `GET /intent/:id` progresses to `SETTLED`.
6. the destination user wallet receives the expected asset.

## 12. What This Checklist Does Not Cover Yet

This guide does not configure additional settlement assets like `WETH` for this pair.

If you want `Axelar` or `LayerZero` to carry `WETH` directly on `84532 <-> 11155420`, you still need to extend:

- [routeExecution.ts](/Users/ganadhish/code/work/ruflo/src/vps/config/routeExecution.ts)
- [routeMetadata.ts](/Users/ganadhish/code/work/ruflo/src/vps/config/routeMetadata.ts)
- the destination asset registry config on both chains
