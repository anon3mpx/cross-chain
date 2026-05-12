curl -X 'POST' \
  'http://localhost:8787/quote/select' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "offerSetId": "0x49bc67b98cc3bbe3cb12d55782830e17dfe494ba980cd1e7e811f6f8f927a724",
  "offerId": "0xa531ec4a655f8a76ee5ac918c4b404888af9ec72eb612c31961f9856708623de",
  "userAddress": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9"
}'

{
  "quote": {
    "intentId": "0x9c1236ac27d5086b81263ab4786244c975e5cc53c55d548f47bd54113f42e059",
    "srcChainId": 8453,
    "dstChainId": 42161,
    "tokenIn": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    "tokenOut": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    "amountIn": "2011008617904743",
    "estimatedOut": "2009995798173960",
    "minAmountOut": "2009995798173960",
    "minSrcSwapOut": "0",
    "feeAmountUSD": 0,
    "feeAmountToken": "0",
    "rail": "GASZIP",
    "railType": "messaging",
    "settlementToken": "ETH",
    "routeAsset": {
      "canonicalAssetId": "ETH",
      "providerAssetId": "gaszip:8453:native",
      "tokenAddress": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      "srcTokenAddress": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      "dstTokenAddress": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      "decimals": 18,
      "assetKind": "native",
      "assetStandard": "native"
    },
    "settlementAssetId": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "expectedDstSettlementToken": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    "expectedDstSettlementAssetId": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "minSettlementAmount": "2009995798173960",
    "dstGasLimit": 0,
    "etaSeconds": 1,
    "expiresAt": 1777988418,
    "railPluginId": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "railData": "0x",
    "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "swapDataSrc": "0x",
    "swapDataDst": "0x",
    "nativeDstAddress": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
    "selectedByUser": true
  },
  "intentId": "0x9c1236ac27d5086b81263ab4786244c975e5cc53c55d548f47bd54113f42e059",
  "integration": {
    "mode": "provider_direct",
    "action": {
      "kind": "gaszip_transfer",
      "recipient": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
      "expectedAmountOut": "2009995798173960",
      "expiresAt": 1777988418
    },
    "tx": {
      "to": "0x391E7C679d29bD940d63be94AD22A25d25b5A604",
      "data": "0x010039",
      "value": "2011008617904743",
      "chainId": 8453
    }
  }
}