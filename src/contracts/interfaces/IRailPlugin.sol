// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IIntentTypes.sol";

/// @title IRailPlugin — Interface every bridge rail plugin must implement
/// @notice Add new rails by deploying a new contract implementing this interface,
///         then registering it in PluginRegistry. Zero core contract changes needed.
interface IRailPlugin {

    /// @notice Returns a unique identifier for this rail (e.g. "CCTP_V1")
    function railId() external view returns (bytes32);

    /// @notice Returns true if this rail can bridge between the two chains
    /// @param srcChainId Source EVM chain ID
    /// @param dstChainId Destination EVM chain ID
    function supportsRoute(uint32 srcChainId, uint32 dstChainId) external view returns (bool);

    /// @notice Estimate bridge fee in native token (wei) for given params
    /// @return fee Estimated cost in native token
    /// @return eta Estimated seconds to destination settlement
    function estimateFee(
        uint32  dstChainId,
        uint256 amount,
        address routeToken,
        bytes32 routeAssetId,
        uint256 dstGasLimit
    ) external view returns (uint256 fee, uint256 eta);

    /// @notice Execute the bridge transfer
    /// @dev Called by RouterV1 after swap to settlement token is complete.
    ///      Plugin must transfer `params.amount` of settlement token from RouterV1
    ///      (already approved) and initiate the cross-chain transfer.
    /// @return railTxId Identifier to track this transfer on the rail's explorer
    function bridge(
        IntentTypes.BridgeParams calldata params
    ) external payable returns (bytes32 railTxId);

    /// @notice EIP-165 support check
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}
