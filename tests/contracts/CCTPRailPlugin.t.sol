// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {CCTPRailPlugin, ITokenMessengerV2} from "../../src/contracts/rails/CCTPRailPlugin.sol";
import {IntentTypes} from "../../src/contracts/interfaces/IIntentTypes.sol";

contract MockUSDCCctpFinalized is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract MockTokenMessengerFinalized is ITokenMessengerV2 {
    uint256 public lastAmount;
    uint32 public lastDestinationDomain;
    bytes32 public lastMintRecipient;
    address public lastBurnToken;
    bytes32 public lastDestinationCaller;
    bytes public lastHookData;
    bool public calledWithHook;

    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,
        uint256,
        uint32
    ) external {
        lastAmount = amount;
        lastDestinationDomain = destinationDomain;
        lastMintRecipient = mintRecipient;
        lastBurnToken = burnToken;
        lastDestinationCaller = destinationCaller;
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
        uint256,
        uint32,
        bytes calldata hookData
    ) external {
        lastAmount = amount;
        lastDestinationDomain = destinationDomain;
        lastMintRecipient = mintRecipient;
        lastBurnToken = burnToken;
        lastDestinationCaller = destinationCaller;
        calledWithHook = true;
        lastHookData = hookData;
        ERC20(burnToken).transferFrom(msg.sender, address(this), amount);
    }
}

contract CCTPRailPluginTest {
    MockUSDCCctpFinalized private usdc;
    MockTokenMessengerFinalized private tokenMessenger;
    CCTPRailPlugin private plugin;

    uint32 private constant DST_CHAIN = 42161;
    uint32 private constant DST_DOMAIN = 3;
    bytes32 private constant DST_RECEIVER = bytes32(uint256(uint160(address(0xBEEF))));
    bytes32 private constant DST_CALLER = bytes32(uint256(uint160(address(0xCAFE))));

    function setUp() public {
        usdc = new MockUSDCCctpFinalized();
        tokenMessenger = new MockTokenMessengerFinalized();
        plugin = new CCTPRailPlugin(address(tokenMessenger), address(usdc), address(this));

        plugin.setChainDomain(DST_CHAIN, DST_DOMAIN);
        plugin.setDestinationReceiver(DST_CHAIN, DST_RECEIVER);
        plugin.setDestinationCaller(DST_CHAIN, DST_CALLER);

        usdc.mint(address(this), 1_000_000e6);
    }

    function testBridgeHappyPathWithExplicitDestinationCaller() public {
        uint256 amount = 100e6;
        usdc.approve(address(plugin), amount);

        bytes32 railTxId = plugin.bridge(_bridgeParams(amount, hex"1234"));

        _assertTrue(railTxId != bytes32(0), "rail tx id is zero");
        _assertTrue(tokenMessenger.calledWithHook(), "expected hook burn");
        _assertEq(tokenMessenger.lastAmount(), amount, "amount mismatch");
        _assertEq(uint256(tokenMessenger.lastDestinationDomain()), uint256(DST_DOMAIN), "domain mismatch");
        _assertEq(tokenMessenger.lastMintRecipient(), DST_RECEIVER, "receiver mismatch");
        _assertEq(tokenMessenger.lastDestinationCaller(), DST_CALLER, "caller mismatch");
        _assertEq(keccak256(tokenMessenger.lastHookData()), keccak256(hex"1234"), "hook mismatch");
    }

    function testBridgeRevertsWhenDestinationCallerIsNotExplicitlyConfigured() public {
        CCTPRailPlugin unconfigured = new CCTPRailPlugin(
            address(tokenMessenger),
            address(usdc),
            address(this)
        );
        unconfigured.setChainDomain(DST_CHAIN, DST_DOMAIN);
        unconfigured.setDestinationReceiver(DST_CHAIN, DST_RECEIVER);

        uint256 amount = 100e6;
        usdc.approve(address(unconfigured), amount);

        (bool ok,) = address(unconfigured).call(
            abi.encodeWithSelector(unconfigured.bridge.selector, _bridgeParams(amount, hex""))
        );
        _assertTrue(!ok, "expected destination caller config revert");
    }

    function testBridgeAllowsExplicitOpenDestinationCaller() public {
        CCTPRailPlugin openRelay = new CCTPRailPlugin(
            address(tokenMessenger),
            address(usdc),
            address(this)
        );
        openRelay.setChainDomain(DST_CHAIN, DST_DOMAIN);
        openRelay.setDestinationReceiver(DST_CHAIN, DST_RECEIVER);
        openRelay.setOpenDestinationCaller(DST_CHAIN);

        uint256 amount = 100e6;
        usdc.approve(address(openRelay), amount);

        openRelay.bridge(_bridgeParams(amount, hex""));

        _assertEq(tokenMessenger.lastDestinationCaller(), bytes32(0), "expected open destination caller");
    }

    function _bridgeParams(uint256 amount, bytes memory dstCalldata)
        internal
        view
        returns (IntentTypes.BridgeParams memory)
    {
        return IntentTypes.BridgeParams({
            intentId: keccak256("intent-finalized"),
            routeTokenAddr: address(usdc),
            amount: amount,
            routeAssetId: bytes32(0),
            expectedDstRouteToken: address(0),
            expectedDstRouteAssetId: bytes32(0),
            minRouteAmount: 0,
            dstChainId: DST_CHAIN,
            railData: bytes(""),
            dstReceiver: address(0xBEEF),
            dstCalldata: dstCalldata,
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

    function _assertTrue(bool ok, string memory err) internal pure {
        require(ok, err);
    }
}
