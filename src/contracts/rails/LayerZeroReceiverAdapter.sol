// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title LayerZeroReceiverAdapter
/// @notice Destination-side adapter that validates LayerZero peer metadata and
///         forwards settlement + payload into ReceiverV1.execute().
contract LayerZeroReceiverAdapter is Ownable2Step {
    using SafeERC20 for IERC20;

    address public immutable endpoint;
    address public immutable receiver;

    // srcEid => trusted source OApp/adapter bytes32 address
    mapping(uint32 => bytes32) public trustedPeers;

    event TrustedPeerSet(uint32 indexed srcEid, bytes32 indexed peer);
    event LayerZeroMessageForwarded(uint32 indexed srcEid, bytes32 indexed sender, address token, uint256 amount);

    error UnauthorizedEndpoint(address caller);
    error UntrustedPeer(uint32 srcEid, bytes32 sender, bytes32 expected);
    error ZeroAddress(string field);

    constructor(address _endpoint, address _receiver, address _owner) Ownable(_owner) {
        if (_endpoint == address(0)) revert ZeroAddress("endpoint");
        if (_receiver == address(0)) revert ZeroAddress("receiver");
        endpoint = _endpoint;
        receiver = _receiver;
    }

    /// @notice Generic handler to be called by LayerZero endpoint / local OApp wrapper.
    function lzReceive(
        uint32 srcEid,
        bytes32 sender,
        address settlementToken,
        uint256 amount,
        bytes calldata payload
    ) external {
        if (msg.sender != endpoint) revert UnauthorizedEndpoint(msg.sender);

        bytes32 expected = trustedPeers[srcEid];
        if (expected == bytes32(0) || expected != sender) {
            revert UntrustedPeer(srcEid, sender, expected);
        }

        IERC20(settlementToken).safeTransfer(receiver, amount);
        IReceiverExecutorLZ(receiver).execute(settlementToken, amount, payload);

        emit LayerZeroMessageForwarded(srcEid, sender, settlementToken, amount);
    }

    function setTrustedPeer(uint32 srcEid, bytes32 peer) external onlyOwner {
        trustedPeers[srcEid] = peer;
        emit TrustedPeerSet(srcEid, peer);
    }

    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}

interface IReceiverExecutorLZ {
    function execute(address settlementToken, uint256 amount, bytes calldata payload) external;
}
