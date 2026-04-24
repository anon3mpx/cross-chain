// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {PluginRegistry} from "../../src/contracts/PluginRegistry.sol";
import {RouterV1} from "../../src/contracts/RouterV1.sol";
import {IRailPlugin} from "../../src/contracts/interfaces/IRailPlugin.sol";
import {IntentTypes} from "../../src/contracts/interfaces/IIntentTypes.sol";

interface Vm {
    function addr(uint256 privateKey) external returns (address);
    function prank(address sender) external;
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
}

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}

    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract MockRailPlugin is ERC165, IRailPlugin {
    IERC20 public immutable settlementToken;
    bytes32 public lastIntentId;
    uint256 public lastAmount;
    bytes32 public lastSettlementAssetId;
    address public lastExpectedDstSettlementToken;
    bytes32 public lastExpectedDstSettlementAssetId;
    uint256 public lastMinSettlementAmount;
    bytes public lastDstCalldata;

    constructor(address settlementToken_) {
        settlementToken = IERC20(settlementToken_);
    }

    function railId() external pure returns (bytes32) {
        return keccak256("MOCK_RAIL");
    }

    function supportsRoute(uint32, uint32) external pure returns (bool) {
        return true;
    }

    function settlementTokenAddress(uint8) external view returns (address) {
        return address(settlementToken);
    }

    function supportsSettlementToken(uint8 settlementTokenType) external pure returns (bool) {
        return settlementTokenType == uint8(IntentTypes.SettlementToken.USDC);
    }

    function estimateFee(uint32, uint256, uint8) external pure returns (uint256 fee, uint256 eta) {
        return (0, 60);
    }

    function bridge(IntentTypes.BridgeParams calldata params) external payable returns (bytes32 railTxId) {
        settlementToken.transferFrom(msg.sender, address(this), params.amount);
        lastIntentId = params.intentId;
        lastAmount = params.amount;
        lastSettlementAssetId = params.settlementAssetId;
        lastExpectedDstSettlementToken = params.expectedDstSettlementToken;
        lastExpectedDstSettlementAssetId = params.expectedDstSettlementAssetId;
        lastMinSettlementAmount = params.minSettlementAmount;
        lastDstCalldata = params.dstCalldata;
        return keccak256(abi.encodePacked(params.intentId, params.amount));
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC165, IRailPlugin) returns (bool) {
        return interfaceId == type(IRailPlugin).interfaceId || super.supportsInterface(interfaceId);
    }
}

contract RouterV1Test {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant INTENT_SIGNER_PK = 0xA11CE;
    address private constant USER = address(0xBEEF);
    bytes32 private constant MOCK_RAIL_ID = keccak256("MOCK_RAIL");

    MockUSDC private usdc;
    MockRailPlugin private railPlugin;
    PluginRegistry private registry;
    RouterV1 private router;

    function setUp() public {
        usdc = new MockUSDC();
        railPlugin = new MockRailPlugin(address(usdc));
        registry = new PluginRegistry(address(this));
        router = new RouterV1(
            address(registry),
            address(0xFEE),
            address(0x4444),
            vm.addr(INTENT_SIGNER_PK),
            address(this)
        );

        registry.registerRailPlugin(address(railPlugin));
        usdc.mint(USER, 500e6);
    }

    function testInitiateSwapAcceptsValidSignature() public {
        IntentTypes.SwapIntent memory intent = _buildIntent();
        bytes memory signature = _signIntent(intent);

        vm.prank(USER);
        usdc.approve(address(router), intent.amountIn);

        vm.prank(USER);
        router.initiateSwap(intent, signature);

        _assertEq(railPlugin.lastIntentId(), intent.intentId, "intent id mismatch");
        _assertEq(railPlugin.lastAmount(), intent.amountIn - intent.feeAmount, "bridged amount mismatch");
        _assertEq(railPlugin.lastSettlementAssetId(), intent.settlementAssetId, "settlement asset id mismatch");
        _assertEq(
            railPlugin.lastExpectedDstSettlementToken(),
            intent.expectedDstSettlementToken,
            "expected dst settlement token mismatch"
        );
        _assertEq(
            railPlugin.lastExpectedDstSettlementAssetId(),
            intent.expectedDstSettlementAssetId,
            "expected dst settlement asset id mismatch"
        );
        _assertEq(
            railPlugin.lastMinSettlementAmount(),
            intent.minSettlementAmount,
            "min settlement amount mismatch"
        );

        (
            bytes32 payloadIntentId,
            address payloadUser,
            address payloadTokenOut,
            uint256 payloadMinAmountOut,
            address payloadExpectedDstSettlementToken,
            bytes32 payloadExpectedDstSettlementAssetId,
            uint256 payloadMinSettlementAmount,
            bytes memory payloadSwapData,
            bytes32 payloadSwapPluginId
        ) = abi.decode(
            railPlugin.lastDstCalldata(),
            (bytes32, address, address, uint256, address, bytes32, uint256, bytes, bytes32)
        );

        _assertEq(payloadIntentId, intent.intentId, "payload intent id mismatch");
        _assertEq(payloadUser, intent.user, "payload user mismatch");
        _assertEq(payloadTokenOut, intent.tokenOut, "payload token out mismatch");
        _assertEq(payloadMinAmountOut, intent.minAmountOut, "payload min amount out mismatch");
        _assertEq(
            payloadExpectedDstSettlementToken,
            intent.expectedDstSettlementToken,
            "payload expected settlement token mismatch"
        );
        _assertEq(
            payloadExpectedDstSettlementAssetId,
            intent.expectedDstSettlementAssetId,
            "payload expected settlement asset id mismatch"
        );
        _assertEq(
            payloadMinSettlementAmount,
            intent.minSettlementAmount,
            "payload min settlement amount mismatch"
        );
        _assertEq(payloadSwapData, intent.swapDataDst, "payload swap data mismatch");
        _assertEq(payloadSwapPluginId, intent.dstSwapPluginId, "payload swap plugin mismatch");
        _assertTrue(router.executedIntents(intent.intentId), "intent not marked executed");
    }

    function testInitiateSwapRejectsTamperedRailPluginId() public {
        IntentTypes.SwapIntent memory signedIntent = _buildIntent();
        bytes memory signature = _signIntent(signedIntent);

        IntentTypes.SwapIntent memory tamperedIntent = signedIntent;
        tamperedIntent.railPluginId = keccak256("TAMPERED_RAIL");

        vm.prank(USER);
        usdc.approve(address(router), tamperedIntent.amountIn);

        vm.prank(USER);
        (bool ok,) = address(router).call(
            abi.encodeWithSelector(router.initiateSwap.selector, tamperedIntent, signature)
        );

        _assertTrue(!ok, "expected invalid signature revert");
        _assertTrue(!router.executedIntents(tamperedIntent.intentId), "tampered intent should not execute");
    }

    function _buildIntent() internal view returns (IntentTypes.SwapIntent memory intent) {
        intent.user = USER;
        intent.tokenIn = address(usdc);
        intent.tokenOut = address(0x2002);
        intent.amountIn = 100e6;
        intent.minAmountOut = 99e6;
        intent.minSrcSwapOut = 0;
        intent.dstChainId = 84532;
        intent.rail = uint8(IntentTypes.Rail.CCTP);
        intent.settlementToken = uint8(IntentTypes.SettlementToken.USDC);
        intent.feeAmount = 1e6;
        intent.settlementAssetId = keccak256("USDC.BASE");
        intent.expectedDstSettlementToken = address(usdc);
        intent.expectedDstSettlementAssetId = keccak256("USDC.ARB");
        intent.minSettlementAmount = 99e6;
        intent.swapDataSrc = bytes("");
        intent.swapDataDst = bytes("");
        intent.swapPluginIdSrc = bytes32(0);
        intent.dstSwapPluginId = bytes32(0);
        intent.railPluginId = MOCK_RAIL_ID;
        intent.railData = bytes("");
        intent.dstReceiver = address(0x3003);
        intent.nativeDstAddress = bytes("");
        intent.thorAssetIdentifier = "";
        intent.minThorOutput = 0;
        intent.intentId = keccak256("router-intent-1");
        intent.deadline = block.timestamp + 10 minutes;
    }

    function _signIntent(IntentTypes.SwapIntent memory intent) internal returns (bytes memory) {
        bytes32 digest = router.hashIntent(intent);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(INTENT_SIGNER_PK, digest);
        return abi.encodePacked(r, s, v);
    }

    function _assertEq(uint256 a, uint256 b, string memory err) internal pure {
        require(a == b, err);
    }

    function _assertEq(bytes32 a, bytes32 b, string memory err) internal pure {
        require(a == b, err);
    }

    function _assertEq(address a, address b, string memory err) internal pure {
        require(a == b, err);
    }

    function _assertEq(bytes memory a, bytes memory b, string memory err) internal pure {
        require(keccak256(a) == keccak256(b), err);
    }

    function _assertTrue(bool ok, string memory err) internal pure {
        require(ok, err);
    }
}
