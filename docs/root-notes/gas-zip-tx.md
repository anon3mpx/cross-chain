{
  "quote": {
    "intentId": "0xe7f140ebeb08c54122e19dc55166a92acd760a8e4e731771d68609fc49818629",
    "srcChainId": 8453,
    "dstChainId": 10,
    "tokenIn": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    "tokenOut": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    "amountIn": "8803568665782",
    "estimatedOut": "8764457300067",
    "minAmountOut": "8764457300067",
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
    "minSettlementAmount": "8764457300067",
    "dstGasLimit": 0,
    "etaSeconds": 2,
    "expiresAt": 1778238072,
    "railPluginId": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "railData": "0x",
    "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "swapDataSrc": "0x",
    "swapDataDst": "0x",
    "nativeDstAddress": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
    "selectedByUser": true
  },
  "intentId": "0xe7f140ebeb08c54122e19dc55166a92acd760a8e4e731771d68609fc49818629",
  "integration": {
    "mode": "provider_direct",
    "action": {
      "kind": "gaszip_transfer",
      "recipient": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
      "expectedAmountOut": "8764457300067",
      "expiresAt": 1778238072
    },
    "tx": {
      "to": "0x391E7C679d29bD940d63be94AD22A25d25b5A604",
      "data": "0x010037",
      "value": "8803568665782",
      "chainId": 8453
    }
  }
}

 node src/vps/scripts/sendGasZipTx.js
from: 0x05F8cC8753D90d67DBB8c02118440b8283F941c9
to: 0x391E7C679d29bD940d63be94AD22A25d25b5A604
valueWei: 8803568708006
data: 0x010037
chainId: 8453
dry run only, transaction not sent

 node src/vps/scripts/sendGasZipTx.js
from: 0x05F8cC8753D90d67DBB8c02118440b8283F941c9
to: 0x391E7C679d29bD940d63be94AD22A25d25b5A604
valueWei: 8803568708006
data: 0x010037
chainId: 8453
txHash: 0xd11d8880109b9825023cffb7b8a171ce61265a2f7acac490f9ed21348c07850c

https://www.gas.zip/scan/tx/0xd11d8880109b9825023cffb7b8a171ce61265a2f7acac490f9ed21348c07850c