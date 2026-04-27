// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title AxelarReceiverAdapter
/// @notice Destination-side Axelar ITS executable that forwards settlement +
///         payload into ReceiverV1.execute().
contract AxelarReceiverAdapter is Ownable2Step {
    using SafeERC20 for IERC20;

    struct ReceiverPayload {
        bytes32 intentId;
        address user;
        address tokenOut;
        uint256 minAmountOut;
        address expectedRouteToken;
        bytes32 expectedRouteAssetId;
        uint256 minRouteAmount;
        bytes swapData;
        bytes32 swapPluginId;
    }

    bytes32 public constant EXECUTE_SUCCESS = keccak256("its-execute-success");

    address public immutable interchainTokenService;
    address public immutable receiver;

    // keccak256(abi.encode(sourceChain, sourceAddress)) => trusted
    mapping(bytes32 => bool) public trustedSources;
    // tokenId => expected local token address. address(0) means unsupported.
    mapping(bytes32 => address) public trustedTokenById;

    event TrustedSourceSet(string sourceChain, bytes sourceAddress, bool trusted);
    event TrustedTokenSet(bytes32 indexed tokenId, address indexed token, bool trusted);
    event AxelarMessageForwarded(
        bytes32 indexed commandId,
        bytes32 indexed sourceKey,
        bytes32 indexed tokenId,
        address token,
        uint256 amount
    );

    error UnauthorizedInterchainTokenService(address caller);
    error UntrustedSource(bytes32 sourceKey);
    error UntrustedToken(bytes32 tokenId, address token, address expected);
    error UnexpectedSettlementToken(address received, address expected);
    error UnexpectedSettlementAsset(bytes32 received, bytes32 expected);
    error ZeroAddress(string field);

    constructor(address _interchainTokenService, address _receiver, address _owner) Ownable(_owner) {
        if (_interchainTokenService == address(0)) revert ZeroAddress("interchainTokenService");
        if (_receiver == address(0)) revert ZeroAddress("receiver");
        interchainTokenService = _interchainTokenService;
        receiver = _receiver;
    }

    /// @notice Official Axelar ITS executable callback.
    /// @dev ITS transfers tokens to this adapter before invoking this function.
    function executeWithInterchainToken(
        bytes32 commandId,
        string calldata sourceChain,
        bytes calldata sourceAddress,
        bytes calldata data,
        bytes32 tokenId,
        address token,
        uint256 amount
    ) external returns (bytes32) {
        if (msg.sender != interchainTokenService) {
            revert UnauthorizedInterchainTokenService(msg.sender);
        }

        bytes32 sourceKey = _sourceKey(sourceChain, sourceAddress);
        if (!trustedSources[sourceKey]) revert UntrustedSource(sourceKey);

        address expectedToken = trustedTokenById[tokenId];
        if (expectedToken == address(0) || expectedToken != token) {
            revert UntrustedToken(tokenId, token, expectedToken);
        }

        bytes calldata receiverPayload = data;
        if (receiverPayload.length >= 4 && bytes4(receiverPayload[0:4]) == bytes4(0)) {
            receiverPayload = receiverPayload[4:];
        }

        ReceiverPayload memory decoded = _decodeReceiverPayload(receiverPayload);
        decoded.intentId;
        decoded.user;
        decoded.tokenOut;
        decoded.minAmountOut;
        decoded.minRouteAmount;
        decoded.swapData;
        decoded.swapPluginId;

        if (decoded.expectedRouteToken == address(0)) revert ZeroAddress("expectedRouteToken");
        if (token != decoded.expectedRouteToken) {
            revert UnexpectedSettlementToken(token, decoded.expectedRouteToken);
        }

        bytes32 receivedRouteAssetId = keccak256(abi.encode(block.chainid, token));
        if (receivedRouteAssetId != decoded.expectedRouteAssetId) {
            revert UnexpectedSettlementAsset(receivedRouteAssetId, decoded.expectedRouteAssetId);
        }

        IERC20(token).safeTransfer(receiver, amount);
        IReceiverExecutorAxelar(receiver).execute(token, amount, receiverPayload);

        emit AxelarMessageForwarded(commandId, sourceKey, tokenId, token, amount);
        return EXECUTE_SUCCESS;
    }

    function setTrustedSource(
        string calldata sourceChain,
        bytes calldata sourceAddress,
        bool trusted
    ) external onlyOwner {
        trustedSources[_sourceKey(sourceChain, sourceAddress)] = trusted;
        emit TrustedSourceSet(sourceChain, sourceAddress, trusted);
    }

    function setTrustedSourceAddress(
        string calldata sourceChain,
        address sourceAddress,
        bool trusted
    ) external onlyOwner {
        bytes memory sourceAddressBytes = abi.encodePacked(sourceAddress);
        trustedSources[_sourceKey(sourceChain, sourceAddressBytes)] = trusted;
        emit TrustedSourceSet(sourceChain, sourceAddressBytes, trusted);
    }

    function setTrustedToken(bytes32 tokenId, address token, bool trusted) external onlyOwner {
        if (trusted && token == address(0)) revert ZeroAddress("token");
        trustedTokenById[tokenId] = trusted ? token : address(0);
        emit TrustedTokenSet(tokenId, token, trusted);
    }

    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    function _sourceKey(string memory sourceChain, bytes memory sourceAddress)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(sourceChain, sourceAddress));
    }

    function _decodeReceiverPayload(bytes calldata receiverPayload)
        internal
        pure
        returns (ReceiverPayload memory decoded)
    {
        (
            decoded.intentId,
            decoded.user,
            decoded.tokenOut,
            decoded.minAmountOut,
            decoded.expectedRouteToken,
            decoded.expectedRouteAssetId,
            decoded.minRouteAmount,
            decoded.swapData,
            decoded.swapPluginId
        ) = abi.decode(
            receiverPayload,
            (bytes32, address, address, uint256, address, bytes32, uint256, bytes, bytes32)
        );
    }
}

interface IReceiverExecutorAxelar {
    function execute(address settlementToken, uint256 amount, bytes calldata payload) external;
}
