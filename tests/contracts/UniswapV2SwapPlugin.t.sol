// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IntentTypes} from "../../src/contracts/interfaces/IIntentTypes.sol";
import {UniswapV2SwapPlugin} from "../../src/contracts/plugins/UniswapV2SwapPlugin.sol";

contract MockTokenUniV2 is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract MockUniswapV2RouterLike {
    mapping(bytes32 => uint256) public pairRateBps;

    function setRate(address tokenIn, address tokenOut, uint256 rateBps) external {
        pairRateBps[_pairKey(tokenIn, tokenOut)] = rateBps;
    }

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts)
    {
        require(path.length >= 2, "bad path");
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        for (uint256 i = 1; i < path.length; i++) {
            uint256 rate = pairRateBps[_pairKey(path[i - 1], path[i])];
            amounts[i] = (amounts[i - 1] * rate) / 10_000;
        }
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256
    ) external returns (uint256[] memory amounts) {
        require(path.length >= 2, "bad path");

        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        for (uint256 i = 1; i < path.length; i++) {
            uint256 rate = pairRateBps[_pairKey(path[i - 1], path[i])];
            amounts[i] = (amounts[i - 1] * rate) / 10_000;
        }
        uint256 out = amounts[amounts.length - 1];
        require(out >= amountOutMin, "slippage");

        ERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        ERC20(path[path.length - 1]).transfer(to, out);
    }

    function _pairKey(address tokenIn, address tokenOut) internal pure returns (bytes32) {
        return keccak256(abi.encode(tokenIn, tokenOut));
    }
}

contract UniswapV2SwapPluginTest {
    MockTokenUniV2 private tokenIn;
    MockTokenUniV2 private tokenOut;
    MockUniswapV2RouterLike private router;
    UniswapV2SwapPlugin private plugin;

    function setUp() public {
        tokenIn = new MockTokenUniV2("Mock USDC", "mUSDC");
        tokenOut = new MockTokenUniV2("Mock USDT", "mUSDT");
        router = new MockUniswapV2RouterLike();
        plugin = new UniswapV2SwapPlugin(address(router), address(this));

        tokenIn.mint(address(this), 1_000_000e6);
        tokenOut.mint(address(router), 1_000_000e6);
        router.setRate(address(tokenIn), address(tokenOut), 10_300); // +3%
    }

    function testSwapHappyPath() public {
        address[] memory path = new address[](2);
        path[0] = address(tokenIn);
        path[1] = address(tokenOut);
        bytes memory data = abi.encode(path, block.timestamp + 3600);

        tokenIn.approve(address(plugin), 100e6);

        IntentTypes.SwapParams memory params = IntentTypes.SwapParams({
            tokenIn: address(tokenIn),
            tokenOut: address(tokenOut),
            amountIn: 100e6,
            minAmountOut: 100e6,
            data: data
        });

        uint256 out = plugin.swap(params);
        _assertEq(out, 103e6, "unexpected output");
        _assertEq(tokenOut.balanceOf(address(this)), 103e6, "caller did not receive output");
        _assertEq(tokenIn.balanceOf(address(router)), 100e6, "router did not receive input");
    }

    function testSwapRevertsOnPathMismatch() public {
        address[] memory path = new address[](2);
        path[0] = address(tokenOut);
        path[1] = address(tokenIn);
        bytes memory data = abi.encode(path, block.timestamp + 3600);

        tokenIn.approve(address(plugin), 100e6);
        IntentTypes.SwapParams memory params = IntentTypes.SwapParams({
            tokenIn: address(tokenIn),
            tokenOut: address(tokenOut),
            amountIn: 100e6,
            minAmountOut: 100e6,
            data: data
        });

        (bool ok, ) = address(plugin).call(abi.encodeWithSelector(plugin.swap.selector, params));
        _assertTrue(!ok, "expected path mismatch revert");
    }

    function testQuoteAndSupportsPair() public view {
        uint256 quoteOut = plugin.getQuote(address(tokenIn), address(tokenOut), 100e6);
        _assertEq(quoteOut, 103e6, "quote mismatch");
        bool supported = plugin.supportsPair(address(tokenIn), address(tokenOut));
        _assertTrue(supported, "pair should be supported");
    }

    function _assertEq(uint256 a, uint256 b, string memory err) internal pure {
        require(a == b, err);
    }

    function _assertTrue(bool ok, string memory err) internal pure {
        require(ok, err);
    }
}
