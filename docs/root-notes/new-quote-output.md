curl -X 'POST' \
  'http://localhost:8787/quote' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
"srcChainId": 84532,"dstChainId": 11155420,"tokenIn": "0x036CbD53842c5426634e7929541eC2318f3dCF7e","tokenOut": "0x5fd84259d66Cd46123540766Be93DFE6D43130D7","amountIn": "2000000","userAddress":"0x05f8cc8753d90d67dbb8c02118440b8283f941c9","urgency": "fast"
}'

{
  "offerSet": {
    "offerSetId": "0x12a0b9cf3d6cd1a8fab66f096539bb3c365cdd8b724e3eee8c7fd4d1f990657c",
    "expiresAt": 1777395036,
    "offers": [
      {
        "offerId": "0xc476a90495e22a7570672434a483b3a0e7441c0dc68f845715220345289ec4d4",
        "rail": "CCTP",
        "offerType": "cctp_fast",
        "railType": "messaging",
        "srcChainId": 84532,
        "dstChainId": 11155420,
        "tokenIn": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        "tokenOut": "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
        "amountIn": "2000000",
        "estimatedOut": "1979604",
        "minAmountOut": "1969705",
        "expiresAt": 1777395036,
        "deliveryShape": "direct",
        "executionMode": "router_intent",
        "routeAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:84532:usdc",
          "tokenAddress": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
          "srcTokenAddress": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
          "dstTokenAddress": "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:84532:usdc",
          "tokenAddress": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
          "srcTokenAddress": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
          "dstTokenAddress": "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "USDC",
          "providerAssetId": "CCTP:84532:usdc",
          "tokenAddress": "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
          "srcTokenAddress": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
          "dstTokenAddress": "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "erc20"
        },
        "economics": {
          "providerFeeUSD": 0.000396,
          "protocolFeeUSD": 0.5,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 8,
          "outboundFeeUSD": 0.000396
        },
        "execution": {
          "quote": {
            "intentId": "0xc476a90495e22a7570672434a483b3a0e7441c0dc68f845715220345289ec4d4",
            "srcChainId": 84532,
            "dstChainId": 11155420,
            "tokenIn": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            "tokenOut": "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
            "amountIn": "2000000",
            "estimatedOut": "1979604",
            "minAmountOut": "1969705",
            "minSrcSwapOut": "0",
            "feeAmountUSD": 0.5,
            "feeAmountToken": "20000",
            "rail": "CCTP",
            "railType": "messaging",
            "settlementToken": "USDC",
            "settlementAssetId": "0x779421a1784749c9d32c67fac4e295f9a47908b2f5ba65491001a8fad4d64b78",
            "expectedDstSettlementToken": "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
            "expectedDstSettlementAssetId": "0x9270caa54a15c33d054997a3dd8542759e853fe93d37ace5d2efdce16118ec65",
            "minSettlementAmount": "1969705",
            "dstGasLimit": 200000,
            "etaSeconds": 8,
            "expiresAt": 1777395036,
            "railPluginId": "0x9181644edfd36b07ccd623494a3681a4a6b9cd5d52611accda20264cd09259ac",
            "railData": "0x00000000000000000000000000000000000000000000000000000000000003e80000000000000000000000000000000000000000000000000000000000000318",
            "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapDataSrc": "0x",
            "swapDataDst": "0x",
            "nativeDstAddress": "undefined",
            "routeAsset": {
              "canonicalAssetId": "USDC",
              "providerAssetId": "CCTP:84532:usdc",
              "tokenAddress": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
              "srcTokenAddress": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
              "dstTokenAddress": "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
              "decimals": 6,
              "assetKind": "erc20",
              "assetStandard": "erc20"
            }
          },
          "feeAmountToken": "20000",
          "minSrcSwapOut": "0",
          "providerFeeUSD": 0.000396,
          "protocolFeeUSD": 0.5,
          "railPluginId": "0x9181644edfd36b07ccd623494a3681a4a6b9cd5d52611accda20264cd09259ac",
          "railData": "0x00000000000000000000000000000000000000000000000000000000000003e80000000000000000000000000000000000000000000000000000000000000318",
          "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
          "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
          "swapDataSrc": "0x",
          "swapDataDst": "0x",
          "nativeDstAddress": "undefined",
          "axelarDestinationTokenId": "undefined"
        }
      }
    ],
    "bestOfferId": "0xc476a90495e22a7570672434a483b3a0e7441c0dc68f845715220345289ec4d4"
  },
  "quote": {
    "intentId": "0xc476a90495e22a7570672434a483b3a0e7441c0dc68f845715220345289ec4d4",
    "srcChainId": 84532,
    "dstChainId": 11155420,
    "tokenIn": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "tokenOut": "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
    "amountIn": "2000000",
    "estimatedOut": "1979604",
    "minAmountOut": "1969705",
    "minSrcSwapOut": "0",
    "feeAmountUSD": 0.5,
    "feeAmountToken": "20000",
    "rail": "CCTP",
    "railType": "messaging",
    "settlementToken": "USDC",
    "settlementAssetId": "0x779421a1784749c9d32c67fac4e295f9a47908b2f5ba65491001a8fad4d64b78",
    "expectedDstSettlementToken": "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
    "expectedDstSettlementAssetId": "0x9270caa54a15c33d054997a3dd8542759e853fe93d37ace5d2efdce16118ec65",
    "minSettlementAmount": "1969705",
    "dstGasLimit": 200000,
    "etaSeconds": 8,
    "expiresAt": 1777395036,
    "railPluginId": "0x9181644edfd36b07ccd623494a3681a4a6b9cd5d52611accda20264cd09259ac",
    "railData": "0x00000000000000000000000000000000000000000000000000000000000003e80000000000000000000000000000000000000000000000000000000000000318",
    "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "swapDataSrc": "0x",
    "swapDataDst": "0x",
    "nativeDstAddress": "undefined",
    "routeAsset": {
      "canonicalAssetId": "USDC",
      "providerAssetId": "CCTP:84532:usdc",
      "tokenAddress": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "srcTokenAddress": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "dstTokenAddress": "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
      "decimals": 6,
      "assetKind": "erc20",
      "assetStandard": "erc20"
    }
  }
}