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
    "offerSetId": "0xc5a36fc5b46f8a89a73f5ebc57654087ca2ba391d0a0685728af2dd5fd4dd8ac",
    "expiresAt": 1779462769,
    "offers": [
      {
        "offerId": "0x0e49a410a07fde77adb57190c8002735e4c64e5296c45b6283cf567b21ba3fce",
        "rail": "CCTP",
        "offerType": "cctp_standard",
        "railType": "messaging",
        "srcChainId": 8453,
        "dstChainId": 42161,
        "tokenIn": "0x4200000000000000000000000000000000000006",
        "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
        "amountIn": "1000000000000000000",
        "estimatedOut": "72058248544613264006",
        "minAmountOut": "71986190296068650741",
        "expiresAt": 1779462769,
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
          "providerFeeUSD": 0,
          "protocolFeeUSD": 0.003,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 1200,
          "outboundFeeUSD": 0
        },
        "execution": {
          "quote": {
            "intentId": "0x0e49a410a07fde77adb57190c8002735e4c64e5296c45b6283cf567b21ba3fce",
            "srcChainId": 8453,
            "dstChainId": 42161,
            "tokenIn": "0x4200000000000000000000000000000000000006",
            "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
            "amountIn": "1000000000000000000",
            "estimatedOut": "72058248544613264006",
            "minAmountOut": "71986190296068650741",
            "minSrcSwapOut": "989038955000000000",
            "feeAmountUSD": 0.003,
            "feeAmountToken": "3000000000000000",
            "rail": "CCTP",
            "railType": "messaging",
            "settlementToken": "USDC",
            "settlementAssetId": "0xf7135e5fd9158c9cea11c421e7df327b195498f7dacd89fb0de0449e618c4027",
            "expectedDstSettlementToken": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            "expectedDstSettlementAssetId": "0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94",
            "minSettlementAmount": "993014991000000000",
            "dstGasLimit": 200000,
            "etaSeconds": 1200,
            "expiresAt": 1779462769,
            "railPluginId": "0xb148ea5f936a28661e11743b1650193f1b14a2322b9541503bf6815a84a1a6e9",
            "railData": "0x",
            "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapDataSrc": "0x",
            "swapDataDst": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000dcb6deb448a9000000000000000000000000000000000000000000000000003e8025345367b6a86000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e583100000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab10000000000000000000000000000000000000000000000000000000000000001000000000000000000000000050c6c2555c2d54aba01420fbc02ff0f1d10e8df",
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
          "minSrcSwapOut": "989038955000000000",
          "providerFeeUSD": 0,
          "protocolFeeUSD": 0.003,
          "railPluginId": "0xb148ea5f936a28661e11743b1650193f1b14a2322b9541503bf6815a84a1a6e9",
          "railData": "0x",
          "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapDataSrc": "0x",
          "swapDataDst": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000dcb6deb448a9000000000000000000000000000000000000000000000000003e8025345367b6a86000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e583100000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab10000000000000000000000000000000000000000000000000000000000000001000000000000000000000000050c6c2555c2d54aba01420fbc02ff0f1d10e8df",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      },
      {
        "offerId": "0x68ea61f322a4f62a20824e211bba4f9af9746c7e0658d8f9046f2846ca5f815b",
        "rail": "LAYERZERO",
        "offerType": "lz_stargate_pool",
        "railType": "messaging",
        "srcChainId": 8453,
        "dstChainId": 42161,
        "tokenIn": "0x4200000000000000000000000000000000000006",
        "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
        "amountIn": "1000000000000000000",
        "estimatedOut": "72058248544613264006",
        "minAmountOut": "71986190296068650741",
        "expiresAt": 1779462769,
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
            "intentId": "0x68ea61f322a4f62a20824e211bba4f9af9746c7e0658d8f9046f2846ca5f815b",
            "srcChainId": 8453,
            "dstChainId": 42161,
            "tokenIn": "0x4200000000000000000000000000000000000006",
            "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
            "amountIn": "1000000000000000000",
            "estimatedOut": "72058248544613264006",
            "minAmountOut": "71986190296068650741",
            "minSrcSwapOut": "989038955000000000",
            "feeAmountUSD": 0.003,
            "feeAmountToken": "3000000000000000",
            "rail": "LAYERZERO",
            "railType": "messaging",
            "settlementToken": "USDC",
            "settlementAssetId": "0xf7135e5fd9158c9cea11c421e7df327b195498f7dacd89fb0de0449e618c4027",
            "expectedDstSettlementToken": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
            "expectedDstSettlementAssetId": "0x4ff7bfa087fef0b3d1091aacb95268321ee02ffb87496abbf2f3994ca399da94",
            "minSettlementAmount": "993014991000000000",
            "dstGasLimit": 240000,
            "etaSeconds": 300,
            "expiresAt": 1779462769,
            "railPluginId": "0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc",
            "railData": "0x000000000000000000000000000000000000000000000000000000000000000200000000000000000000000027a16dc786820b16e5c9028b75b99f6f604b5d260000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a800000000000000000000000000000000000000000",
            "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
            "swapDataSrc": "0x",
            "swapDataDst": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000dcb6deb448a9000000000000000000000000000000000000000000000000003e8025345367b6a86000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e583100000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab10000000000000000000000000000000000000000000000000000000000000001000000000000000000000000050c6c2555c2d54aba01420fbc02ff0f1d10e8df",
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
          "minSrcSwapOut": "989038955000000000",
          "providerFeeUSD": 0.35,
          "protocolFeeUSD": 0.003,
          "railPluginId": "0xc472efb7b9a986e1446d8bf9dec51e88548a1d8eb4a0810e6424d97a878d34fc",
          "railData": "0x000000000000000000000000000000000000000000000000000000000000000200000000000000000000000027a16dc786820b16e5c9028b75b99f6f604b5d260000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002c00030100110100000000000000000000000000030d4001001303000000000000000000000000000000061a800000000000000000000000000000000000000000",
          "swapPluginIdSrc": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapPluginIdDst": "0x62d69a2b9d5c124337a6d3df09e273f71aa045b7b8758c9c6695143a40ad10b6",
          "swapDataSrc": "0x",
          "swapDataDst": "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000dcb6deb448a9000000000000000000000000000000000000000000000000003e8025345367b6a86000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e583100000000000000000000000082af49447d8a07e3bd95bd0d56f35241523fbab10000000000000000000000000000000000000000000000000000000000000001000000000000000000000000050c6c2555c2d54aba01420fbc02ff0f1d10e8df",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      },
      {
        "offerId": "0x73f2dc6f99c0922e4adb5ab49d0a4d4f8d37d2df1f7ed8844b3181fc7f3c916a",
        "rail": "LAYERZERO",
        "offerType": "lz_api_direct",
        "railType": "messaging",
        "srcChainId": 8453,
        "dstChainId": 42161,
        "tokenIn": "0x4200000000000000000000000000000000000006",
        "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
        "amountIn": "1000000000000000000",
        "estimatedOut": "998396373465161044",
        "minAmountOut": "988412409730509433",
        "expiresAt": 1779462771,
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
          "providerFeeUSD": 2.73873328,
          "protocolFeeUSD": 0,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 3
        },
        "execution": {
          "provider": "layerzero_value_transfer_api",
          "quote": {
            "intentId": "0x73f2dc6f99c0922e4adb5ab49d0a4d4f8d37d2df1f7ed8844b3181fc7f3c916a",
            "srcChainId": 8453,
            "dstChainId": 42161,
            "tokenIn": "0x4200000000000000000000000000000000000006",
            "tokenOut": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
            "amountIn": "1000000000000000000",
            "estimatedOut": "998396373465161044",
            "minAmountOut": "988412409730509433",
            "minSrcSwapOut": "0",
            "feeAmountUSD": 2.73873328,
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
            "minSettlementAmount": "988412409730509433",
            "dstGasLimit": 0,
            "etaSeconds": 3,
            "expiresAt": 1779462771,
            "railPluginId": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "railData": "0x",
            "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapDataSrc": "0x",
            "swapDataDst": "0x",
            "nativeDstAddress": "undefined",
            "layerZeroValueTransferApiQuoteId": "0x00000000000000000000000000000000019e503d3bd9770a8dacf0f77a8b3c96",
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
                      "outputAmount": "998396373465161044",
                      "startTime": "1779462651",
                      "endTime": "1779462741",
                      "srcEid": 30184,
                      "dstEid": 30110
                    }
                  }
                }
              }
            ]
          },
          "layerZeroValueTransferApiQuoteId": "0x00000000000000000000000000000000019e503d3bd9770a8dacf0f77a8b3c96",
          "layerZeroValueTransferApiQuote": {
            "id": "0x00000000000000000000000000000000019e503d3bd9770a8dacf0f77a8b3c96",
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
                "amount": "1292618278216756",
                "address": "0x4200000000000000000000000000000000000006"
              }
            ],
            "duration": {
              "estimated": "3000"
            },
            "feeUsd": "2.73873328",
            "feePercent": "0.00129262",
            "srcAmount": "1000000000000000000",
            "dstAmount": "998396373465161044",
            "dstAmountMin": "988412409730509433",
            "srcAmountUsd": "2118.74868801",
            "dstAmountUsd": "2116.00995473",
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
                      "outputAmount": "998396373465161044",
                      "startTime": "1779462651",
                      "endTime": "1779462741",
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
                    "outputAmount": "998396373465161044",
                    "startTime": "1779462651",
                    "endTime": "1779462741",
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
          "feeUsd": 2.73873328
        }
      }
    ],
    "bestOfferId": "0x0e49a410a07fde77adb57190c8002735e4c64e5296c45b6283cf567b21ba3fce"
  }
}