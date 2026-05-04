// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {PluginRegistry} from "../../src/contracts/PluginRegistry.sol";
import {ReceiverV1} from "../../src/contracts/ReceiverV1.sol";

interface Vm {
    function prank(address sender) external;
}

contract MockSettlementToken is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract ReceiverV1Test {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant APPROVED_CALLER = address(0x1234);
    address private constant USER = address(0xBEEF);
    bytes4 private constant UNEXPECTED_SETTLEMENT_TOKEN_SELECTOR =
        bytes4(keccak256("UnexpectedSettlementToken(address,address)"));

    MockSettlementToken private usdc;
    MockSettlementToken private wrongToken;
    PluginRegistry private registry;
    ReceiverV1 private receiver;

    function setUp() public {
        usdc = new MockSettlementToken("Mock USDC", "mUSDC");
        wrongToken = new MockSettlementToken("Wrong Token", "WRONG");
        registry = new PluginRegistry(address(this));
        receiver = new ReceiverV1(address(registry), address(this));
        receiver.addApprovedCaller(APPROVED_CALLER);
    }

    function testExecuteRevertsOnUnexpectedSettlementToken() public {
        bytes32 intentId = keccak256("receiver-intent-unexpected-token");
        bytes32 expectedAssetId = _assetId(address(usdc));
        bytes memory payload = abi.encode(
            intentId,
            USER,
            address(usdc),
            uint256(90e6),
            address(usdc),
            expectedAssetId,
            uint256(90e6),
            bytes(""),
            bytes32(0)
        );

        vm.prank(APPROVED_CALLER);
        (bool ok, bytes memory data) = address(receiver).call(
            abi.encodeWithSelector(receiver.execute.selector, address(wrongToken), 100e6, payload)
        );

        _assertTrue(!ok, "expected unexpected settlement token revert");
        _assertEq(_errorSelector(data), UNEXPECTED_SETTLEMENT_TOKEN_SELECTOR, "wrong revert selector");
        _assertTrue(!receiver.settledIntents(intentId), "intent should remain unsettled");
    }

    function testExecuteDirectDeliveryHappyPath() public {
        bytes32 intentId = keccak256("receiver-intent-direct-delivery");
        bytes32 expectedAssetId = _assetId(address(usdc));
        usdc.mint(address(receiver), 100e6);

        bytes memory payload = abi.encode(
            intentId,
            USER,
            address(usdc),
            uint256(90e6),
            address(usdc),
            expectedAssetId,
            uint256(90e6),
            bytes(""),
            bytes32(0)
        );

        vm.prank(APPROVED_CALLER);
        receiver.execute(address(usdc), 100e6, payload);

        _assertTrue(receiver.settledIntents(intentId), "intent should settle");
        _assertEq(usdc.balanceOf(USER), 100e6, "user balance mismatch");
        _assertEq(usdc.balanceOf(address(receiver)), 0, "receiver should transfer funds out");
    }

    function testExecuteRevertsOnUnexpectedSettlementAsset() public {
        bytes32 intentId = keccak256("receiver-intent-unexpected-asset");
        bytes memory payload = abi.encode(
            intentId,
            USER,
            address(usdc),
            uint256(90e6),
            address(usdc),
            bytes32("WRONG.ASSET"),
            uint256(90e6),
            bytes(""),
            bytes32(0)
        );

        usdc.mint(address(receiver), 100e6);
        vm.prank(APPROVED_CALLER);
        (bool ok, bytes memory data) = address(receiver).call(
            abi.encodeWithSelector(receiver.execute.selector, address(usdc), 100e6, payload)
        );

        _assertTrue(!ok, "expected unexpected settlement asset revert");
        _assertEq(_errorSelector(data), bytes4(keccak256("UnexpectedSettlementAsset(bytes32,bytes32)")), "wrong revert selector");
        _assertTrue(!receiver.settledIntents(intentId), "intent should remain unsettled");
    }

    function testExecuteRevertsOnSettlementOutputTooLow() public {
        bytes32 intentId = keccak256("receiver-intent-settlement-low");
        bytes32 expectedAssetId = _assetId(address(usdc));
        bytes memory payload = abi.encode(
            intentId,
            USER,
            address(usdc),
            uint256(90e6),
            address(usdc),
            expectedAssetId,
            uint256(101e6),
            bytes(""),
            bytes32(0)
        );

        usdc.mint(address(receiver), 100e6);
        vm.prank(APPROVED_CALLER);
        (bool ok, bytes memory data) = address(receiver).call(
            abi.encodeWithSelector(receiver.execute.selector, address(usdc), 100e6, payload)
        );

        _assertTrue(!ok, "expected settlement output too low revert");
        _assertEq(_errorSelector(data), bytes4(keccak256("SettlementOutputTooLow(bytes32,uint256,uint256)")), "wrong revert selector");
        _assertTrue(!receiver.settledIntents(intentId), "intent should remain unsettled");
    }

    function _assetId(address token) internal view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, token));
    }

    function _errorSelector(bytes memory data) internal pure returns (bytes4 selector) {
        require(data.length >= 4, "missing selector");
        assembly {
            selector := mload(add(data, 32))
        }
    }

    function _assertEq(uint256 a, uint256 b, string memory err) internal pure {
        require(a == b, err);
    }

    function _assertEq(bytes4 a, bytes4 b, string memory err) internal pure {
        require(a == b, err);
    }

    function _assertTrue(bool ok, string memory err) internal pure {
        require(ok, err);
    }
}
