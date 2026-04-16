// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title LayerZeroReceiverAdapter
/// @notice Destination-side LayerZero OFT composer that validates compose
///         metadata and forwards settlement + payload into ReceiverV1.execute().
contract LayerZeroReceiverAdapter is Ownable2Step {
    using SafeERC20 for IERC20;

    address public immutable endpoint;
    address public immutable oft;
    address public immutable settlementToken;
    address public immutable receiver;

    // srcEid => trusted source composeFrom address bytes32.
    mapping(uint32 => bytes32) public trustedPeers;

    event TrustedPeerSet(uint32 indexed srcEid, bytes32 indexed peer);
    event LayerZeroMessageForwarded(
        uint32 indexed srcEid,
        bytes32 indexed composeFrom,
        bytes32 indexed guid,
        address token,
        uint256 amount
    );

    error UnauthorizedEndpoint(address caller);
    error UnauthorizedComposeSender(address from, address expected);
    error UntrustedPeer(uint32 srcEid, bytes32 composeFrom, bytes32 expected);
    error MalformedComposeMessage(uint256 length);
    error ZeroAddress(string field);

    constructor(
        address _endpoint,
        address _oft,
        address _settlementToken,
        address _receiver,
        address _owner
    ) Ownable(_owner) {
        if (_endpoint == address(0)) revert ZeroAddress("endpoint");
        if (_oft == address(0)) revert ZeroAddress("oft");
        if (_settlementToken == address(0)) revert ZeroAddress("settlementToken");
        if (_receiver == address(0)) revert ZeroAddress("receiver");
        endpoint = _endpoint;
        oft = _oft;
        settlementToken = _settlementToken;
        receiver = _receiver;
    }

    /// @notice Official LayerZero composer callback used by OFT/Stargate compose.
    /// @dev The OFT sends settlement tokens to this adapter before the endpoint calls lzCompose.
    function lzCompose(
        address _from,
        bytes32 _guid,
        bytes calldata _message,
        address _executor,
        bytes calldata _extraData
    ) external payable {
        _executor;
        _extraData;

        if (msg.sender != endpoint) revert UnauthorizedEndpoint(msg.sender);
        if (_from != oft) revert UnauthorizedComposeSender(_from, oft);
        if (_message.length < OFTComposeMsgCodec.COMPOSE_MSG_OFFSET) {
            revert MalformedComposeMessage(_message.length);
        }

        uint32 srcEid = OFTComposeMsgCodec.srcEid(_message);
        bytes32 composeFrom = OFTComposeMsgCodec.composeFrom(_message);
        bytes32 expected = trustedPeers[srcEid];
        if (expected == bytes32(0) || expected != composeFrom) {
            revert UntrustedPeer(srcEid, composeFrom, expected);
        }

        uint256 amount = OFTComposeMsgCodec.amountLD(_message);
        bytes memory payload = OFTComposeMsgCodec.composeMsg(_message);

        IERC20(settlementToken).safeTransfer(receiver, amount);
        IReceiverExecutorLZ(receiver).execute(settlementToken, amount, payload);

        emit LayerZeroMessageForwarded(srcEid, composeFrom, _guid, settlementToken, amount);
    }

    function setTrustedPeer(uint32 srcEid, bytes32 peer) external onlyOwner {
        trustedPeers[srcEid] = peer;
        emit TrustedPeerSet(srcEid, peer);
    }

    function setTrustedPeerAddress(uint32 srcEid, address peer) external onlyOwner {
        bytes32 peerBytes32 = OFTComposeMsgCodec.addressToBytes32(peer);
        trustedPeers[srcEid] = peerBytes32;
        emit TrustedPeerSet(srcEid, peerBytes32);
    }

    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}

library OFTComposeMsgCodec {
    uint256 internal constant NONCE_OFFSET = 8;
    uint256 internal constant SRC_EID_OFFSET = 12;
    uint256 internal constant AMOUNT_LD_OFFSET = 44;
    uint256 internal constant COMPOSE_MSG_OFFSET = 76;

    function srcEid(bytes calldata message) internal pure returns (uint32) {
        return uint32(bytes4(message[NONCE_OFFSET:SRC_EID_OFFSET]));
    }

    function amountLD(bytes calldata message) internal pure returns (uint256) {
        return uint256(bytes32(message[SRC_EID_OFFSET:AMOUNT_LD_OFFSET]));
    }

    function composeFrom(bytes calldata message) internal pure returns (bytes32) {
        return bytes32(message[AMOUNT_LD_OFFSET:COMPOSE_MSG_OFFSET]);
    }

    function composeMsg(bytes calldata message) internal pure returns (bytes memory) {
        return message[COMPOSE_MSG_OFFSET:];
    }

    function addressToBytes32(address a) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(a)));
    }
}

interface IReceiverExecutorLZ {
    function execute(address settlementToken, uint256 amount, bytes calldata payload) external;
}
