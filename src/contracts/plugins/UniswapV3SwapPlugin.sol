// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "../interfaces/ISwapPlugin.sol";

interface IUniswapV3SwapRouterLike {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/// @title UniswapV3SwapPlugin
/// @notice Swap plugin for UniswapV3-compatible routers (single-hop exact-input).
/// @dev Swap calldata format:
///      abi.encode(uint24 poolFee, uint160 sqrtPriceLimitX96, uint256 deadline)
contract UniswapV3SwapPlugin is ISwapPlugin, ERC165, Ownable2Step {
    using SafeERC20 for IERC20;

    bytes32 public constant override pluginId = keccak256("UNISWAP_V3_V1");
    IUniswapV3SwapRouterLike public immutable router;

    error ZeroAddress(string field);
    error UnsupportedPair(address tokenIn, address tokenOut);
    error InvalidPoolFee(uint24 fee);
    error DecodeFailed();
    error QuoteNotSupported();
    error SlippageExceeded(uint256 got, uint256 minAmountOut);

    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint24 poolFee,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(address _router, address _owner) Ownable(_owner) {
        if (_router == address(0)) revert ZeroAddress("router");
        router = IUniswapV3SwapRouterLike(_router);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC165, ISwapPlugin)
        returns (bool)
    {
        return interfaceId == type(ISwapPlugin).interfaceId || super.supportsInterface(interfaceId);
    }

    function supportsPair(address tokenIn, address tokenOut) external pure override returns (bool) {
        return _supportsPair(tokenIn, tokenOut);
    }

    function getQuote(address, address, uint256) external pure override returns (uint256) {
        revert QuoteNotSupported();
    }

    function swap(IntentTypes.SwapParams calldata params)
        external
        override
        returns (uint256 amountOut)
    {
        if (!_supportsPair(params.tokenIn, params.tokenOut)) {
            revert UnsupportedPair(params.tokenIn, params.tokenOut);
        }

        (uint24 poolFee, uint160 sqrtPriceLimitX96, uint256 deadline) = _decodeData(params.data);
        if (poolFee == 0) revert InvalidPoolFee(poolFee);

        IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        IERC20(params.tokenIn).forceApprove(address(router), params.amountIn);

        amountOut = router.exactInputSingle(
            IUniswapV3SwapRouterLike.ExactInputSingleParams({
                tokenIn: params.tokenIn,
                tokenOut: params.tokenOut,
                fee: poolFee,
                recipient: address(this),
                deadline: deadline == 0 ? block.timestamp + 300 : deadline,
                amountIn: params.amountIn,
                amountOutMinimum: params.minAmountOut,
                sqrtPriceLimitX96: sqrtPriceLimitX96
            })
        );

        if (amountOut < params.minAmountOut) {
            revert SlippageExceeded(amountOut, params.minAmountOut);
        }

        IERC20(params.tokenOut).safeTransfer(msg.sender, amountOut);
        emit SwapExecuted(params.tokenIn, params.tokenOut, poolFee, params.amountIn, amountOut);
    }

    function _decodeData(bytes calldata data)
        internal
        pure
        returns (uint24 poolFee, uint160 sqrtPriceLimitX96, uint256 deadline)
    {
        if (data.length == 0) revert DecodeFailed();
        return abi.decode(data, (uint24, uint160, uint256));
    }

    function _supportsPair(address tokenIn, address tokenOut) internal pure returns (bool) {
        return tokenIn != address(0) && tokenOut != address(0) && tokenIn != tokenOut;
    }

    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
