// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {
    AxelarReceiverAdapter
} from "../../src/contracts/rails/AxelarReceiverAdapter.sol";
import {
    LayerZeroReceiverAdapter,
    OFTComposeMsgCodec
} from "../../src/contracts/rails/LayerZeroReceiverAdapter.sol";

contract MockUSDCAdapters is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract MockReceiver {
    address public lastToken;
    uint256 public lastAmount;
    bytes public lastPayload;
    uint256 public calls;

    function execute(address settlementToken, uint256 amount, bytes calldata payload) external {
        lastToken = settlementToken;
        lastAmount = amount;
        lastPayload = payload;
        calls++;
    }
}

contract InterchainTokenServiceCaller {
    function callAxelar(
        address adapter,
        bytes32 commandId,
        string calldata sourceChain,
        bytes calldata sourceAddress,
        bytes calldata data,
        bytes32 tokenId,
        address token,
        uint256 amount
    ) external returns (bytes32) {
        return AxelarReceiverAdapter(adapter).executeWithInterchainToken(
            commandId,
            sourceChain,
            sourceAddress,
            data,
            tokenId,
            token,
            amount
        );
    }
}

contract LayerZeroEndpointCaller {
    function callLzCompose(
        address adapter,
        address from,
        bytes32 guid,
        bytes calldata message
    ) external {
        LayerZeroReceiverAdapter(adapter).lzCompose(
            from,
            guid,
            message,
            address(0xEEEE),
            bytes("")
        );
    }
}

contract ReceiverAdaptersTest {
    MockUSDCAdapters private usdc;
    MockReceiver private receiver;
    InterchainTokenServiceCaller private its;
    LayerZeroEndpointCaller private endpoint;
    AxelarReceiverAdapter private axelarAdapter;
    LayerZeroReceiverAdapter private lzAdapter;

    address private constant SOURCE_RAIL = address(0x1234);
    address private constant LZ_OFT = address(0xCAFE);
    address private constant LZ_ALT_OFT = address(0xBEEF);
    bytes32 private constant AXELAR_TOKEN_ID = keccak256("AXELAR_USDC");
    uint32 private constant SRC_EID = 30101;
    bytes32 private constant AXELAR_INTENT_ID = keccak256("intent");
    bytes4 private constant AXELAR_UNEXPECTED_SETTLEMENT_TOKEN_SELECTOR =
        bytes4(keccak256("UnexpectedSettlementToken(address,address)"));
    bytes4 private constant AXELAR_UNEXPECTED_SETTLEMENT_ASSET_SELECTOR =
        bytes4(keccak256("UnexpectedSettlementAsset(bytes32,bytes32)"));
    bytes4 private constant LZ_UNEXPECTED_SETTLEMENT_TOKEN_SELECTOR =
        bytes4(keccak256("UnexpectedSettlementToken(address,address)"));
    bytes4 private constant LZ_UNSUPPORTED_SETTLEMENT_ASSET_SELECTOR =
        bytes4(keccak256("UnsupportedSettlementAsset(bytes32)"));
    bytes4 private constant LZ_UNAUTHORIZED_COMPOSE_SENDER_SELECTOR =
        bytes4(keccak256("UnauthorizedComposeSender(address,address)"));

    function setUp() public {
        usdc = new MockUSDCAdapters();
        receiver = new MockReceiver();
        its = new InterchainTokenServiceCaller();
        endpoint = new LayerZeroEndpointCaller();

        axelarAdapter = new AxelarReceiverAdapter(address(its), address(receiver), address(this));
        lzAdapter = new LayerZeroReceiverAdapter(address(endpoint), address(receiver), address(this));

        axelarAdapter.setTrustedSourceAddress("ethereum", SOURCE_RAIL, true);
        axelarAdapter.setTrustedToken(AXELAR_TOKEN_ID, address(usdc), true);
        lzAdapter.setTrustedPeerAddress(SRC_EID, SOURCE_RAIL);
        lzAdapter.setSettlementToken(_receiverSettlementAssetId(address(usdc)), address(usdc));
        lzAdapter.setExpectedComposeSender(SRC_EID, _receiverSettlementAssetId(address(usdc)), LZ_OFT);
    }

    function testAxelarAdapterForwardsToReceiver() public {
        bytes memory payload = _axelarReceiverPayload(address(usdc), _receiverSettlementAssetId(address(usdc)));
        uint256 amount = 15e6;

        usdc.mint(address(axelarAdapter), amount);
        bytes32 result = its.callAxelar(
            address(axelarAdapter),
            keccak256("cmd"),
            "ethereum",
            abi.encodePacked(SOURCE_RAIL),
            payload,
            AXELAR_TOKEN_ID,
            address(usdc),
            amount
        );

        _assertEq(result, axelarAdapter.EXECUTE_SUCCESS(), "unexpected Axelar result");
        _assertEq(usdc.balanceOf(address(receiver)), amount, "receiver token balance mismatch");
        _assertEq(receiver.lastToken(), address(usdc), "receiver settlement token mismatch");
        _assertEq(receiver.lastAmount(), amount, "receiver amount mismatch");
        _assertEq(receiver.calls(), 1, "receiver execute not called");
        _assertEq(keccak256(receiver.lastPayload()), keccak256(payload), "payload mismatch");
    }

    function testAxelarAdapterForwardsPrefixedPayloadToReceiver() public {
        bytes memory payload = _axelarReceiverPayload(address(usdc), _receiverSettlementAssetId(address(usdc)));
        bytes memory prefixedPayload = bytes.concat(bytes4(0), payload);
        uint256 amount = 9e6;

        usdc.mint(address(axelarAdapter), amount);
        bytes32 result = its.callAxelar(
            address(axelarAdapter),
            keccak256("cmd-prefixed"),
            "ethereum",
            abi.encodePacked(SOURCE_RAIL),
            prefixedPayload,
            AXELAR_TOKEN_ID,
            address(usdc),
            amount
        );

        _assertEq(result, axelarAdapter.EXECUTE_SUCCESS(), "unexpected Axelar result");
        _assertEq(usdc.balanceOf(address(receiver)), amount, "receiver token balance mismatch");
        _assertEq(receiver.lastToken(), address(usdc), "receiver settlement token mismatch");
        _assertEq(receiver.lastAmount(), amount, "receiver amount mismatch");
        _assertEq(receiver.calls(), 1, "receiver execute not called");
        _assertEq(keccak256(receiver.lastPayload()), keccak256(payload), "prefixed payload should be stripped");
    }

    function testAxelarAdapterRejectsPayloadSettlementTokenMismatch() public {
        bytes memory payload =
            _axelarReceiverPayload(address(0x9999), _receiverSettlementAssetId(address(usdc)));
        uint256 amount = 1e6;

        usdc.mint(address(axelarAdapter), amount);
        (bool ok, bytes memory data) = address(its).call(
            abi.encodeWithSelector(
                InterchainTokenServiceCaller.callAxelar.selector,
                address(axelarAdapter),
                keccak256("bad-payload-token"),
                "ethereum",
                abi.encodePacked(SOURCE_RAIL),
                payload,
                AXELAR_TOKEN_ID,
                address(usdc),
                amount
            )
        );

        _assertTrue(!ok, "expected payload token mismatch revert");
        _assertEqBytes4(_errorSelector(data), AXELAR_UNEXPECTED_SETTLEMENT_TOKEN_SELECTOR, "wrong revert selector");
    }

    function testAxelarAdapterRejectsPayloadSettlementAssetMismatch() public {
        bytes memory payload = _axelarReceiverPayload(address(usdc), keccak256("wrong-asset"));
        uint256 amount = 1e6;

        usdc.mint(address(axelarAdapter), amount);
        (bool ok, bytes memory data) = address(its).call(
            abi.encodeWithSelector(
                InterchainTokenServiceCaller.callAxelar.selector,
                address(axelarAdapter),
                keccak256("bad-payload-asset"),
                "ethereum",
                abi.encodePacked(SOURCE_RAIL),
                payload,
                AXELAR_TOKEN_ID,
                address(usdc),
                amount
            )
        );

        _assertTrue(!ok, "expected payload asset mismatch revert");
        _assertEqBytes4(_errorSelector(data), AXELAR_UNEXPECTED_SETTLEMENT_ASSET_SELECTOR, "wrong revert selector");
    }

    function testLayerZeroAdapterForwardsToReceiver() public {
        bytes memory payload = _axelarReceiverPayload(address(usdc), _receiverSettlementAssetId(address(usdc)));
        uint256 amount = 25e6;
        bytes memory message = _encodeOftComposeMessage(1, SRC_EID, amount, SOURCE_RAIL, payload);

        usdc.mint(address(lzAdapter), amount);
        endpoint.callLzCompose(address(lzAdapter), LZ_OFT, keccak256("guid"), message);

        _assertEq(usdc.balanceOf(address(receiver)), amount, "receiver token balance mismatch");
        _assertEq(receiver.lastToken(), address(usdc), "receiver settlement token mismatch");
        _assertEq(receiver.lastAmount(), amount, "receiver amount mismatch");
        _assertEq(receiver.calls(), 1, "receiver execute not called");
        _assertEq(keccak256(receiver.lastPayload()), keccak256(payload), "payload mismatch");
    }

    function testLayerZeroAdapterForwardsPayloadWithZeroPrefixedIntentId() public {
        bytes memory payload = _axelarReceiverPayload(address(usdc), _receiverSettlementAssetId(address(usdc)));
        payload = abi.encode(
            bytes32(0),
            address(0x7777),
            address(0x8888),
            uint256(42),
            address(usdc),
            _receiverSettlementAssetId(address(usdc)),
            uint256(1),
            hex"1234",
            bytes32(0)
        );
        uint256 amount = 7e6;
        bytes memory message = _encodeOftComposeMessage(2, SRC_EID, amount, SOURCE_RAIL, payload);

        usdc.mint(address(lzAdapter), amount);
        endpoint.callLzCompose(address(lzAdapter), LZ_OFT, keccak256("guid-zero-prefix"), message);

        _assertEq(usdc.balanceOf(address(receiver)), amount, "receiver token balance mismatch");
        _assertEq(receiver.lastToken(), address(usdc), "receiver settlement token mismatch");
        _assertEq(receiver.lastAmount(), amount, "receiver amount mismatch");
        _assertEq(receiver.calls(), 1, "receiver execute not called");
        _assertEq(keccak256(receiver.lastPayload()), keccak256(payload), "payload mismatch");
    }

    function testAxelarAdapterRejectsUntrustedSource() public {
        bytes memory payload = abi.encode(bytes32("bad-intent"));
        uint256 amount = 1e6;

        usdc.mint(address(axelarAdapter), amount);
        (bool ok, ) = address(its).call(
            abi.encodeWithSelector(
                InterchainTokenServiceCaller.callAxelar.selector,
                address(axelarAdapter),
                keccak256("bad-cmd"),
                "ethereum",
                abi.encodePacked(address(0x9999)),
                payload,
                AXELAR_TOKEN_ID,
                address(usdc),
                amount
            )
        );

        _assertTrue(!ok, "expected untrusted source revert");
    }

    function testAxelarAdapterRejectsUntrustedToken() public {
        bytes memory payload = abi.encode(bytes32("bad-token"));
        uint256 amount = 1e6;

        usdc.mint(address(axelarAdapter), amount);
        (bool ok, ) = address(its).call(
            abi.encodeWithSelector(
                InterchainTokenServiceCaller.callAxelar.selector,
                address(axelarAdapter),
                keccak256("bad-token-cmd"),
                "ethereum",
                abi.encodePacked(SOURCE_RAIL),
                payload,
                keccak256("UNKNOWN_TOKEN"),
                address(usdc),
                amount
            )
        );

        _assertTrue(!ok, "expected untrusted token revert");
    }

    function testLayerZeroAdapterRejectsUnknownPeer() public {
        bytes memory payload = abi.encode(bytes32("bad-lz-intent"));
        uint256 amount = 1e6;
        bytes memory message = _encodeOftComposeMessage(1, SRC_EID, amount, address(0x9999), payload);

        usdc.mint(address(lzAdapter), amount);
        (bool ok, ) = address(endpoint).call(
            abi.encodeWithSelector(
                LayerZeroEndpointCaller.callLzCompose.selector,
                address(lzAdapter),
                LZ_OFT,
                keccak256("bad-guid"),
                message
            )
        );

        _assertTrue(!ok, "expected untrusted peer revert");
    }

    function testLayerZeroAdapterRejectsWrongOft() public {
        bytes memory payload = _axelarReceiverPayload(address(usdc), _receiverSettlementAssetId(address(usdc)));
        uint256 amount = 1e6;
        bytes memory message = _encodeOftComposeMessage(1, SRC_EID, amount, SOURCE_RAIL, payload);

        usdc.mint(address(lzAdapter), amount);
        (bool ok, bytes memory data) = address(endpoint).call(
            abi.encodeWithSelector(
                LayerZeroEndpointCaller.callLzCompose.selector,
                address(lzAdapter),
                address(0xBAD),
                keccak256("bad-oft-guid"),
                message
            )
        );

        _assertTrue(!ok, "expected wrong OFT revert");
        _assertEqBytes4(_errorSelector(data), LZ_UNAUTHORIZED_COMPOSE_SENDER_SELECTOR, "wrong revert selector");
    }

    function testLayerZeroAdapterAcceptsRouteSpecificComposeSender() public {
        bytes32 settlementAssetId = _receiverSettlementAssetId(address(usdc));
        bytes memory payload = _axelarReceiverPayload(address(usdc), settlementAssetId);
        uint256 amount = 2e6;
        bytes memory message = _encodeOftComposeMessage(5, SRC_EID, amount, SOURCE_RAIL, payload);

        lzAdapter.setExpectedComposeSender(SRC_EID, settlementAssetId, LZ_ALT_OFT);

        usdc.mint(address(lzAdapter), amount);
        endpoint.callLzCompose(address(lzAdapter), LZ_ALT_OFT, keccak256("route-oft-ok"), message);

        _assertEq(usdc.balanceOf(address(receiver)), amount, "receiver token balance mismatch");
        _assertEq(receiver.lastToken(), address(usdc), "receiver settlement token mismatch");
        _assertEq(receiver.lastAmount(), amount, "receiver amount mismatch");
        _assertEq(receiver.calls(), 1, "receiver execute not called");
        _assertEq(keccak256(receiver.lastPayload()), keccak256(payload), "payload mismatch");
    }

    function testLayerZeroAdapterRejectsRouteSpecificComposeSenderMismatch() public {
        bytes32 settlementAssetId = _receiverSettlementAssetId(address(usdc));
        bytes memory payload = _axelarReceiverPayload(address(usdc), settlementAssetId);
        uint256 amount = 3e6;
        bytes memory message = _encodeOftComposeMessage(6, SRC_EID, amount, SOURCE_RAIL, payload);

        lzAdapter.setExpectedComposeSender(SRC_EID, settlementAssetId, LZ_ALT_OFT);

        usdc.mint(address(lzAdapter), amount);
        (bool ok, bytes memory data) = address(endpoint).call(
            abi.encodeWithSelector(
                LayerZeroEndpointCaller.callLzCompose.selector,
                address(lzAdapter),
                LZ_OFT,
                keccak256("route-oft-bad"),
                message
            )
        );

        _assertTrue(!ok, "expected route-specific OFT mismatch revert");
        _assertEqBytes4(_errorSelector(data), LZ_UNAUTHORIZED_COMPOSE_SENDER_SELECTOR, "wrong revert selector");
    }

    function testLayerZeroAdapterRejectsPayloadSettlementTokenMismatch() public {
        bytes memory payload =
            _axelarReceiverPayload(address(0x9999), _receiverSettlementAssetId(address(usdc)));
        uint256 amount = 1e6;
        bytes memory message = _encodeOftComposeMessage(3, SRC_EID, amount, SOURCE_RAIL, payload);

        usdc.mint(address(lzAdapter), amount);
        (bool ok, bytes memory data) = address(endpoint).call(
            abi.encodeWithSelector(
                LayerZeroEndpointCaller.callLzCompose.selector,
                address(lzAdapter),
                LZ_OFT,
                keccak256("bad-lz-token"),
                message
            )
        );

        _assertTrue(!ok, "expected LayerZero payload token mismatch revert");
        _assertEqBytes4(_errorSelector(data), LZ_UNEXPECTED_SETTLEMENT_TOKEN_SELECTOR, "wrong revert selector");
    }

    function testLayerZeroAdapterRejectsPayloadSettlementAssetMismatch() public {
        bytes memory payload = _axelarReceiverPayload(address(usdc), keccak256("wrong-lz-asset"));
        uint256 amount = 1e6;
        bytes memory message = _encodeOftComposeMessage(4, SRC_EID, amount, SOURCE_RAIL, payload);

        usdc.mint(address(lzAdapter), amount);
        (bool ok, bytes memory data) = address(endpoint).call(
            abi.encodeWithSelector(
                LayerZeroEndpointCaller.callLzCompose.selector,
                address(lzAdapter),
                LZ_OFT,
                keccak256("bad-lz-asset"),
                message
            )
        );

        _assertTrue(!ok, "expected LayerZero payload asset mismatch revert");
        _assertEqBytes4(_errorSelector(data), LZ_UNSUPPORTED_SETTLEMENT_ASSET_SELECTOR, "wrong revert selector");
    }

    function _encodeOftComposeMessage(
        uint64 nonce,
        uint32 srcEid,
        uint256 amountLD,
        address composeFrom,
        bytes memory composeMsg
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(
            nonce,
            srcEid,
            amountLD,
            OFTComposeMsgCodec.addressToBytes32(composeFrom),
            composeMsg
        );
    }

    function _axelarReceiverPayload(address expectedSettlementToken, bytes32 expectedSettlementAssetId)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(
            AXELAR_INTENT_ID,
            address(0x7777),
            address(0x8888),
            uint256(42),
            expectedSettlementToken,
            expectedSettlementAssetId,
            uint256(1),
            hex"1234",
            bytes32(0)
        );
    }

    function _receiverSettlementAssetId(address token) internal view returns (bytes32) {
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

    function _assertEq(address a, address b, string memory err) internal pure {
        require(a == b, err);
    }

    function _assertEq(bytes32 a, bytes32 b, string memory err) internal pure {
        require(a == b, err);
    }

    function _assertEqBytes4(bytes4 a, bytes4 b, string memory err) internal pure {
        require(a == b, err);
    }

    function _assertTrue(bool ok, string memory err) internal pure {
        require(ok, err);
    }
}
