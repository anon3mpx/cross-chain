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

contract MockLayerZeroToken is ERC20 {
    uint8 public immutable tokenDecimals;

    constructor(string memory name_, string memory symbol_, uint8 _tokenDecimals) ERC20(name_, symbol_) {
        tokenDecimals = _tokenDecimals;
    }

    function decimals() public view override returns (uint8) { return tokenDecimals; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract MockLayerZeroOFT is ILayerZeroOFT {
    MockLayerZeroToken public immutable token;
    uint256 public nativeFee;

    uint32 public lastDstEid;
    bytes32 public lastTo;
    uint256 public lastAmount;
    bytes32 public lastComposeHash;
    bytes32 public lastOptionsHash;
    uint256 public lastPaidNativeFee;
    bool public sendCalled;

    constructor(address _token, uint256 _nativeFee) {
        token = MockLayerZeroToken(_token);
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

        token.transferFrom(msg.sender, address(this), _sendParam.amountLD);
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
    MockLayerZeroToken private usdc;
    MockLayerZeroToken private weth;
    MockLayerZeroOFT private oft;
    MockLayerZeroOFT private wethOft;
    LayerZeroRailPlugin private plugin;

    uint32 private constant DST_CHAIN = 10;
    uint32 private constant DST_EID = 30111;
    uint256 private constant LZ_NATIVE_FEE = 0.005 ether;
    bytes32 private constant LEGACY_SETTLEMENT_ASSET_ID = bytes32(0);
    bytes4 private constant UNSUPPORTED_ROUTE_SELECTOR =
        bytes4(keccak256("UnsupportedRoute(uint32)"));

    function setUp() public {
        usdc = new MockLayerZeroToken("Mock USDC", "mUSDC", 6);
        weth = new MockLayerZeroToken("Mock WETH", "mWETH", 18);
        oft = new MockLayerZeroOFT(address(usdc), LZ_NATIVE_FEE);
        wethOft = new MockLayerZeroOFT(address(weth), LZ_NATIVE_FEE);
        plugin = new LayerZeroRailPlugin(address(usdc), address(0x9999), address(oft), address(this));

        plugin.setRouteConfig(DST_CHAIN, DST_EID, address(0xBEEF), hex"01020304");
        usdc.mint(address(this), 1_000_000e6);
        weth.mint(address(this), 1_000_000e18);
    }

    function testBridgeHappyPath() public {
        uint256 amount = 250e6;
        bytes memory payload = _receiverPayload(
            address(usdc),
            _settlementAssetId(address(usdc)),
            keccak256("intent-lz")
        );
        usdc.approve(address(plugin), amount);

        IntentTypes.BridgeParams memory params =
            _bridgeParams(
                address(usdc),
                amount,
                LEGACY_SETTLEMENT_ASSET_ID,
                keccak256("intent-lz"),
                payload
            );

        bytes32 railTxId = plugin.bridge{value: LZ_NATIVE_FEE + 1 wei}(params);

        _assertTrue(railTxId != bytes32(0), "rail tx id is zero");
        _assertTrue(oft.sendCalled(), "send not called");
        _assertEq(oft.lastDstEid(), DST_EID, "dst eid mismatch");
        _assertEq(oft.lastTo(), bytes32(uint256(uint160(address(0xBEEF)))), "receiver bytes32 mismatch");
        _assertEq(oft.lastAmount(), amount, "amount mismatch");
        _assertEq(oft.lastComposeHash(), keccak256(payload), "compose payload mismatch");
        _assertEq(oft.lastPaidNativeFee(), LZ_NATIVE_FEE, "native fee mismatch");
        _assertEq(keccak256(hex"01020304"), oft.lastOptionsHash(), "options mismatch");
        _assertEq(usdc.balanceOf(address(oft)), amount, "OFT did not receive funds");
    }

    function testBridgeUsesDynamicOftRouteConfig() public {
        uint256 amount = 2e18;
        bytes32 settlementAssetId = _settlementAssetId(address(weth));
        bytes memory payload = _receiverPayload(
            address(weth),
            settlementAssetId,
            keccak256("intent-lz-weth")
        );

        plugin.setSettlementTokenAddress(uint8(IntentTypes.SettlementToken.ETH), address(weth));
        plugin.setRouteConfig(
            DST_CHAIN,
            settlementAssetId,
            DST_EID,
            address(0xBEEF),
            hex"05060708",
            address(wethOft),
            address(weth)
        );
        weth.approve(address(plugin), amount);

        IntentTypes.BridgeParams memory params =
            _bridgeParams(
                address(weth),
                amount,
                settlementAssetId,
                keccak256("intent-lz-weth"),
                payload
            );

        bytes32 railTxId = plugin.bridge{value: LZ_NATIVE_FEE}(params);

        _assertTrue(railTxId != bytes32(0), "rail tx id is zero");
        _assertTrue(wethOft.sendCalled(), "dynamic oft send not called");
        _assertEq(wethOft.lastDstEid(), DST_EID, "dynamic dst eid mismatch");
        _assertEq(wethOft.lastAmount(), amount, "dynamic amount mismatch");
        _assertEq(wethOft.lastComposeHash(), keccak256(payload), "dynamic compose payload mismatch");
        _assertEq(wethOft.lastPaidNativeFee(), LZ_NATIVE_FEE, "dynamic native fee mismatch");
        _assertEq(keccak256(hex"05060708"), wethOft.lastOptionsHash(), "dynamic options mismatch");
        _assertEq(weth.balanceOf(address(wethOft)), amount, "dynamic oft did not receive funds");
    }

    function testBridgeRevertsWhenRouteMissing() public {
        IntentTypes.BridgeParams memory params =
            _bridgeParams(
                address(usdc),
                1e6,
                LEGACY_SETTLEMENT_ASSET_ID,
                keccak256("intent-lz-2"),
                hex""
            );
        params.dstChainId = 55555;
        params.dstCalldata = hex"";

        (bool ok, ) = address(plugin).call{value: LZ_NATIVE_FEE}(
            abi.encodeWithSelector(plugin.bridge.selector, params)
        );
        _assertTrue(!ok, "expected unsupported route revert");
    }

    function testEstimateFeeRevertsWhenRouteMissingForRequestedSettlementToken() public {
        plugin.setSettlementTokenAddress(uint8(IntentTypes.SettlementToken.ETH), address(weth));

        (bool ok, bytes memory data) = address(plugin).call(
            abi.encodeWithSelector(
                plugin.estimateFee.selector,
                DST_CHAIN,
                uint256(1e18),
                uint8(IntentTypes.SettlementToken.ETH)
            )
        );

        _assertTrue(!ok, "expected estimate fee to revert");
        _assertEqBytes4(_errorSelector(data), UNSUPPORTED_ROUTE_SELECTOR, "wrong revert selector");
    }

    receive() external payable {}

    function _bridgeParams(
        address settlementToken,
        uint256 amount,
        bytes32 settlementAssetId,
        bytes32 intentId,
        bytes memory dstCalldata
    ) internal pure returns (IntentTypes.BridgeParams memory) {
        return IntentTypes.BridgeParams({
            intentId: intentId,
            settlementTokenAddr: settlementToken,
            amount: amount,
            settlementAssetId: settlementAssetId,
            expectedDstSettlementToken: address(0),
            expectedDstSettlementAssetId: bytes32(0),
            minSettlementAmount: 0,
            dstChainId: DST_CHAIN,
            railData: bytes(""),
            dstReceiver: address(0xBEEF),
            dstCalldata: dstCalldata,
            gasForDst: 200_000,
            finalRecipient: address(0xCAFE),
            nativeDstAddress: bytes(""),
            thorAssetIdentifier: "",
            minThorOutput: 0
        });
    }

    function _receiverPayload(
        address expectedSettlementToken,
        bytes32 expectedSettlementAssetId,
        bytes32 intentId
    ) internal pure returns (bytes memory) {
        return abi.encode(
            intentId,
            address(0x1111),
            address(0x2222),
            uint256(42),
            expectedSettlementToken,
            expectedSettlementAssetId,
            uint256(1),
            hex"1234",
            bytes32(0)
        );
    }

    function _settlementAssetId(address token) internal view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, token));
    }

    function _assertEq(uint256 a, uint256 b, string memory err) internal pure {
        require(a == b, err);
    }

    function _assertEq(bytes32 a, bytes32 b, string memory err) internal pure {
        require(a == b, err);
    }

    function _assertEqBytes4(bytes4 a, bytes4 b, string memory err) internal pure {
        require(a == b, err);
    }

    function _errorSelector(bytes memory data) internal pure returns (bytes4 selector) {
        require(data.length >= 4, "missing selector");
        assembly {
            selector := mload(add(data, 32))
        }
    }

    function _assertTrue(bool ok, string memory err) internal pure {
        require(ok, err);
    }
}
