// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {CCTPFastRailPlugin, ITokenMessengerV2} from "../../src/contracts/rails/CCTPFastRailPlugin.sol";
import {IntentTypes} from "../../src/contracts/interfaces/IIntentTypes.sol";

contract MockUSDCCctpFast is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract MockTokenMessengerFast is ITokenMessengerV2 {
    uint256 public lastAmount;
    uint32 public lastDestinationDomain;
    bytes32 public lastMintRecipient;
    address public lastBurnToken;
    bytes32 public lastDestinationCaller;
    uint256 public lastMaxFee;
    uint32 public lastMinFinalityThreshold;
    bytes public lastHookData;
    bool public calledWithHook;

    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold
    ) external {
        lastAmount = amount;
        lastDestinationDomain = destinationDomain;
        lastMintRecipient = mintRecipient;
        lastBurnToken = burnToken;
        lastDestinationCaller = destinationCaller;
        lastMaxFee = maxFee;
        lastMinFinalityThreshold = minFinalityThreshold;
        calledWithHook = false;
        lastHookData = bytes("");
        ERC20(burnToken).transferFrom(msg.sender, address(this), amount);
    }

    function depositForBurnWithHook(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold,
        bytes calldata hookData
    ) external {
        lastAmount = amount;
        lastDestinationDomain = destinationDomain;
        lastMintRecipient = mintRecipient;
        lastBurnToken = burnToken;
        lastDestinationCaller = destinationCaller;
        lastMaxFee = maxFee;
        lastMinFinalityThreshold = minFinalityThreshold;
        calledWithHook = true;
        lastHookData = hookData;
        ERC20(burnToken).transferFrom(msg.sender, address(this), amount);
    }
}

contract CCTPFastRailPluginTest {
    MockUSDCCctpFast private usdc;
    MockTokenMessengerFast private tokenMessenger;
    CCTPFastRailPlugin private plugin;

    uint32 private constant DST_CHAIN = 42161;
    uint32 private constant DST_DOMAIN = 3;
    bytes32 private constant DST_RECEIVER = bytes32(uint256(uint160(address(0xBEEF))));

    function setUp() public {
        usdc = new MockUSDCCctpFast();
        tokenMessenger = new MockTokenMessengerFast();
        plugin = new CCTPFastRailPlugin(address(tokenMessenger), address(usdc), address(this));

        plugin.setChainDomain(DST_CHAIN, DST_DOMAIN);
        plugin.setDestinationReceiver(DST_CHAIN, DST_RECEIVER);
        plugin.setDestinationCaller(DST_CHAIN, bytes32(uint256(uint160(address(0xCAFE)))));

        usdc.mint(address(this), 1_000_000e6);
    }

    function testBridgeFastHappyPathWithHook() public {
        uint256 amount = 100e6;
        uint256 maxFee = 1e6; // 1%
        usdc.approve(address(plugin), amount);

        IntentTypes.BridgeParams memory params = IntentTypes.BridgeParams({
            intentId: keccak256("intent-fast-1"),
            routeTokenAddr: address(usdc),
            amount: amount,
            routeAssetId: bytes32(0),
            expectedDstRouteToken: address(0),
            expectedDstRouteAssetId: bytes32(0),
            minRouteAmount: 0,
            dstChainId: DST_CHAIN,
            railData: abi.encode(uint32(1000), maxFee),
            dstReceiver: address(0xBEEF),
            dstCalldata: hex"1234",
            gasForDst: 200_000,
            finalRecipient: address(0xABCD),
            nativeDstAddress: bytes(""),
            thorAssetIdentifier: "",
            minThorOutput: 0
        });

        bytes32 railTxId = plugin.bridge(params);

        _assertTrue(railTxId != bytes32(0), "rail tx id is zero");
        _assertTrue(tokenMessenger.calledWithHook(), "expected depositForBurnWithHook");
        _assertEq(tokenMessenger.lastAmount(), amount, "amount mismatch");
        _assertEq(uint256(tokenMessenger.lastDestinationDomain()), uint256(DST_DOMAIN), "domain mismatch");
        _assertEq(tokenMessenger.lastMintRecipient(), DST_RECEIVER, "receiver mismatch");
        _assertEq(tokenMessenger.lastMaxFee(), maxFee, "max fee mismatch");
        _assertEq(uint256(tokenMessenger.lastMinFinalityThreshold()), 1000, "finality mismatch");
        _assertEq(keccak256(tokenMessenger.lastHookData()), keccak256(hex"1234"), "hook mismatch");
        _assertEq(usdc.balanceOf(address(tokenMessenger)), amount, "burn token pull mismatch");
    }

    function testBridgeRevertsOnMissingRailData() public {
        usdc.approve(address(plugin), 10e6);
        IntentTypes.BridgeParams memory params = IntentTypes.BridgeParams({
            intentId: keccak256("intent-fast-2"),
            routeTokenAddr: address(usdc),
            amount: 10e6,
            routeAssetId: bytes32(0),
            expectedDstRouteToken: address(0),
            expectedDstRouteAssetId: bytes32(0),
            minRouteAmount: 0,
            dstChainId: DST_CHAIN,
            railData: bytes(""),
            dstReceiver: address(0xBEEF),
            dstCalldata: hex"",
            gasForDst: 200_000,
            finalRecipient: address(0xABCD),
            nativeDstAddress: bytes(""),
            thorAssetIdentifier: "",
            minThorOutput: 0
        });

        (bool ok,) = address(plugin).call(abi.encodeWithSelector(plugin.bridge.selector, params));
        _assertTrue(!ok, "expected missing railData revert");
    }

    function testBridgeRevertsWhenMaxFeeAboveCap() public {
        uint256 amount = 100e6;
        uint256 tooHighMaxFee = 2e6; // 2% > default cap (1%)
        usdc.approve(address(plugin), amount);

        IntentTypes.BridgeParams memory params = IntentTypes.BridgeParams({
            intentId: keccak256("intent-fast-3"),
            routeTokenAddr: address(usdc),
            amount: amount,
            routeAssetId: bytes32(0),
            expectedDstRouteToken: address(0),
            expectedDstRouteAssetId: bytes32(0),
            minRouteAmount: 0,
            dstChainId: DST_CHAIN,
            railData: abi.encode(uint32(1000), tooHighMaxFee),
            dstReceiver: address(0xBEEF),
            dstCalldata: hex"",
            gasForDst: 200_000,
            finalRecipient: address(0xABCD),
            nativeDstAddress: bytes(""),
            thorAssetIdentifier: "",
            minThorOutput: 0
        });

        (bool ok,) = address(plugin).call(abi.encodeWithSelector(plugin.bridge.selector, params));
        _assertTrue(!ok, "expected maxFee cap revert");
    }

    function _assertEq(uint256 a, uint256 b, string memory err) internal pure {
        require(a == b, err);
    }

    function _assertEq(bytes32 a, bytes32 b, string memory err) internal pure {
        require(a == b, err);
    }

    function _assertTrue(bool ok, string memory err) internal pure {
        require(ok, err);
    }
}
