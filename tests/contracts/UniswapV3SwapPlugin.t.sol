// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IntentTypes} from "../../src/contracts/interfaces/IIntentTypes.sol";
import {UniswapV3SwapPlugin} from "../../src/contracts/plugins/UniswapV3SwapPlugin.sol";

contract MockTokenUniV3 is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract MockUniswapV3RouterLike {
    mapping(bytes32 => uint256) public pairRateBps;

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

    function setRate(address tokenIn, address tokenOut, uint24 fee, uint256 rateBps) external {
        pairRateBps[_pairKey(tokenIn, tokenOut, fee)] = rateBps;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external returns (uint256 amountOut) {
        require(params.deadline >= block.timestamp, "expired");
        params.sqrtPriceLimitX96; // silence warning in mock
        uint256 rate = pairRateBps[_pairKey(params.tokenIn, params.tokenOut, params.fee)];
        require(rate > 0, "unsupported pair");
        amountOut = (params.amountIn * rate) / 10_000;
        require(amountOut >= params.amountOutMinimum, "slippage");

        ERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
        ERC20(params.tokenOut).transfer(params.recipient, amountOut);
    }

    function _pairKey(address tokenIn, address tokenOut, uint24 fee) internal pure returns (bytes32) {
        return keccak256(abi.encode(tokenIn, tokenOut, fee));
    }
}

contract UniswapV3SwapPluginTest {
    MockTokenUniV3 private tokenIn;
    MockTokenUniV3 private tokenOut;
    MockUniswapV3RouterLike private router;
    UniswapV3SwapPlugin private plugin;

    function setUp() public {
        tokenIn = new MockTokenUniV3("Mock USDC", "mUSDC");
        tokenOut = new MockTokenUniV3("Mock USDT", "mUSDT");
        router = new MockUniswapV3RouterLike();
        plugin = new UniswapV3SwapPlugin(address(router), address(this));

        tokenIn.mint(address(this), 1_000_000e6);
        tokenOut.mint(address(router), 1_000_000e6);
        router.setRate(address(tokenIn), address(tokenOut), 3000, 10_100); // +1%
    }

    function testSwapHappyPath() public {
        bytes memory data = abi.encode(uint24(3000), uint160(0), block.timestamp + 3600);
        tokenIn.approve(address(plugin), 100e6);

        IntentTypes.SwapParams memory params = IntentTypes.SwapParams({
            tokenIn: address(tokenIn),
            tokenOut: address(tokenOut),
            amountIn: 100e6,
            minAmountOut: 100e6,
            data: data
        });

        uint256 out = plugin.swap(params);
        _assertEq(out, 101e6, "unexpected output");
        _assertEq(tokenOut.balanceOf(address(this)), 101e6, "caller did not receive output");
        _assertEq(tokenIn.balanceOf(address(router)), 100e6, "router did not receive input");
    }

    function testSwapRevertsWithEmptyData() public {
        tokenIn.approve(address(plugin), 100e6);
        IntentTypes.SwapParams memory params = IntentTypes.SwapParams({
            tokenIn: address(tokenIn),
            tokenOut: address(tokenOut),
            amountIn: 100e6,
            minAmountOut: 100e6,
            data: bytes("")
        });

        (bool ok, ) = address(plugin).call(abi.encodeWithSelector(plugin.swap.selector, params));
        _assertTrue(!ok, "expected decode revert");
    }

    function testSupportsPairAndQuoteRevert() public {
        bool supported = plugin.supportsPair(address(tokenIn), address(tokenOut));
        bool unsupported = plugin.supportsPair(address(tokenIn), address(tokenIn));
        _assertTrue(supported, "expected supported pair");
        _assertTrue(!unsupported, "same-token pair must be unsupported");

        (bool ok, ) = address(plugin).call(
            abi.encodeWithSelector(plugin.getQuote.selector, address(tokenIn), address(tokenOut), 100e6)
        );
        _assertTrue(!ok, "expected quote not supported revert");
    }

    function _assertEq(uint256 a, uint256 b, string memory err) internal pure {
        require(a == b, err);
    }

    function _assertTrue(bool ok, string memory err) internal pure {
        require(ok, err);
    }
}
