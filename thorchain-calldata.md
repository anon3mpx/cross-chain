curl -X 'POST' \
  'http://localhost:8787/quote' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
    "tokenIn": "BASE.ETH",
    "tokenOut": "BASE.USDC",
    "amountIn": "500000000000000",
    "srcChainId": 1,
    "dstChainId": 1,
    "userAddress": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9"
  }'

{
  "offerSet": {
    "offerSetId": "0xc937f358dfca54e94e2d48001b53415af164e185b74742c837f8a969c6ecf2ca",
    "expiresAt": 1777561352,
    "offers": [
      {
        "offerId": "0xa0b1ccb69a66a1c24012c636660bb8bed8eaecc288a97095e7082b94e186c469",
        "rail": "THORCHAIN",
        "offerType": "thor_api_direct",
        "railType": "liquidity",
        "srcChainId": 1,
        "dstChainId": 1,
        "tokenIn": "BASE.ETH",
        "tokenOut": "BASE.USDC",
        "amountIn": "500000000000000",
        "estimatedOut": "87376000",
        "minAmountOut": "87288624",
        "expiresAt": 1777561352,
        "deliveryShape": "direct",
        "executionMode": "provider_direct",
        "routeAsset": {
          "canonicalAssetId": "BASE.USDC",
          "providerAssetId": "THORCHAIN:1:1:BASE.USDC",
          "tokenAddress": "undefined",
          "srcTokenAddress": "undefined",
          "dstTokenAddress": "undefined",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "native"
        },
        "sourceSettlementAsset": {
          "canonicalAssetId": "BASE.USDC",
          "providerAssetId": "THORCHAIN:1:1:BASE.USDC",
          "tokenAddress": "undefined",
          "srcTokenAddress": "undefined",
          "dstTokenAddress": "undefined",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "native"
        },
        "destinationSettlementAsset": {
          "canonicalAssetId": "BASE.USDC",
          "providerAssetId": "THORCHAIN:1:1:BASE.USDC",
          "tokenAddress": "undefined",
          "srcTokenAddress": "undefined",
          "dstTokenAddress": "undefined",
          "decimals": 6,
          "assetKind": "erc20",
          "assetStandard": "native"
        },
        "economics": {
          "providerFeeUSD": 0,
          "protocolFeeUSD": 0.0000015,
          "sourceGasUSD": 0,
          "settlementTimeSeconds": 30,
          "slippageBps": 19,
          "minimumInput": "36189"
        },
        "execution": {
          "provider": "thorchain_api",
          "quote": {
            "intentId": "0xa0b1ccb69a66a1c24012c636660bb8bed8eaecc288a97095e7082b94e186c469",
            "srcChainId": 1,
            "dstChainId": 1,
            "tokenIn": "BASE.ETH",
            "tokenOut": "BASE.USDC",
            "amountIn": "500000000000000",
            "estimatedOut": "87376000",
            "minAmountOut": "87288624",
            "minSrcSwapOut": "0",
            "feeAmountUSD": 0.0000015,
            "feeAmountToken": "1500000000000",
            "rail": "THORCHAIN",
            "railType": "liquidity",
            "settlementToken": "USDC",
            "settlementAssetId": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "expectedDstSettlementToken": "0x0000000000000000000000000000000000000000",
            "expectedDstSettlementAssetId": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "minSettlementAmount": "498500000000000",
            "dstGasLimit": 0,
            "etaSeconds": 30,
            "expiresAt": 1777561352,
            "railPluginId": "0x390774707b6ae71a0ce31d10394e70b6ac75b3b62ec4db96c9672cafd1b516c9",
            "railData": "0x",
            "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "swapDataSrc": "0x",
            "swapDataDst": "0x",
            "nativeDstAddress": "undefined",
            "thorAsset": "undefined",
            "minThorOutput": "87376000",
            "routeAsset": {
              "canonicalAssetId": "BASE.USDC",
              "providerAssetId": "THORCHAIN:1:1:BASE.USDC",
              "tokenAddress": "undefined",
              "srcTokenAddress": "undefined",
              "dstTokenAddress": "undefined",
              "decimals": 6,
              "assetKind": "erc20",
              "assetStandard": "native"
            }
          },
          "thorQuote": {
            "inbound_address": "0x4feea1caeea66b3351ddba68bd80c37c9ed6c3c8",
            "inbound_confirmation_blocks": 12,
            "inbound_confirmation_seconds": 24,
            "outbound_delay_blocks": 0,
            "outbound_delay_seconds": 0,
            "fees": {
              "asset": "BASE.USDC-0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913",
              "affiliate": "0",
              "outbound": "24987900",
              "liquidity": "225000",
              "total": "25212900",
              "slippage_bps": 19,
              "total_bps": 1832
            },
            "router": "0x00dc6100103BC402d490aEE3F9a5560cBd91f1d4",
            "expiry": 1777561352,
            "warning": "Do not cache this response. Do not send funds after the expiry. Rapid streaming time is a best-case estimate. Actual execution may take longer due to direction skipping, swap failures, or queue budget limits.",
            "notes": "Base Asset: Send the inbound_address the asset with the memo encoded in hex in the data field. Tokens: First approve router to spend tokens from user: asset.approve(router, amount). Then call router.depositWithExpiry(inbound_address, asset, amount, memo, expiry). Asset is the token contract address. Amount should be in native asset decimals (eg 1e18 for most tokens). Do not swap to smart contract addresses.",
            "dust_threshold": "1000",
            "recommended_min_amount_in": "36189",
            "recommended_gas_rate": "150",
            "gas_rate_units": "mwei",
            "memo": "=:BASE.USDC:0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
            "expected_amount_out": "87376000",
            "max_streaming_quantity": 1,
            "streaming_swap_blocks": 1,
            "streaming_swap_seconds": 6,
            "total_swap_seconds": 30
          },
          "thorAssetIdentifier": "undefined",
          "minThorOutput": "87376000",
          "router": "0x00dc6100103BC402d490aEE3F9a5560cBd91f1d4",
          "inboundAddress": "0x4feea1caeea66b3351ddba68bd80c37c9ed6c3c8",
          "memo": "=:BASE.USDC:0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
          "thorchainExpiry": 1777561352,
          "feeAmountToken": "1500000000000",
          "providerFeeUSD": 0,
          "protocolFeeUSD": 0.0000015,
          "railPluginId": "0x390774707b6ae71a0ce31d10394e70b6ac75b3b62ec4db96c9672cafd1b516c9",
          "railData": "0x",
          "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
          "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
          "swapDataSrc": "0x",
          "swapDataDst": "0x",
          "nativeDstAddress": "undefined"
        }
      }
    ],
    "bestOfferId": "0xa0b1ccb69a66a1c24012c636660bb8bed8eaecc288a97095e7082b94e186c469"
  },
  "quote": {
    "intentId": "0xd4fa69a78009aa880f1a81a3777baa32e3e3fa073d31370079f031349abdb18f",
    "srcChainId": 1,
    "dstChainId": 1,
    "tokenIn": "BASE.ETH",
    "tokenOut": "BASE.USDC",
    "amountIn": "500000000000000",
    "estimatedOut": "87376000",
    "minAmountOut": "87288624",
    "minSrcSwapOut": "0",
    "feeAmountUSD": 0.0000015,
    "feeAmountToken": "1500000000000",
    "rail": "THORCHAIN",
    "railType": "liquidity",
    "settlementToken": "USDC",
    "settlementAssetId": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "expectedDstSettlementToken": "0x0000000000000000000000000000000000000000",
    "expectedDstSettlementAssetId": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "minSettlementAmount": "498500000000000",
    "dstGasLimit": 0,
    "etaSeconds": 30,
    "expiresAt": 1777561352,
    "railPluginId": "0x390774707b6ae71a0ce31d10394e70b6ac75b3b62ec4db96c9672cafd1b516c9",
    "railData": "0x",
    "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "swapDataSrc": "0x",
    "swapDataDst": "0x",
    "nativeDstAddress": "undefined",
    "thorAsset": "undefined",
    "minThorOutput": "87376000",
    "routeAsset": {
      "canonicalAssetId": "BASE.USDC",
      "providerAssetId": "THORCHAIN:1:1:BASE.USDC",
      "tokenAddress": "undefined",
      "srcTokenAddress": "undefined",
      "dstTokenAddress": "undefined",
      "decimals": 6,
      "assetKind": "erc20",
      "assetStandard": "native"
    }
  }
}

curl -X 'POST' \
  'http://localhost:8787/quote/select' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "offerSetId": "0xc937f358dfca54e94e2d48001b53415af164e185b74742c837f8a969c6ecf2ca",
  "offerId": "0xa0b1ccb69a66a1c24012c636660bb8bed8eaecc288a97095e7082b94e186c469",
  "userAddress": "0x05F8cC8753D90d67DBB8c02118440b8283F941c9"
}'

{
  "quote": {
    "intentId": "0x1016d19a46f2d2a6e7e833ce8cac9f7171b20f6b84ceaa7b4c3e83b9d207fa07",
    "srcChainId": 1,
    "dstChainId": 1,
    "tokenIn": "BASE.ETH",
    "tokenOut": "BASE.USDC",
    "amountIn": "500000000000000",
    "estimatedOut": "87376000",
    "minAmountOut": "87288624",
    "minSrcSwapOut": "0",
    "feeAmountUSD": 0.0000015,
    "feeAmountToken": "1500000000000",
    "rail": "THORCHAIN",
    "railType": "liquidity",
    "settlementToken": "USDC",
    "settlementAssetId": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "expectedDstSettlementToken": "0x0000000000000000000000000000000000000000",
    "expectedDstSettlementAssetId": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "minSettlementAmount": "498500000000000",
    "dstGasLimit": 0,
    "etaSeconds": 30,
    "expiresAt": 1777561352,
    "railPluginId": "0x390774707b6ae71a0ce31d10394e70b6ac75b3b62ec4db96c9672cafd1b516c9",
    "railData": "0x",
    "swapPluginIdSrc": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "swapPluginIdDst": "0x0000000000000000000000000000000000000000000000000000000000000000",
    "swapDataSrc": "0x",
    "swapDataDst": "0x",
    "nativeDstAddress": "undefined",
    "thorAsset": "undefined",
    "minThorOutput": "87376000",
    "routeAsset": {
      "canonicalAssetId": "BASE.USDC",
      "providerAssetId": "THORCHAIN:1:1:BASE.USDC",
      "tokenAddress": "undefined",
      "srcTokenAddress": "undefined",
      "dstTokenAddress": "undefined",
      "decimals": 6,
      "assetKind": "erc20",
      "assetStandard": "native"
    },
    "selectedByUser": true
  },
  "intentId": "0x1016d19a46f2d2a6e7e833ce8cac9f7171b20f6b84ceaa7b4c3e83b9d207fa07",
  "integration": {
    "mode": "provider_direct",
    "action": {
      "kind": "thorchain_swap",
      "depositAddress": "0x4feea1caeea66b3351ddba68bd80c37c9ed6c3c8",
      "memo": "=:BASE.USDC:0x05F8cC8753D90d67DBB8c02118440b8283F941c9",
      "expiresAt": 1777561352,
      "expectedAmountOut": "87376000"
    },
    "tx": {
      "to": "0x00dc6100103BC402d490aEE3F9a5560cBd91f1d4",
      "data": "0x44bc937b0000000000000000000000004feea1caeea66b3351ddba68bd80c37c9ed6c3c800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001c6bf5263400000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000069f36f0800000000000000000000000000000000000000000000000000000000000000363d3a424153452e555344433a30783035463863433837353344393064363744424238633032313138343430623832383346393431633900000000000000000000",
      "value": "500000000000000",
      "chainId": 1
    }
  }
}

node src/vps/scripts/sendManualThorchain.js 
to: 0x00dc6100103BC402d490aEE3F9a5560cBd91f1d4
value: 500000000000000
dataBytes: 260

node src/vps/scripts/sendManualThorchain.js 
to: 0x00dc6100103BC402d490aEE3F9a5560cBd91f1d4
value: 500000000000000
dataBytes: 260
from: 0x05F8cC8753D90d67DBB8c02118440b8283F941c9
txHash: 0x5ae6c3fab62573c49fa3351065da96da93a251407fb3c0768a0fb4ba0ecadffe
status: 1
block: 45385580