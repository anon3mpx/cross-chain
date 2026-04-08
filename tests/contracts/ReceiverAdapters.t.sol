// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AxelarReceiverAdapter} from "../../src/contracts/rails/AxelarReceiverAdapter.sol";
import {LayerZeroReceiverAdapter} from "../../src/contracts/rails/LayerZeroReceiverAdapter.sol";

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

contract GatewayCaller {
    function callAxelar(
        address adapter,
        string calldata sourceChain,
        string calldata sourceAddress,
        address token,
        uint256 amount,
        bytes calldata payload
    ) external {
        AxelarReceiverAdapter(adapter).executeWithToken(
            sourceChain,
            sourceAddress,
            token,
            amount,
            payload
        );
    }
}

contract EndpointCaller {
    function callLz(
        address adapter,
        uint32 srcEid,
        bytes32 sender,
        address token,
        uint256 amount,
        bytes calldata payload
    ) external {
        LayerZeroReceiverAdapter(adapter).lzReceive(srcEid, sender, token, amount, payload);
    }
}

contract ReceiverAdaptersTest {
    MockUSDCAdapters private usdc;
    MockReceiver private receiver;
    GatewayCaller private gateway;
    EndpointCaller private endpoint;
    AxelarReceiverAdapter private axelarAdapter;
    LayerZeroReceiverAdapter private lzAdapter;

    function setUp() public {
        usdc = new MockUSDCAdapters();
        receiver = new MockReceiver();
        gateway = new GatewayCaller();
        endpoint = new EndpointCaller();

        axelarAdapter = new AxelarReceiverAdapter(address(gateway), address(receiver), address(this));
        lzAdapter = new LayerZeroReceiverAdapter(address(endpoint), address(receiver), address(this));

        axelarAdapter.setTrustedSource("ethereum", "0xSourceAxelar", true);
        lzAdapter.setTrustedPeer(30101, bytes32(uint256(uint160(address(0x1234)))));
    }

    function testAxelarAdapterForwardsToReceiver() public {
        bytes memory payload = abi.encode(bytes32("intent"), uint256(42));
        uint256 amount = 15e6;

        usdc.mint(address(axelarAdapter), amount);
        gateway.callAxelar(
            address(axelarAdapter),
            "ethereum",
            "0xSourceAxelar",
            address(usdc),
            amount,
            payload
        );

        _assertEq(usdc.balanceOf(address(receiver)), amount, "receiver token balance mismatch");
        _assertEq(receiver.lastToken(), address(usdc), "receiver settlement token mismatch");
        _assertEq(receiver.lastAmount(), amount, "receiver amount mismatch");
        _assertEq(receiver.calls(), 1, "receiver execute not called");
        _assertEq(keccak256(receiver.lastPayload()), keccak256(payload), "payload mismatch");
    }

    function testLayerZeroAdapterForwardsToReceiver() public {
        bytes memory payload = abi.encode(bytes32("intent-lz"), uint256(99));
        uint256 amount = 25e6;

        usdc.mint(address(lzAdapter), amount);
        endpoint.callLz(
            address(lzAdapter),
            30101,
            bytes32(uint256(uint160(address(0x1234)))),
            address(usdc),
            amount,
            payload
        );

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
        (bool ok, ) = address(gateway).call(
            abi.encodeWithSelector(
                GatewayCaller.callAxelar.selector,
                address(axelarAdapter),
                "ethereum",
                "0xWrongSource",
                address(usdc),
                amount,
                payload
            )
        );

        _assertTrue(!ok, "expected untrusted source revert");
    }

    function testLayerZeroAdapterRejectsUnknownPeer() public {
        bytes memory payload = abi.encode(bytes32("bad-lz-intent"));
        uint256 amount = 1e6;

        usdc.mint(address(lzAdapter), amount);
        (bool ok, ) = address(endpoint).call(
            abi.encodeWithSelector(
                EndpointCaller.callLz.selector,
                address(lzAdapter),
                uint32(30101),
                bytes32(uint256(uint160(address(0x9999)))),
                address(usdc),
                amount,
                payload
            )
        );

        _assertTrue(!ok, "expected untrusted peer revert");
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
