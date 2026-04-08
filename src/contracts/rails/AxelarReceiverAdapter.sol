// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title AxelarReceiverAdapter
/// @notice Destination-side adapter that forwards Axelar-delivered settlement
///         tokens + payload into ReceiverV1.execute().
contract AxelarReceiverAdapter is Ownable2Step {
    using SafeERC20 for IERC20;

    address public immutable gateway;
    address public immutable receiver;

    // keccak256(sourceChain + ":" + sourceAddress) => trusted
    mapping(bytes32 => bool) public trustedSources;

    event TrustedSourceSet(string sourceChain, string sourceAddress, bool trusted);
    event AxelarMessageForwarded(bytes32 indexed sourceKey, address token, uint256 amount);

    error UnauthorizedGateway(address caller);
    error UntrustedSource(bytes32 sourceKey);
    error ZeroAddress(string field);

    constructor(address _gateway, address _receiver, address _owner) Ownable(_owner) {
        if (_gateway == address(0)) revert ZeroAddress("gateway");
        if (_receiver == address(0)) revert ZeroAddress("receiver");
        gateway = _gateway;
        receiver = _receiver;
    }

    /// @notice Called by Axelar gateway/executable wrapper once tokens are delivered.
    function executeWithToken(
        string calldata sourceChain,
        string calldata sourceAddress,
        address settlementToken,
        uint256 amount,
        bytes calldata payload
    ) external {
        if (msg.sender != gateway) revert UnauthorizedGateway(msg.sender);

        bytes32 sourceKey = _sourceKey(sourceChain, sourceAddress);
        if (!trustedSources[sourceKey]) revert UntrustedSource(sourceKey);

        IERC20(settlementToken).safeTransfer(receiver, amount);
        IReceiverExecutorAxelar(receiver).execute(settlementToken, amount, payload);

        emit AxelarMessageForwarded(sourceKey, settlementToken, amount);
    }

    function setTrustedSource(
        string calldata sourceChain,
        string calldata sourceAddress,
        bool trusted
    ) external onlyOwner {
        trustedSources[_sourceKey(sourceChain, sourceAddress)] = trusted;
        emit TrustedSourceSet(sourceChain, sourceAddress, trusted);
    }

    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    function _sourceKey(string calldata sourceChain, string calldata sourceAddress)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(sourceChain, ":", sourceAddress));
    }
}

interface IReceiverExecutorAxelar {
    function execute(address settlementToken, uint256 amount, bytes calldata payload) external;
}
