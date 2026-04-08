// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IIntentTypes.sol";

/// @title ISwapPlugin — Interface every DEX aggregator plugin must implement
/// @notice Wrap any on-chain DEX (Uniswap, Curve, 1inch, etc.) as a plugin.
///         Each chain gets its own plugin set registered in PluginRegistry.
interface ISwapPlugin {

    /// @notice Returns a unique identifier (e.g. "UNISWAP_V3", "CURVE_STABLE")
    function pluginId() external view returns (bytes32);

    /// @notice Returns true if this plugin can swap the given token pair
    function supportsPair(address tokenIn, address tokenOut) external view returns (bool);

    /// @notice Get an estimated output amount (not guaranteed, for quoting only)
    /// @param tokenIn  Input token address
    /// @param tokenOut Output token address
    /// @param amountIn Exact input amount
    /// @return amountOut Estimated output (not accounting for slippage in calldata)
    function getQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut);

    /// @notice Execute a swap
    /// @dev Plugin pulls `params.amountIn` of tokenIn from caller (must be approved).
    ///      Plugin pushes `amountOut` of tokenOut back to caller.
    ///      Reverts if amountOut < params.minAmountOut.
    /// @return amountOut Actual output amount
    function swap(
        IntentTypes.SwapParams calldata params
    ) external returns (uint256 amountOut);

    /// @notice EIP-165 support check
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}
