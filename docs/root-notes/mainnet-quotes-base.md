curl -X 'POST' \
  'http://localhost:8787/api/v1/quote' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "tokenIn": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "tokenOut": "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
  "amountIn": "100000000",
  "srcChainId": 8453,
  "dstChainId": 42161,
  "userAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
  "urgency": "fast"
}'

{
  "offerSet": {
    "offerSetId": "0xf8ea5bc1583d77d4c53c130b7670fabb387bb1fcd1a9e2f121a6572fe7e12872",
    "expiresAt": 1779366294,
    "offers": [
      {
        "offerId": "0x29a58f7b62c96daf5b92fa322edf8a3895d9c194a94fe2f07df6f20cc6cc380c",
        "rail": "CCTP",
        "offerType": "cctp_fast",
        "railType": "messaging",
        "srcChainId": 8453,
        "dstChainId": 42161,
        "tokenIn": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "tokenOut": "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
        "amountIn": "100000000",
        "estimatedOut": "99747584",
        "minAmountOut": "99647836",
        "expiresAt": 1779366294,
        "deliveryShape": "dst_swap_required",
        "executionMode": "router_intent",
        "routeAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:8453:usdc",
          "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:8453:usdc",
          "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:8453:usdc",
          "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
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
            "intentId": "0x29a58f7b62c96daf5b92fa322edf8a3895d9c194a94fe2f07df6f20cc6cc380c",
            "srcChainId": 8453,
            "dstChainId": 42161,
            "tokenIn": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "tokenOut": "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
            "amountIn": "100000000",
            "estimatedOut": "99747584",
            "minAmountOut": "99647836",
            "minSrcSwapOut": "0",
            "feeAmountUSD": 0.3,
            "feeAmountToken": "300000",
            "rail": "CCTP",
            "railType": "messaging",
            "settlementToken": "USDC",
            "settlementAssetId": "0xf7135e5fd9158c9cea11c421e7df327b195498f7dacd89fb0de0449e618c4027",
            "expectedDstSettlementToken": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            "expectedDstSettlementAssetId": "0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94",
            "minSettlementAmount": "99580379",
            "dstGasLimit": 200000,
            "etaSeconds": 8,
            "expiresAt": 1779366294,
            "railPluginId": "0x9181644edfd36b07ccd623494a3681a4a6b9cd5d52611accda20264cd09259ac",
            "railData": "0x00000000000000000000000000000000000000000000000000000000000003e80000000000000000000000000000000000000000000000000000000000009bc8",
            "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapDataSrc": "0x",
            "swapDataDst": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000005f0ff3c0000000000000000000000000000000000000000000000000000000005f20700000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e5831000000000000000000000000fd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb900000000000000000000000000000000000000000000000000000000000000010000000000000000000000002cebbe0b2145d6d8a103e91c4fd01b06b9058eda",
            "nativeDstAddress": "undefined",
            "routeAsset": {
              "canonicalAssetId": "USDC",
              "providerAssetId": "CCTP:8453:usdc",
              "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
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
          "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapDataSrc": "0x",
          "swapDataDst": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000005f0ff3c0000000000000000000000000000000000000000000000000000000005f20700000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e5831000000000000000000000000fd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb900000000000000000000000000000000000000000000000000000000000000010000000000000000000000002cebbe0b2145d6d8a103e91c4fd01b06b9058eda",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      },
      {
        "offerId": "0xe8c8b91b3a5a62ea7ef165c3d60d6254e117a2be3fadd7de7377d4d87951117b",
        "rail": "LAYERZERO",
        "offerType": "lz_stargate_pool",
        "railType": "messaging",
        "srcChainId": 8453,
        "dstChainId": 42161,
        "tokenIn": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "tokenOut": "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
        "amountIn": "100000000",
        "estimatedOut": "99767538",
        "minAmountOut": "99667770",
        "expiresAt": 1779366294,
        "deliveryShape": "dst_swap_required",
        "executionMode": "router_intent",
        "routeAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
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
            "intentId": "0xe8c8b91b3a5a62ea7ef165c3d60d6254e117a2be3fadd7de7377d4d87951117b",
            "srcChainId": 8453,
            "dstChainId": 42161,
            "tokenIn": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "tokenOut": "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
            "amountIn": "100000000",
            "estimatedOut": "99767538",
            "minAmountOut": "99667770",
            "minSrcSwapOut": "0",
            "feeAmountUSD": 0.3,
            "feeAmountToken": "300000",
            "rail": "LAYERZERO",
            "railType": "messaging",
            "settlementToken": "USDC",
            "settlementAssetId": "0xf7135e5fd9158c9cea11c421e7df327b195498f7dacd89fb0de0449e618c4027",
            "expectedDstSettlementToken": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            "expectedDstSettlementAssetId": "0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94",
            "minSettlementAmount": "99600300",
            "dstGasLimit": 240000,
            "etaSeconds": 300,
            "expiresAt": 1779366294,
            "railPluginId": "0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc",
            "railData": "0x000000000000000000000000000000000000000000000000000000000000000200000000000000000000000027a16dc786820b16e5c9028b75b99f6f604b5d260000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a800000000000000000000000000000000000000000",
            "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapDataSrc": "0x",
            "swapDataDst": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000005f14d200000000000000000000000000000000000000000000000000000000005f254f2000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e5831000000000000000000000000fd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb900000000000000000000000000000000000000000000000000000000000000010000000000000000000000002cebbe0b2145d6d8a103e91c4fd01b06b9058eda",
            "nativeDstAddress": "undefined",
            "routeAsset": {
              "canonicalAssetId": "USDC",
              "providerAssetId": "layerzero:usdc",
              "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
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
          "railData": "0x000000000000000000000000000000000000000000000000000000000000000200000000000000000000000027a16dc786820b16e5c9028b75b99f6f604b5d260000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a800000000000000000000000000000000000000000",
          "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
          "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapDataSrc": "0x",
          "swapDataDst": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000005f14d200000000000000000000000000000000000000000000000000000000005f254f2000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e5831000000000000000000000000fd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb900000000000000000000000000000000000000000000000000000000000000010000000000000000000000002cebbe0b2145d6d8a103e91c4fd01b06b9058eda",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      }
    ],
    "bestOfferId": "0x29a58f7b62c96daf5b92fa322edf8a3895d9c194a94fe2f07df6f20cc6cc380c"
  },
  "quote": {
    "intentId": "0x29a58f7b62c96daf5b92fa322edf8a3895d9c194a94fe2f07df6f20cc6cc380c",
    "srcChainId": 8453,
    "dstChainId": 42161,
    "tokenIn": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "tokenOut": "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
    "amountIn": "100000000",
    "estimatedOut": "99747584",
    "minAmountOut": "99647836",
    "minSrcSwapOut": "0",
    "feeAmountUSD": 0.3,
    "feeAmountToken": "300000",
    "rail": "CCTP",
    "railType": "messaging",
    "settlementToken": "USDC",
    "settlementAssetId": "0xf7135e5fd9158c9cea11c421e7df327b195498f7dacd89fb0de0449e618c4027",
    "expectedDstSettlementToken": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    "expectedDstSettlementAssetId": "0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94",
    "minSettlementAmount": "99580379",
    "dstGasLimit": 200000,
    "etaSeconds": 8,
    "expiresAt": 1779366294,
    "railPluginId": "0x9181644edfd36b07ccd623494a3681a4a6b9cd5d52611accda20264cd09259ac",
    "railData": "0x00000000000000000000000000000000000000000000000000000000000003e80000000000000000000000000000000000000000000000000000000000009bc8",
    "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
    "swapDataSrc": "0x",
    "swapDataDst": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000005f0ff3c0000000000000000000000000000000000000000000000000000000005f20700000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e5831000000000000000000000000fd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb900000000000000000000000000000000000000000000000000000000000000010000000000000000000000002cebbe0b2145d6d8a103e91c4fd01b06b9058eda",
    "nativeDstAddress": "undefined",
    "routeAsset": {
      "canonicalAssetId": "USDC",
      "providerAssetId": "CCTP:8453:usdc",
      "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      "decimals": 6,
      "assetKind": "erc20",
      "assetStandard": "erc20"
    }
  }
}

----------

# Base to ARB for WETH with 2 swap hops

{
  "offerSet": {
    "offerSetId": "0x486761af35f3ab0d62362060d6cf7af703860307e0324f9deea308798927c912",
    "expiresAt": 1779464477,
    "offers": [
      {
        "offerId": "0x2d324fea356753c62266cf2a29941788944615cc74388a53d5d4d8b2062f69c1",
        "rail": "CCTP",
        "offerType": "cctp_fast",
        "railType": "messaging",
        "srcChainId": 8453,
        "dstChainId": 42161,
        "tokenIn": "0x4200000000000000000000000000000000000006",
        "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
        "amountIn": "1000000000000000000",
        "estimatedOut": "996166476418292321",
        "minAmountOut": "995170309941874028",
        "expiresAt": 1779464478,
        "deliveryShape": "src_and_dst_swap_required",
        "executionMode": "router_intent",
        "routeAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:8453:usdc",
          "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:8453:usdc",
          "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:8453:usdc",
          "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "economics": {
          "providerFeeUSD": 0.422023,
          "protocolFeeUSD": 0.003,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 8,
          "outboundFeeUSD": 0.422023
        },
        "execution": {
          "quote": {
            "intentId": "0x2d324fea356753c62266cf2a29941788944615cc74388a53d5d4d8b2062f69c1",
            "srcChainId": 8453,
            "dstChainId": 42161,
            "tokenIn": "0x4200000000000000000000000000000000000006",
            "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
            "amountIn": "1000000000000000000",
            "estimatedOut": "996166476418292321",
            "minAmountOut": "995170309941874028",
            "minSrcSwapOut": "2099563550",
            "feeAmountUSD": 0.003,
            "feeAmountToken": "3000000000000000",
            "rail": "CCTP",
            "railType": "messaging",
            "settlementToken": "USDC",
            "settlementAssetId": "0xf7135e5fd9158c9cea11c421e7df327b195498f7dacd89fb0de0449e618c4027",
            "expectedDstSettlementToken": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            "expectedDstSettlementAssetId": "0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94",
            "minSettlementAmount": "2107582405",
            "dstGasLimit": 200000,
            "etaSeconds": 8,
            "expiresAt": 1779464478,
            "railPluginId": "0x9181644edfd36b07ccd623494a3681a4a6b9cd5d52611accda20264cd09259ac",
            "railData": "0x00000000000000000000000000000000000000000000000000000000000003e800000000000000000000000000000000000000000000000000000000000ce10e",
            "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapDataSrc": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000dd60e37b9108000000000000000000000000000000000000000000000000000000000007dc5c949000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000020000000000000000000000004200000000000000000000000000000000000006000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda0291300000000000000000000000000000000000000000000000000000000000000010000000000000000000000002e8e19b402460c859b6e07a71b29b01c8c5a420f",
            "swapDataDst": "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000007dbf58c20000000000000000000000000000000000000000000000000dd31821e4109a61000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e583100000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab10000000000000000000000000000000000000000000000000000000000000001000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d7",
            "nativeDstAddress": "undefined",
            "routeAsset": {
              "canonicalAssetId": "USDC",
              "providerAssetId": "CCTP:8453:usdc",
              "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              "decimals": 6,
              "assetKind": "erc20",
              "assetStandard": "erc20"
            }
          },
          "feeAmountToken": "3000000000000000",
          "minSrcSwapOut": "2099563550",
          "providerFeeUSD": 0.422023,
          "protocolFeeUSD": 0.003,
          "railPluginId": "0x9181644edfd36b07ccd623494a3681a4a6b9cd5d52611accda20264cd09259ac",
          "railData": "0x00000000000000000000000000000000000000000000000000000000000003e800000000000000000000000000000000000000000000000000000000000ce10e",
          "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapDataSrc": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000dd60e37b9108000000000000000000000000000000000000000000000000000000000007dc5c949000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000020000000000000000000000004200000000000000000000000000000000000006000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda0291300000000000000000000000000000000000000000000000000000000000000010000000000000000000000002e8e19b402460c859b6e07a71b29b01c8c5a420f",
          "swapDataDst": "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000007dbf58c20000000000000000000000000000000000000000000000000dd31821e4109a61000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e583100000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab10000000000000000000000000000000000000000000000000000000000000001000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d7",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      },
      {
        "offerId": "0x7da8e24e8743ebac4a04bf07d27e7629f992f9f8b10de6cd116df51e9da857f7",
        "rail": "LAYERZERO",
        "offerType": "lz_stargate_pool",
        "railType": "messaging",
        "srcChainId": 8453,
        "dstChainId": 42161,
        "tokenIn": "0x4200000000000000000000000000000000000006",
        "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
        "amountIn": "1000000000000000000",
        "estimatedOut": "996365667900059204",
        "minAmountOut": "995369302232159144",
        "expiresAt": 1779464477,
        "deliveryShape": "src_and_dst_swap_required",
        "executionMode": "router_intent",
        "routeAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "economics": {
          "providerFeeUSD": 0.35,
          "protocolFeeUSD": 0.003,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 300
        },
        "execution": {
          "quote": {
            "intentId": "0x7da8e24e8743ebac4a04bf07d27e7629f992f9f8b10de6cd116df51e9da857f7",
            "srcChainId": 8453,
            "dstChainId": 42161,
            "tokenIn": "0x4200000000000000000000000000000000000006",
            "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
            "amountIn": "1000000000000000000",
            "estimatedOut": "996365667900059204",
            "minAmountOut": "995369302232159144",
            "minSrcSwapOut": "2099563550",
            "feeAmountUSD": 0.003,
            "feeAmountToken": "3000000000000000",
            "rail": "LAYERZERO",
            "railType": "messaging",
            "settlementToken": "USDC",
            "settlementAssetId": "0xf7135e5fd9158c9cea11c421e7df327b195498f7dacd89fb0de0449e618c4027",
            "expectedDstSettlementToken": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            "expectedDstSettlementAssetId": "0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94",
            "minSettlementAmount": "2108004006",
            "dstGasLimit": 240000,
            "etaSeconds": 300,
            "expiresAt": 1779464477,
            "railPluginId": "0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc",
            "railData": "0x000000000000000000000000000000000000000000000000000000000000000200000000000000000000000027a16dc786820b16e5c9028b75b99f6f604b5d260000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a800000000000000000000000000000000000000000",
            "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapDataSrc": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000dd60e37b9108000000000000000000000000000000000000000000000000000000000007dc5c949000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000020000000000000000000000004200000000000000000000000000000000000006000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda0291300000000000000000000000000000000000000000000000000000000000000010000000000000000000000002e8e19b402460c859b6e07a71b29b01c8c5a420f",
            "swapDataDst": "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000007dc5c9490000000000000000000000000000000000000000000000000dd3cd4bc593ee44000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e583100000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab10000000000000000000000000000000000000000000000000000000000000001000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d7",
            "nativeDstAddress": "undefined",
            "routeAsset": {
              "canonicalAssetId": "USDC",
              "providerAssetId": "layerzero:usdc",
              "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              "decimals": 6,
              "assetKind": "erc20",
              "assetStandard": "stargate_pool"
            }
          },
          "feeAmountToken": "3000000000000000",
          "minSrcSwapOut": "2099563550",
          "providerFeeUSD": 0.35,
          "protocolFeeUSD": 0.003,
          "railPluginId": "0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc",
          "railData": "0x000000000000000000000000000000000000000000000000000000000000000200000000000000000000000027a16dc786820b16e5c9028b75b99f6f604b5d260000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a800000000000000000000000000000000000000000",
          "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapDataSrc": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000dd60e37b9108000000000000000000000000000000000000000000000000000000000007dc5c949000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000020000000000000000000000004200000000000000000000000000000000000006000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda0291300000000000000000000000000000000000000000000000000000000000000010000000000000000000000002e8e19b402460c859b6e07a71b29b01c8c5a420f",
          "swapDataDst": "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000007dc5c9490000000000000000000000000000000000000000000000000dd3cd4bc593ee44000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e583100000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab10000000000000000000000000000000000000000000000000000000000000001000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d7",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      },
      {
        "offerId": "0xfa546a10a68135b3aea90de434dd3088e8beb17a7897b68758915080971e77bb",
        "rail": "LAYERZERO",
        "offerType": "lz_api_direct",
        "railType": "messaging",
        "srcChainId": 8453,
        "dstChainId": 42161,
        "tokenIn": "0x4200000000000000000000000000000000000006",
        "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
        "amountIn": "1000000000000000000",
        "estimatedOut": "997548958508900169",
        "minAmountOut": "987573468923811167",
        "expiresAt": 1779464480,
        "deliveryShape": "direct",
        "executionMode": "provider_direct",
        "routeAsset": {
          "canonicalAssetId": "WETH",
          "providerAssetId": "layerzero-api:base:0x4200000000000000000000000000000000000006",
          "tokenAddress": "0x4200000000000000000000000000000000000006",
          "srcTokenAddress": "0x4200000000000000000000000000000000000006",
          "dstTokenAddress": "0x4200000000000000000000000000000000000006",
          "decimals": 18,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "WETH",
          "providerAssetId": "layerzero-api:base:0x4200000000000000000000000000000000000006",
          "tokenAddress": "0x4200000000000000000000000000000000000006",
          "srcTokenAddress": "0x4200000000000000000000000000000000000006",
          "dstTokenAddress": "0x4200000000000000000000000000000000000006",
          "decimals": 18,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "WETH",
          "providerAssetId": "layerzero-api:arbitrum:0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
          "tokenAddress": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
          "srcTokenAddress": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
          "dstTokenAddress": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
          "decimals": 18,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "economics": {
          "providerFeeUSD": 6.69715725,
          "protocolFeeUSD": 0,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 3
        },
        "execution": {
          "provider": "layerzero_value_transfer_api",
          "quote": {
            "intentId": "0xfa546a10a68135b3aea90de434dd3088e8beb17a7897b68758915080971e77bb",
            "srcChainId": 8453,
            "dstChainId": 42161,
            "tokenIn": "0x4200000000000000000000000000000000000006",
            "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
            "amountIn": "1000000000000000000",
            "estimatedOut": "997548958508900169",
            "minAmountOut": "987573468923811167",
            "minSrcSwapOut": "0",
            "feeAmountUSD": 6.69715725,
            "feeAmountToken": "0",
            "rail": "LAYERZERO",
            "railType": "messaging",
            "settlementToken": "ETH",
            "routeAsset": {
              "canonicalAssetId": "WETH",
              "providerAssetId": "layerzero-api:base:0x4200000000000000000000000000000000000006",
              "tokenAddress": "0x4200000000000000000000000000000000000006",
              "srcTokenAddress": "0x4200000000000000000000000000000000000006",
              "dstTokenAddress": "0x4200000000000000000000000000000000000006",
              "decimals": 18,
              "assetKind": "erc20",
              "assetStandard": "erc20"
            },
            "settlementAssetId": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "expectedDstSettlementToken": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
            "expectedDstSettlementAssetId": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "minSettlementAmount": "987573468923811167",
            "dstGasLimit": 0,
            "etaSeconds": 3,
            "expiresAt": 1779464480,
            "railPluginId": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "railData": "0x",
            "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapDataSrc": "0x",
            "swapDataDst": "0x",
            "nativeDstAddress": "undefined",
            "layerZeroValueTransferApiQuoteId": "0x00000000000000000000000000000000019e50574ef672de943e6d5ffae9942f",
            "layerZeroValueTransferApiRouteSteps": [
              {
                "type": "AORI_V1",
                "srcChainKey": "base",
                "description": "Aori"
              }
            ],
            "layerZeroValueTransferApiUserSteps": [
              {
                "type": "TRANSACTION",
                "description": "approve",
                "chainKey": "base",
                "chainType": "EVM",
                "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
                "transaction": {
                  "encoded": {
                    "chainId": 8453,
                    "data": "0x095ea7b3000000000000000000000000c6868edf1d2a7a8b759856cb8afa333210dfeda60000000000000000000000000000000000000000000000000de0b6b3a7640000",
                    "from": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                    "to": "0x4200000000000000000000000000000000000006"
                  }
                }
              },
              {
                "type": "SIGNATURE",
                "description": "bridge",
                "chainKey": "base",
                "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
                "signature": {
                  "type": "EIP712",
                  "typedData": {
                    "primaryType": "Order",
                    "domain": {
                      "name": "Aori",
                      "version": "0.3.1",
                      "verifyingContract": "0xc6868edf1d2a7a8b759856cb8afa333210dfeda6"
                    },
                    "types": {
                      "EIP712Domain": [
                        {
                          "name": "name",
                          "type": "string"
                        },
                        {
                          "name": "version",
                          "type": "string"
                        },
                        {
                          "name": "verifyingContract",
                          "type": "address"
                        }
                      ],
                      "Order": [
                        {
                          "name": "inputAmount",
                          "type": "uint128"
                        },
                        {
                          "name": "outputAmount",
                          "type": "uint128"
                        },
                        {
                          "name": "inputToken",
                          "type": "address"
                        },
                        {
                          "name": "outputToken",
                          "type": "address"
                        },
                        {
                          "name": "startTime",
                          "type": "uint32"
                        },
                        {
                          "name": "endTime",
                          "type": "uint32"
                        },
                        {
                          "name": "srcEid",
                          "type": "uint32"
                        },
                        {
                          "name": "dstEid",
                          "type": "uint32"
                        },
                        {
                          "name": "offerer",
                          "type": "address"
                        },
                        {
                          "name": "recipient",
                          "type": "address"
                        }
                      ]
                    },
                    "message": {
                      "offerer": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                      "recipient": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                      "inputToken": "0x4200000000000000000000000000000000000006",
                      "outputToken": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
                      "inputAmount": "1000000000000000000",
                      "outputAmount": "997548958508900169",
                      "startTime": "1779464360",
                      "endTime": "1779464450",
                      "srcEid": 30184,
                      "dstEid": 30110
                    }
                  }
                }
              }
            ]
          },
          "layerZeroValueTransferApiQuoteId": "0x00000000000000000000000000000000019e50574ef672de943e6d5ffae9942f",
          "layerZeroValueTransferApiQuote": {
            "id": "0x00000000000000000000000000000000019e50574ef672de943e6d5ffae9942f",
            "routeSteps": [
              {
                "type": "AORI_V1",
                "srcChainKey": "base",
                "description": "Aori"
              }
            ],
            "fees": [
              {
                "chainKey": "base",
                "type": "GENERAL",
                "description": "Aori Fees",
                "amount": "3157573196051466",
                "address": "0x4200000000000000000000000000000000000006"
              }
            ],
            "duration": {
              "estimated": "3000"
            },
            "feeUsd": "6.69715725",
            "feePercent": "0.00315757",
            "srcAmount": "1000000000000000000",
            "dstAmount": "997548958508900169",
            "dstAmountMin": "987573468923811167",
            "srcAmountUsd": "2120.98242409",
            "dstAmountUsd": "2114.28526684",
            "userSteps": [
              {
                "type": "TRANSACTION",
                "description": "approve",
                "chainKey": "base",
                "chainType": "EVM",
                "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
                "transaction": {
                  "encoded": {
                    "chainId": 8453,
                    "data": "0x095ea7b3000000000000000000000000c6868edf1d2a7a8b759856cb8afa333210dfeda60000000000000000000000000000000000000000000000000de0b6b3a7640000",
                    "from": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                    "to": "0x4200000000000000000000000000000000000006"
                  }
                }
              },
              {
                "type": "SIGNATURE",
                "description": "bridge",
                "chainKey": "base",
                "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
                "signature": {
                  "type": "EIP712",
                  "typedData": {
                    "primaryType": "Order",
                    "domain": {
                      "name": "Aori",
                      "version": "0.3.1",
                      "verifyingContract": "0xc6868edf1d2a7a8b759856cb8afa333210dfeda6"
                    },
                    "types": {
                      "EIP712Domain": [
                        {
                          "name": "name",
                          "type": "string"
                        },
                        {
                          "name": "version",
                          "type": "string"
                        },
                        {
                          "name": "verifyingContract",
                          "type": "address"
                        }
                      ],
                      "Order": [
                        {
                          "name": "inputAmount",
                          "type": "uint128"
                        },
                        {
                          "name": "outputAmount",
                          "type": "uint128"
                        },
                        {
                          "name": "inputToken",
                          "type": "address"
                        },
                        {
                          "name": "outputToken",
                          "type": "address"
                        },
                        {
                          "name": "startTime",
                          "type": "uint32"
                        },
                        {
                          "name": "endTime",
                          "type": "uint32"
                        },
                        {
                          "name": "srcEid",
                          "type": "uint32"
                        },
                        {
                          "name": "dstEid",
                          "type": "uint32"
                        },
                        {
                          "name": "offerer",
                          "type": "address"
                        },
                        {
                          "name": "recipient",
                          "type": "address"
                        }
                      ]
                    },
                    "message": {
                      "offerer": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                      "recipient": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                      "inputToken": "0x4200000000000000000000000000000000000006",
                      "outputToken": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
                      "inputAmount": "1000000000000000000",
                      "outputAmount": "997548958508900169",
                      "startTime": "1779464360",
                      "endTime": "1779464450",
                      "srcEid": 30184,
                      "dstEid": 30110
                    }
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
              "chainKey": "base",
              "chainType": "EVM",
              "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
              "transaction": {
                "encoded": {
                  "chainId": 8453,
                  "data": "0x095ea7b3000000000000000000000000c6868edf1d2a7a8b759856cb8afa333210dfeda60000000000000000000000000000000000000000000000000de0b6b3a7640000",
                  "from": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                  "to": "0x4200000000000000000000000000000000000006"
                }
              }
            },
            {
              "type": "SIGNATURE",
              "description": "bridge",
              "chainKey": "base",
              "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
              "signature": {
                "type": "EIP712",
                "typedData": {
                  "primaryType": "Order",
                  "domain": {
                    "name": "Aori",
                    "version": "0.3.1",
                    "verifyingContract": "0xc6868edf1d2a7a8b759856cb8afa333210dfeda6"
                  },
                  "types": {
                    "EIP712Domain": [
                      {
                        "name": "name",
                        "type": "string"
                      },
                      {
                        "name": "version",
                        "type": "string"
                      },
                      {
                        "name": "verifyingContract",
                        "type": "address"
                      }
                    ],
                    "Order": [
                      {
                        "name": "inputAmount",
                        "type": "uint128"
                      },
                      {
                        "name": "outputAmount",
                        "type": "uint128"
                      },
                      {
                        "name": "inputToken",
                        "type": "address"
                      },
                      {
                        "name": "outputToken",
                        "type": "address"
                      },
                      {
                        "name": "startTime",
                        "type": "uint32"
                      },
                      {
                        "name": "endTime",
                        "type": "uint32"
                      },
                      {
                        "name": "srcEid",
                        "type": "uint32"
                      },
                      {
                        "name": "dstEid",
                        "type": "uint32"
                      },
                      {
                        "name": "offerer",
                        "type": "address"
                      },
                      {
                        "name": "recipient",
                        "type": "address"
                      }
                    ]
                  },
                  "message": {
                    "offerer": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                    "recipient": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                    "inputToken": "0x4200000000000000000000000000000000000006",
                    "outputToken": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
                    "inputAmount": "1000000000000000000",
                    "outputAmount": "997548958508900169",
                    "startTime": "1779464360",
                    "endTime": "1779464450",
                    "srcEid": 30184,
                    "dstEid": 30110
                  }
                }
              }
            }
          ],
          "layerZeroValueTransferApiRouteSteps": [
            {
              "type": "AORI_V1",
              "srcChainKey": "base",
              "description": "Aori"
            }
          ],
          "feeUsd": 6.69715725
        }
      }
    ],
    "bestOfferId": "0x2d324fea356753c62266cf2a29941788944615cc74388a53d5d4d8b2062f69c1"
  }
}

# ------------------------------------------------------------
# ------------------------------------------------------------

# Base to arbitrum WETH with 1 swap hop and WETH as settlement 

curl -X 'POST' \
  'http://localhost:8787/api/v1/quote' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "tokenIn": "0x4200000000000000000000000000000000000006",
  "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
  "amountIn": "1000000000000000000",
  "srcChainId": 8453,
  "dstChainId": 42161,
  "userAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
  "urgency": "fast"
}'

{
  "offerSet": {
    "offerSetId": "0x464aaed3277f07d4d330916b3c19ed4a1afbad7976519551edafef6ac8c4d59d",
    "expiresAt": 1779465887,
    "offers": [
      {
        "offerId": "0x9b9b03fc61e866af719a10ba8c136134b03b3cb4ac7c21b5af50df74955aa53d",
        "rail": "CCTP",
        "offerType": "cctp_fast",
        "railType": "messaging",
        "srcChainId": 8453,
        "dstChainId": 42161,
        "tokenIn": "0x4200000000000000000000000000000000000006",
        "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
        "amountIn": "1000000000000000000",
        "estimatedOut": "996638596881812867",
        "minAmountOut": "995641958284931054",
        "expiresAt": 1779465888,
        "deliveryShape": "src_and_dst_swap_required",
        "executionMode": "router_intent",
        "routeAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:8453:usdc",
          "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:8453:usdc",
          "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:8453:usdc",
          "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "economics": {
          "providerFeeUSD": 0.422875,
          "protocolFeeUSD": 0.003,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 8,
          "outboundFeeUSD": 0.422875
        },
        "execution": {
          "quote": {
            "intentId": "0x9b9b03fc61e866af719a10ba8c136134b03b3cb4ac7c21b5af50df74955aa53d",
            "srcChainId": 8453,
            "dstChainId": 42161,
            "tokenIn": "0x4200000000000000000000000000000000000006",
            "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
            "amountIn": "1000000000000000000",
            "estimatedOut": "996638596881812867",
            "minAmountOut": "995641958284931054",
            "minSrcSwapOut": "2103798523",
            "feeAmountUSD": 0.003,
            "feeAmountToken": "3000000000000000",
            "rail": "CCTP",
            "railType": "messaging",
            "settlementToken": "USDC",
            "settlementAssetId": "0xf7135e5fd9158c9cea11c421e7df327b195498f7dacd89fb0de0449e618c4027",
            "expectedDstSettlementToken": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            "expectedDstSettlementAssetId": "0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94",
            "minSettlementAmount": "2111833552",
            "dstGasLimit": 200000,
            "etaSeconds": 8,
            "expiresAt": 1779465888,
            "railPluginId": "0x9181644edfd36b07ccd623494a3681a4a6b9cd5d52611accda20264cd09259ac",
            "railData": "0x00000000000000000000000000000000000000000000000000000000000003e800000000000000000000000000000000000000000000000000000000000ce7b5",
            "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapDataSrc": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000dd60e37b9108000000000000000000000000000000000000000000000000000000000007e06bb47000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000020000000000000000000000004200000000000000000000000000000000000006000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda029130000000000000000000000000000000000000000000000000000000000000001000000000000000000000000ca9b4b3a861ebb3475263c8cd5943c8ab7403ba1",
            "swapDataDst": "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000007e00476c0000000000000000000000000000000000000000000000000dd4c58600958d83000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e583100000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab10000000000000000000000000000000000000000000000000000000000000001000000000000000000000000a91d8284c199fe4c178d76558a1427790af7e80f",
            "nativeDstAddress": "undefined",
            "routeAsset": {
              "canonicalAssetId": "USDC",
              "providerAssetId": "CCTP:8453:usdc",
              "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              "decimals": 6,
              "assetKind": "erc20",
              "assetStandard": "erc20"
            }
          },
          "feeAmountToken": "3000000000000000",
          "minSrcSwapOut": "2103798523",
          "providerFeeUSD": 0.422875,
          "protocolFeeUSD": 0.003,
          "railPluginId": "0x9181644edfd36b07ccd623494a3681a4a6b9cd5d52611accda20264cd09259ac",
          "railData": "0x00000000000000000000000000000000000000000000000000000000000003e800000000000000000000000000000000000000000000000000000000000ce7b5",
          "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapDataSrc": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000dd60e37b9108000000000000000000000000000000000000000000000000000000000007e06bb47000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000020000000000000000000000004200000000000000000000000000000000000006000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda029130000000000000000000000000000000000000000000000000000000000000001000000000000000000000000ca9b4b3a861ebb3475263c8cd5943c8ab7403ba1",
          "swapDataDst": "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000007e00476c0000000000000000000000000000000000000000000000000dd4c58600958d83000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e583100000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab10000000000000000000000000000000000000000000000000000000000000001000000000000000000000000a91d8284c199fe4c178d76558a1427790af7e80f",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      },
      {
        "offerId": "0x72f71fcb194a5f6bf82e6bfb0f66010d133741294d131e592420950a5a695f7a",
        "rail": "LAYERZERO",
        "offerType": "lz_stargate_pool",
        "railType": "messaging",
        "srcChainId": 8453,
        "dstChainId": 42161,
        "tokenIn": "0x4200000000000000000000000000000000000006",
        "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
        "amountIn": "1000000000000000000",
        "estimatedOut": "996837962792504701",
        "minAmountOut": "995841124829712196",
        "expiresAt": 1779465888,
        "deliveryShape": "src_and_dst_swap_required",
        "executionMode": "router_intent",
        "routeAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "economics": {
          "providerFeeUSD": 0.35,
          "protocolFeeUSD": 0.003,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 300
        },
        "execution": {
          "quote": {
            "intentId": "0x72f71fcb194a5f6bf82e6bfb0f66010d133741294d131e592420950a5a695f7a",
            "srcChainId": 8453,
            "dstChainId": 42161,
            "tokenIn": "0x4200000000000000000000000000000000000006",
            "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
            "amountIn": "1000000000000000000",
            "estimatedOut": "996837962792504701",
            "minAmountOut": "995841124829712196",
            "minSrcSwapOut": "2103798523",
            "feeAmountUSD": 0.003,
            "feeAmountToken": "3000000000000000",
            "rail": "LAYERZERO",
            "railType": "messaging",
            "settlementToken": "USDC",
            "settlementAssetId": "0xf7135e5fd9158c9cea11c421e7df327b195498f7dacd89fb0de0449e618c4027",
            "expectedDstSettlementToken": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            "expectedDstSettlementAssetId": "0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94",
            "minSettlementAmount": "2112256004",
            "dstGasLimit": 240000,
            "etaSeconds": 300,
            "expiresAt": 1779465888,
            "railPluginId": "0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc",
            "railData": "0x000000000000000000000000000000000000000000000000000000000000000200000000000000000000000027a16dc786820b16e5c9028b75b99f6f604b5d260000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a800000000000000000000000000000000000000000",
            "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapDataSrc": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000dd60e37b9108000000000000000000000000000000000000000000000000000000000007e06bb47000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000020000000000000000000000004200000000000000000000000000000000000006000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda029130000000000000000000000000000000000000000000000000000000000000001000000000000000000000000ca9b4b3a861ebb3475263c8cd5943c8ab7403ba1",
            "swapDataDst": "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000007e06bb470000000000000000000000000000000000000000000000000dd57ad87edf0d7d000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e583100000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab10000000000000000000000000000000000000000000000000000000000000001000000000000000000000000a91d8284c199fe4c178d76558a1427790af7e80f",
            "nativeDstAddress": "undefined",
            "routeAsset": {
              "canonicalAssetId": "USDC",
              "providerAssetId": "layerzero:usdc",
              "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              "decimals": 6,
              "assetKind": "erc20",
              "assetStandard": "stargate_pool"
            }
          },
          "feeAmountToken": "3000000000000000",
          "minSrcSwapOut": "2103798523",
          "providerFeeUSD": 0.35,
          "protocolFeeUSD": 0.003,
          "railPluginId": "0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc",
          "railData": "0x000000000000000000000000000000000000000000000000000000000000000200000000000000000000000027a16dc786820b16e5c9028b75b99f6f604b5d260000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a800000000000000000000000000000000000000000",
          "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapDataSrc": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000dd60e37b9108000000000000000000000000000000000000000000000000000000000007e06bb47000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000020000000000000000000000004200000000000000000000000000000000000006000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda029130000000000000000000000000000000000000000000000000000000000000001000000000000000000000000ca9b4b3a861ebb3475263c8cd5943c8ab7403ba1",
          "swapDataDst": "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000007e06bb470000000000000000000000000000000000000000000000000dd57ad87edf0d7d000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e583100000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab10000000000000000000000000000000000000000000000000000000000000001000000000000000000000000a91d8284c199fe4c178d76558a1427790af7e80f",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      },
      {
        "offerId": "0x2bd3604c32257d053c4a0e433548d5e0303fa50aa3d8413af825c2035cf1fd1c",
        "rail": "LAYERZERO",
        "offerType": "lz_oft",
        "railType": "messaging",
        "srcChainId": 8453,
        "dstChainId": 42161,
        "tokenIn": "0x4200000000000000000000000000000000000006",
        "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
        "amountIn": "1000000000000000000",
        "estimatedOut": "997000000000000000",
        "minAmountOut": "996003000000000000",
        "expiresAt": 1779465887,
        "deliveryShape": "direct",
        "executionMode": "router_intent",
        "routeAsset": {
          "canonicalAssetId": "WETH",
          "providerAssetId": "layerzero:weth",
          "tokenAddress": "0x4200000000000000000000000000000000000006",
          "srcTokenAddress": "0x4200000000000000000000000000000000000006",
          "dstTokenAddress": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
          "decimals": 18,
          "assetKind": "erc20",
          "assetStandard": "oft"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "WETH",
          "providerAssetId": "layerzero:weth",
          "tokenAddress": "0x4200000000000000000000000000000000000006",
          "srcTokenAddress": "0x4200000000000000000000000000000000000006",
          "dstTokenAddress": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
          "decimals": 18,
          "assetKind": "erc20",
          "assetStandard": "oft"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "WETH",
          "providerAssetId": "layerzero:weth",
          "tokenAddress": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
          "srcTokenAddress": "0x4200000000000000000000000000000000000006",
          "dstTokenAddress": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
          "decimals": 18,
          "assetKind": "erc20",
          "assetStandard": "oft"
        },
        "economics": {
          "providerFeeUSD": 0.35,
          "protocolFeeUSD": 0.003,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 300
        },
        "execution": {
          "quote": {
            "intentId": "0x2bd3604c32257d053c4a0e433548d5e0303fa50aa3d8413af825c2035cf1fd1c",
            "srcChainId": 8453,
            "dstChainId": 42161,
            "tokenIn": "0x4200000000000000000000000000000000000006",
            "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
            "amountIn": "1000000000000000000",
            "estimatedOut": "997000000000000000",
            "minAmountOut": "996003000000000000",
            "minSrcSwapOut": "0",
            "feeAmountUSD": 0.003,
            "feeAmountToken": "3000000000000000",
            "rail": "LAYERZERO",
            "railType": "messaging",
            "settlementToken": "ETH",
            "settlementAssetId": "0x38b79d5775fbebcc217e3aeda900f052bb68fc41d2f46b2fd7f4aac08f600530",
            "expectedDstSettlementToken": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
            "expectedDstSettlementAssetId": "0xe06aa7652c488e617d0b2022306fe2e9fa222808b84299384753bf1405a59a63",
            "minSettlementAmount": "996003000000000000",
            "dstGasLimit": 220000,
            "etaSeconds": 300,
            "expiresAt": 1779465887,
            "railPluginId": "0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc",
            "railData": "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000dc181bd607330aeebef6ea62e03e5e1fb4b6f7c700000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000",
            "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapDataSrc": "0x",
            "swapDataDst": "0x",
            "nativeDstAddress": "undefined",
            "routeAsset": {
              "canonicalAssetId": "WETH",
              "providerAssetId": "layerzero:weth",
              "tokenAddress": "0x4200000000000000000000000000000000000006",
              "srcTokenAddress": "0x4200000000000000000000000000000000000006",
              "dstTokenAddress": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
              "decimals": 18,
              "assetKind": "erc20",
              "assetStandard": "oft"
            }
          },
          "feeAmountToken": "3000000000000000",
          "minSrcSwapOut": "0",
          "providerFeeUSD": 0.35,
          "protocolFeeUSD": 0.003,
          "railPluginId": "0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc",
          "railData": "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000dc181bd607330aeebef6ea62e03e5e1fb4b6f7c700000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000",
          "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
          "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
          "swapDataSrc": "0x",
          "swapDataDst": "0x",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      },
      {
        "offerId": "0xf7bd5069090df78a80a7af178b05133e9811347af16ce5b440a4c9c423c7ae4c",
        "rail": "LAYERZERO",
        "offerType": "lz_oft",
        "railType": "messaging",
        "srcChainId": 8453,
        "dstChainId": 42161,
        "tokenIn": "0x4200000000000000000000000000000000000006",
        "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
        "amountIn": "1000000000000000000",
        "estimatedOut": "997000000000000000",
        "minAmountOut": "996003000000000000",
        "expiresAt": 1779465887,
        "deliveryShape": "direct",
        "executionMode": "router_intent",
        "routeAsset": {
          "canonicalAssetId": "ETH",
          "providerAssetId": "layerzero:eth",
          "tokenAddress": "0x4200000000000000000000000000000000000006",
          "srcTokenAddress": "0x4200000000000000000000000000000000000006",
          "dstTokenAddress": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
          "decimals": 18,
          "assetKind": "erc20",
          "assetStandard": "oft"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "ETH",
          "providerAssetId": "layerzero:eth",
          "tokenAddress": "0x4200000000000000000000000000000000000006",
          "srcTokenAddress": "0x4200000000000000000000000000000000000006",
          "dstTokenAddress": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
          "decimals": 18,
          "assetKind": "erc20",
          "assetStandard": "oft"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "ETH",
          "providerAssetId": "layerzero:eth",
          "tokenAddress": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
          "srcTokenAddress": "0x4200000000000000000000000000000000000006",
          "dstTokenAddress": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
          "decimals": 18,
          "assetKind": "erc20",
          "assetStandard": "oft"
        },
        "economics": {
          "providerFeeUSD": 0.35,
          "protocolFeeUSD": 0.003,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 300
        },
        "execution": {
          "quote": {
            "intentId": "0xf7bd5069090df78a80a7af178b05133e9811347af16ce5b440a4c9c423c7ae4c",
            "srcChainId": 8453,
            "dstChainId": 42161,
            "tokenIn": "0x4200000000000000000000000000000000000006",
            "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
            "amountIn": "1000000000000000000",
            "estimatedOut": "997000000000000000",
            "minAmountOut": "996003000000000000",
            "minSrcSwapOut": "0",
            "feeAmountUSD": 0.003,
            "feeAmountToken": "3000000000000000",
            "rail": "LAYERZERO",
            "railType": "messaging",
            "settlementToken": "ETH",
            "settlementAssetId": "0x38b79d5775fbebcc217e3aeda900f052bb68fc41d2f46b2fd7f4aac08f600530",
            "expectedDstSettlementToken": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
            "expectedDstSettlementAssetId": "0xe06aa7652c488e617d0b2022306fe2e9fa222808b84299384753bf1405a59a63",
            "minSettlementAmount": "996003000000000000",
            "dstGasLimit": 220000,
            "etaSeconds": 300,
            "expiresAt": 1779465887,
            "railPluginId": "0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc",
            "railData": "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000dc181bd607330aeebef6ea62e03e5e1fb4b6f7c700000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000",
            "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapDataSrc": "0x",
            "swapDataDst": "0x",
            "nativeDstAddress": "undefined",
            "routeAsset": {
              "canonicalAssetId": "ETH",
              "providerAssetId": "layerzero:eth",
              "tokenAddress": "0x4200000000000000000000000000000000000006",
              "srcTokenAddress": "0x4200000000000000000000000000000000000006",
              "dstTokenAddress": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
              "decimals": 18,
              "assetKind": "erc20",
              "assetStandard": "oft"
            }
          },
          "feeAmountToken": "3000000000000000",
          "minSrcSwapOut": "0",
          "providerFeeUSD": 0.35,
          "protocolFeeUSD": 0.003,
          "railPluginId": "0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc",
          "railData": "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000dc181bd607330aeebef6ea62e03e5e1fb4b6f7c700000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000",
          "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
          "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
          "swapDataSrc": "0x",
          "swapDataDst": "0x",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      },
      {
        "offerId": "0x8b4c9a6204457ccb279473685fe1c7e53a27b88dae97659754afa6cba41629a6",
        "rail": "LAYERZERO",
        "offerType": "lz_api_direct",
        "railType": "messaging",
        "srcChainId": 8453,
        "dstChainId": 42161,
        "tokenIn": "0x4200000000000000000000000000000000000006",
        "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
        "amountIn": "1000000000000000000",
        "estimatedOut": "998672258389868972",
        "minAmountOut": "988685535805970282",
        "expiresAt": 1779465890,
        "deliveryShape": "direct",
        "executionMode": "provider_direct",
        "routeAsset": {
          "canonicalAssetId": "WETH",
          "providerAssetId": "layerzero-api:base:0x4200000000000000000000000000000000000006",
          "tokenAddress": "0x4200000000000000000000000000000000000006",
          "srcTokenAddress": "0x4200000000000000000000000000000000000006",
          "dstTokenAddress": "0x4200000000000000000000000000000000000006",
          "decimals": 18,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "WETH",
          "providerAssetId": "layerzero-api:base:0x4200000000000000000000000000000000000006",
          "tokenAddress": "0x4200000000000000000000000000000000000006",
          "srcTokenAddress": "0x4200000000000000000000000000000000000006",
          "dstTokenAddress": "0x4200000000000000000000000000000000000006",
          "decimals": 18,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "WETH",
          "providerAssetId": "layerzero-api:arbitrum:0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
          "tokenAddress": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
          "srcTokenAddress": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
          "dstTokenAddress": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
          "decimals": 18,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "economics": {
          "providerFeeUSD": 1.51064155,
          "protocolFeeUSD": 0,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 3
        },
        "execution": {
          "provider": "layerzero_value_transfer_api",
          "quote": {
            "intentId": "0x8b4c9a6204457ccb279473685fe1c7e53a27b88dae97659754afa6cba41629a6",
            "srcChainId": 8453,
            "dstChainId": 42161,
            "tokenIn": "0x4200000000000000000000000000000000000006",
            "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
            "amountIn": "1000000000000000000",
            "estimatedOut": "998672258389868972",
            "minAmountOut": "988685535805970282",
            "minSrcSwapOut": "0",
            "feeAmountUSD": 1.51064155,
            "feeAmountToken": "0",
            "rail": "LAYERZERO",
            "railType": "messaging",
            "settlementToken": "ETH",
            "routeAsset": {
              "canonicalAssetId": "WETH",
              "providerAssetId": "layerzero-api:base:0x4200000000000000000000000000000000000006",
              "tokenAddress": "0x4200000000000000000000000000000000000006",
              "srcTokenAddress": "0x4200000000000000000000000000000000000006",
              "dstTokenAddress": "0x4200000000000000000000000000000000000006",
              "decimals": 18,
              "assetKind": "erc20",
              "assetStandard": "erc20"
            },
            "settlementAssetId": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "expectedDstSettlementToken": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
            "expectedDstSettlementAssetId": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "minSettlementAmount": "988685535805970282",
            "dstGasLimit": 0,
            "etaSeconds": 3,
            "expiresAt": 1779465890,
            "railPluginId": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "railData": "0x",
            "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapDataSrc": "0x",
            "swapDataDst": "0x",
            "nativeDstAddress": "undefined",
            "layerZeroValueTransferApiQuoteId": "0x00000000000000000000000000000000019e506cd46e7575bdd074544da8597e",
            "layerZeroValueTransferApiRouteSteps": [
              {
                "type": "AORI_V1",
                "srcChainKey": "base",
                "description": "Aori"
              }
            ],
            "layerZeroValueTransferApiUserSteps": [
              {
                "type": "TRANSACTION",
                "description": "approve",
                "chainKey": "base",
                "chainType": "EVM",
                "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
                "transaction": {
                  "encoded": {
                    "chainId": 8453,
                    "data": "0x095ea7b3000000000000000000000000c6868edf1d2a7a8b759856cb8afa333210dfeda60000000000000000000000000000000000000000000000000de0b6b3a7640000",
                    "from": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                    "to": "0x4200000000000000000000000000000000000006"
                  }
                }
              },
              {
                "type": "SIGNATURE",
                "description": "bridge",
                "chainKey": "base",
                "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
                "signature": {
                  "type": "EIP712",
                  "typedData": {
                    "primaryType": "Order",
                    "domain": {
                      "name": "Aori",
                      "version": "0.3.1",
                      "verifyingContract": "0xc6868edf1d2a7a8b759856cb8afa333210dfeda6"
                    },
                    "types": {
                      "EIP712Domain": [
                        {
                          "name": "name",
                          "type": "string"
                        },
                        {
                          "name": "version",
                          "type": "string"
                        },
                        {
                          "name": "verifyingContract",
                          "type": "address"
                        }
                      ],
                      "Order": [
                        {
                          "name": "inputAmount",
                          "type": "uint128"
                        },
                        {
                          "name": "outputAmount",
                          "type": "uint128"
                        },
                        {
                          "name": "inputToken",
                          "type": "address"
                        },
                        {
                          "name": "outputToken",
                          "type": "address"
                        },
                        {
                          "name": "startTime",
                          "type": "uint32"
                        },
                        {
                          "name": "endTime",
                          "type": "uint32"
                        },
                        {
                          "name": "srcEid",
                          "type": "uint32"
                        },
                        {
                          "name": "dstEid",
                          "type": "uint32"
                        },
                        {
                          "name": "offerer",
                          "type": "address"
                        },
                        {
                          "name": "recipient",
                          "type": "address"
                        }
                      ]
                    },
                    "message": {
                      "offerer": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                      "recipient": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                      "inputToken": "0x4200000000000000000000000000000000000006",
                      "outputToken": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
                      "inputAmount": "1000000000000000000",
                      "outputAmount": "998672258389868972",
                      "startTime": "1779465770",
                      "endTime": "1779465860",
                      "srcEid": 30184,
                      "dstEid": 30110
                    }
                  }
                }
              }
            ]
          },
          "layerZeroValueTransferApiQuoteId": "0x00000000000000000000000000000000019e506cd46e7575bdd074544da8597e",
          "layerZeroValueTransferApiQuote": {
            "id": "0x00000000000000000000000000000000019e506cd46e7575bdd074544da8597e",
            "routeSteps": [
              {
                "type": "AORI_V1",
                "srcChainKey": "base",
                "description": "Aori"
              }
            ],
            "fees": [
              {
                "chainKey": "base",
                "type": "GENERAL",
                "description": "Aori Fees",
                "amount": "713493059424214",
                "address": "0x4200000000000000000000000000000000000006"
              }
            ],
            "duration": {
              "estimated": "3000"
            },
            "feeUsd": "1.51064155",
            "feePercent": "0.00071349",
            "srcAmount": "1000000000000000000",
            "dstAmount": "998672258389868972",
            "dstAmountMin": "988685535805970282",
            "srcAmountUsd": "2117.24772181",
            "dstAmountUsd": "2115.73708026",
            "userSteps": [
              {
                "type": "TRANSACTION",
                "description": "approve",
                "chainKey": "base",
                "chainType": "EVM",
                "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
                "transaction": {
                  "encoded": {
                    "chainId": 8453,
                    "data": "0x095ea7b3000000000000000000000000c6868edf1d2a7a8b759856cb8afa333210dfeda60000000000000000000000000000000000000000000000000de0b6b3a7640000",
                    "from": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                    "to": "0x4200000000000000000000000000000000000006"
                  }
                }
              },
              {
                "type": "SIGNATURE",
                "description": "bridge",
                "chainKey": "base",
                "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
                "signature": {
                  "type": "EIP712",
                  "typedData": {
                    "primaryType": "Order",
                    "domain": {
                      "name": "Aori",
                      "version": "0.3.1",
                      "verifyingContract": "0xc6868edf1d2a7a8b759856cb8afa333210dfeda6"
                    },
                    "types": {
                      "EIP712Domain": [
                        {
                          "name": "name",
                          "type": "string"
                        },
                        {
                          "name": "version",
                          "type": "string"
                        },
                        {
                          "name": "verifyingContract",
                          "type": "address"
                        }
                      ],
                      "Order": [
                        {
                          "name": "inputAmount",
                          "type": "uint128"
                        },
                        {
                          "name": "outputAmount",
                          "type": "uint128"
                        },
                        {
                          "name": "inputToken",
                          "type": "address"
                        },
                        {
                          "name": "outputToken",
                          "type": "address"
                        },
                        {
                          "name": "startTime",
                          "type": "uint32"
                        },
                        {
                          "name": "endTime",
                          "type": "uint32"
                        },
                        {
                          "name": "srcEid",
                          "type": "uint32"
                        },
                        {
                          "name": "dstEid",
                          "type": "uint32"
                        },
                        {
                          "name": "offerer",
                          "type": "address"
                        },
                        {
                          "name": "recipient",
                          "type": "address"
                        }
                      ]
                    },
                    "message": {
                      "offerer": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                      "recipient": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                      "inputToken": "0x4200000000000000000000000000000000000006",
                      "outputToken": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
                      "inputAmount": "1000000000000000000",
                      "outputAmount": "998672258389868972",
                      "startTime": "1779465770",
                      "endTime": "1779465860",
                      "srcEid": 30184,
                      "dstEid": 30110
                    }
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
              "chainKey": "base",
              "chainType": "EVM",
              "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
              "transaction": {
                "encoded": {
                  "chainId": 8453,
                  "data": "0x095ea7b3000000000000000000000000c6868edf1d2a7a8b759856cb8afa333210dfeda60000000000000000000000000000000000000000000000000de0b6b3a7640000",
                  "from": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                  "to": "0x4200000000000000000000000000000000000006"
                }
              }
            },
            {
              "type": "SIGNATURE",
              "description": "bridge",
              "chainKey": "base",
              "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
              "signature": {
                "type": "EIP712",
                "typedData": {
                  "primaryType": "Order",
                  "domain": {
                    "name": "Aori",
                    "version": "0.3.1",
                    "verifyingContract": "0xc6868edf1d2a7a8b759856cb8afa333210dfeda6"
                  },
                  "types": {
                    "EIP712Domain": [
                      {
                        "name": "name",
                        "type": "string"
                      },
                      {
                        "name": "version",
                        "type": "string"
                      },
                      {
                        "name": "verifyingContract",
                        "type": "address"
                      }
                    ],
                    "Order": [
                      {
                        "name": "inputAmount",
                        "type": "uint128"
                      },
                      {
                        "name": "outputAmount",
                        "type": "uint128"
                      },
                      {
                        "name": "inputToken",
                        "type": "address"
                      },
                      {
                        "name": "outputToken",
                        "type": "address"
                      },
                      {
                        "name": "startTime",
                        "type": "uint32"
                      },
                      {
                        "name": "endTime",
                        "type": "uint32"
                      },
                      {
                        "name": "srcEid",
                        "type": "uint32"
                      },
                      {
                        "name": "dstEid",
                        "type": "uint32"
                      },
                      {
                        "name": "offerer",
                        "type": "address"
                      },
                      {
                        "name": "recipient",
                        "type": "address"
                      }
                    ]
                  },
                  "message": {
                    "offerer": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                    "recipient": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                    "inputToken": "0x4200000000000000000000000000000000000006",
                    "outputToken": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
                    "inputAmount": "1000000000000000000",
                    "outputAmount": "998672258389868972",
                    "startTime": "1779465770",
                    "endTime": "1779465860",
                    "srcEid": 30184,
                    "dstEid": 30110
                  }
                }
              }
            }
          ],
          "layerZeroValueTransferApiRouteSteps": [
            {
              "type": "AORI_V1",
              "srcChainKey": "base",
              "description": "Aori"
            }
          ],
          "feeUsd": 1.51064155
        }
      }
    ],
    "bestOfferId": "0x9b9b03fc61e866af719a10ba8c136134b03b3cb4ac7c21b5af50df74955aa53d"
  }
}

-------

# Base to OP WETH 

curl -X 'POST' \
  'http://localhost:8787/api/v1/quote' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "tokenIn": "0x4200000000000000000000000000000000000006",
  "tokenOut": "0x4200000000000000000000000000000000000006",
  "amountIn": "1000000000000000000",
  "srcChainId": 8453,
  "dstChainId": 10,
  "userAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
  "urgency": "fast"
}'

{
  "offerSet": {
    "offerSetId": "0xd522769462dc8f83dfc67590bb234d6c05daab4c9b67f272bd359c0a2d2d0451",
    "expiresAt": 1779466330,
    "offers": [
      {
        "offerId": "0xbc0867e2e986f1c9e0f584a0a0cf1f7395754b4ad18332ced03c2f1cc405330c",
        "rail": "CCTP",
        "offerType": "cctp_fast",
        "railType": "messaging",
        "srcChainId": 8453,
        "dstChainId": 10,
        "tokenIn": "0x4200000000000000000000000000000000000006",
        "tokenOut": "0x4200000000000000000000000000000000000006",
        "amountIn": "1000000000000000000",
        "estimatedOut": "996334209432074421",
        "minAmountOut": "995337875222642346",
        "expiresAt": 1779466331,
        "deliveryShape": "src_and_dst_swap_required",
        "executionMode": "router_intent",
        "routeAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:8453:usdc",
          "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:8453:usdc",
          "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:8453:usdc",
          "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "economics": {
          "providerFeeUSD": 0.422259,
          "protocolFeeUSD": 0.003,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 8,
          "outboundFeeUSD": 0.422259
        },
        "execution": {
          "quote": {
            "intentId": "0xbc0867e2e986f1c9e0f584a0a0cf1f7395754b4ad18332ced03c2f1cc405330c",
            "srcChainId": 8453,
            "dstChainId": 10,
            "tokenIn": "0x4200000000000000000000000000000000000006",
            "tokenOut": "0x4200000000000000000000000000000000000006",
            "amountIn": "1000000000000000000",
            "estimatedOut": "996334209432074421",
            "minAmountOut": "995337875222642346",
            "minSrcSwapOut": "2100736857",
            "feeAmountUSD": 0.003,
            "feeAmountToken": "3000000000000000",
            "rail": "CCTP",
            "railType": "messaging",
            "settlementToken": "USDC",
            "settlementAssetId": "0xf7135e5fd9158c9cea11c421e7df327b195498f7dacd89fb0de0449e618c4027",
            "expectedDstSettlementToken": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
            "expectedDstSettlementAssetId": "0xc9e6c698b6a822819702171c2ca95ee8e0bd8b87d4d4954b42a3ef3815a80042",
            "minSettlementAmount": "2108760193",
            "dstGasLimit": 200000,
            "etaSeconds": 8,
            "expiresAt": 1779466331,
            "railPluginId": "0x9181644edfd36b07ccd623494a3681a4a6b9cd5d52611accda20264cd09259ac",
            "railData": "0x00000000000000000000000000000000000000000000000000000000000003e800000000000000000000000000000000000000000000000000000000000ce2e6",
            "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapDataSrc": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000dd60e37b9108000000000000000000000000000000000000000000000000000000000007dd7c78c000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000020000000000000000000000004200000000000000000000000000000000000006000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda0291300000000000000000000000000000000000000000000000000000000000000010000000000000000000000002e8e19b402460c859b6e07a71b29b01c8c5a420f",
            "swapDataDst": "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000007dd156190000000000000000000000000000000000000000000000000dd3b0af46c4b8b5000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000b2c639c533813f4aa9d7837caf62653d097ff85000000000000000000000000420000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000010000000000000000000000009293cb3dec942c9f0a76d1c9131d923d2713a1f6",
            "nativeDstAddress": "undefined",
            "routeAsset": {
              "canonicalAssetId": "USDC",
              "providerAssetId": "CCTP:8453:usdc",
              "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
              "decimals": 6,
              "assetKind": "erc20",
              "assetStandard": "erc20"
            }
          },
          "feeAmountToken": "3000000000000000",
          "minSrcSwapOut": "2100736857",
          "providerFeeUSD": 0.422259,
          "protocolFeeUSD": 0.003,
          "railPluginId": "0x9181644edfd36b07ccd623494a3681a4a6b9cd5d52611accda20264cd09259ac",
          "railData": "0x00000000000000000000000000000000000000000000000000000000000003e800000000000000000000000000000000000000000000000000000000000ce2e6",
          "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapDataSrc": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000dd60e37b9108000000000000000000000000000000000000000000000000000000000007dd7c78c000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000020000000000000000000000004200000000000000000000000000000000000006000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda0291300000000000000000000000000000000000000000000000000000000000000010000000000000000000000002e8e19b402460c859b6e07a71b29b01c8c5a420f",
          "swapDataDst": "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000007dd156190000000000000000000000000000000000000000000000000dd3b0af46c4b8b5000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000b2c639c533813f4aa9d7837caf62653d097ff85000000000000000000000000420000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000010000000000000000000000009293cb3dec942c9f0a76d1c9131d923d2713a1f6",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      },
      {
        "offerId": "0xe294fbe39614c6fe351107484f63b23d0f2bdf26719f3741a5b1664dfc333c9a",
        "rail": "LAYERZERO",
        "offerType": "lz_stargate_pool",
        "railType": "messaging",
        "srcChainId": 8453,
        "dstChainId": 10,
        "tokenIn": "0x4200000000000000000000000000000000000006",
        "tokenOut": "0x4200000000000000000000000000000000000006",
        "amountIn": "1000000000000000000",
        "estimatedOut": "996533482154830213",
        "minAmountOut": "995536948672675382",
        "expiresAt": 1779466330,
        "deliveryShape": "src_and_dst_swap_required",
        "executionMode": "router_intent",
        "routeAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "economics": {
          "providerFeeUSD": 0.35,
          "protocolFeeUSD": 0.003,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 300
        },
        "execution": {
          "quote": {
            "intentId": "0xe294fbe39614c6fe351107484f63b23d0f2bdf26719f3741a5b1664dfc333c9a",
            "srcChainId": 8453,
            "dstChainId": 10,
            "tokenIn": "0x4200000000000000000000000000000000000006",
            "tokenOut": "0x4200000000000000000000000000000000000006",
            "amountIn": "1000000000000000000",
            "estimatedOut": "996533482154830213",
            "minAmountOut": "995536948672675382",
            "minSrcSwapOut": "2100736857",
            "feeAmountUSD": 0.003,
            "feeAmountToken": "3000000000000000",
            "rail": "LAYERZERO",
            "railType": "messaging",
            "settlementToken": "USDC",
            "settlementAssetId": "0xf7135e5fd9158c9cea11c421e7df327b195498f7dacd89fb0de0449e618c4027",
            "expectedDstSettlementToken": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
            "expectedDstSettlementAssetId": "0xc9e6c698b6a822819702171c2ca95ee8e0bd8b87d4d4954b42a3ef3815a80042",
            "minSettlementAmount": "2109182030",
            "dstGasLimit": 240000,
            "etaSeconds": 300,
            "expiresAt": 1779466330,
            "railPluginId": "0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc",
            "railData": "0x000000000000000000000000000000000000000000000000000000000000000200000000000000000000000027a16dc786820b16e5c9028b75b99f6f604b5d260000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a800000000000000000000000000000000000000000",
            "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapDataSrc": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000dd60e37b9108000000000000000000000000000000000000000000000000000000000007dd7c78c000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000020000000000000000000000004200000000000000000000000000000000000006000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda0291300000000000000000000000000000000000000000000000000000000000000010000000000000000000000002e8e19b402460c859b6e07a71b29b01c8c5a420f",
            "swapDataDst": "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000007dd7c78c0000000000000000000000000000000000000000000000000dd465ec129f2985000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000b2c639c533813f4aa9d7837caf62653d097ff85000000000000000000000000420000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000010000000000000000000000009293cb3dec942c9f0a76d1c9131d923d2713a1f6",
            "nativeDstAddress": "undefined",
            "routeAsset": {
              "canonicalAssetId": "USDC",
              "providerAssetId": "layerzero:usdc",
              "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              "srcTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              "dstTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
              "decimals": 6,
              "assetKind": "erc20",
              "assetStandard": "stargate_pool"
            }
          },
          "feeAmountToken": "3000000000000000",
          "minSrcSwapOut": "2100736857",
          "providerFeeUSD": 0.35,
          "protocolFeeUSD": 0.003,
          "railPluginId": "0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc",
          "railData": "0x000000000000000000000000000000000000000000000000000000000000000200000000000000000000000027a16dc786820b16e5c9028b75b99f6f604b5d260000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a800000000000000000000000000000000000000000",
          "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapDataSrc": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000dd60e37b9108000000000000000000000000000000000000000000000000000000000007dd7c78c000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000020000000000000000000000004200000000000000000000000000000000000006000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda0291300000000000000000000000000000000000000000000000000000000000000010000000000000000000000002e8e19b402460c859b6e07a71b29b01c8c5a420f",
          "swapDataDst": "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000007dd7c78c0000000000000000000000000000000000000000000000000dd465ec129f2985000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000b2c639c533813f4aa9d7837caf62653d097ff85000000000000000000000000420000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000010000000000000000000000009293cb3dec942c9f0a76d1c9131d923d2713a1f6",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      },
      {
        "offerId": "0x0f5a7291e6cc9988f0604ecbd7e9db0bebb7d2447978697e9bce1ff42b6fccf2",
        "rail": "LAYERZERO",
        "offerType": "lz_api_direct",
        "railType": "messaging",
        "srcChainId": 8453,
        "dstChainId": 10,
        "tokenIn": "0x4200000000000000000000000000000000000006",
        "tokenOut": "0x4200000000000000000000000000000000000006",
        "amountIn": "1000000000000000000",
        "estimatedOut": "998137583995165850",
        "minAmountOut": "988156208155214191",
        "expiresAt": 1779466333,
        "deliveryShape": "direct",
        "executionMode": "provider_direct",
        "routeAsset": {
          "canonicalAssetId": "WETH",
          "providerAssetId": "layerzero-api:base:0x4200000000000000000000000000000000000006",
          "tokenAddress": "0x4200000000000000000000000000000000000006",
          "srcTokenAddress": "0x4200000000000000000000000000000000000006",
          "dstTokenAddress": "0x4200000000000000000000000000000000000006",
          "decimals": 18,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "WETH",
          "providerAssetId": "layerzero-api:base:0x4200000000000000000000000000000000000006",
          "tokenAddress": "0x4200000000000000000000000000000000000006",
          "srcTokenAddress": "0x4200000000000000000000000000000000000006",
          "dstTokenAddress": "0x4200000000000000000000000000000000000006",
          "decimals": 18,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "WETH",
          "providerAssetId": "layerzero-api:optimism:0x4200000000000000000000000000000000000006",
          "tokenAddress": "0x4200000000000000000000000000000000000006",
          "srcTokenAddress": "0x4200000000000000000000000000000000000006",
          "dstTokenAddress": "0x4200000000000000000000000000000000000006",
          "decimals": 18,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "economics": {
          "providerFeeUSD": 1.96777543,
          "protocolFeeUSD": 0,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 4
        },
        "execution": {
          "provider": "layerzero_value_transfer_api",
          "quote": {
            "intentId": "0x0f5a7291e6cc9988f0604ecbd7e9db0bebb7d2447978697e9bce1ff42b6fccf2",
            "srcChainId": 8453,
            "dstChainId": 10,
            "tokenIn": "0x4200000000000000000000000000000000000006",
            "tokenOut": "0x4200000000000000000000000000000000000006",
            "amountIn": "1000000000000000000",
            "estimatedOut": "998137583995165850",
            "minAmountOut": "988156208155214191",
            "minSrcSwapOut": "0",
            "feeAmountUSD": 1.96777543,
            "feeAmountToken": "0",
            "rail": "LAYERZERO",
            "railType": "messaging",
            "settlementToken": "ETH",
            "routeAsset": {
              "canonicalAssetId": "WETH",
              "providerAssetId": "layerzero-api:base:0x4200000000000000000000000000000000000006",
              "tokenAddress": "0x4200000000000000000000000000000000000006",
              "srcTokenAddress": "0x4200000000000000000000000000000000000006",
              "dstTokenAddress": "0x4200000000000000000000000000000000000006",
              "decimals": 18,
              "assetKind": "erc20",
              "assetStandard": "erc20"
            },
            "settlementAssetId": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "expectedDstSettlementToken": "0x4200000000000000000000000000000000000006",
            "expectedDstSettlementAssetId": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "minSettlementAmount": "988156208155214191",
            "dstGasLimit": 0,
            "etaSeconds": 4,
            "expiresAt": 1779466333,
            "railPluginId": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "railData": "0x",
            "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapDataSrc": "0x",
            "swapDataDst": "0x",
            "nativeDstAddress": "undefined",
            "layerZeroValueTransferApiQuoteId": "0x00000000000000000000000000000000019e5073958a7779b5f2cc2b84b27c48",
            "layerZeroValueTransferApiRouteSteps": [
              {
                "type": "AORI_V1",
                "srcChainKey": "base",
                "description": "Aori"
              }
            ],
            "layerZeroValueTransferApiUserSteps": [
              {
                "type": "TRANSACTION",
                "description": "approve",
                "chainKey": "base",
                "chainType": "EVM",
                "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
                "transaction": {
                  "encoded": {
                    "chainId": 8453,
                    "data": "0x095ea7b3000000000000000000000000c6868edf1d2a7a8b759856cb8afa333210dfeda60000000000000000000000000000000000000000000000000de0b6b3a7640000",
                    "from": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                    "to": "0x4200000000000000000000000000000000000006"
                  }
                }
              },
              {
                "type": "SIGNATURE",
                "description": "bridge",
                "chainKey": "base",
                "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
                "signature": {
                  "type": "EIP712",
                  "typedData": {
                    "primaryType": "Order",
                    "domain": {
                      "name": "Aori",
                      "version": "0.3.1",
                      "verifyingContract": "0xc6868edf1d2a7a8b759856cb8afa333210dfeda6"
                    },
                    "types": {
                      "EIP712Domain": [
                        {
                          "name": "name",
                          "type": "string"
                        },
                        {
                          "name": "version",
                          "type": "string"
                        },
                        {
                          "name": "verifyingContract",
                          "type": "address"
                        }
                      ],
                      "Order": [
                        {
                          "name": "inputAmount",
                          "type": "uint128"
                        },
                        {
                          "name": "outputAmount",
                          "type": "uint128"
                        },
                        {
                          "name": "inputToken",
                          "type": "address"
                        },
                        {
                          "name": "outputToken",
                          "type": "address"
                        },
                        {
                          "name": "startTime",
                          "type": "uint32"
                        },
                        {
                          "name": "endTime",
                          "type": "uint32"
                        },
                        {
                          "name": "srcEid",
                          "type": "uint32"
                        },
                        {
                          "name": "dstEid",
                          "type": "uint32"
                        },
                        {
                          "name": "offerer",
                          "type": "address"
                        },
                        {
                          "name": "recipient",
                          "type": "address"
                        }
                      ]
                    },
                    "message": {
                      "offerer": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                      "recipient": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                      "inputToken": "0x4200000000000000000000000000000000000006",
                      "outputToken": "0x4200000000000000000000000000000000000006",
                      "inputAmount": "1000000000000000000",
                      "outputAmount": "998137583995165850",
                      "startTime": "1779466212",
                      "endTime": "1779466302",
                      "srcEid": 30184,
                      "dstEid": 30111
                    }
                  }
                }
              }
            ]
          },
          "layerZeroValueTransferApiQuoteId": "0x00000000000000000000000000000000019e5073958a7779b5f2cc2b84b27c48",
          "layerZeroValueTransferApiQuote": {
            "id": "0x00000000000000000000000000000000019e5073958a7779b5f2cc2b84b27c48",
            "routeSteps": [
              {
                "type": "AORI_V1",
                "srcChainKey": "base",
                "description": "Aori"
              }
            ],
            "fees": [
              {
                "chainKey": "base",
                "type": "GENERAL",
                "description": "Aori Fees",
                "amount": "929719906390743",
                "address": "0x4200000000000000000000000000000000000006"
              }
            ],
            "duration": {
              "estimated": "4000"
            },
            "feeUsd": "1.96777543",
            "feePercent": "0.00092972",
            "srcAmount": "1000000000000000000",
            "dstAmount": "998137583995165850",
            "dstAmountMin": "988156208155214191",
            "srcAmountUsd": "2116.52500220",
            "dstAmountUsd": "2114.55722677",
            "userSteps": [
              {
                "type": "TRANSACTION",
                "description": "approve",
                "chainKey": "base",
                "chainType": "EVM",
                "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
                "transaction": {
                  "encoded": {
                    "chainId": 8453,
                    "data": "0x095ea7b3000000000000000000000000c6868edf1d2a7a8b759856cb8afa333210dfeda60000000000000000000000000000000000000000000000000de0b6b3a7640000",
                    "from": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                    "to": "0x4200000000000000000000000000000000000006"
                  }
                }
              },
              {
                "type": "SIGNATURE",
                "description": "bridge",
                "chainKey": "base",
                "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
                "signature": {
                  "type": "EIP712",
                  "typedData": {
                    "primaryType": "Order",
                    "domain": {
                      "name": "Aori",
                      "version": "0.3.1",
                      "verifyingContract": "0xc6868edf1d2a7a8b759856cb8afa333210dfeda6"
                    },
                    "types": {
                      "EIP712Domain": [
                        {
                          "name": "name",
                          "type": "string"
                        },
                        {
                          "name": "version",
                          "type": "string"
                        },
                        {
                          "name": "verifyingContract",
                          "type": "address"
                        }
                      ],
                      "Order": [
                        {
                          "name": "inputAmount",
                          "type": "uint128"
                        },
                        {
                          "name": "outputAmount",
                          "type": "uint128"
                        },
                        {
                          "name": "inputToken",
                          "type": "address"
                        },
                        {
                          "name": "outputToken",
                          "type": "address"
                        },
                        {
                          "name": "startTime",
                          "type": "uint32"
                        },
                        {
                          "name": "endTime",
                          "type": "uint32"
                        },
                        {
                          "name": "srcEid",
                          "type": "uint32"
                        },
                        {
                          "name": "dstEid",
                          "type": "uint32"
                        },
                        {
                          "name": "offerer",
                          "type": "address"
                        },
                        {
                          "name": "recipient",
                          "type": "address"
                        }
                      ]
                    },
                    "message": {
                      "offerer": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                      "recipient": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                      "inputToken": "0x4200000000000000000000000000000000000006",
                      "outputToken": "0x4200000000000000000000000000000000000006",
                      "inputAmount": "1000000000000000000",
                      "outputAmount": "998137583995165850",
                      "startTime": "1779466212",
                      "endTime": "1779466302",
                      "srcEid": 30184,
                      "dstEid": 30111
                    }
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
              "chainKey": "base",
              "chainType": "EVM",
              "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
              "transaction": {
                "encoded": {
                  "chainId": 8453,
                  "data": "0x095ea7b3000000000000000000000000c6868edf1d2a7a8b759856cb8afa333210dfeda60000000000000000000000000000000000000000000000000de0b6b3a7640000",
                  "from": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                  "to": "0x4200000000000000000000000000000000000006"
                }
              }
            },
            {
              "type": "SIGNATURE",
              "description": "bridge",
              "chainKey": "base",
              "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
              "signature": {
                "type": "EIP712",
                "typedData": {
                  "primaryType": "Order",
                  "domain": {
                    "name": "Aori",
                    "version": "0.3.1",
                    "verifyingContract": "0xc6868edf1d2a7a8b759856cb8afa333210dfeda6"
                  },
                  "types": {
                    "EIP712Domain": [
                      {
                        "name": "name",
                        "type": "string"
                      },
                      {
                        "name": "version",
                        "type": "string"
                      },
                      {
                        "name": "verifyingContract",
                        "type": "address"
                      }
                    ],
                    "Order": [
                      {
                        "name": "inputAmount",
                        "type": "uint128"
                      },
                      {
                        "name": "outputAmount",
                        "type": "uint128"
                      },
                      {
                        "name": "inputToken",
                        "type": "address"
                      },
                      {
                        "name": "outputToken",
                        "type": "address"
                      },
                      {
                        "name": "startTime",
                        "type": "uint32"
                      },
                      {
                        "name": "endTime",
                        "type": "uint32"
                      },
                      {
                        "name": "srcEid",
                        "type": "uint32"
                      },
                      {
                        "name": "dstEid",
                        "type": "uint32"
                      },
                      {
                        "name": "offerer",
                        "type": "address"
                      },
                      {
                        "name": "recipient",
                        "type": "address"
                      }
                    ]
                  },
                  "message": {
                    "offerer": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                    "recipient": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                    "inputToken": "0x4200000000000000000000000000000000000006",
                    "outputToken": "0x4200000000000000000000000000000000000006",
                    "inputAmount": "1000000000000000000",
                    "outputAmount": "998137583995165850",
                    "startTime": "1779466212",
                    "endTime": "1779466302",
                    "srcEid": 30184,
                    "dstEid": 30111
                  }
                }
              }
            }
          ],
          "layerZeroValueTransferApiRouteSteps": [
            {
              "type": "AORI_V1",
              "srcChainKey": "base",
              "description": "Aori"
            }
          ],
          "feeUsd": 1.96777543
        }
      }
    ],
    "bestOfferId": "0xbc0867e2e986f1c9e0f584a0a0cf1f7395754b4ad18332ced03c2f1cc405330c"
  }
}

------

# OP to Base WETH: 

curl -X 'POST' \
  'http://localhost:8787/api/v1/quote' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "tokenIn": "0x4200000000000000000000000000000000000006",
  "tokenOut": "0x4200000000000000000000000000000000000006",
  "amountIn": "1000000000000000000",
  "srcChainId": 10,
  "dstChainId": 8453,
  "userAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
  "urgency": "fast"
}'

{
  "offerSet": {
    "offerSetId": "0x82ec695f590abd79f59b2c2ba6b908383f9076bd504574e0284e6c90e7c3e08a",
    "expiresAt": 1779466492,
    "offers": [
      {
        "offerId": "0xbc4bfdc76b2dac95414aad8d59edcb4adaa9c95843bc7ae3f616e1515f3e493c",
        "rail": "CCTP",
        "offerType": "cctp_fast",
        "railType": "messaging",
        "srcChainId": 10,
        "dstChainId": 8453,
        "tokenIn": "0x4200000000000000000000000000000000000006",
        "tokenOut": "0x4200000000000000000000000000000000000006",
        "amountIn": "1000000000000000000",
        "estimatedOut": "995896052673906154",
        "minAmountOut": "994900156621232247",
        "expiresAt": 1779466492,
        "deliveryShape": "src_and_dst_swap_required",
        "executionMode": "router_intent",
        "routeAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:10:usdc",
          "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "dstTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:10:usdc",
          "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "dstTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:10:usdc",
          "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "dstTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "economics": {
          "providerFeeUSD": 0.422036,
          "protocolFeeUSD": 0.003,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 8,
          "outboundFeeUSD": 0.422036
        },
        "execution": {
          "quote": {
            "intentId": "0xbc4bfdc76b2dac95414aad8d59edcb4adaa9c95843bc7ae3f616e1515f3e493c",
            "srcChainId": 10,
            "dstChainId": 8453,
            "tokenIn": "0x4200000000000000000000000000000000000006",
            "tokenOut": "0x4200000000000000000000000000000000000006",
            "amountIn": "1000000000000000000",
            "estimatedOut": "995896052673906154",
            "minAmountOut": "994900156621232247",
            "minSrcSwapOut": "2099628796",
            "feeAmountUSD": 0.003,
            "feeAmountToken": "3000000000000000",
            "rail": "CCTP",
            "railType": "messaging",
            "settlementToken": "USDC",
            "settlementAssetId": "0xc9e6c698b6a822819702171c2ca95ee8e0bd8b87d4d4954b42a3ef3815a80042",
            "expectedDstSettlementToken": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "expectedDstSettlementAssetId": "0xf7135e5fd9158c9cea11c421e7df327b195498f7dacd89fb0de0449e618c4027",
            "minSettlementAmount": "2107647901",
            "dstGasLimit": 200000,
            "etaSeconds": 8,
            "expiresAt": 1779466492,
            "railPluginId": "0x9181644edfd36b07ccd623494a3681a4a6b9cd5d52611accda20264cd09259ac",
            "railData": "0x00000000000000000000000000000000000000000000000000000000000003e800000000000000000000000000000000000000000000000000000000000ce128",
            "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapDataSrc": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000dd60e37b9108000000000000000000000000000000000000000000000000000000000007dc6c96f000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000200000000000000000000000042000000000000000000000000000000000000060000000000000000000000000b2c639c533813f4aa9d7837caf62653d097ff8500000000000000000000000000000000000000000000000000000000000000010000000000000000000000009293cb3dec942c9f0a76d1c9131d923d2713a1f6",
            "swapDataDst": "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000007dc058db0000000000000000000000000000000000000000000000000dd2222ef4d785ea000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913000000000000000000000000420000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000010000000000000000000000002e8e19b402460c859b6e07a71b29b01c8c5a420f",
            "nativeDstAddress": "undefined",
            "routeAsset": {
              "canonicalAssetId": "USDC",
              "providerAssetId": "CCTP:10:usdc",
              "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
              "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
              "dstTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              "decimals": 6,
              "assetKind": "erc20",
              "assetStandard": "erc20"
            }
          },
          "feeAmountToken": "3000000000000000",
          "minSrcSwapOut": "2099628796",
          "providerFeeUSD": 0.422036,
          "protocolFeeUSD": 0.003,
          "railPluginId": "0x9181644edfd36b07ccd623494a3681a4a6b9cd5d52611accda20264cd09259ac",
          "railData": "0x00000000000000000000000000000000000000000000000000000000000003e800000000000000000000000000000000000000000000000000000000000ce128",
          "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapDataSrc": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000dd60e37b9108000000000000000000000000000000000000000000000000000000000007dc6c96f000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000200000000000000000000000042000000000000000000000000000000000000060000000000000000000000000b2c639c533813f4aa9d7837caf62653d097ff8500000000000000000000000000000000000000000000000000000000000000010000000000000000000000009293cb3dec942c9f0a76d1c9131d923d2713a1f6",
          "swapDataDst": "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000007dc058db0000000000000000000000000000000000000000000000000dd2222ef4d785ea000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913000000000000000000000000420000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000010000000000000000000000002e8e19b402460c859b6e07a71b29b01c8c5a420f",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      },
      {
        "offerId": "0x42b107f0bf39d6fd84c2dc5dc86c72ee036c35bbc0a0696cc79fe7c861308131",
        "rail": "LAYERZERO",
        "offerType": "lz_stargate_pool",
        "railType": "messaging",
        "srcChainId": 10,
        "dstChainId": 8453,
        "tokenIn": "0x4200000000000000000000000000000000000006",
        "tokenOut": "0x4200000000000000000000000000000000000006",
        "amountIn": "1000000000000000000",
        "estimatedOut": "996095266074999321",
        "minAmountOut": "995099170808924321",
        "expiresAt": 1779466492,
        "deliveryShape": "src_and_dst_swap_required",
        "executionMode": "router_intent",
        "routeAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "dstTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "dstTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
          "dstTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "economics": {
          "providerFeeUSD": 0.35,
          "protocolFeeUSD": 0.003,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 300
        },
        "execution": {
          "quote": {
            "intentId": "0x42b107f0bf39d6fd84c2dc5dc86c72ee036c35bbc0a0696cc79fe7c861308131",
            "srcChainId": 10,
            "dstChainId": 8453,
            "tokenIn": "0x4200000000000000000000000000000000000006",
            "tokenOut": "0x4200000000000000000000000000000000000006",
            "amountIn": "1000000000000000000",
            "estimatedOut": "996095266074999321",
            "minAmountOut": "995099170808924321",
            "minSrcSwapOut": "2099628796",
            "feeAmountUSD": 0.003,
            "feeAmountToken": "3000000000000000",
            "rail": "LAYERZERO",
            "railType": "messaging",
            "settlementToken": "USDC",
            "settlementAssetId": "0xc9e6c698b6a822819702171c2ca95ee8e0bd8b87d4d4954b42a3ef3815a80042",
            "expectedDstSettlementToken": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "expectedDstSettlementAssetId": "0xf7135e5fd9158c9cea11c421e7df327b195498f7dacd89fb0de0449e618c4027",
            "minSettlementAmount": "2108069515",
            "dstGasLimit": 240000,
            "etaSeconds": 300,
            "expiresAt": 1779466492,
            "railPluginId": "0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc",
            "railData": "0x0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000ce8cca271ebc0533920c83d39f417ed6a0abb7d00000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a800000000000000000000000000000000000000000",
            "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapDataSrc": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000dd60e37b9108000000000000000000000000000000000000000000000000000000000007dc6c96f000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000200000000000000000000000042000000000000000000000000000000000000060000000000000000000000000b2c639c533813f4aa9d7837caf62653d097ff8500000000000000000000000000000000000000000000000000000000000000010000000000000000000000009293cb3dec942c9f0a76d1c9131d923d2713a1f6",
            "swapDataDst": "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000007dc6c96f0000000000000000000000000000000000000000000000000dd2d75df0d93a19000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913000000000000000000000000420000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000010000000000000000000000002e8e19b402460c859b6e07a71b29b01c8c5a420f",
            "nativeDstAddress": "undefined",
            "routeAsset": {
              "canonicalAssetId": "USDC",
              "providerAssetId": "layerzero:usdc",
              "tokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
              "srcTokenAddress": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
              "dstTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              "decimals": 6,
              "assetKind": "erc20",
              "assetStandard": "stargate_pool"
            }
          },
          "feeAmountToken": "3000000000000000",
          "minSrcSwapOut": "2099628796",
          "providerFeeUSD": 0.35,
          "protocolFeeUSD": 0.003,
          "railPluginId": "0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc",
          "railData": "0x0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000ce8cca271ebc0533920c83d39f417ed6a0abb7d00000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a800000000000000000000000000000000000000000",
          "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapDataSrc": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000dd60e37b9108000000000000000000000000000000000000000000000000000000000007dc6c96f000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000200000000000000000000000042000000000000000000000000000000000000060000000000000000000000000b2c639c533813f4aa9d7837caf62653d097ff8500000000000000000000000000000000000000000000000000000000000000010000000000000000000000009293cb3dec942c9f0a76d1c9131d923d2713a1f6",
          "swapDataDst": "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000007dc6c96f0000000000000000000000000000000000000000000000000dd2d75df0d93a19000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913000000000000000000000000420000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000010000000000000000000000002e8e19b402460c859b6e07a71b29b01c8c5a420f",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      },
      {
        "offerId": "0x0d920de30fd684e58760678f8a261e3660983c934346611f23cdc6844acd9ed7",
        "rail": "LAYERZERO",
        "offerType": "lz_api_direct",
        "railType": "messaging",
        "srcChainId": 10,
        "dstChainId": 8453,
        "tokenIn": "0x4200000000000000000000000000000000000006",
        "tokenOut": "0x4200000000000000000000000000000000000006",
        "amountIn": "1000000000000000000",
        "estimatedOut": "998048872118757531",
        "minAmountOut": "988068383397569955",
        "expiresAt": 1779466494,
        "deliveryShape": "direct",
        "executionMode": "provider_direct",
        "routeAsset": {
          "canonicalAssetId": "WETH",
          "providerAssetId": "layerzero-api:optimism:0x4200000000000000000000000000000000000006",
          "tokenAddress": "0x4200000000000000000000000000000000000006",
          "srcTokenAddress": "0x4200000000000000000000000000000000000006",
          "dstTokenAddress": "0x4200000000000000000000000000000000000006",
          "decimals": 18,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "WETH",
          "providerAssetId": "layerzero-api:optimism:0x4200000000000000000000000000000000000006",
          "tokenAddress": "0x4200000000000000000000000000000000000006",
          "srcTokenAddress": "0x4200000000000000000000000000000000000006",
          "dstTokenAddress": "0x4200000000000000000000000000000000000006",
          "decimals": 18,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "WETH",
          "providerAssetId": "layerzero-api:base:0x4200000000000000000000000000000000000006",
          "tokenAddress": "0x4200000000000000000000000000000000000006",
          "srcTokenAddress": "0x4200000000000000000000000000000000000006",
          "dstTokenAddress": "0x4200000000000000000000000000000000000006",
          "decimals": 18,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "economics": {
          "providerFeeUSD": 5.7365386,
          "protocolFeeUSD": 0,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 4
        },
        "execution": {
          "provider": "layerzero_value_transfer_api",
          "quote": {
            "intentId": "0x0d920de30fd684e58760678f8a261e3660983c934346611f23cdc6844acd9ed7",
            "srcChainId": 10,
            "dstChainId": 8453,
            "tokenIn": "0x4200000000000000000000000000000000000006",
            "tokenOut": "0x4200000000000000000000000000000000000006",
            "amountIn": "1000000000000000000",
            "estimatedOut": "998048872118757531",
            "minAmountOut": "988068383397569955",
            "minSrcSwapOut": "0",
            "feeAmountUSD": 5.7365386,
            "feeAmountToken": "0",
            "rail": "LAYERZERO",
            "railType": "messaging",
            "settlementToken": "ETH",
            "routeAsset": {
              "canonicalAssetId": "WETH",
              "providerAssetId": "layerzero-api:optimism:0x4200000000000000000000000000000000000006",
              "tokenAddress": "0x4200000000000000000000000000000000000006",
              "srcTokenAddress": "0x4200000000000000000000000000000000000006",
              "dstTokenAddress": "0x4200000000000000000000000000000000000006",
              "decimals": 18,
              "assetKind": "erc20",
              "assetStandard": "erc20"
            },
            "settlementAssetId": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "expectedDstSettlementToken": "0x4200000000000000000000000000000000000006",
            "expectedDstSettlementAssetId": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "minSettlementAmount": "988068383397569955",
            "dstGasLimit": 0,
            "etaSeconds": 4,
            "expiresAt": 1779466494,
            "railPluginId": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "railData": "0x",
            "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapDataSrc": "0x",
            "swapDataDst": "0x",
            "nativeDstAddress": "undefined",
            "layerZeroValueTransferApiQuoteId": "0x00000000000000000000000000000000019e50760a67764abab9ec473a85822d",
            "layerZeroValueTransferApiRouteSteps": [
              {
                "type": "AORI_V1",
                "srcChainKey": "optimism",
                "description": "Aori"
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
                    "data": "0x095ea7b3000000000000000000000000c6868edf1d2a7a8b759856cb8afa333210dfeda60000000000000000000000000000000000000000000000000de0b6b3a7640000",
                    "from": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                    "to": "0x4200000000000000000000000000000000000006"
                  }
                }
              },
              {
                "type": "SIGNATURE",
                "description": "bridge",
                "chainKey": "optimism",
                "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
                "signature": {
                  "type": "EIP712",
                  "typedData": {
                    "primaryType": "Order",
                    "domain": {
                      "name": "Aori",
                      "version": "0.3.1",
                      "verifyingContract": "0xc6868edf1d2a7a8b759856cb8afa333210dfeda6"
                    },
                    "types": {
                      "EIP712Domain": [
                        {
                          "name": "name",
                          "type": "string"
                        },
                        {
                          "name": "version",
                          "type": "string"
                        },
                        {
                          "name": "verifyingContract",
                          "type": "address"
                        }
                      ],
                      "Order": [
                        {
                          "name": "inputAmount",
                          "type": "uint128"
                        },
                        {
                          "name": "outputAmount",
                          "type": "uint128"
                        },
                        {
                          "name": "inputToken",
                          "type": "address"
                        },
                        {
                          "name": "outputToken",
                          "type": "address"
                        },
                        {
                          "name": "startTime",
                          "type": "uint32"
                        },
                        {
                          "name": "endTime",
                          "type": "uint32"
                        },
                        {
                          "name": "srcEid",
                          "type": "uint32"
                        },
                        {
                          "name": "dstEid",
                          "type": "uint32"
                        },
                        {
                          "name": "offerer",
                          "type": "address"
                        },
                        {
                          "name": "recipient",
                          "type": "address"
                        }
                      ]
                    },
                    "message": {
                      "offerer": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                      "recipient": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                      "inputToken": "0x4200000000000000000000000000000000000006",
                      "outputToken": "0x4200000000000000000000000000000000000006",
                      "inputAmount": "1000000000000000000",
                      "outputAmount": "998048872118757531",
                      "startTime": "1779466373",
                      "endTime": "1779466463",
                      "srcEid": 30111,
                      "dstEid": 30184
                    }
                  }
                }
              }
            ]
          },
          "layerZeroValueTransferApiQuoteId": "0x00000000000000000000000000000000019e50760a67764abab9ec473a85822d",
          "layerZeroValueTransferApiQuote": {
            "id": "0x00000000000000000000000000000000019e50760a67764abab9ec473a85822d",
            "routeSteps": [
              {
                "type": "AORI_V1",
                "srcChainKey": "optimism",
                "description": "Aori"
              }
            ],
            "fees": [
              {
                "chainKey": "optimism",
                "type": "GENERAL",
                "description": "Aori Fees",
                "amount": "2707915003542974",
                "address": "0x4200000000000000000000000000000000000006"
              }
            ],
            "duration": {
              "estimated": "4000"
            },
            "feeUsd": "5.73653860",
            "feePercent": "0.00270792",
            "srcAmount": "1000000000000000000",
            "dstAmount": "998048872118757531",
            "dstAmountMin": "988068383397569955",
            "srcAmountUsd": "2118.43377449",
            "dstAmountUsd": "2112.69723589",
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
                    "data": "0x095ea7b3000000000000000000000000c6868edf1d2a7a8b759856cb8afa333210dfeda60000000000000000000000000000000000000000000000000de0b6b3a7640000",
                    "from": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                    "to": "0x4200000000000000000000000000000000000006"
                  }
                }
              },
              {
                "type": "SIGNATURE",
                "description": "bridge",
                "chainKey": "optimism",
                "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
                "signature": {
                  "type": "EIP712",
                  "typedData": {
                    "primaryType": "Order",
                    "domain": {
                      "name": "Aori",
                      "version": "0.3.1",
                      "verifyingContract": "0xc6868edf1d2a7a8b759856cb8afa333210dfeda6"
                    },
                    "types": {
                      "EIP712Domain": [
                        {
                          "name": "name",
                          "type": "string"
                        },
                        {
                          "name": "version",
                          "type": "string"
                        },
                        {
                          "name": "verifyingContract",
                          "type": "address"
                        }
                      ],
                      "Order": [
                        {
                          "name": "inputAmount",
                          "type": "uint128"
                        },
                        {
                          "name": "outputAmount",
                          "type": "uint128"
                        },
                        {
                          "name": "inputToken",
                          "type": "address"
                        },
                        {
                          "name": "outputToken",
                          "type": "address"
                        },
                        {
                          "name": "startTime",
                          "type": "uint32"
                        },
                        {
                          "name": "endTime",
                          "type": "uint32"
                        },
                        {
                          "name": "srcEid",
                          "type": "uint32"
                        },
                        {
                          "name": "dstEid",
                          "type": "uint32"
                        },
                        {
                          "name": "offerer",
                          "type": "address"
                        },
                        {
                          "name": "recipient",
                          "type": "address"
                        }
                      ]
                    },
                    "message": {
                      "offerer": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                      "recipient": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                      "inputToken": "0x4200000000000000000000000000000000000006",
                      "outputToken": "0x4200000000000000000000000000000000000006",
                      "inputAmount": "1000000000000000000",
                      "outputAmount": "998048872118757531",
                      "startTime": "1779466373",
                      "endTime": "1779466463",
                      "srcEid": 30111,
                      "dstEid": 30184
                    }
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
                  "data": "0x095ea7b3000000000000000000000000c6868edf1d2a7a8b759856cb8afa333210dfeda60000000000000000000000000000000000000000000000000de0b6b3a7640000",
                  "from": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                  "to": "0x4200000000000000000000000000000000000006"
                }
              }
            },
            {
              "type": "SIGNATURE",
              "description": "bridge",
              "chainKey": "optimism",
              "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
              "signature": {
                "type": "EIP712",
                "typedData": {
                  "primaryType": "Order",
                  "domain": {
                    "name": "Aori",
                    "version": "0.3.1",
                    "verifyingContract": "0xc6868edf1d2a7a8b759856cb8afa333210dfeda6"
                  },
                  "types": {
                    "EIP712Domain": [
                      {
                        "name": "name",
                        "type": "string"
                      },
                      {
                        "name": "version",
                        "type": "string"
                      },
                      {
                        "name": "verifyingContract",
                        "type": "address"
                      }
                    ],
                    "Order": [
                      {
                        "name": "inputAmount",
                        "type": "uint128"
                      },
                      {
                        "name": "outputAmount",
                        "type": "uint128"
                      },
                      {
                        "name": "inputToken",
                        "type": "address"
                      },
                      {
                        "name": "outputToken",
                        "type": "address"
                      },
                      {
                        "name": "startTime",
                        "type": "uint32"
                      },
                      {
                        "name": "endTime",
                        "type": "uint32"
                      },
                      {
                        "name": "srcEid",
                        "type": "uint32"
                      },
                      {
                        "name": "dstEid",
                        "type": "uint32"
                      },
                      {
                        "name": "offerer",
                        "type": "address"
                      },
                      {
                        "name": "recipient",
                        "type": "address"
                      }
                    ]
                  },
                  "message": {
                    "offerer": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                    "recipient": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                    "inputToken": "0x4200000000000000000000000000000000000006",
                    "outputToken": "0x4200000000000000000000000000000000000006",
                    "inputAmount": "1000000000000000000",
                    "outputAmount": "998048872118757531",
                    "startTime": "1779466373",
                    "endTime": "1779466463",
                    "srcEid": 30111,
                    "dstEid": 30184
                  }
                }
              }
            }
          ],
          "layerZeroValueTransferApiRouteSteps": [
            {
              "type": "AORI_V1",
              "srcChainKey": "optimism",
              "description": "Aori"
            }
          ],
          "feeUsd": 5.7365386
        }
      }
    ],
    "bestOfferId": "0xbc4bfdc76b2dac95414aad8d59edcb4adaa9c95843bc7ae3f616e1515f3e493c"
  }
}

------
# Arb to Base: USDC TO WETH:

curl -X 'POST' \
  'http://localhost:8787/api/v1/quote' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "tokenIn": "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
  "tokenOut": "0x4200000000000000000000000000000000000006",
  "amountIn": "100000000",
  "srcChainId": 42161,
  "dstChainId": 8453,
  "userAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
  "urgency": "fast"
}'

{
  "offerSet": {
    "offerSetId": "0x2d7cb9493c0bca23ea53db7fc834d63dd8a31a333a06f76c763b4d6a5669e768",
    "expiresAt": 1779466688,
    "offers": [
      {
        "offerId": "0x03e9bf42dbd755166dcac803173e0ee45548bd50c8bfa576b2b93fd8c698835a",
        "rail": "CCTP",
        "offerType": "cctp_fast",
        "railType": "messaging",
        "srcChainId": 42161,
        "dstChainId": 8453,
        "tokenIn": "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
        "tokenOut": "0x4200000000000000000000000000000000000006",
        "amountIn": "100000000",
        "estimatedOut": "47086812586550848",
        "minAmountOut": "47039725773964297",
        "expiresAt": 1779466689,
        "deliveryShape": "dst_swap_required",
        "executionMode": "router_intent",
        "routeAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:42161:usdc",
          "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "dstTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:42161:usdc",
          "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "dstTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:42161:usdc",
          "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "dstTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
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
            "intentId": "0x03e9bf42dbd755166dcac803173e0ee45548bd50c8bfa576b2b93fd8c698835a",
            "srcChainId": 42161,
            "dstChainId": 8453,
            "tokenIn": "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
            "tokenOut": "0x4200000000000000000000000000000000000006",
            "amountIn": "100000000",
            "estimatedOut": "47086812586550848",
            "minAmountOut": "47039725773964297",
            "minSrcSwapOut": "0",
            "feeAmountUSD": 0.3,
            "feeAmountToken": "300000",
            "rail": "CCTP",
            "railType": "messaging",
            "settlementToken": "USDC",
            "settlementAssetId": "0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94",
            "expectedDstSettlementToken": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "expectedDstSettlementAssetId": "0xf7135e5fd9158c9cea11c421e7df327b195498f7dacd89fb0de0449e618c4027",
            "minSettlementAmount": "99580379",
            "dstGasLimit": 200000,
            "etaSeconds": 8,
            "expiresAt": 1779466689,
            "railPluginId": "0x9181644edfd36b07ccd623494a3681a4a6b9cd5d52611accda20264cd09259ac",
            "railData": "0x00000000000000000000000000000000000000000000000000000000000003e80000000000000000000000000000000000000000000000000000000000009bc8",
            "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapDataSrc": "0x",
            "swapDataDst": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000005f0ff3c00000000000000000000000000000000000000000000000000a74934e1d3a640000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913000000000000000000000000420000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000010000000000000000000000002e8e19b402460c859b6e07a71b29b01c8c5a420f",
            "nativeDstAddress": "undefined",
            "routeAsset": {
              "canonicalAssetId": "USDC",
              "providerAssetId": "CCTP:42161:usdc",
              "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              "dstTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
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
          "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapDataSrc": "0x",
          "swapDataDst": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000005f0ff3c00000000000000000000000000000000000000000000000000a74934e1d3a640000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913000000000000000000000000420000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000010000000000000000000000002e8e19b402460c859b6e07a71b29b01c8c5a420f",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      },
      {
        "offerId": "0xe71d20903f3916335f64dd831ebdae16485909d0b2c208b58ee660b368630600",
        "rail": "LAYERZERO",
        "offerType": "lz_stargate_pool",
        "railType": "messaging",
        "srcChainId": 42161,
        "dstChainId": 8453,
        "tokenIn": "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
        "tokenOut": "0x4200000000000000000000000000000000000006",
        "amountIn": "100000000",
        "estimatedOut": "47096232289678448",
        "minAmountOut": "47049136057388769",
        "expiresAt": 1779466688,
        "deliveryShape": "dst_swap_required",
        "executionMode": "router_intent",
        "routeAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "dstTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "dstTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "stargate_pool"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero:usdc",
          "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "dstTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
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
            "intentId": "0xe71d20903f3916335f64dd831ebdae16485909d0b2c208b58ee660b368630600",
            "srcChainId": 42161,
            "dstChainId": 8453,
            "tokenIn": "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
            "tokenOut": "0x4200000000000000000000000000000000000006",
            "amountIn": "100000000",
            "estimatedOut": "47096232289678448",
            "minAmountOut": "47049136057388769",
            "minSrcSwapOut": "0",
            "feeAmountUSD": 0.3,
            "feeAmountToken": "300000",
            "rail": "LAYERZERO",
            "railType": "messaging",
            "settlementToken": "USDC",
            "settlementAssetId": "0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94",
            "expectedDstSettlementToken": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "expectedDstSettlementAssetId": "0xf7135e5fd9158c9cea11c421e7df327b195498f7dacd89fb0de0449e618c4027",
            "minSettlementAmount": "99600300",
            "dstGasLimit": 240000,
            "etaSeconds": 300,
            "expiresAt": 1779466688,
            "railPluginId": "0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc",
            "railData": "0x0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000e8cdf27acd73a434d661c84887215f7598e7d0d30000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a800000000000000000000000000000000000000000",
            "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapDataSrc": "0x",
            "swapDataDst": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000005f14d2000000000000000000000000000000000000000000000000000a751c613e2b470000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913000000000000000000000000420000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000010000000000000000000000002e8e19b402460c859b6e07a71b29b01c8c5a420f",
            "nativeDstAddress": "undefined",
            "routeAsset": {
              "canonicalAssetId": "USDC",
              "providerAssetId": "layerzero:usdc",
              "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              "dstTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
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
          "railData": "0x0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000e8cdf27acd73a434d661c84887215f7598e7d0d30000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a800000000000000000000000000000000000000000",
          "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
          "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapDataSrc": "0x",
          "swapDataDst": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000005f14d2000000000000000000000000000000000000000000000000000a751c613e2b470000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913000000000000000000000000420000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000010000000000000000000000002e8e19b402460c859b6e07a71b29b01c8c5a420f",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      },
      {
        "offerId": "0x043255129dc87491dfaa12564227410f6c475d92e634335234dde3b388911ffb",
        "rail": "LAYERZERO",
        "offerType": "lz_api_direct",
        "railType": "messaging",
        "srcChainId": 42161,
        "dstChainId": 8453,
        "tokenIn": "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
        "tokenOut": "0x4200000000000000000000000000000000000006",
        "amountIn": "100000000",
        "estimatedOut": "47171482131331976",
        "minAmountOut": "46699767310018656",
        "expiresAt": 1779466690,
        "deliveryShape": "direct",
        "executionMode": "provider_direct",
        "routeAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero-api:arbitrum:0xaf88d065e77c8cc2239327c5edb3a432268e5831",
          "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "layerzero-api:arbitrum:0xaf88d065e77c8cc2239327c5edb3a432268e5831",
          "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "WETH",
          "providerAssetId": "layerzero-api:base:0x4200000000000000000000000000000000000006",
          "tokenAddress": "0x4200000000000000000000000000000000000006",
          "srcTokenAddress": "0x4200000000000000000000000000000000000006",
          "dstTokenAddress": "0x4200000000000000000000000000000000000006",
          "decimals": 18,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "economics": {
          "providerFeeUSD": 0.0598128,
          "protocolFeeUSD": 0,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 3
        },
        "execution": {
          "provider": "layerzero_value_transfer_api",
          "quote": {
            "intentId": "0x043255129dc87491dfaa12564227410f6c475d92e634335234dde3b388911ffb",
            "srcChainId": 42161,
            "dstChainId": 8453,
            "tokenIn": "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
            "tokenOut": "0x4200000000000000000000000000000000000006",
            "amountIn": "100000000",
            "estimatedOut": "47171482131331976",
            "minAmountOut": "46699767310018656",
            "minSrcSwapOut": "0",
            "feeAmountUSD": 0.0598128,
            "feeAmountToken": "0",
            "rail": "LAYERZERO",
            "railType": "messaging",
            "settlementToken": "ETH",
            "routeAsset": {
              "canonicalAssetId": "USDC",
              "providerAssetId": "layerzero-api:arbitrum:0xaf88d065e77c8cc2239327c5edb3a432268e5831",
              "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              "srcTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              "dstTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
              "decimals": 6,
              "assetKind": "erc20",
              "assetStandard": "erc20"
            },
            "settlementAssetId": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "expectedDstSettlementToken": "0x4200000000000000000000000000000000000006",
            "expectedDstSettlementAssetId": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "minSettlementAmount": "46699767310018656",
            "dstGasLimit": 0,
            "etaSeconds": 3,
            "expiresAt": 1779466690,
            "railPluginId": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "railData": "0x",
            "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapDataSrc": "0x",
            "swapDataDst": "0x",
            "nativeDstAddress": "undefined",
            "layerZeroValueTransferApiQuoteId": "0x00000000000000000000000000000000019e50790aae702e9b83e2f8997e520e",
            "layerZeroValueTransferApiRouteSteps": [
              {
                "type": "AORI_V1",
                "srcChainKey": "arbitrum",
                "description": "Aori"
              }
            ],
            "layerZeroValueTransferApiUserSteps": [
              {
                "type": "TRANSACTION",
                "description": "approve",
                "chainKey": "arbitrum",
                "chainType": "EVM",
                "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
                "transaction": {
                  "encoded": {
                    "chainId": 42161,
                    "data": "0x095ea7b3000000000000000000000000c6868edf1d2a7a8b759856cb8afa333210dfeda60000000000000000000000000000000000000000000000000000000005f5e100",
                    "from": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                    "to": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
                  }
                }
              },
              {
                "type": "SIGNATURE",
                "description": "bridge",
                "chainKey": "arbitrum",
                "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
                "signature": {
                  "type": "EIP712",
                  "typedData": {
                    "primaryType": "Order",
                    "domain": {
                      "name": "Aori",
                      "version": "0.3.1",
                      "verifyingContract": "0xc6868edf1d2a7a8b759856cb8afa333210dfeda6"
                    },
                    "types": {
                      "EIP712Domain": [
                        {
                          "name": "name",
                          "type": "string"
                        },
                        {
                          "name": "version",
                          "type": "string"
                        },
                        {
                          "name": "verifyingContract",
                          "type": "address"
                        }
                      ],
                      "Order": [
                        {
                          "name": "inputAmount",
                          "type": "uint128"
                        },
                        {
                          "name": "outputAmount",
                          "type": "uint128"
                        },
                        {
                          "name": "inputToken",
                          "type": "address"
                        },
                        {
                          "name": "outputToken",
                          "type": "address"
                        },
                        {
                          "name": "startTime",
                          "type": "uint32"
                        },
                        {
                          "name": "endTime",
                          "type": "uint32"
                        },
                        {
                          "name": "srcEid",
                          "type": "uint32"
                        },
                        {
                          "name": "dstEid",
                          "type": "uint32"
                        },
                        {
                          "name": "offerer",
                          "type": "address"
                        },
                        {
                          "name": "recipient",
                          "type": "address"
                        }
                      ]
                    },
                    "message": {
                      "offerer": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                      "recipient": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                      "inputToken": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
                      "outputToken": "0x4200000000000000000000000000000000000006",
                      "inputAmount": "100000000",
                      "outputAmount": "47171482131331976",
                      "startTime": "1779466570",
                      "endTime": "1779466660",
                      "srcEid": 30110,
                      "dstEid": 30184
                    }
                  }
                }
              }
            ]
          },
          "layerZeroValueTransferApiQuoteId": "0x00000000000000000000000000000000019e50790aae702e9b83e2f8997e520e",
          "layerZeroValueTransferApiQuote": {
            "id": "0x00000000000000000000000000000000019e50790aae702e9b83e2f8997e520e",
            "routeSteps": [
              {
                "type": "AORI_V1",
                "srcChainKey": "arbitrum",
                "description": "Aori"
              }
            ],
            "fees": [
              {
                "chainKey": "arbitrum",
                "type": "GENERAL",
                "description": "Aori Fees",
                "amount": "59826",
                "address": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
              }
            ],
            "duration": {
              "estimated": "3000"
            },
            "feeUsd": "0.05981280",
            "feePercent": "0.00059827",
            "srcAmount": "100000000",
            "dstAmount": "47171482131331976",
            "dstAmountMin": "46699767310018656",
            "srcAmountUsd": "99.97668000",
            "dstAmountUsd": "99.91686720",
            "userSteps": [
              {
                "type": "TRANSACTION",
                "description": "approve",
                "chainKey": "arbitrum",
                "chainType": "EVM",
                "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
                "transaction": {
                  "encoded": {
                    "chainId": 42161,
                    "data": "0x095ea7b3000000000000000000000000c6868edf1d2a7a8b759856cb8afa333210dfeda60000000000000000000000000000000000000000000000000000000005f5e100",
                    "from": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                    "to": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
                  }
                }
              },
              {
                "type": "SIGNATURE",
                "description": "bridge",
                "chainKey": "arbitrum",
                "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
                "signature": {
                  "type": "EIP712",
                  "typedData": {
                    "primaryType": "Order",
                    "domain": {
                      "name": "Aori",
                      "version": "0.3.1",
                      "verifyingContract": "0xc6868edf1d2a7a8b759856cb8afa333210dfeda6"
                    },
                    "types": {
                      "EIP712Domain": [
                        {
                          "name": "name",
                          "type": "string"
                        },
                        {
                          "name": "version",
                          "type": "string"
                        },
                        {
                          "name": "verifyingContract",
                          "type": "address"
                        }
                      ],
                      "Order": [
                        {
                          "name": "inputAmount",
                          "type": "uint128"
                        },
                        {
                          "name": "outputAmount",
                          "type": "uint128"
                        },
                        {
                          "name": "inputToken",
                          "type": "address"
                        },
                        {
                          "name": "outputToken",
                          "type": "address"
                        },
                        {
                          "name": "startTime",
                          "type": "uint32"
                        },
                        {
                          "name": "endTime",
                          "type": "uint32"
                        },
                        {
                          "name": "srcEid",
                          "type": "uint32"
                        },
                        {
                          "name": "dstEid",
                          "type": "uint32"
                        },
                        {
                          "name": "offerer",
                          "type": "address"
                        },
                        {
                          "name": "recipient",
                          "type": "address"
                        }
                      ]
                    },
                    "message": {
                      "offerer": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                      "recipient": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                      "inputToken": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
                      "outputToken": "0x4200000000000000000000000000000000000006",
                      "inputAmount": "100000000",
                      "outputAmount": "47171482131331976",
                      "startTime": "1779466570",
                      "endTime": "1779466660",
                      "srcEid": 30110,
                      "dstEid": 30184
                    }
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
              "chainKey": "arbitrum",
              "chainType": "EVM",
              "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
              "transaction": {
                "encoded": {
                  "chainId": 42161,
                  "data": "0x095ea7b3000000000000000000000000c6868edf1d2a7a8b759856cb8afa333210dfeda60000000000000000000000000000000000000000000000000000000005f5e100",
                  "from": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                  "to": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
                }
              }
            },
            {
              "type": "SIGNATURE",
              "description": "bridge",
              "chainKey": "arbitrum",
              "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
              "signature": {
                "type": "EIP712",
                "typedData": {
                  "primaryType": "Order",
                  "domain": {
                    "name": "Aori",
                    "version": "0.3.1",
                    "verifyingContract": "0xc6868edf1d2a7a8b759856cb8afa333210dfeda6"
                  },
                  "types": {
                    "EIP712Domain": [
                      {
                        "name": "name",
                        "type": "string"
                      },
                      {
                        "name": "version",
                        "type": "string"
                      },
                      {
                        "name": "verifyingContract",
                        "type": "address"
                      }
                    ],
                    "Order": [
                      {
                        "name": "inputAmount",
                        "type": "uint128"
                      },
                      {
                        "name": "outputAmount",
                        "type": "uint128"
                      },
                      {
                        "name": "inputToken",
                        "type": "address"
                      },
                      {
                        "name": "outputToken",
                        "type": "address"
                      },
                      {
                        "name": "startTime",
                        "type": "uint32"
                      },
                      {
                        "name": "endTime",
                        "type": "uint32"
                      },
                      {
                        "name": "srcEid",
                        "type": "uint32"
                      },
                      {
                        "name": "dstEid",
                        "type": "uint32"
                      },
                      {
                        "name": "offerer",
                        "type": "address"
                      },
                      {
                        "name": "recipient",
                        "type": "address"
                      }
                    ]
                  },
                  "message": {
                    "offerer": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                    "recipient": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
                    "inputToken": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
                    "outputToken": "0x4200000000000000000000000000000000000006",
                    "inputAmount": "100000000",
                    "outputAmount": "47171482131331976",
                    "startTime": "1779466570",
                    "endTime": "1779466660",
                    "srcEid": 30110,
                    "dstEid": 30184
                  }
                }
              }
            }
          ],
          "layerZeroValueTransferApiRouteSteps": [
            {
              "type": "AORI_V1",
              "srcChainKey": "arbitrum",
              "description": "Aori"
            }
          ],
          "feeUsd": 0.0598128
        }
      }
    ],
    "bestOfferId": "0x03e9bf42dbd755166dcac803173e0ee45548bd50c8bfa576b2b93fd8c698835a"
  }
}


{
  "tokenIn": "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
  "tokenOut": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "amountIn": "100000000",
  "srcChainId": 42161,
  "dstChainId": 8453,
  "userAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
  "urgency": "fast"
}

{
  "tokenIn": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "tokenOut": "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
  "amountIn": "1200000",
  "srcChainId": 8453,
  "dstChainId": 42161,
  "userAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
  "urgency": "fast"
}