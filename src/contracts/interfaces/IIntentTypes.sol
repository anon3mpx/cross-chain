// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IIntentTypes — Shared structs for the EMPX-Cross-Chain cross-chain router
library IntentTypes {
    /// @notice Which rail to use for bridging
    enum Rail { CCTP, AXELAR, LAYERZERO, VIA_LABS }

    /// @notice Full intent parameters submitted by the user on the source chain
    struct SwapIntent {
        address user;               // Recipient on destination chain
        address tokenIn;            // Token user is selling (address on src chain)
        address tokenOut;           // Token user wants (address on dst chain)
        uint256 amountIn;           // Exact amount in
        uint256 minAmountOut;       // Slippage protection on destination swap
        uint256 minSrcSwapOut;      // [SECURITY] Min route token from src swap (anti-sandwich)
        uint32  dstChainId;         // Destination chain (EVM chain ID)
        uint8   rail;               // Rail enum value (selected off-chain)
        address routeToken;         // Exact source-chain token the selected rail will bridge
        bytes32 routeAssetId;       // Provider/canonical route asset selected for the transfer
        address expectedDstRouteToken; // Exact destination token expected from the rail
        bytes32 expectedDstRouteAssetId; // Destination route asset identifier expected from the rail
        uint256 minRouteAmount;     // Minimum route-token amount that must arrive before dst swap/direct delivery
        uint256 feeAmount;          // Pre-quoted fee in tokenIn terms (capped at 1% on-chain)
        bytes   swapDataSrc;        // Encoded swap params for source aggregator
        bytes   swapDataDst;        // Encoded swap params for destination aggregator
        bytes32 swapPluginIdSrc;    // [SECURITY] Src plugin locked in intent, not external calldata
        bytes32 dstSwapPluginId;    // [SECURITY] Dst plugin locked in intent, not in calldata
        bytes32 railPluginId;       // [SECURITY] Rail plugin locked in intent, not external calldata
        bytes   railData;           // Rail-specific params (e.g. CCTP maxFee/minFinalityThreshold)
        uint256 dstGasLimit;        // Destination execution gas budget selected by the signer
        address dstReceiver;        // ReceiverV1 address on destination chain
        bytes   nativeDstAddress;   // For non-EVM delivery rails (BTC/SOL/etc.)
        string  thorAssetIdentifier;// THORChain asset identifier
        uint256 minThorOutput;      // THORChain minimum output (8-dec units)
        bytes32 intentId;           // Unique ID generated off-chain (VPS)
        uint256 deadline;           // Unix timestamp — revert if expired (max 30min ahead)
    }

    /// @notice Params passed to a rail plugin to execute a bridge
    struct BridgeParams {
        bytes32 intentId;
        address routeTokenAddr;      // Exact source-chain token the rail should bridge
        uint256 amount;              // Amount of route token to bridge
        bytes32 routeAssetId;        // Route asset identifier attached to the bridge request
        address expectedDstRouteToken; // Destination route token expected from the rail
        bytes32 expectedDstRouteAssetId; // Destination route asset identifier expected from the rail
        uint256 minRouteAmount;      // Minimum destination route amount expected from the rail
        uint32  dstChainId;
        bytes   railData;            // Rail-specific params forwarded from signed intent
        // ── Messaging rails (CCTP, Axelar, LZ, Via Labs) ──────────────────────
        address dstReceiver;         // ReceiverV1 contract on destination EVM chain
        bytes   dstCalldata;         // Calldata for ReceiverV1.execute()
        uint256 gasForDst;           // Gas budget for destination execution
        // ── Liquidity rails (THORChain, Chainflip) ────────────────────────────
        address finalRecipient;      // End user EVM address (used if dstChain is EVM)
        bytes   nativeDstAddress;    // UTF-8 encoded native address: BTC/SOL/DOGE addr
        string  thorAssetIdentifier; // THORChain asset string e.g. "BTC.BTC", "SOL.SOL"
        uint256 minThorOutput;       // THORChain slip limit in 8-decimal units (0 = no limit)
    }

    /// @notice Params passed to a swap plugin
    struct SwapParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        bytes   data;               // Plugin-specific encoded swap data
    }
}
