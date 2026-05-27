// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "../interfaces/ISwapPlugin.sol";
import "../interfaces/IEmpsealRouter.sol";

/// @title EmpsealSwapPluginV2
/// @notice Fee-aware Empseal adapter used when EmpsealRouter requires non-zero router fee.
/// @dev Expects params.data = abi.encode(IEmpsealRouter.Trade, uint256 routerFeeBps).
contract EmpsealSwapPluginV2 is ISwapPlugin, ERC165, Ownable2Step {
    using SafeERC20 for IERC20;

    bytes32 public constant override pluginId = keccak256("EMPSEAL_V2");
    IEmpsealRouter public immutable empseal;

    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 routerFeeBps
    );

    error TradeDecodeFailed();
    error EmptyPath();
    error InvalidTrade();
    error InvalidRouterFeeBps(uint256 feeBps);
    error PathTokenMismatch(address pathTokenIn, address pathTokenOut, address paramsTokenIn, address paramsTokenOut);
    error SlippageExceeded(uint256 got, uint256 min);
    error ZeroAddress(string field);

    constructor(address _empseal, address _owner) Ownable(_owner) {
        if (_empseal == address(0)) revert ZeroAddress("empseal");
        empseal = IEmpsealRouter(_empseal);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC165, ISwapPlugin)
        returns (bool)
    {
        return interfaceId == type(ISwapPlugin).interfaceId
            || super.supportsInterface(interfaceId);
    }

    function swap(IntentTypes.SwapParams calldata params)
        external
        override
        returns (uint256 amountOut)
    {
        (IEmpsealRouter.Trade memory trade, uint256 routerFeeBps) = _decodeTradeAndFee(params.data);

        if (trade.path.length < 2) revert EmptyPath();
        if (trade.adapters.length + 1 != trade.path.length) revert InvalidTrade();
        if (routerFeeBps > 9_900) revert InvalidRouterFeeBps(routerFeeBps);

        trade.amountIn = params.amountIn;
        trade.amountOut = params.minAmountOut;

        address tokenIn = trade.path[0];
        address tokenOut = trade.path[trade.path.length - 1];
        if (tokenIn != params.tokenIn || tokenOut != params.tokenOut) {
            revert PathTokenMismatch(tokenIn, tokenOut, params.tokenIn, params.tokenOut);
        }

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        IERC20(tokenIn).forceApprove(address(empseal), params.amountIn);

        uint256 beforeBalance = IERC20(tokenOut).balanceOf(address(this));
        empseal.swapNoSplit(trade, address(this), routerFeeBps);
        amountOut = IERC20(tokenOut).balanceOf(address(this)) - beforeBalance;

        if (amountOut < params.minAmountOut) {
            revert SlippageExceeded(amountOut, params.minAmountOut);
        }

        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
        emit SwapExecuted(tokenIn, tokenOut, params.amountIn, amountOut, routerFeeBps);
    }

    function getQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view override returns (uint256 amountOut) {
        IEmpsealRouter.Query memory q = empseal.queryNoSplit(amountIn, tokenIn, tokenOut);
        return q.amountOut;
    }

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

    function _decodeTradeAndFee(bytes calldata data)
        internal pure
        returns (IEmpsealRouter.Trade memory trade, uint256 routerFeeBps)
    {
        if (data.length == 0) revert TradeDecodeFailed();
        return abi.decode(data, (IEmpsealRouter.Trade, uint256));
    }

    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
