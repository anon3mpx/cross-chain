// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IEmpsealRouter} from "../../src/contracts/interfaces/IEmpsealRouter.sol";
import {EmpsealSwapPlugin} from "../../src/contracts/plugins/EmpsealSwapPlugin.sol";
import {IntentTypes} from "../../src/contracts/interfaces/IIntentTypes.sol";

contract MockUSDCForEmpseal is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract MockEmpsealRouter is IEmpsealRouter {
    mapping(bytes32 => uint256) public quotes;
    uint256 public fixedOutput;

    function setQuote(address tokenIn, address tokenOut, uint256 amountOut) external {
        quotes[keccak256(abi.encode(tokenIn, tokenOut))] = amountOut;
    }

    function setFixedOutput(uint256 amountOut) external {
        fixedOutput = amountOut;
    }

    function findBestPath(
        uint256,
        address,
        address,
        uint256
    ) external pure returns (FormattedOffer memory) {
        return FormattedOffer(new uint256[](0), new address[](0), new address[](0), new uint256[](0));
    }

    function findBestPathWithGas(
        uint256,
        address,
        address,
        uint256,
        uint256
    ) external pure returns (FormattedOffer memory) {
        return FormattedOffer(new uint256[](0), new address[](0), new address[](0), new uint256[](0));
    }

    function queryNoSplit(
        uint256,
        address _tokenIn,
        address _tokenOut
    ) external view returns (Query memory) {
        uint256 out = quotes[keccak256(abi.encode(_tokenIn, _tokenOut))];
        return Query(address(this), _tokenIn, _tokenOut, out);
    }

    function swapNoSplit(Trade calldata _trade, address _to, uint256) external {
        ERC20(_trade.path[0]).transferFrom(msg.sender, address(this), _trade.amountIn);
        ERC20(_trade.path[_trade.path.length - 1]).transfer(_to, fixedOutput);
    }

    function swapNoSplitFromETH(Trade calldata, address, uint256) external payable {}
    function swapNoSplitToETH(Trade calldata, address, uint256) external {}
    function swapNoSplitFromPLS(Trade calldata, address, uint256) external payable {}
    function swapNoSplitToPLS(Trade calldata, address, uint256) external {}
}

contract EmpsealSwapPluginTest {
    MockUSDCForEmpseal private tokenIn;
    MockUSDCForEmpseal private tokenOut;
    MockEmpsealRouter private router;
    EmpsealSwapPlugin private plugin;

    function setUp() public {
        tokenIn = new MockUSDCForEmpseal();
        tokenOut = new MockUSDCForEmpseal();
        router = new MockEmpsealRouter();
        plugin = new EmpsealSwapPlugin(address(router), address(this));

        tokenIn.mint(address(this), 1_000_000e6);
        tokenOut.mint(address(router), 1_000_000e6);
        router.setFixedOutput(105e6);
        router.setQuote(address(tokenIn), address(tokenOut), 100e6);
    }

    function testSwapHappyPath() public {
        IEmpsealRouter.Trade memory trade = _trade(address(tokenIn), address(tokenOut), 100e6, 100e6);
        bytes memory data = abi.encode(trade);

        tokenIn.approve(address(plugin), 100e6);

        IntentTypes.SwapParams memory params = IntentTypes.SwapParams({
            tokenIn: address(tokenIn),
            tokenOut: address(tokenOut),
            amountIn: 100e6,
            minAmountOut: 100e6,
            data: data
        });

        uint256 out = plugin.swap(params);

        _assertEq(out, 105e6, "unexpected out");
        _assertEq(tokenOut.balanceOf(address(this)), 105e6, "caller did not receive output");
        _assertEq(tokenIn.balanceOf(address(router)), 100e6, "router did not receive input");
    }

    function testSwapRevertsOnPathTokenMismatch() public {
        IEmpsealRouter.Trade memory trade = _trade(address(tokenOut), address(tokenIn), 100e6, 100e6);
        bytes memory data = abi.encode(trade);
        tokenIn.approve(address(plugin), 100e6);

        IntentTypes.SwapParams memory params = IntentTypes.SwapParams({
            tokenIn: address(tokenIn),
            tokenOut: address(tokenOut),
            amountIn: 100e6,
            minAmountOut: 100e6,
            data: data
        });

        (bool ok, ) = address(plugin).call(
            abi.encodeWithSelector(plugin.swap.selector, params)
        );
        _assertTrue(!ok, "expected mismatch revert");
    }

    function testGetQuoteAndSupportsPair() public view {
        uint256 q = plugin.getQuote(address(tokenIn), address(tokenOut), 100e6);
        _assertEq(q, 100e6, "quote mismatch");
        bool supported = plugin.supportsPair(address(tokenIn), address(tokenOut));
        _assertTrue(supported, "expected supported pair");
    }

    function _trade(
        address _tokenIn,
        address _tokenOut,
        uint256 amountIn,
        uint256 amountOut
    ) internal pure returns (IEmpsealRouter.Trade memory t) {
        address[] memory path = new address[](2);
        path[0] = _tokenIn;
        path[1] = _tokenOut;

        address[] memory adapters = new address[](1);
        adapters[0] = address(0xA11CE);

        t = IEmpsealRouter.Trade({
            amountIn: amountIn,
            amountOut: amountOut,
            path: path,
            adapters: adapters
        });
    }

    function _assertEq(uint256 a, uint256 b, string memory err) internal pure {
        require(a == b, err);
    }

    function _assertTrue(bool ok, string memory err) internal pure {
        require(ok, err);
    }
}

