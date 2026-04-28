// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {
    AxelarRailPlugin,
    IAxelarGasService,
    IAxelarITS,
    IAxelarInterchainToken
} from "../../src/contracts/rails/AxelarRailPlugin.sol";
import {IntentTypes} from "../../src/contracts/interfaces/IIntentTypes.sol";

contract MockAxelarToken is ERC20, IAxelarInterchainToken {
    address public immutable its;
    uint8 public immutable tokenDecimals;

    string public lastDestinationChain;
    bytes public lastDestinationAddress;
    uint256 public lastAmount;
    bytes public lastMetadata;
    uint256 public lastPaidNativeFee;

    constructor(address _its, string memory name_, string memory symbol_, uint8 _tokenDecimals)
        ERC20(name_, symbol_)
    {
        its = _its;
        tokenDecimals = _tokenDecimals;
    }

    function decimals() public view override returns (uint8) { return tokenDecimals; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }

    function interchainTokenService() external view returns (address interchainTokenServiceAddress) {
        return its;
    }

    function interchainTransfer(
        string calldata destinationChain,
        bytes calldata recipient,
        uint256 amount,
        bytes calldata metadata
    ) external payable {
        lastDestinationChain = destinationChain;
        lastDestinationAddress = recipient;
        lastAmount = amount;
        lastMetadata = metadata;
        lastPaidNativeFee = msg.value;
        _transfer(msg.sender, address(this), amount);
    }
}

contract MockAxelarGasService is IAxelarGasService {
    uint256 public fixedFee;
    string public lastDestinationChain;
    string public lastDestinationAddress;
    bytes public lastPayload;
    uint256 public lastGasLimit;
    uint256 public lastPaid;

    constructor(uint256 _fixedFee) {
        fixedFee = _fixedFee;
    }

    function estimateGasFee(
        string memory destinationChain,
        string memory destinationAddress,
        bytes memory payload,
        uint256 executionGasLimit,
        bytes memory params
    ) external view returns (uint256) {
        destinationChain; destinationAddress; payload; executionGasLimit; params;
        return fixedFee;
    }

    function payNativeGasForContractCall(
        address,
        string calldata destinationChain,
        string calldata destinationAddress,
        bytes calldata payload,
        address
    ) external payable {
        lastDestinationChain = destinationChain;
        lastDestinationAddress = destinationAddress;
        lastPayload = payload;
        lastGasLimit = 200_000;
        lastPaid = msg.value;
    }
}

contract MockAxelarITS is IAxelarITS {
    function callContractWithInterchainToken(
        bytes32,
        string calldata,
        bytes calldata,
        uint256,
        bytes calldata
    ) external payable {}
}

contract AxelarRailPluginTest {
    MockAxelarToken private usdc;
    MockAxelarToken private weth;
    MockAxelarGasService private gasService;
    MockAxelarITS private its;
    AxelarRailPlugin private plugin;

    uint32 private constant DST_CHAIN = 42161;
    bytes32 private constant DST_TOKEN_ID = keccak256("ARBITRUM_USDC");
    bytes32 private constant DST_WETH_TOKEN_ID = keccak256("ARBITRUM_WETH");
    uint256 private constant GAS_FEE = 0.01 ether;

    function setUp() public {
        its = new MockAxelarITS();
        usdc = new MockAxelarToken(address(its), "Mock USDC", "mUSDC", 6);
        weth = new MockAxelarToken(address(its), "Mock WETH", "mWETH", 18);
        gasService = new MockAxelarGasService(GAS_FEE);
        plugin = new AxelarRailPlugin(address(gasService), address(its), address(this));

        plugin.setRouteConfig(DST_CHAIN, "arbitrum", address(0xBEEF), DST_TOKEN_ID, address(usdc));
        usdc.mint(address(this), 1_000_000e6);
        weth.mint(address(this), 1_000_000e18);
    }

    function testBridgeHappyPath() public {
        uint256 amount = 100e6;
        usdc.approve(address(plugin), amount);
        IntentTypes.BridgeParams memory params =
            _bridgeParams(address(usdc), amount, _settlementAssetId(address(usdc)), keccak256("intent-1"));

        bytes32 railTxId = plugin.bridge{value: GAS_FEE + 1 wei}(params);

        _assertTrue(railTxId != bytes32(0), "rail tx id is zero");
        _assertEq(usdc.lastAmount(), amount, "bridged amount mismatch");
        _assertEq(keccak256(bytes(usdc.lastDestinationChain())), keccak256(bytes("arbitrum")), "dst chain mismatch");
        _assertEq(usdc.balanceOf(address(usdc)), amount, "token contract did not take funds");
        _assertEq(usdc.lastPaidNativeFee(), GAS_FEE, "gas fee mismatch");
        _assertEq(
            keccak256(usdc.lastMetadata()),
            keccak256(bytes.concat(bytes4(0), hex"1234")),
            "payload metadata mismatch"
        );
    }

    function testBridgeAcceptsDynamicAxelarToken() public {
        uint256 amount = 2e18;
        weth.approve(address(plugin), amount);
        plugin.setRouteConfig(
            DST_CHAIN,
            "arbitrum",
            address(0xBEEF),
            DST_WETH_TOKEN_ID,
            address(weth)
        );

        IntentTypes.BridgeParams memory params =
            _bridgeParams(address(weth), amount, _settlementAssetId(address(weth)), keccak256("intent-weth"));

        bytes32 railTxId = plugin.bridge{value: GAS_FEE}(params);

        _assertTrue(railTxId != bytes32(0), "rail tx id is zero");
        _assertEq(weth.lastAmount(), amount, "bridged amount mismatch");
        _assertEq(
            keccak256(bytes(weth.lastDestinationChain())),
            keccak256(bytes("arbitrum")),
            "dst chain mismatch"
        );
        _assertEq(weth.balanceOf(address(weth)), amount, "token contract did not take funds");
        _assertEq(weth.lastPaidNativeFee(), GAS_FEE, "gas fee mismatch");
    }

    function testEstimateFeeRevertsOnUnsupportedRoute() public {
        (bool ok, ) = address(plugin).call(
            abi.encodeWithSelector(
                plugin.estimateFee.selector,
                uint32(999999),
                uint256(1e6),
                address(usdc),
                _settlementAssetId(address(usdc)),
                uint256(200_000)
            )
        );
        _assertTrue(!ok, "expected unsupported route revert");
    }

    function testBridgeRevertsWhenDynamicAssetRouteMissing() public {
        uint256 amount = 1e18;
        weth.approve(address(plugin), amount);

        IntentTypes.BridgeParams memory params =
            _bridgeParams(address(weth), amount, _settlementAssetId(address(weth)), keccak256("intent-missing-route"));

        (bool ok, ) = address(plugin).call{value: GAS_FEE}(
            abi.encodeWithSelector(plugin.bridge.selector, params)
        );
        _assertTrue(!ok, "expected missing dynamic route revert");
    }

    function testBridgeRevertsWhenRouteAssetIdDoesNotMatchToken() public {
        uint256 amount = 100e6;
        usdc.approve(address(plugin), amount);

        IntentTypes.BridgeParams memory params =
            _bridgeParams(address(usdc), amount, _settlementAssetId(address(weth)), keccak256("intent-bad-asset"));

        (bool ok, ) = address(plugin).call{value: GAS_FEE}(
            abi.encodeWithSelector(plugin.bridge.selector, params)
        );
        _assertTrue(!ok, "expected route asset mismatch revert");
    }

    receive() external payable {}

    function _bridgeParams(
        address settlementToken,
        uint256 amount,
        bytes32 settlementAssetId,
        bytes32 intentId
    ) internal pure returns (IntentTypes.BridgeParams memory) {
        return IntentTypes.BridgeParams({
            intentId: intentId,
            routeTokenAddr: settlementToken,
            amount: amount,
            routeAssetId: settlementAssetId,
            expectedDstRouteToken: address(0),
            expectedDstRouteAssetId: bytes32(0),
            minRouteAmount: 0,
            dstChainId: DST_CHAIN,
            railData: bytes(""),
            dstReceiver: address(0xBEEF),
            dstCalldata: hex"1234",
            gasForDst: 200_000,
            finalRecipient: address(0xABCD),
            nativeDstAddress: bytes(""),
            thorAssetIdentifier: "",
            minThorOutput: 0
        });
    }

    function _assertEq(uint256 a, uint256 b, string memory err) internal pure {
        require(a == b, err);
    }

    function _assertEq(bytes32 a, bytes32 b, string memory err) internal pure {
        require(a == b, err);
    }

    function _settlementAssetId(address token) internal view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, token));
    }

    function _assertTrue(bool ok, string memory err) internal pure {
        require(ok, err);
    }
}
