// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IEmpsealRouter
/// @notice Minimal interface for the EmpsealRouter on-chain aggregator.
///         Only the functions called by EmpsealSwapPlugin are included.
///         Full router is already deployed — this is a call-site interface only.
interface IEmpsealRouter {

    // ── Structs (must match EmpsealRouter exactly) ─────────────────────────────

    /// @dev Swap instruction. VPS builds this off-chain via findBestPath() and
    ///      encodes it in SwapParams.data for the plugin to decode and execute.
    struct Trade {
        uint256   amountIn;
        uint256   amountOut;    // minimum out (slippage guard inside router)
        address[] path;         // token path  e.g. [WETH, USDC]
        address[] adapters;     // adapter addresses for each hop
    }

    struct Query {
        address adapter;
        address tokenIn;
        address tokenOut;
        uint256 amountOut;
    }

    struct FormattedOffer {
        uint256[] amounts;     // amounts at each step
        address[] adapters;
        address[] path;
    }

    // ── View: quote ────────────────────────────────────────────────────────────

    /// @notice Find best multi-hop path between two tokens across all adapters.
    /// @dev VPS calls this off-chain to build the Trade for swapDataSrc/swapDataDst.
    function findBestPath(
        uint256 _amountIn,
        address _tokenIn,
        address _tokenOut,
        uint256 _maxSteps
    ) external view returns (FormattedOffer memory);

    /// @notice Find best path and account for gas cost in token-out terms.
    function findBestPathWithGas(
        uint256 _amountIn,
        address _tokenIn,
        address _tokenOut,
        uint256 _maxSteps,
        uint256 _gasPrice
    ) external view returns (FormattedOffer memory);

    /// @notice Quote a single-hop swap against all adapters.
    function queryNoSplit(
        uint256 _amountIn,
        address _tokenIn,
        address _tokenOut
    ) external view returns (Query memory);

    // ── Execute: swap ──────────────────────────────────────────────────────────

    /// @notice Execute a swap along the given path using the specified adapters.
    ///         Tokens are sent directly to `_to`. Fee = 0 (EMPX Cross Chain charges fee separately).
    /// @param _trade  Pre-built trade struct from findBestPath
    /// @param _to     Recipient of output token
    /// @param _fee    Router-level fee in BPS — pass 0 (EMPX Cross Chain fee is charged in RouterV1)
    function swapNoSplit(
        Trade calldata _trade,
        address _to,
        uint256 _fee
    ) external;

    /// @notice Swap from native to token (ETH-style function name in reference router).
    function swapNoSplitFromETH(
        Trade calldata _trade,
        address _to,
        uint256 _fee
    ) external payable;

    /// @notice Swap token to native (ETH-style function name in reference router).
    function swapNoSplitToETH(
        Trade calldata _trade,
        address _to,
        uint256 _fee
    ) external;

    /// @notice PulseChain deployments may expose PLS-named variants.
    /// @dev Kept for compatibility where routers were deployed with PLS naming.
    function swapNoSplitFromPLS(
        Trade calldata _trade,
        address _to,
        uint256 _fee
    ) external payable;

    /// @notice PulseChain deployments may expose PLS-named variants.
    function swapNoSplitToPLS(
        Trade calldata _trade,
        address _to,
        uint256 _fee
    ) external;
}
