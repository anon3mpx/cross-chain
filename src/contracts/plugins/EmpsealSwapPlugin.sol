// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "../interfaces/ISwapPlugin.sol";
import "../interfaces/IEmpsealRouter.sol";

/// @title EmpsealSwapPlugin
/// @notice ISwapPlugin adapter that routes swaps through the deployed EmpsealRouter
///         aggregator. Used by RouterV1 (source chain) and ReceiverV1 (destination
///         chain) to execute tokenIn → settlementToken and settlementToken → tokenOut.
///
/// @dev  Integration model:
///         1. VPS calls empsealRouter.findBestPath() off-chain to find optimal route.
///         2. VPS encodes the resulting Trade struct into swapDataSrc / swapDataDst.
///         3. RouterV1/ReceiverV1 call swapPlugin.swap(SwapParams{data: encodedTrade}).
///         4. This plugin decodes Trade and calls empsealRouter.swapNoSplit().
///
///       Why zero router fee: EMPX Cross Chain charges its fee in RouterV1 before the swap.
///       Passing _fee=0 to EmpsealRouter avoids double-charging the user.
contract EmpsealSwapPlugin is ISwapPlugin, ERC165, Ownable2Step {
    using SafeERC20 for IERC20;

    bytes32 public constant override pluginId = keccak256("EMPSEAL_V1");
    IEmpsealRouter public immutable empseal;

    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    error TradeDecodeFailed();
    error EmptyPath();
    error InvalidTrade();
    error PathTokenMismatch(address pathTokenIn, address pathTokenOut, address paramsTokenIn, address paramsTokenOut);
    error SlippageExceeded(uint256 got, uint256 min);
    error ZeroAddress(string field);

    constructor(address _empseal, address _owner) Ownable(_owner) {
        if (_empseal == address(0)) revert ZeroAddress("empseal");
        empseal = IEmpsealRouter(_empseal);
    }

    // ── ERC-165 ────────────────────────────────────────────────────────────────

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC165, ISwapPlugin)
        returns (bool)
    {
        return interfaceId == type(ISwapPlugin).interfaceId
            || super.supportsInterface(interfaceId);
    }

    // ── ISwapPlugin ────────────────────────────────────────────────────────────

    /// @notice Execute a swap. Called by RouterV1 (src) and ReceiverV1 (dst).
    /// @param params  SwapParams where `data` = abi.encode(IEmpsealRouter.Trade)
    /// @return amountOut Actual output tokens received (balance-delta verified)
    function swap(IntentTypes.SwapParams calldata params)
        external
        override
        returns (uint256 amountOut)
    {
        // ── Decode Trade from VPS-built calldata ──────────────────────────────
        IEmpsealRouter.Trade memory trade = _decodeTrade(params.data);

        if (trade.path.length < 2) revert EmptyPath();
        if (trade.adapters.length + 1 != trade.path.length) revert InvalidTrade();

        // Override amountIn from the intent (authoritative) in case Trade was
        // built with a slightly different amount during quote time.
        trade.amountIn  = params.amountIn;
        trade.amountOut = params.minAmountOut; // EmpsealRouter enforces >= this

        address tokenIn  = trade.path[0];
        address tokenOut = trade.path[trade.path.length - 1];
        if (tokenIn != params.tokenIn || tokenOut != params.tokenOut) {
            revert PathTokenMismatch(tokenIn, tokenOut, params.tokenIn, params.tokenOut);
        }

        // Pull tokenIn from RouterV1 / ReceiverV1 into this plugin.
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);

        // ── Approve EmpsealRouter to spend tokenIn ────────────────────────────
        // RouterV1/ReceiverV1 approve this plugin; plugin then approves Empseal.
        IERC20(tokenIn).forceApprove(address(empseal), params.amountIn);

        // ── Execute via EmpsealRouter ─────────────────────────────────────────
        uint256 before = IERC20(tokenOut).balanceOf(address(this));

        // Fee = 0: EMPX Cross Chain fee is collected in RouterV1 before this call.
        // Output is sent to address(this) so RouterV1/ReceiverV1 can verify
        // balance-delta before forwarding to the rail / user.
        empseal.swapNoSplit(trade, address(this), 0);

        amountOut = IERC20(tokenOut).balanceOf(address(this)) - before;

        // Sanity check — EmpsealRouter should already enforce this internally
        if (amountOut < params.minAmountOut) {
            revert SlippageExceeded(amountOut, params.minAmountOut);
        }

        // Forward output to the caller (RouterV1 or ReceiverV1) so they can
        // then approve the rail plugin or transfer to the user.
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);

        emit SwapExecuted(tokenIn, tokenOut, params.amountIn, amountOut);
    }

    /// @notice Quote a swap using EmpsealRouter's on-chain best-path finder.
    /// @dev    VPS calls this for real-time quoting. For intent building it calls
    ///         empseal.findBestPath() directly (off-chain, gas-free).
    function getQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view override returns (uint256 amountOut) {
        IEmpsealRouter.Query memory q = empseal.queryNoSplit(amountIn, tokenIn, tokenOut);
        return q.amountOut;
    }

    /// @notice Return true if Empseal can currently quote the pair.
    function supportsPair(address tokenIn, address tokenOut)
        external
        view
        override
        returns (bool)
    {
        try empseal.queryNoSplit(1e6, tokenIn, tokenOut) returns (IEmpsealRouter.Query memory q) {
            return q.amountOut > 0;
        } catch {
            return false;
        }
    }

    // ── Internal ───────────────────────────────────────────────────────────────

    function _decodeTrade(bytes calldata data)
        internal pure
        returns (IEmpsealRouter.Trade memory trade)
    {
        // VPS encodes: abi.encode(Trade) where Trade = (amountIn, amountOut, path[], adapters[])
        if (data.length == 0) revert TradeDecodeFailed();
        return abi.decode(data, (IEmpsealRouter.Trade));
    }

    // ── Admin ──────────────────────────────────────────────────────────────────

    /// @notice Recover stuck tokens (should never happen in normal flow)
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
