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
    bytes32 private constant AXELAR_TOKEN_ID = keccak256("AXELAR_USDC");
    uint32 private constant SRC_EID = 30101;

    function setUp() public {
        usdc = new MockUSDCAdapters();
        receiver = new MockReceiver();
        its = new InterchainTokenServiceCaller();
        endpoint = new LayerZeroEndpointCaller();

        axelarAdapter = new AxelarReceiverAdapter(address(its), address(receiver), address(this));
        lzAdapter = new LayerZeroReceiverAdapter(
            address(endpoint),
            LZ_OFT,
            address(usdc),
            address(receiver),
            address(this)
        );

        axelarAdapter.setTrustedSourceAddress("ethereum", SOURCE_RAIL, true);
        axelarAdapter.setTrustedToken(AXELAR_TOKEN_ID, address(usdc), true);
        lzAdapter.setTrustedPeerAddress(SRC_EID, SOURCE_RAIL);
    }

    function testAxelarAdapterForwardsToReceiver() public {
        bytes memory payload = abi.encode(bytes32("intent"), uint256(42));
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

    function testLayerZeroAdapterForwardsToReceiver() public {
        bytes memory payload = abi.encode(bytes32("intent-lz"), uint256(99));
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
        bytes memory payload = abi.encode(bytes32("bad-oft"));
        uint256 amount = 1e6;
        bytes memory message = _encodeOftComposeMessage(1, SRC_EID, amount, SOURCE_RAIL, payload);

        usdc.mint(address(lzAdapter), amount);
        (bool ok, ) = address(endpoint).call(
            abi.encodeWithSelector(
                LayerZeroEndpointCaller.callLzCompose.selector,
                address(lzAdapter),
                address(0xBAD),
                keccak256("bad-oft-guid"),
                message
            )
        );

        _assertTrue(!ok, "expected wrong OFT revert");
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

    function _assertEq(uint256 a, uint256 b, string memory err) internal pure {
        require(a == b, err);
    }

    function _assertEq(address a, address b, string memory err) internal pure {
        require(a == b, err);
    }

    function _assertEq(bytes32 a, bytes32 b, string memory err) internal pure {
        require(a == b, err);
    }

    function _assertTrue(bool ok, string memory err) internal pure {
        require(ok, err);
    }
}
