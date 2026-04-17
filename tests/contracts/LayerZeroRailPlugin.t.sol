// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {
    LayerZeroRailPlugin,
    ILayerZeroOFT,
    SendParam,
    MessagingFee,
    MessagingReceipt,
    OFTReceipt
} from "../../src/contracts/rails/LayerZeroRailPlugin.sol";
import {IntentTypes} from "../../src/contracts/interfaces/IIntentTypes.sol";

contract MockUSDCLayerZero is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract MockLayerZeroOFT is ILayerZeroOFT {
    MockUSDCLayerZero public immutable usdc;
    uint256 public nativeFee;

    uint32 public lastDstEid;
    bytes32 public lastTo;
    uint256 public lastAmount;
    bytes32 public lastComposeHash;
    bytes32 public lastOptionsHash;
    uint256 public lastPaidNativeFee;
    bool public sendCalled;

    constructor(address _usdc, uint256 _nativeFee) {
        usdc = MockUSDCLayerZero(_usdc);
        nativeFee = _nativeFee;
    }

    function quoteSend(
        SendParam calldata,
        bool
    ) external view returns (MessagingFee memory fee) {
        fee = MessagingFee({ nativeFee: nativeFee, lzTokenFee: 0 });
    }

    function send(
        SendParam calldata _sendParam,
        MessagingFee calldata _fee,
        address payable
    ) external payable returns (MessagingReceipt memory receipt, OFTReceipt memory oftReceipt) {
        require(msg.value == _fee.nativeFee, "native fee mismatch");

        lastDstEid = _sendParam.dstEid;
        lastTo = _sendParam.to;
        lastAmount = _sendParam.amountLD;
        lastComposeHash = keccak256(_sendParam.composeMsg);
        lastOptionsHash = keccak256(_sendParam.extraOptions);
        lastPaidNativeFee = msg.value;
        sendCalled = true;

        usdc.transferFrom(msg.sender, address(this), _sendParam.amountLD);
        receipt = MessagingReceipt({
            guid: keccak256(abi.encodePacked(_sendParam.dstEid, _sendParam.to, _sendParam.amountLD)),
            nonce: 1,
            fee: _fee
        });
        oftReceipt = OFTReceipt({
            amountSentLD: _sendParam.amountLD,
            amountReceivedLD: _sendParam.amountLD
        });
    }
}

contract LayerZeroRailPluginTest {
    MockUSDCLayerZero private usdc;
    MockLayerZeroOFT private oft;
    LayerZeroRailPlugin private plugin;

    uint32 private constant DST_CHAIN = 10;
    uint32 private constant DST_EID = 30111;
    uint256 private constant LZ_NATIVE_FEE = 0.005 ether;

    function setUp() public {
        usdc = new MockUSDCLayerZero();
        oft = new MockLayerZeroOFT(address(usdc), LZ_NATIVE_FEE);
        plugin = new LayerZeroRailPlugin(address(usdc), address(0x9999), address(oft), address(this));

        plugin.setRouteConfig(DST_CHAIN, DST_EID, address(0xBEEF), hex"01020304");
        usdc.mint(address(this), 1_000_000e6);
    }

    function testBridgeHappyPath() public {
        uint256 amount = 250e6;
        usdc.approve(address(plugin), amount);

        IntentTypes.BridgeParams memory params = IntentTypes.BridgeParams({
            intentId: keccak256("intent-lz"),
            settlementTokenAddr: address(usdc),
            amount: amount,
            dstChainId: DST_CHAIN,
            railData: bytes(""),
            dstReceiver: address(0xBEEF),
            dstCalldata: hex"abcd",
            gasForDst: 200_000,
            finalRecipient: address(0xCAFE),
            nativeDstAddress: bytes(""),
            thorAssetIdentifier: "",
            minThorOutput: 0
        });

        bytes32 railTxId = plugin.bridge{value: LZ_NATIVE_FEE + 1 wei}(params);

        _assertTrue(railTxId != bytes32(0), "rail tx id is zero");
        _assertTrue(oft.sendCalled(), "send not called");
        _assertEq(oft.lastDstEid(), DST_EID, "dst eid mismatch");
        _assertEq(oft.lastTo(), bytes32(uint256(uint160(address(0xBEEF)))), "receiver bytes32 mismatch");
        _assertEq(oft.lastAmount(), amount, "amount mismatch");
        _assertEq(oft.lastComposeHash(), keccak256(hex"abcd"), "compose payload mismatch");
        _assertEq(oft.lastPaidNativeFee(), LZ_NATIVE_FEE, "native fee mismatch");
        _assertEq(keccak256(hex"01020304"), oft.lastOptionsHash(), "options mismatch");
        _assertEq(usdc.balanceOf(address(oft)), amount, "OFT did not receive funds");
    }

    function testBridgeRevertsWhenRouteMissing() public {
        IntentTypes.BridgeParams memory params = IntentTypes.BridgeParams({
            intentId: keccak256("intent-lz-2"),
            settlementTokenAddr: address(usdc),
            amount: 1e6,
            dstChainId: 55555,
            railData: bytes(""),
            dstReceiver: address(0xBEEF),
            dstCalldata: hex"",
            gasForDst: 200_000,
            finalRecipient: address(0xCAFE),
            nativeDstAddress: bytes(""),
            thorAssetIdentifier: "",
            minThorOutput: 0
        });

        (bool ok, ) = address(plugin).call{value: LZ_NATIVE_FEE}(
            abi.encodeWithSelector(plugin.bridge.selector, params)
        );
        _assertTrue(!ok, "expected unsupported route revert");
    }

    receive() external payable {}

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
