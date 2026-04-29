curl -X 'POST' \
  'http://localhost:8787/quote/select' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "offerSetId": "0xfc94a190cb61ce1cf63b77431223d7f50e826bbeb0f7043ec88214ca0e9899b7",
  "offerId": "0x0b7deed7ee408338047d47bca424fb36f32d41023d1a53fec2f0b2f2681588e7",
  "userAddress": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9"
}'

{
  "quote": {
    "intentId": "0x16a1cf30bbcc6ffc4657388f1705316ebd0d555b36a5cdf474069f878dc60e73",
    "srcChainId": 8453,
    "dstChainId": 8453,
    "tokenIn": "BASE.ETH",
    "tokenOut": "BASE.USDC",
    "amountIn": "500000000000000",
    "estimatedOut": "89383100",
    "minAmountOut": "89293716",
    "minSrcSwapOut": "0",
    "feeAmountUSD": 0.5,
    "feeAmountToken": "5000000000000",
    "rail": "THORCHAIN",
    "railType": "liquidity",
    "settlementToken": "USDC",
    "settlementAssetId": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "expectedDstSettlementToken": "0x0000000000000000000000000000000000000000",
    "expectedDstSettlementAssetId": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "minSettlementAmount": "495000000000000",
    "dstGasLimit": 0,
    "etaSeconds": 30,
    "expiresAt": 1777468540,
    "railPluginId": "0x390774707b6ae71a0ce31d10394e70b6ac75b3b62ec4db96c9672cafd1b516c9",
    "railData": "0x",
    "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "swapDataSrc": "0x",
    "swapDataDst": "0x",
    "nativeDstAddress": "undefined",
    "thorAsset": "undefined",
    "minThorOutput": "89383100",
    "routeAsset": {
      "canonicalAssetId": "BASE.USDC",
      "providerAssetId": "THORCHAIN:8453:8453:BASE.USDC",
      "tokenAddress": "undefined",
      "srcTokenAddress": "undefined",
      "dstTokenAddress": "undefined",
      "decimals": 6,
      "assetKind": "erc20",
      "assetStandard": "native"
    },
    "selectedByUser": true
  },
  "intentId": "0x16a1cf30bbcc6ffc4657388f1705316ebd0d555b36a5cdf474069f878dc60e73",
  "integration": {
    "mode": "provider_direct",
    "action": {
      "kind": "thorchain_swap",
      "depositAddress": "",
      "memo": "",
      "expiresAt": 0,
      "expectedAmountOut": ""
    }
  }
}

{
  "quote": {
    "intentId": "0x36a5f0441daa2ca9de1cb1fcec0ba917eb0c7836ca1b3ca792e68fa7cfdfb7a7",
    "srcChainId": 8453,
    "dstChainId": 8453,
    "tokenIn": "BASE.ETH",
    "tokenOut": "BASE.USDC",
    "amountIn": "500000000000000",
    "estimatedOut": "89747900",
    "minAmountOut": "89658152",
    "minSrcSwapOut": "0",
    "feeAmountUSD": 0.5,
    "feeAmountToken": "5000000000000",
    "rail": "THORCHAIN",
    "railType": "liquidity",
    "settlementToken": "USDC",
    "settlementAssetId": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "expectedDstSettlementToken": "0x0000000000000000000000000000000000000000",
    "expectedDstSettlementAssetId": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "minSettlementAmount": "495000000000000",
    "dstGasLimit": 0,
    "etaSeconds": 30,
    "expiresAt": 1777468853,
    "railPluginId": "0x390774707b6ae71a0ce31d10394e70b6ac75b3b62ec4db96c9672cafd1b516c9",
    "railData": "0x",
    "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "swapDataSrc": "0x",
    "swapDataDst": "0x",
    "nativeDstAddress": "undefined",
    "thorAsset": "undefined",
    "minThorOutput": "89747900",
    "routeAsset": {
      "canonicalAssetId": "BASE.USDC",
      "providerAssetId": "THORCHAIN:8453:8453:BASE.USDC",
      "tokenAddress": "undefined",
      "srcTokenAddress": "undefined",
      "dstTokenAddress": "undefined",
      "decimals": 6,
      "assetKind": "erc20",
      "assetStandard": "native"
    },
    "selectedByUser": true
  },
  "intentId": "0x36a5f0441daa2ca9de1cb1fcec0ba917eb0c7836ca1b3ca792e68fa7cfdfb7a7",
  "integration": {
    "mode": "provider_direct",
    "action": {
      "kind": "thorchain_swap",
      "depositAddress": "0x57bb04f3215dbbb60b9da6154e0a7abdb6fbac27",
      "memo": "=:BASE.USDC:0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
      "expiresAt": 1777468853,
      "expectedAmountOut": "89747900"
    }
  }
}