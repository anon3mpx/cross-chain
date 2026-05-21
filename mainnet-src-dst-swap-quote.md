curl -X 'POST' \
  'http://localhost:8787/api/v1/quote' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "tokenIn": "0x4200000000000000000000000000000000000006",
  "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
  "amountIn": "22300000000000000",
  "srcChainId": 10,
  "dstChainId": 42161,
  "userAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
  "urgency": "fast"
}'

1000000000000000000

{
  "offerSet": {
    "offerSetId": "0x267369d849827a042873684e6de073b6a5ce44f805020e721f21e19fc61a957a",
    "expiresAt": 1778865045,
    "offers": [
      {
        "offerId": "0xa3ba7aac8a99d803e44ec841e7132ec6cca874e7ae8ee7b67fe0588f8b846c32",
        "rail": "CCTP",
        "offerType": "cctp_fast",
        "railType": "messaging",
        "srcChainId": 10,
        "dstChainId": 42161,
        "tokenIn": "0x4200000000000000000000000000000000000006",
        "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
        "amountIn": "22300000000000000",
        "estimatedOut": "22212677530352747",
        "minAmountOut": "22190464852822394",
        "expiresAt": 1778865046,
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
          "providerFeeUSD": 0.009909,
          "protocolFeeUSD": 0.0000669,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 8,
          "outboundFeeUSD": 0.009909
        },
        "execution": {
          "quote": {
            "intentId": "0xa3ba7aac8a99d803e44ec841e7132ec6cca874e7ae8ee7b67fe0588f8b846c32",
            "srcChainId": 10,
            "dstChainId": 42161,
            "tokenIn": "0x4200000000000000000000000000000000000006",
            "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
            "amountIn": "22300000000000000",
            "estimatedOut": "22212677530352747",
            "minAmountOut": "22190464852822394",
            "minSrcSwapOut": "49293372",
            "feeAmountUSD": 0.0000669,
            "feeAmountToken": "66900000000000",
            "rail": "CCTP",
            "railType": "messaging",
            "settlementToken": "USDC",
            "settlementAssetId": "0xc9e6c698b6a822819702171c2ca95ee8e0bd8b87d4d4954b42a3ef3815a80042",
            "expectedDstSettlementToken": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            "expectedDstSettlementAssetId": "0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94",
            "minSettlementAmount": "49481637",
            "dstGasLimit": 200000,
            "etaSeconds": 8,
            "expiresAt": 1778865046,
            "railPluginId": "0x9181644edfd36b07ccd623494a3681a4a6b9cd5d52611accda20264cd09259ac",
            "railData": "0x00000000000000000000000000000000000000000000000000000000000003e80000000000000000000000000000000000000000000000000000000000004d69",
            "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapDataSrc": "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000004efce2fbc178000000000000000000000000000000000000000000000000000000000002f3efd6000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000200000000000000000000000042000000000000000000000000000000000000060000000000000000000000000b2c639c533813f4aa9d7837caf62653d097ff8500000000000000000000000000000000000000000000000000000000000000010000000000000000000000009293cb3dec942c9f0a76d1c9131d923d2713a1f6",
            "swapDataDst": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000002f3c921000000000000000000000000000000000000000000000000004eea5001b4fc6b000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000004000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e5831000000000000000000000000fd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb90000000000000000000000002f2a2543b76a4166549f7aab2e75bef0aefc5b0f00000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab100000000000000000000000000000000000000000000000000000000000000030000000000000000000000008c30e0d45733e99cc5aa8269e92922412471dbcf000000000000000000000000a91d8284c199fe4c178d76558a1427790af7e80f000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d7",
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
          "feeAmountToken": "66900000000000",
          "minSrcSwapOut": "49293372",
          "providerFeeUSD": 0.009909,
          "protocolFeeUSD": 0.0000669,
          "railPluginId": "0x9181644edfd36b07ccd623494a3681a4a6b9cd5d52611accda20264cd09259ac",
          "railData": "0x00000000000000000000000000000000000000000000000000000000000003e80000000000000000000000000000000000000000000000000000000000004d69",
          "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapDataSrc": "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000004efce2fbc178000000000000000000000000000000000000000000000000000000000002f3efd6000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000200000000000000000000000042000000000000000000000000000000000000060000000000000000000000000b2c639c533813f4aa9d7837caf62653d097ff8500000000000000000000000000000000000000000000000000000000000000010000000000000000000000009293cb3dec942c9f0a76d1c9131d923d2713a1f6",
          "swapDataDst": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000002f3c921000000000000000000000000000000000000000000000000004eea5001b4fc6b000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000004000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e5831000000000000000000000000fd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb90000000000000000000000002f2a2543b76a4166549f7aab2e75bef0aefc5b0f00000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab100000000000000000000000000000000000000000000000000000000000000030000000000000000000000008c30e0d45733e99cc5aa8269e92922412471dbcf000000000000000000000000a91d8284c199fe4c178d76558a1427790af7e80f000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d7",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      },
      {
        "offerId": "0x05a7d98f9d6c2859ee7e6ecbc5005707a16cfee1a59757f67b6b2b2355b7b9d9",
        "rail": "LAYERZERO",
        "offerType": "lz_stargate_pool",
        "railType": "messaging",
        "srcChainId": 10,
        "dstChainId": 42161,
        "tokenIn": "0x4200000000000000000000000000000000000006",
        "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
        "amountIn": "22300000000000000",
        "estimatedOut": "22194716755901686",
        "minAmountOut": "22174716755901686",
        "expiresAt": 1778865045,
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
          "protocolFeeUSD": 0.0000669,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 300
        },
        "execution": {
          "quote": {
            "intentId": "0x05a7d98f9d6c2859ee7e6ecbc5005707a16cfee1a59757f67b6b2b2355b7b9d9",
            "srcChainId": 10,
            "dstChainId": 42161,
            "tokenIn": "0x4200000000000000000000000000000000000006",
            "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
            "amountIn": "22300000000000000",
            "estimatedOut": "22216933689591278",
            "minAmountOut": "22194716755901686",
            "minSrcSwapOut": "49293372",
            "feeAmountUSD": 0.0000669,
            "feeAmountToken": "66900000000000",
            "rail": "LAYERZERO",
            "railType": "messaging",
            "settlementToken": "USDC",
            "settlementAssetId": "0xc9e6c698b6a822819702171c2ca95ee8e0bd8b87d4d4954b42a3ef3815a80042",
            "expectedDstSettlementToken": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            "expectedDstSettlementAssetId": "0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94",
            "minSettlementAmount": "49491536",
            "dstGasLimit": 240000,
            "etaSeconds": 300,
            "expiresAt": 1778865045,
            "railPluginId": "0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc",
            "railData": "0x0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000ce8cca271ebc0533920c83d39f417ed6a0abb7d00000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a800000000000000000000000000000000000000000",
            "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapDataSrc": "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000004efce2fbc178000000000000000000000000000000000000000000000000000000000002f3efd6000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000200000000000000000000000042000000000000000000000000000000000000060000000000000000000000000b2c639c533813f4aa9d7837caf62653d097ff8500000000000000000000000000000000000000000000000000000000000000010000000000000000000000009293cb3dec942c9f0a76d1c9131d923d2713a1f6",
            "swapDataDst": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000002f3efd6000000000000000000000000000000000000000000000000004eee2ef89105ee000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000004000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e5831000000000000000000000000fd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb90000000000000000000000002f2a2543b76a4166549f7aab2e75bef0aefc5b0f00000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab100000000000000000000000000000000000000000000000000000000000000030000000000000000000000008c30e0d45733e99cc5aa8269e92922412471dbcf000000000000000000000000a91d8284c199fe4c178d76558a1427790af7e80f000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d7",
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
          "feeAmountToken": "66900000000000",
          "minSrcSwapOut": "49293372",
          "providerFeeUSD": 0.35,
          "protocolFeeUSD": 0.0000669,
          "railPluginId": "0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc",
          "railData": "0x0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000ce8cca271ebc0533920c83d39f417ed6a0abb7d00000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a800000000000000000000000000000000000000000",
          "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapDataSrc": "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000004efce2fbc178000000000000000000000000000000000000000000000000000000000002f3efd6000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000200000000000000000000000042000000000000000000000000000000000000060000000000000000000000000b2c639c533813f4aa9d7837caf62653d097ff8500000000000000000000000000000000000000000000000000000000000000010000000000000000000000009293cb3dec942c9f0a76d1c9131d923d2713a1f6",
          "swapDataDst": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000002f3efd6000000000000000000000000000000000000000000000000004eee2ef89105ee000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000004000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e5831000000000000000000000000fd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb90000000000000000000000002f2a2543b76a4166549f7aab2e75bef0aefc5b0f00000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab100000000000000000000000000000000000000000000000000000000000000030000000000000000000000008c30e0d45733e99cc5aa8269e92922412471dbcf000000000000000000000000a91d8284c199fe4c178d76558a1427790af7e80f000000000000000000000000e92d374a55655f4b8447e3a6eaca87bbc09dd8d7",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      },
      {
        "offerId": "0x0b58e57dd440cea6d2cbf807bd4234c105a1ee8bd01af22f0b680b4c2649071e",
        "rail": "LAYERZERO",
        "offerType": "lz_api_direct",
        "railType": "messaging",
        "srcChainId": 10,
        "dstChainId": 42161,
        "tokenIn": "0x4200000000000000000000000000000000000006",
        "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
        "amountIn": "22300000000000000",
        "estimatedOut": "22259950289863971",
        "minAmountOut": "22037350786965331",
        "expiresAt": 1778865047,
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
          "providerAssetId": "layerzero-api:arbitrum:0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
          "tokenAddress": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
          "srcTokenAddress": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
          "dstTokenAddress": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
          "decimals": 18,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "economics": {
          "providerFeeUSD": 0.08897502,
          "protocolFeeUSD": 0,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 3
        },
        "execution": {
          "provider": "layerzero_value_transfer_api",
          "quote": {
            "intentId": "0x0b58e57dd440cea6d2cbf807bd4234c105a1ee8bd01af22f0b680b4c2649071e",
            "srcChainId": 10,
            "dstChainId": 42161,
            "tokenIn": "0x4200000000000000000000000000000000000006",
            "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
            "amountIn": "22300000000000000",
            "estimatedOut": "22259950289863971",
            "minAmountOut": "22037350786965331",
            "minSrcSwapOut": "0",
            "feeAmountUSD": 0.08897502,
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
            "expectedDstSettlementToken": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
            "expectedDstSettlementAssetId": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "minSettlementAmount": "22037350786965331",
            "dstGasLimit": 0,
            "etaSeconds": 3,
            "expiresAt": 1778865047,
            "railPluginId": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "railData": "0x",
            "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapDataSrc": "0x",
            "swapDataDst": "0x",
            "nativeDstAddress": "undefined",
            "layerZeroValueTransferApiQuoteId": "0x00000000000000000000000000000000019e2c9cb2747660a6f3539fb9fe9b29",
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
                    "data": "0x095ea7b3000000000000000000000000c6868edf1d2a7a8b759856cb8afa333210dfeda6000000000000000000000000000000000000000000000000004f39bb5a7dc000",
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
                      "outputToken": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
                      "inputAmount": "22300000000000000",
                      "outputAmount": "22259950289863971",
                      "startTime": "1778864927",
                      "endTime": "1778865017",
                      "srcEid": 30111,
                      "dstEid": 30110
                    }
                  }
                }
              }
            ]
          },
          "layerZeroValueTransferApiQuoteId": "0x00000000000000000000000000000000019e2c9cb2747660a6f3539fb9fe9b29",
          "layerZeroValueTransferApiQuote": {
            "id": "0x00000000000000000000000000000000019e2c9cb2747660a6f3539fb9fe9b29",
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
                "amount": "40049710136029",
                "address": "0x4200000000000000000000000000000000000006"
              }
            ],
            "duration": {
              "estimated": "3000"
            },
            "feeUsd": "0.08897502",
            "feePercent": "0.00179595",
            "srcAmount": "22300000000000000",
            "dstAmount": "22259950289863971",
            "dstAmountMin": "22037350786965331",
            "srcAmountUsd": "49.54200348",
            "dstAmountUsd": "49.45302847",
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
                    "data": "0x095ea7b3000000000000000000000000c6868edf1d2a7a8b759856cb8afa333210dfeda6000000000000000000000000000000000000000000000000004f39bb5a7dc000",
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
                      "outputToken": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
                      "inputAmount": "22300000000000000",
                      "outputAmount": "22259950289863971",
                      "startTime": "1778864927",
                      "endTime": "1778865017",
                      "srcEid": 30111,
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
              "chainKey": "optimism",
              "chainType": "EVM",
              "signerAddress": "0x05f8cc8753d90d67dbb8c02118440b8283f941c9",
              "transaction": {
                "encoded": {
                  "chainId": 10,
                  "data": "0x095ea7b3000000000000000000000000c6868edf1d2a7a8b759856cb8afa333210dfeda6000000000000000000000000000000000000000000000000004f39bb5a7dc000",
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
                    "outputToken": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
                    "inputAmount": "22300000000000000",
                    "outputAmount": "22259950289863971",
                    "startTime": "1778864927",
                    "endTime": "1778865017",
                    "srcEid": 30111,
                    "dstEid": 30110
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
          "feeUsd": 0.08897502
        }
      }
    ],
    "bestOfferId": "0xa3ba7aac8a99d803e44ec841e7132ec6cca874e7ae8ee7b67fe0588f8b846c32"
  }
}