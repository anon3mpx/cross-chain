curl -X 'POST' \
  'http://localhost:8787/api/v1/quote' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "tokenIn": "0x4200000000000000000000000000000000000042",
  "tokenOut": "0x912ce59144191c1204e64559fe8253a0e49e6548",
  "amountIn": "100000000000000000000",
  "srcChainId": 10,
  "dstChainId": 42161,
  "userAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
  "urgency": "fast"
}'

{
  "offerSet": {
    "offerSetId": "0xd55ae78fb2ab11b33437e8b9be234621c6e86c6b1062005fe0b8228852eae89c",
    "expiresAt": 1778844200,
    "offers": [
      {
        "offerId": "0x1e27e6b5229ca5e12a62636065735b252f665e4fcbedbf57f010fdbb7827209f",
        "rail": "CCTP",
        "offerType": "cctp_standard",
        "railType": "messaging",
        "srcChainId": 10,
        "dstChainId": 42161,
        "tokenIn": "0x4200000000000000000000000000000000000042",
        "tokenOut": "0x912ce59144191c1204e64559fe8253a0e49e6548",
        "amountIn": "100000000000000000000",
        "estimatedOut": "99102697300000000000",
        "minAmountOut": "99003594602700000000",
        "expiresAt": 1778844201,
        "deliveryShape": "src_and_dst_swap_required",
        "executionMode": "router_intent",
        "routeAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:10:usdc",
          "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:10:usdc",
          "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:10:usdc",
          "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "economics": {
          "providerFeeUSD": 0,
          "protocolFeeUSD": 0.3,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 1200,
          "outboundFeeUSD": 0
        },
        "execution": {
          "quote": {
            "intentId": "0x1e27e6b5229ca5e12a62636065735b252f665e4fcbedbf57f010fdbb7827209f",
            "srcChainId": 10,
            "dstChainId": 42161,
            "tokenIn": "0x4200000000000000000000000000000000000042",
            "tokenOut": "0x912ce59144191c1204e64559fe8253a0e49e6548",
            "amountIn": "100000000000000000000",
            "estimatedOut": "99102697300000000000",
            "minAmountOut": "99003594602700000000",
            "minSrcSwapOut": "98903895500000000000",
            "feeAmountUSD": 0.3,
            "feeAmountToken": "300000000000000000",
            "rail": "CCTP",
            "railType": "messaging",
            "settlementToken": "USDC",
            "settlementAssetId": "0xc9e6c698b6a822819702171c2ca95ee8e0bd8b87d4d4954b42a3ef3815a80042",
            "expectedDstSettlementToken": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            "expectedDstSettlementAssetId": "0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94",
            "minSettlementAmount": "99301499100000000000",
            "dstGasLimit": 200000,
            "etaSeconds": 1200,
            "expiresAt": 1778844201,
            "railPluginId": "0xb148ea5f936a28661e11743b1650193f1b14a2322b9541503bf6815a84a1a6e9",
            "railData": "0x",
            "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapDataSrc": "0x",
            "swapDataDst": "0x",
            "nativeDstAddress": "undefined",
            "routeAsset": {
              "canonicalAssetId": "USDC",
              "providerAssetId": "CCTP:10:usdc",
              "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
              "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
              "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              "decimals": 6,
              "assetKind": "erc20",
              "assetStandard": "erc20"
            }
          },
          "feeAmountToken": "300000000000000000",
          "minSrcSwapOut": "98903895500000000000",
          "providerFeeUSD": 0,
          "protocolFeeUSD": 0.3,
          "railPluginId": "0xb148ea5f936a28661e11743b1650193f1b14a2322b9541503bf6815a84a1a6e9",
          "railData": "0x",
          "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapDataSrc": "0x",
          "swapDataDst": "0x",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      },
      {
        "offerId": "0xa1bc1dd140152ebd2af561c5a1efeb03cb1957423136a1e57bfcc2ebc1993ac9",
        "rail": "LAYERZERO",
        "offerType": "lz_stargate_pool",
        "railType": "messaging",
        "srcChainId": 10,
        "dstChainId": 42161,
        "tokenIn": "0x4200000000000000000000000000000000000042",
        "tokenOut": "0x912ce59144191c1204e64559fe8253a0e49e6548",
        "amountIn": "100000000000000000000",
        "estimatedOut": "99102697300000000000",
        "minAmountOut": "99003594602700000000",
        "expiresAt": 1778844200,
        "deliveryShape": "src_and_dst_swap_required",
        "executionMode": "router_intent",
        "routeAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "economics": {
          "providerFeeUSD": 0.35,
          "protocolFeeUSD": 0.3,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 300
        },
        "execution": {
          "quote": {
            "intentId": "0xa1bc1dd140152ebd2af561c5a1efeb03cb1957423136a1e57bfcc2ebc1993ac9",
            "srcChainId": 10,
            "dstChainId": 42161,
            "tokenIn": "0x4200000000000000000000000000000000000042",
            "tokenOut": "0x912ce59144191c1204e64559fe8253a0e49e6548",
            "amountIn": "100000000000000000000",
            "estimatedOut": "99102697300000000000",
            "minAmountOut": "99003594602700000000",
            "minSrcSwapOut": "98903895500000000000",
            "feeAmountUSD": 0.3,
            "feeAmountToken": "300000000000000000",
            "rail": "LAYERZERO",
            "railType": "messaging",
            "settlementToken": "USDC",
            "settlementAssetId": "0xc9e6c698b6a822819702171c2ca95ee8e0bd8b87d4d4954b42a3ef3815a80042",
            "expectedDstSettlementToken": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            "expectedDstSettlementAssetId": "0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94",
            "minSettlementAmount": "99301499100000000000",
            "dstGasLimit": 240000,
            "etaSeconds": 300,
            "expiresAt": 1778844200,
            "railPluginId": "0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc",
            "railData": "0x0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000ce8cca271ebc0533920c83d39f417ed6a0abb7d00000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a800000000000000000000000000000000000000000",
            "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapDataSrc": "0x",
            "swapDataDst": "0x",
            "nativeDstAddress": "undefined",
            "routeAsset": {
              "canonicalAssetId": "USDC",
              "providerAssetId": "layerzero:usdc",
              "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
              "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
              "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              "decimals": 6,
              "assetKind": "erc20",
              "assetStandard": "stargate_pool"
            }
          },
          "feeAmountToken": "300000000000000000",
          "minSrcSwapOut": "98903895500000000000",
          "providerFeeUSD": 0.35,
          "protocolFeeUSD": 0.3,
          "railPluginId": "0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc",
          "railData": "0x0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000ce8cca271ebc0533920c83d39f417ed6a0abb7d00000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a800000000000000000000000000000000000000000",
          "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapDataSrc": "0x",
          "swapDataDst": "0x",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      }
    ],
    "bestOfferId": "0x1e27e6b5229ca5e12a62636065735b252f665e4fcbedbf57f010fdbb7827209f"
  },
  "quote": {
    "intentId": "0x1e27e6b5229ca5e12a62636065735b252f665e4fcbedbf57f010fdbb7827209f",
    "srcChainId": 10,
    "dstChainId": 42161,
    "tokenIn": "0x4200000000000000000000000000000000000042",
    "tokenOut": "0x912ce59144191c1204e64559fe8253a0e49e6548",
    "amountIn": "100000000000000000000",
    "estimatedOut": "99102697300000000000",
    "minAmountOut": "99003594602700000000",
    "minSrcSwapOut": "98903895500000000000",
    "feeAmountUSD": 0.3,
    "feeAmountToken": "300000000000000000",
    "rail": "CCTP",
    "railType": "messaging",
    "settlementToken": "USDC",
    "settlementAssetId": "0xc9e6c698b6a822819702171c2ca95ee8e0bd8b87d4d4954b42a3ef3815a80042",
    "expectedDstSettlementToken": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    "expectedDstSettlementAssetId": "0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94",
    "minSettlementAmount": "99301499100000000000",
    "dstGasLimit": 200000,
    "etaSeconds": 1200,
    "expiresAt": 1778844201,
    "railPluginId": "0xb148ea5f936a28661e11743b1650193f1b14a2322b9541503bf6815a84a1a6e9",
    "railData": "0x",
    "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
    "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
    "swapDataSrc": "0x",
    "swapDataDst": "0x",
    "nativeDstAddress": "undefined",
    "routeAsset": {
      "canonicalAssetId": "USDC",
      "providerAssetId": "CCTP:10:usdc",
      "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      "decimals": 6,
      "assetKind": "erc20",
      "assetStandard": "erc20"
    }
  }
}
-----


curl -s http://localhost:8787/api/v1/quote \
   -H 'accept: application/json' \
   -H 'Content-Type: application/json' \
   -d '{
     "tokenIn": "0x1b896893dfc86bb67cf57767298b9073d2c1ba2c",
     "tokenOut": "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
     "amountIn": "200000000000000000000",
     "srcChainId": 42161,
     "dstChainId": 10,
     "userAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9"
   }' | jq
{
  "offerSet": {
    "offerSetId": "0x1981323a44f181e82aa510339b2dec0f9e4384af7409c41e867a916ac1869d50",
    "expiresAt": 1778852648,
    "offers": [
      {
        "offerId": "0xc5b05390c70cc20e061b24b82fea53b73142bd6a6b2bc45f32a1faa0cce621ef",
        "rail": "CCTP",
        "offerType": "cctp_standard",
        "railType": "messaging",
        "srcChainId": 42161,
        "dstChainId": 10,
        "tokenIn": "0x1b896893dfc86bb67cf57767298b9073d2c1ba2c",
        "tokenOut": "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
        "amountIn": "200000000000000000000",
        "estimatedOut": "297955997",
        "minAmountOut": "297658041",
        "expiresAt": 1778852648,
        "deliveryShape": "src_swap_required",
        "executionMode": "router_intent",
        "routeAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:42161:usdc",
          "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:42161:usdc",
          "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:42161:usdc",
          "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "economics": {
          "providerFeeUSD": 0,
          "protocolFeeUSD": 0.6,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 1200,
          "outboundFeeUSD": 0
        },
        "execution": {
          "quote": {
            "intentId": "0xc5b05390c70cc20e061b24b82fea53b73142bd6a6b2bc45f32a1faa0cce621ef",
            "srcChainId": 42161,
            "dstChainId": 10,
            "tokenIn": "0x1b896893dfc86bb67cf57767298b9073d2c1ba2c",
            "tokenOut": "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
            "amountIn": "200000000000000000000",
            "estimatedOut": "297955997",
            "minAmountOut": "297658041",
            "minSrcSwapOut": "296466217",
            "feeAmountUSD": 0.6,
            "feeAmountToken": "600000000000000000",
            "rail": "CCTP",
            "railType": "messaging",
            "settlementToken": "USDC",
            "settlementAssetId": "0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94",
            "expectedDstSettlementToken": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
            "expectedDstSettlementAssetId": "0xc9e6c698b6a822819702171c2ca95ee8e0bd8b87d4d4954b42a3ef3815a80042",
            "minSettlementAmount": "297658041",
            "dstGasLimit": 200000,
            "etaSeconds": 1200,
            "expiresAt": 1778852648,
            "railPluginId": "0xb148ea5f936a28661e11743b1650193f1b14a2322b9541503bf6815a84a1a6e9",
            "railData": "0x",
            "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapDataSrc": "0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000acf3b1b8894e400000000000000000000000000000000000000000000000000000000000011c2729d0000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000030000000000000000000000001b896893dfc86bb67cf57767298b9073d2c1ba2c00000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab1000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e58310000000000000000000000000000000000000000000000000000000000000002000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d7000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d7",
            "swapDataDst": "0x",
            "nativeDstAddress": "undefined",
            "routeAsset": {
              "canonicalAssetId": "USDC",
              "providerAssetId": "CCTP:42161:usdc",
              "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
              "decimals": 6,
              "assetKind": "erc20",
              "assetStandard": "erc20"
            }
          },
          "feeAmountToken": "600000000000000000",
          "minSrcSwapOut": "296466217",
          "providerFeeUSD": 0,
          "protocolFeeUSD": 0.6,
          "railPluginId": "0xb148ea5f936a28661e11743b1650193f1b14a2322b9541503bf6815a84a1a6e9",
          "railData": "0x",
          "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
          "swapDataSrc": "0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000acf3b1b8894e400000000000000000000000000000000000000000000000000000000000011c2729d0000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000030000000000000000000000001b896893dfc86bb67cf57767298b9073d2c1ba2c00000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab1000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e58310000000000000000000000000000000000000000000000000000000000000002000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d7000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d7",
          "swapDataDst": "0x",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      },
      {
        "offerId": "0x8dbf5d6b2680d2e2b51d01e7498e0622095220cd0eb9d04c86957244b59eb8c3",
        "rail": "LAYERZERO",
        "offerType": "lz_stargate_pool",
        "railType": "messaging",
        "srcChainId": 42161,
        "dstChainId": 10,
        "tokenIn": "0x1b896893dfc86bb67cf57767298b9073d2c1ba2c",
        "tokenOut": "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
        "amountIn": "200000000000000000000",
        "estimatedOut": "297955997",
        "minAmountOut": "297658041",
        "expiresAt": 1778852648,
        "deliveryShape": "src_swap_required",
        "executionMode": "router_intent",
        "routeAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "economics": {
          "providerFeeUSD": 0.35,
          "protocolFeeUSD": 0.6,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 300
        },
        "execution": {
          "quote": {
            "intentId": "0x8dbf5d6b2680d2e2b51d01e7498e0622095220cd0eb9d04c86957244b59eb8c3",
            "srcChainId": 42161,
            "dstChainId": 10,
            "tokenIn": "0x1b896893dfc86bb67cf57767298b9073d2c1ba2c",
            "tokenOut": "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
            "amountIn": "200000000000000000000",
            "estimatedOut": "297955997",
            "minAmountOut": "297658041",
            "minSrcSwapOut": "296466217",
            "feeAmountUSD": 0.6,
            "feeAmountToken": "600000000000000000",
            "rail": "LAYERZERO",
            "railType": "messaging",
            "settlementToken": "USDC",
            "settlementAssetId": "0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94",
            "expectedDstSettlementToken": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
            "expectedDstSettlementAssetId": "0xc9e6c698b6a822819702171c2ca95ee8e0bd8b87d4d4954b42a3ef3815a80042",
            "minSettlementAmount": "297658041",
            "dstGasLimit": 240000,
            "etaSeconds": 300,
            "expiresAt": 1778852648,
            "railPluginId": "0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc",
            "railData": "0x0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000e8cdf27acd73a434d661c84887215f7598e7d0d30000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a800000000000000000000000000000000000000000",
            "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapDataSrc": "0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000acf3b1b8894e400000000000000000000000000000000000000000000000000000000000011c2729d0000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000030000000000000000000000001b896893dfc86bb67cf57767298b9073d2c1ba2c00000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab1000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e58310000000000000000000000000000000000000000000000000000000000000002000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d7000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d7",
            "swapDataDst": "0x",
            "nativeDstAddress": "undefined",
            "routeAsset": {
              "canonicalAssetId": "USDC",
              "providerAssetId": "layerzero:usdc",
              "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
              "decimals": 6,
              "assetKind": "erc20",
              "assetStandard": "stargate_pool"
            }
          },
          "feeAmountToken": "600000000000000000",
          "minSrcSwapOut": "296466217",
          "providerFeeUSD": 0.35,
          "protocolFeeUSD": 0.6,
          "railPluginId": "0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc",
          "railData": "0x0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000e8cdf27acd73a434d661c84887215f7598e7d0d30000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a800000000000000000000000000000000000000000",
          "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
          "swapDataSrc": "0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000acf3b1b8894e400000000000000000000000000000000000000000000000000000000000011c2729d0000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000030000000000000000000000001b896893dfc86bb67cf57767298b9073d2c1ba2c00000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab1000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e58310000000000000000000000000000000000000000000000000000000000000002000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d7000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d7",
          "swapDataDst": "0x",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      }
    ],
    "bestOfferId": "0xc5b05390c70cc20e061b24b82fea53b73142bd6a6b2bc45f32a1faa0cce621ef"
  },
  "quote": {
    "intentId": "0xc5b05390c70cc20e061b24b82fea53b73142bd6a6b2bc45f32a1faa0cce621ef",
    "srcChainId": 42161,
    "dstChainId": 10,
    "tokenIn": "0x1b896893dfc86bb67cf57767298b9073d2c1ba2c",
    "tokenOut": "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
    "amountIn": "200000000000000000000",
    "estimatedOut": "297955997",
    "minAmountOut": "297658041",
    "minSrcSwapOut": "296466217",
    "feeAmountUSD": 0.6,
    "feeAmountToken": "600000000000000000",
    "rail": "CCTP",
    "railType": "messaging",
    "settlementToken": "USDC",
    "settlementAssetId": "0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94",
    "expectedDstSettlementToken": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    "expectedDstSettlementAssetId": "0xc9e6c698b6a822819702171c2ca95ee8e0bd8b87d4d4954b42a3ef3815a80042",
    "minSettlementAmount": "297658041",
    "dstGasLimit": 200000,
    "etaSeconds": 1200,
    "expiresAt": 1778852648,
    "railPluginId": "0xb148ea5f936a28661e11743b1650193f1b14a2322b9541503bf6815a84a1a6e9",
    "railData": "0x",
    "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
    "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "swapDataSrc": "0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000acf3b1b8894e400000000000000000000000000000000000000000000000000000000000011c2729d0000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000030000000000000000000000001b896893dfc86bb67cf57767298b9073d2c1ba2c00000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab1000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e58310000000000000000000000000000000000000000000000000000000000000002000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d7000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d7",
    "swapDataDst": "0x",
    "nativeDstAddress": "undefined",
    "routeAsset": {
      "canonicalAssetId": "USDC",
      "providerAssetId": "CCTP:42161:usdc",
      "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      "decimals": 6,
      "assetKind": "erc20",
      "assetStandard": "erc20"
    }
  }
}
----------------------------------
curl -X 'POST' \
  'http://localhost:8787/api/v1/quote' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "tokenIn": "0x1b896893dfc86bb67cf57767298b9073d2c1ba2c",
  "tokenOut": "0x4200000000000000000000000000000000000042",
  "amountIn": "200000000000000000000",
  "srcChainId": 42161,
  "dstChainId": 10,
  "userAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9"
}'

{
  "offerSet": {
    "offerSetId": "0x4e3e72de7c0e80c49be53534306e03b70992e17dfaa0b2b907855debee7013b1",
    "expiresAt": 1778852936,
    "offers": [
      {
        "offerId": "0x01e6b4be3ab5cc4354f63d5147ddb3263eb423b929de6a7e2437c2596c491989",
        "rail": "CCTP",
        "offerType": "cctp_standard",
        "railType": "messaging",
        "srcChainId": 42161,
        "dstChainId": 10,
        "tokenIn": "0x1b896893dfc86bb67cf57767298b9073d2c1ba2c",
        "tokenOut": "0x4200000000000000000000000000000000000042",
        "amountIn": "200000000000000000000",
        "estimatedOut": "2164597642364630257211",
        "minAmountOut": "2162433044722265626953",
        "expiresAt": 1778852936,
        "deliveryShape": "src_and_dst_swap_required",
        "executionMode": "router_intent",
        "routeAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:42161:usdc",
          "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:42161:usdc",
          "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:42161:usdc",
          "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "economics": {
          "providerFeeUSD": 0,
          "protocolFeeUSD": 0.6,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 1200,
          "outboundFeeUSD": 0
        },
        "execution": {
          "quote": {
            "intentId": "0x01e6b4be3ab5cc4354f63d5147ddb3263eb423b929de6a7e2437c2596c491989",
            "srcChainId": 42161,
            "dstChainId": 10,
            "tokenIn": "0x1b896893dfc86bb67cf57767298b9073d2c1ba2c",
            "tokenOut": "0x4200000000000000000000000000000000000042",
            "amountIn": "200000000000000000000",
            "estimatedOut": "2164597642364630257211",
            "minAmountOut": "2162433044722265626953",
            "minSrcSwapOut": "295746052",
            "feeAmountUSD": 0.6,
            "feeAmountToken": "600000000000000000",
            "rail": "CCTP",
            "railType": "messaging",
            "settlementToken": "USDC",
            "settlementAssetId": "0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94",
            "expectedDstSettlementToken": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
            "expectedDstSettlementAssetId": "0xc9e6c698b6a822819702171c2ca95ee8e0bd8b87d4d4954b42a3ef3815a80042",
            "minSettlementAmount": "296934981",
            "dstGasLimit": 200000,
            "etaSeconds": 1200,
            "expiresAt": 1778852936,
            "railPluginId": "0xb148ea5f936a28661e11743b1650193f1b14a2322b9541503bf6815a84a1a6e9",
            "railData": "0x",
            "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapDataSrc": "0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000acf3b1b8894e400000000000000000000000000000000000000000000000000000000000011b767560000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000030000000000000000000000001b896893dfc86bb67cf57767298b9073d2c1ba2c00000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab1000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e58310000000000000000000000000000000000000000000000000000000000000002000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d7000000000000000000000000a91d8284c199fe4c178d76558a1427790af7e80f",
            "swapDataDst": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000011b7675600000000000000000000000000000000000000000000007557d3a73367d2ce3b0000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000030000000000000000000000000b2c639c533813f4aa9d7837caf62653d097ff850000000000000000000000004200000000000000000000000000000000000006000000000000000000000000420000000000000000000000000000000000004200000000000000000000000000000000000000000000000000000000000000020000000000000000000000009293cb3dec942c9f0a76d1c9131d923d2713a1f60000000000000000000000009293cb3dec942c9f0a76d1c9131d923d2713a1f6",
            "nativeDstAddress": "undefined",
            "routeAsset": {
              "canonicalAssetId": "USDC",
              "providerAssetId": "CCTP:42161:usdc",
              "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
              "decimals": 6,
              "assetKind": "erc20",
              "assetStandard": "erc20"
            }
          },
          "feeAmountToken": "600000000000000000",
          "minSrcSwapOut": "295746052",
          "providerFeeUSD": 0,
          "protocolFeeUSD": 0.6,
          "railPluginId": "0xb148ea5f936a28661e11743b1650193f1b14a2322b9541503bf6815a84a1a6e9",
          "railData": "0x",
          "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapDataSrc": "0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000acf3b1b8894e400000000000000000000000000000000000000000000000000000000000011b767560000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000030000000000000000000000001b896893dfc86bb67cf57767298b9073d2c1ba2c00000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab1000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e58310000000000000000000000000000000000000000000000000000000000000002000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d7000000000000000000000000a91d8284c199fe4c178d76558a1427790af7e80f",
          "swapDataDst": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000011b7675600000000000000000000000000000000000000000000007557d3a73367d2ce3b0000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000030000000000000000000000000b2c639c533813f4aa9d7837caf62653d097ff850000000000000000000000004200000000000000000000000000000000000006000000000000000000000000420000000000000000000000000000000000004200000000000000000000000000000000000000000000000000000000000000020000000000000000000000009293cb3dec942c9f0a76d1c9131d923d2713a1f60000000000000000000000009293cb3dec942c9f0a76d1c9131d923d2713a1f6",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      },
      {
        "offerId": "0xbcba817ac0185ad27a65c15b851af0b7bd594485362706c49597377d4f4f401a",
        "rail": "LAYERZERO",
        "offerType": "lz_stargate_pool",
        "railType": "messaging",
        "srcChainId": 42161,
        "dstChainId": 10,
        "tokenIn": "0x1b896893dfc86bb67cf57767298b9073d2c1ba2c",
        "tokenOut": "0x4200000000000000000000000000000000000042",
        "amountIn": "200000000000000000000",
        "estimatedOut": "2164597642364630257211",
        "minAmountOut": "2162433044722265626953",
        "expiresAt": 1778852936,
        "deliveryShape": "src_and_dst_swap_required",
        "executionMode": "router_intent",
        "routeAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "economics": {
          "providerFeeUSD": 0.35,
          "protocolFeeUSD": 0.6,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 300
        },
        "execution": {
          "quote": {
            "intentId": "0xbcba817ac0185ad27a65c15b851af0b7bd594485362706c49597377d4f4f401a",
            "srcChainId": 42161,
            "dstChainId": 10,
            "tokenIn": "0x1b896893dfc86bb67cf57767298b9073d2c1ba2c",
            "tokenOut": "0x4200000000000000000000000000000000000042",
            "amountIn": "200000000000000000000",
            "estimatedOut": "2164597642364630257211",
            "minAmountOut": "2162433044722265626953",
            "minSrcSwapOut": "295746052",
            "feeAmountUSD": 0.6,
            "feeAmountToken": "600000000000000000",
            "rail": "LAYERZERO",
            "railType": "messaging",
            "settlementToken": "USDC",
            "settlementAssetId": "0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94",
            "expectedDstSettlementToken": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
            "expectedDstSettlementAssetId": "0xc9e6c698b6a822819702171c2ca95ee8e0bd8b87d4d4954b42a3ef3815a80042",
            "minSettlementAmount": "296934981",
            "dstGasLimit": 240000,
            "etaSeconds": 300,
            "expiresAt": 1778852936,
            "railPluginId": "0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc",
            "railData": "0x0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000e8cdf27acd73a434d661c84887215f7598e7d0d30000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a800000000000000000000000000000000000000000",
            "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapDataSrc": "0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000acf3b1b8894e400000000000000000000000000000000000000000000000000000000000011b767560000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000030000000000000000000000001b896893dfc86bb67cf57767298b9073d2c1ba2c00000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab1000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e58310000000000000000000000000000000000000000000000000000000000000002000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d7000000000000000000000000a91d8284c199fe4c178d76558a1427790af7e80f",
            "swapDataDst": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000011b7675600000000000000000000000000000000000000000000007557d3a73367d2ce3b0000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000030000000000000000000000000b2c639c533813f4aa9d7837caf62653d097ff850000000000000000000000004200000000000000000000000000000000000006000000000000000000000000420000000000000000000000000000000000004200000000000000000000000000000000000000000000000000000000000000020000000000000000000000009293cb3dec942c9f0a76d1c9131d923d2713a1f60000000000000000000000009293cb3dec942c9f0a76d1c9131d923d2713a1f6",
            "nativeDstAddress": "undefined",
            "routeAsset": {
              "canonicalAssetId": "USDC",
              "providerAssetId": "layerzero:usdc",
              "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
              "decimals": 6,
              "assetKind": "erc20",
              "assetStandard": "stargate_pool"
            }
          },
          "feeAmountToken": "600000000000000000",
          "minSrcSwapOut": "295746052",
          "providerFeeUSD": 0.35,
          "protocolFeeUSD": 0.6,
          "railPluginId": "0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc",
          "railData": "0x0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000e8cdf27acd73a434d661c84887215f7598e7d0d30000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a800000000000000000000000000000000000000000",
          "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapDataSrc": "0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000acf3b1b8894e400000000000000000000000000000000000000000000000000000000000011b767560000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000030000000000000000000000001b896893dfc86bb67cf57767298b9073d2c1ba2c00000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab1000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e58310000000000000000000000000000000000000000000000000000000000000002000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d7000000000000000000000000a91d8284c199fe4c178d76558a1427790af7e80f",
          "swapDataDst": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000011b7675600000000000000000000000000000000000000000000007557d3a73367d2ce3b0000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000030000000000000000000000000b2c639c533813f4aa9d7837caf62653d097ff850000000000000000000000004200000000000000000000000000000000000006000000000000000000000000420000000000000000000000000000000000004200000000000000000000000000000000000000000000000000000000000000020000000000000000000000009293cb3dec942c9f0a76d1c9131d923d2713a1f60000000000000000000000009293cb3dec942c9f0a76d1c9131d923d2713a1f6",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      }
    ],
    "bestOfferId": "0x01e6b4be3ab5cc4354f63d5147ddb3263eb423b929de6a7e2437c2596c491989"
  },
  "quote": {
    "intentId": "0x01e6b4be3ab5cc4354f63d5147ddb3263eb423b929de6a7e2437c2596c491989",
    "srcChainId": 42161,
    "dstChainId": 10,
    "tokenIn": "0x1b896893dfc86bb67cf57767298b9073d2c1ba2c",
    "tokenOut": "0x4200000000000000000000000000000000000042",
    "amountIn": "200000000000000000000",
    "estimatedOut": "2164597642364630257211",
    "minAmountOut": "2162433044722265626953",
    "minSrcSwapOut": "295746052",
    "feeAmountUSD": 0.6,
    "feeAmountToken": "600000000000000000",
    "rail": "CCTP",
    "railType": "messaging",
    "settlementToken": "USDC",
    "settlementAssetId": "0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94",
    "expectedDstSettlementToken": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    "expectedDstSettlementAssetId": "0xc9e6c698b6a822819702171c2ca95ee8e0bd8b87d4d4954b42a3ef3815a80042",
    "minSettlementAmount": "296934981",
    "dstGasLimit": 200000,
    "etaSeconds": 1200,
    "expiresAt": 1778852936,
    "railPluginId": "0xb148ea5f936a28661e11743b1650193f1b14a2322b9541503bf6815a84a1a6e9",
    "railData": "0x",
    "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
    "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
    "swapDataSrc": "0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000acf3b1b8894e400000000000000000000000000000000000000000000000000000000000011b767560000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000030000000000000000000000001b896893dfc86bb67cf57767298b9073d2c1ba2c00000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab1000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e58310000000000000000000000000000000000000000000000000000000000000002000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d7000000000000000000000000a91d8284c199fe4c178d76558a1427790af7e80f",
    "swapDataDst": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000011b7675600000000000000000000000000000000000000000000007557d3a73367d2ce3b0000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000030000000000000000000000000b2c639c533813f4aa9d7837caf62653d097ff850000000000000000000000004200000000000000000000000000000000000006000000000000000000000000420000000000000000000000000000000000004200000000000000000000000000000000000000000000000000000000000000020000000000000000000000009293cb3dec942c9f0a76d1c9131d923d2713a1f60000000000000000000000009293cb3dec942c9f0a76d1c9131d923d2713a1f6",
    "nativeDstAddress": "undefined",
    "routeAsset": {
      "canonicalAssetId": "USDC",
      "providerAssetId": "CCTP:42161:usdc",
      "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      "decimals": 6,
      "assetKind": "erc20",
      "assetStandard": "erc20"
    }
  }
}

-------------------------------------------------------------------------------

curl -X 'POST' \
  'http://localhost:8787/api/v1/quote' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "tokenIn": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  "tokenOut": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  "amountIn": "100000000",
  "srcChainId": 10,
  "dstChainId": 42161,
  "userAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
  "urgency": "fast"
}'

{
  "offerSet": {
    "offerSetId": "0x4252afcb6b50458474d782b89ccef0b2af414b6620c60b4fd0a134d456eef96b",
    "expiresAt": 1778865856,
    "offers": [
      {
        "offerId": "0x34b2f4fa86a1a89eb6b8ea939403284f040197c5c50ac04e0967462d6b0a0969",
        "rail": "CCTP",
        "offerType": "cctp_fast",
        "railType": "messaging",
        "srcChainId": 10,
        "dstChainId": 42161,
        "tokenIn": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
        "tokenOut": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        "amountIn": "100000000",
        "estimatedOut": "99680060",
        "minAmountOut": "99580379",
        "expiresAt": 1778865856,
        "deliveryShape": "direct",
        "executionMode": "router_intent",
        "routeAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:10:usdc",
          "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:10:usdc",
          "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:10:usdc",
          "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "economics": {
          "providerFeeUSD": 0.01994,
          "protocolFeeUSD": 0.3,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 8,
          "outboundFeeUSD": 0.01994
        },
        "execution": {
          "quote": {
            "intentId": "0x34b2f4fa86a1a89eb6b8ea939403284f040197c5c50ac04e0967462d6b0a0969",
            "srcChainId": 10,
            "dstChainId": 42161,
            "tokenIn": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
            "tokenOut": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            "amountIn": "100000000",
            "estimatedOut": "99680060",
            "minAmountOut": "99580379",
            "minSrcSwapOut": "0",
            "feeAmountUSD": 0.3,
            "feeAmountToken": "300000",
            "rail": "CCTP",
            "railType": "messaging",
            "settlementToken": "USDC",
            "settlementAssetId": "0xc9e6c698b6a822819702171c2ca95ee8e0bd8b87d4d4954b42a3ef3815a80042",
            "expectedDstSettlementToken": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            "expectedDstSettlementAssetId": "0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94",
            "minSettlementAmount": "99580379",
            "dstGasLimit": 200000,
            "etaSeconds": 8,
            "expiresAt": 1778865856,
            "railPluginId": "0x9181644edfd36b07ccd623494a3681a4a6b9cd5d52611accda20264cd09259ac",
            "railData": "0x00000000000000000000000000000000000000000000000000000000000003e80000000000000000000000000000000000000000000000000000000000009bc8",
            "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapDataSrc": "0x",
            "swapDataDst": "0x",
            "nativeDstAddress": "undefined",
            "routeAsset": {
              "canonicalAssetId": "USDC",
              "providerAssetId": "CCTP:10:usdc",
              "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
              "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
              "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              "decimals": 6,
              "assetKind": "erc20",
              "assetStandard": "erc20"
            }
          },
          "feeAmountToken": "300000",
          "minSrcSwapOut": "0",
          "providerFeeUSD": 0.01994,
          "protocolFeeUSD": 0.3,
          "railPluginId": "0x9181644edfd36b07ccd623494a3681a4a6b9cd5d52611accda20264cd09259ac",
          "railData": "0x00000000000000000000000000000000000000000000000000000000000003e80000000000000000000000000000000000000000000000000000000000009bc8",
          "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
          "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
          "swapDataSrc": "0x",
          "swapDataDst": "0x",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      },
      {
        "offerId": "0x64330bb3f986336bc825159ecd63666e4eef42612eccd08bce28a283999d13ca",
        "rail": "LAYERZERO",
        "offerType": "lz_stargate_pool",
        "railType": "messaging",
        "srcChainId": 10,
        "dstChainId": 42161,
        "tokenIn": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
        "tokenOut": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        "amountIn": "100000000",
        "estimatedOut": "99700000",
        "minAmountOut": "99600300",
        "expiresAt": 1778865856,
        "deliveryShape": "direct",
        "executionMode": "router_intent",
        "routeAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "economics": {
          "providerFeeUSD": 0.35,
          "protocolFeeUSD": 0.3,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 300
        },
        "execution": {
          "quote": {
            "intentId": "0x64330bb3f986336bc825159ecd63666e4eef42612eccd08bce28a283999d13ca",
            "srcChainId": 10,
            "dstChainId": 42161,
            "tokenIn": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
            "tokenOut": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            "amountIn": "100000000",
            "estimatedOut": "99700000",
            "minAmountOut": "99600300",
            "minSrcSwapOut": "0",
            "feeAmountUSD": 0.3,
            "feeAmountToken": "300000",
            "rail": "LAYERZERO",
            "railType": "messaging",
            "settlementToken": "USDC",
            "settlementAssetId": "0xc9e6c698b6a822819702171c2ca95ee8e0bd8b87d4d4954b42a3ef3815a80042",
            "expectedDstSettlementToken": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            "expectedDstSettlementAssetId": "0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94",
            "minSettlementAmount": "99600300",
            "dstGasLimit": 240000,
            "etaSeconds": 300,
            "expiresAt": 1778865856,
            "railPluginId": "0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc",
            "railData": "0x0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000ce8cca271ebc0533920c83d39f417ed6a0abb7d00000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a800000000000000000000000000000000000000000",
            "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapDataSrc": "0x",
            "swapDataDst": "0x",
            "nativeDstAddress": "undefined",
            "routeAsset": {
              "canonicalAssetId": "USDC",
              "providerAssetId": "layerzero:usdc",
              "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
              "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
              "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              "decimals": 6,
              "assetKind": "erc20",
              "assetStandard": "stargate_pool"
            }
          },
          "feeAmountToken": "300000",
          "minSrcSwapOut": "0",
          "providerFeeUSD": 0.35,
          "protocolFeeUSD": 0.3,
          "railPluginId": "0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc",
          "railData": "0x0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000ce8cca271ebc0533920c83d39f417ed6a0abb7d00000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a800000000000000000000000000000000000000000",
          "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
          "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
          "swapDataSrc": "0x",
          "swapDataDst": "0x",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      },
      {
        "offerId": "0xbbd5d0008b28bb256c3eeb2056f7de70e99dcee8e4ff0aedc3502ebf437ac24e",
        "rail": "LAYERZERO",
        "offerType": "lz_api_direct",
        "railType": "messaging",
        "srcChainId": 10,
        "dstChainId": 42161,
        "tokenIn": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
        "tokenOut": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        "amountIn": "100000000",
        "estimatedOut": "99967699",
        "minAmountOut": "98968022",
        "expiresAt": 1778865857,
        "deliveryShape": "direct",
        "executionMode": "provider_direct",
        "routeAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero-api:optimism:0x0b2c639c533813f4aa9d7837caf62653d097ff85",
          "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero-api:optimism:0x0b2c639c533813f4aa9d7837caf62653d097ff85",
          "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero-api:arbitrum:0xaf88d065e77c8cc2239327c5edb3a432268e5831",
          "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "economics": {
          "providerFeeUSD": 0.03229297,
          "protocolFeeUSD": 0,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 61
        },
        "execution": {
          "provider": "layerzero_value_transfer_api",
          "quote": {
            "intentId": "0xbbd5d0008b28bb256c3eeb2056f7de70e99dcee8e4ff0aedc3502ebf437ac24e",
            "srcChainId": 10,
            "dstChainId": 42161,
            "tokenIn": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
            "tokenOut": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            "amountIn": "100000000",
            "estimatedOut": "99967699",
            "minAmountOut": "98968022",
            "minSrcSwapOut": "0",
            "feeAmountUSD": 0.03229297,
            "feeAmountToken": "0",
            "rail": "LAYERZERO",
            "railType": "messaging",
            "settlementToken": "USDC",
            "routeAsset": {
              "canonicalAssetId": "USDC",
              "providerAssetId": "layerzero-api:optimism:0x0b2c639c533813f4aa9d7837caf62653d097ff85",
              "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
              "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
              "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
              "decimals": 6,
              "assetKind": "erc20",
              "assetStandard": "erc20"
            },
            "settlementAssetId": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "expectedDstSettlementToken": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            "expectedDstSettlementAssetId": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "minSettlementAmount": "98968022",
            "dstGasLimit": 0,
            "etaSeconds": 61,
            "expiresAt": 1778865857,
            "railPluginId": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "railData": "0x",
            "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapDataSrc": "0x",
            "swapDataDst": "0x",
            "nativeDstAddress": "undefined",
            "layerZeroValueTransferApiQuoteId": "0x00000000000000000000000000000000019e2ca90e09765292f67a283e05ec22",
            "layerZeroValueTransferApiRouteSteps": [
              {
                "type": "STARGATE_V2_TAXI",
                "srcChainKey": "optimism",
                "description": "Stargate"
              }
            ],
            "layerZeroValueTransferApiUserSteps": [
              {
                "type": "TRANSACTION",
                "description": "approve",
                "chainKey": "optimism",
                "chainType": "EVM",
                "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
                "transaction": {
                  "encoded": {
                    "chainId": 10,
                    "data": "0x095ea7b3000000000000000000000000fbea79d13e6f795a0e1e4b99090f1165a01c7b030000000000000000000000000000000000000000000000000000000005f5e100",
                    "from": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                    "to": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85"
                  }
                }
              },
              {
                "type": "TRANSACTION",
                "description": "bridge",
                "chainKey": "optimism",
                "chainType": "EVM",
                "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
                "transaction": {
                  "encoded": {
                    "chainId": 10,
                    "data": "0x571d3dc7000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000019e2ca90e09765292f67a283e05ec220000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000002800000000000000000000000000000000000000000000000000000000000000500000000000000000000000000fbea79d13e6f795a0e1e4b99090f1165a01c7b03000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000084eac6f3fe0000000000000000000000000b2c639c533813f4aa9d7837caf62653d097ff8500000000000000000000000005f8cc8753d90d67dbb8c02118440b8283f941c90000000000000000000000005528cf58feb8fbfce94f43b33240fffb1312bde30000000000000000000000000000000000000000000000000000000005f5e100000000000000000000000000000000000000000000000000000000000000000000000000000000000b2c639c533813f4aa9d7837caf62653d097ff85000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000044095ea7b3000000000000000000000000ce8cca271ebc0533920c83d39f417ed6a0abb7d00000000000000000000000000000000000000000000000000000000005f5e10000000000000000000000000000000000000000000000000000000000000000000000000000000000ce8cca271ebc0533920c83d39f417ed6a0abb7d000000000000000000000000000000000000000000000000000002d53162e136e000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001e4c7c7f5b3000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000002d53162e136e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000005528cf58feb8fbfce94f43b33240fffb1312bde3000000000000000000000000000000000000000000000000000000000000759e00000000000000000000000005f8cc8753d90d67dbb8c02118440b8283f941c90000000000000000000000000000000000000000000000000000000005f5e1000000000000000000000000000000000000000000000000000000000005e621d600000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000002000300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005528cf58feb8fbfce94f43b33240fffb1312bde30000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a4d20c88bd000000000000000000000000000000000000000000000000000000000000004000000000000000000000000005f8cc8753d90d67dbb8c02118440b8283f941c900000000000000000000000000000000000000000000000000000000000000020000000000000000000000000b2c639c533813f4aa9d7837caf62653d097ff85000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
                    "from": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
                    "to": "0x5528Cf58fEB8fbfcE94f43B33240FFFB1312bDe3",
                    "value": "49834877653870"
                  }
                }
              }
            ]
          },
          "layerZeroValueTransferApiQuoteId": "0x00000000000000000000000000000000019e2ca90e09765292f67a283e05ec22",
          "layerZeroValueTransferApiQuote": {
            "id": "0x00000000000000000000000000000000019e2ca90e09765292f67a283e05ec22",
            "routeSteps": [
              {
                "type": "STARGATE_V2_TAXI",
                "srcChainKey": "optimism",
                "description": "Stargate"
              }
            ],
            "fees": [
              {
                "chainKey": "optimism",
                "type": "MESSAGE",
                "description": "",
                "amount": "49834877653870",
                "address": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
              }
            ],
            "duration": {
              "estimated": "60300"
            },
            "feeUsd": "0.03229297",
            "feePercent": "0.00032301",
            "srcAmount": "100000000",
            "dstAmount": "99967699",
            "dstAmountMin": "98968022",
            "srcAmountUsd": "99.97514400",
            "dstAmountUsd": "99.94285103",
            "userSteps": [
              {
                "type": "TRANSACTION",
                "description": "approve",
                "chainKey": "optimism",
                "chainType": "EVM",
                "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
                "transaction": {
                  "encoded": {
                    "chainId": 10,
                    "data": "0x095ea7b3000000000000000000000000fbea79d13e6f795a0e1e4b99090f1165a01c7b030000000000000000000000000000000000000000000000000000000005f5e100",
                    "from": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                    "to": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85"
                  }
                }
              },
              {
                "type": "TRANSACTION",
                "description": "bridge",
                "chainKey": "optimism",
                "chainType": "EVM",
                "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
                "transaction": {
                  "encoded": {
                    "chainId": 10,
                    "data": "0x571d3dc7000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000019e2ca90e09765292f67a283e05ec220000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000002800000000000000000000000000000000000000000000000000000000000000500000000000000000000000000fbea79d13e6f795a0e1e4b99090f1165a01c7b03000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000084eac6f3fe0000000000000000000000000b2c639c533813f4aa9d7837caf62653d097ff8500000000000000000000000005f8cc8753d90d67dbb8c02118440b8283f941c90000000000000000000000005528cf58feb8fbfce94f43b33240fffb1312bde30000000000000000000000000000000000000000000000000000000005f5e100000000000000000000000000000000000000000000000000000000000000000000000000000000000b2c639c533813f4aa9d7837caf62653d097ff85000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000044095ea7b3000000000000000000000000ce8cca271ebc0533920c83d39f417ed6a0abb7d00000000000000000000000000000000000000000000000000000000005f5e10000000000000000000000000000000000000000000000000000000000000000000000000000000000ce8cca271ebc0533920c83d39f417ed6a0abb7d000000000000000000000000000000000000000000000000000002d53162e136e000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001e4c7c7f5b3000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000002d53162e136e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000005528cf58feb8fbfce94f43b33240fffb1312bde3000000000000000000000000000000000000000000000000000000000000759e00000000000000000000000005f8cc8753d90d67dbb8c02118440b8283f941c90000000000000000000000000000000000000000000000000000000005f5e1000000000000000000000000000000000000000000000000000000000005e621d600000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000002000300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005528cf58feb8fbfce94f43b33240fffb1312bde30000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a4d20c88bd000000000000000000000000000000000000000000000000000000000000004000000000000000000000000005f8cc8753d90d67dbb8c02118440b8283f941c900000000000000000000000000000000000000000000000000000000000000020000000000000000000000000b2c639c533813f4aa9d7837caf62653d097ff85000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
                    "from": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
                    "to": "0x5528Cf58fEB8fbfcE94f43B33240FFFB1312bDe3",
                    "value": "49834877653870"
                  }
                }
              }
            ],
            "options": {
              "dstNativeDropAmount": "0"
            }
          },
          "layerZeroValueTransferApiUserSteps": [
            {
              "type": "TRANSACTION",
              "description": "approve",
              "chainKey": "optimism",
              "chainType": "EVM",
              "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
              "transaction": {
                "encoded": {
                  "chainId": 10,
                  "data": "0x095ea7b3000000000000000000000000fbea79d13e6f795a0e1e4b99090f1165a01c7b030000000000000000000000000000000000000000000000000000000005f5e100",
                  "from": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                  "to": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85"
                }
              }
            },
            {
              "type": "TRANSACTION",
              "description": "bridge",
              "chainKey": "optimism",
              "chainType": "EVM",
              "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
              "transaction": {
                "encoded": {
                  "chainId": 10,
                  "data": "0x571d3dc7000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000019e2ca90e09765292f67a283e05ec220000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000002800000000000000000000000000000000000000000000000000000000000000500000000000000000000000000fbea79d13e6f795a0e1e4b99090f1165a01c7b03000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000084eac6f3fe0000000000000000000000000b2c639c533813f4aa9d7837caf62653d097ff8500000000000000000000000005f8cc8753d90d67dbb8c02118440b8283f941c90000000000000000000000005528cf58feb8fbfce94f43b33240fffb1312bde30000000000000000000000000000000000000000000000000000000005f5e100000000000000000000000000000000000000000000000000000000000000000000000000000000000b2c639c533813f4aa9d7837caf62653d097ff85000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000044095ea7b3000000000000000000000000ce8cca271ebc0533920c83d39f417ed6a0abb7d00000000000000000000000000000000000000000000000000000000005f5e10000000000000000000000000000000000000000000000000000000000000000000000000000000000ce8cca271ebc0533920c83d39f417ed6a0abb7d000000000000000000000000000000000000000000000000000002d53162e136e000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001e4c7c7f5b3000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000002d53162e136e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000005528cf58feb8fbfce94f43b33240fffb1312bde3000000000000000000000000000000000000000000000000000000000000759e00000000000000000000000005f8cc8753d90d67dbb8c02118440b8283f941c90000000000000000000000000000000000000000000000000000000005f5e1000000000000000000000000000000000000000000000000000000000005e621d600000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000002000300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005528cf58feb8fbfce94f43b33240fffb1312bde30000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a4d20c88bd000000000000000000000000000000000000000000000000000000000000004000000000000000000000000005f8cc8753d90d67dbb8c02118440b8283f941c900000000000000000000000000000000000000000000000000000000000000020000000000000000000000000b2c639c533813f4aa9d7837caf62653d097ff85000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
                  "from": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
                  "to": "0x5528Cf58fEB8fbfcE94f43B33240FFFB1312bDe3",
                  "value": "49834877653870"
                }
              }
            }
          ],
          "layerZeroValueTransferApiRouteSteps": [
            {
              "type": "STARGATE_V2_TAXI",
              "srcChainKey": "optimism",
              "description": "Stargate"
            }
          ],
          "feeUsd": 0.03229297
        }
      }
    ],
    "bestOfferId": "0x34b2f4fa86a1a89eb6b8ea939403284f040197c5c50ac04e0967462d6b0a0969"
  }
}