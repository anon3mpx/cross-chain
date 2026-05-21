// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "../interfaces/ISwapPlugin.sol";

interface IUniswapV2RouterLike {
    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

/// @title UniswapV2SwapPlugin
/// @notice Testnet-friendly swap plugin using any UniswapV2-compatible router.
/// @dev Swap calldata format:
///      abi.encode(address[] path, uint256 deadline)
contract UniswapV2SwapPlugin is ISwapPlugin, ERC165, Ownable2Step {
    using SafeERC20 for IERC20;

    bytes32 public constant override pluginId = keccak256("UNISWAP_V2_V1");
    IUniswapV2RouterLike public immutable router;

    error ZeroAddress(string field);
    error InvalidPath();
    error PathTokenMismatch(address pathTokenIn, address pathTokenOut, address paramsTokenIn, address paramsTokenOut);
    error DecodeFailed();
    error SlippageExceeded(uint256 got, uint256 minAmountOut);

    event SwapExecuted(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);

    constructor(address _router, address _owner) Ownable(_owner) {
        if (_router == address(0)) revert ZeroAddress("router");
        router = IUniswapV2RouterLike(_router);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC165, ISwapPlugin)
        returns (bool)
    {
        return interfaceId == type(ISwapPlugin).interfaceId || super.supportsInterface(interfaceId);
    }

    function supportsPair(address tokenIn, address tokenOut) external view override returns (bool) {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        try router.getAmountsOut(1e6, path) returns (uint256[] memory amounts) {
            return amounts.length > 1 && amounts[1] > 0;
        } catch {
            return false;
        }
    }

    function getQuote(address tokenIn, address tokenOut, uint256 amountIn)
        external
        view
        override
        returns (uint256 amountOut)
    {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        uint256[] memory amounts = router.getAmountsOut(amountIn, path);
        if (amounts.length < 2) revert InvalidPath();
        return amounts[amounts.length - 1];
    }

    function swap(IntentTypes.SwapParams calldata params)
        external
        override
        returns (uint256 amountOut)
    {
        (address[] memory path, uint256 deadline) = _decodePathAndDeadline(params.data);
        _validatePath(path, params.tokenIn, params.tokenOut);

        IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        IERC20(params.tokenIn).forceApprove(address(router), params.amountIn);

        uint256[] memory amounts = router.swapExactTokensForTokens(
            params.amountIn,
            params.minAmountOut,
            path,
            address(this),
            deadline == 0 ? block.timestamp + 300 : deadline
        );

        if (amounts.length < 2) revert InvalidPath();
        amountOut = amounts[amounts.length - 1];
        if (amountOut < params.minAmountOut) {
            revert SlippageExceeded(amountOut, params.minAmountOut);
        }

        IERC20(params.tokenOut).safeTransfer(msg.sender, amountOut);
        emit SwapExecuted(params.tokenIn, params.tokenOut, params.amountIn, amountOut);
    }

    function _decodePathAndDeadline(bytes calldata data)
        internal
        pure
        returns (address[] memory path, uint256 deadline)
    {
        if (data.length == 0) revert DecodeFailed();
        return abi.decode(data, (address[], uint256));
    }

    function _validatePath(address[] memory path, address tokenIn, address tokenOut) internal pure {
        if (path.length < 2) revert InvalidPath();
        address pathIn = path[0];
        address pathOut = path[path.length - 1];
        if (pathIn != tokenIn || pathOut != tokenOut) {
            revert PathTokenMismatch(pathIn, pathOut, tokenIn, tokenOut);
        }
    }

    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
