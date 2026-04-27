// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./interfaces/IIntentTypes.sol";
import "./interfaces/ISwapPlugin.sol";
import "./PluginRegistry.sol";

/// @title ReceiverV1 — Destination-chain receiver for cross-chain swaps
/// @notice Receives settlement tokens from rail, executes destination swap,
///         delivers final token to user.
/// @dev Security: swapPluginId comes from the signed payload (not caller-supplied),
///      preventing a compromised relay from redirecting swaps to malicious plugins.
contract ReceiverV1 is ReentrancyGuard, Pausable, Ownable2Step {
    using SafeERC20 for IERC20;

    struct ExecutionPayload {
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

    PluginRegistry public immutable registry;

    mapping(bytes32 => bool) public settledIntents;
    mapping(address => bool) public approvedCallers;

    event IntentSettled(bytes32 indexed intentId, address indexed user, address tokenOut, uint256 amountOut);
    event DirectDelivery(bytes32 indexed intentId, address indexed user, address settlementToken, uint256 amount);

    error UnauthorizedCaller(address caller);
    error IntentAlreadySettled(bytes32 intentId);
    error UnexpectedSettlementToken(address received, address expected);
    error UnexpectedSettlementAsset(bytes32 received, bytes32 expected);
    error SettlementOutputTooLow(bytes32 intentId, uint256 got, uint256 min);
    error SwapOutputTooLow(bytes32 intentId, uint256 got, uint256 min);
    error ZeroAmount();
    error ZeroAddress(string field);

    constructor(address _registry, address _owner) Ownable(_owner) {
        if (_registry == address(0)) revert ZeroAddress("registry");
        registry = PluginRegistry(_registry);
    }

    /// @notice Called by approved rail infrastructure after route tokens arrive.
    /// @param settlementToken  Address of the received route token on this chain
    /// @param amount           Amount received from the rail
    /// @param payload          ABI-encoded intent data originally built by RouterV1
    /// @dev [SECURITY] swapPluginId is decoded from payload — NOT accepted as a
    ///      separate parameter. This prevents a compromised relayer from substituting
    ///      a malicious swap plugin after funds have arrived.
    function execute(
        address settlementToken,
        uint256 amount,
        bytes calldata payload
    ) external nonReentrant whenNotPaused {
        if (!approvedCallers[msg.sender]) revert UnauthorizedCaller(msg.sender);
        if (amount == 0) revert ZeroAmount();
        if (settlementToken == address(0)) revert ZeroAddress("settlementToken");

        // Decode — swapPluginId is embedded in the payload from RouterV1, not caller-supplied
        ExecutionPayload memory decoded = _decodeExecutionPayload(payload);

        if (decoded.user == address(0)) revert ZeroAddress("user");
        if (decoded.expectedRouteToken == address(0)) revert ZeroAddress("expectedRouteToken");
        if (settledIntents[decoded.intentId]) revert IntentAlreadySettled(decoded.intentId);

        if (settlementToken != decoded.expectedRouteToken) {
            revert UnexpectedSettlementToken(settlementToken, decoded.expectedRouteToken);
        }
        bytes32 receivedRouteAssetId = keccak256(abi.encode(block.chainid, settlementToken));
        if (receivedRouteAssetId != decoded.expectedRouteAssetId) {
            revert UnexpectedSettlementAsset(receivedRouteAssetId, decoded.expectedRouteAssetId);
        }
        if (amount < decoded.minRouteAmount) {
            revert SettlementOutputTooLow(decoded.intentId, amount, decoded.minRouteAmount);
        }

        settledIntents[decoded.intentId] = true;

        // ── Case 1: Direct delivery — no aggregator on this chain or same token ─
        if (decoded.swapPluginId == bytes32(0) || decoded.tokenOut == settlementToken) {
            if (amount < decoded.minAmountOut) {
                revert SwapOutputTooLow(decoded.intentId, amount, decoded.minAmountOut);
            }
            IERC20(settlementToken).safeTransfer(decoded.user, amount);
            emit DirectDelivery(decoded.intentId, decoded.user, settlementToken, amount);
            return;
        }

        // ── Case 2: Swap settlement token → tokenOut ───────────────────────────
        ISwapPlugin swapPlugin = registry.getSwapPlugin(decoded.swapPluginId);
        IERC20(settlementToken).forceApprove(address(swapPlugin), amount);

        uint256 before    = IERC20(decoded.tokenOut).balanceOf(address(this));
        swapPlugin.swap(
            IntentTypes.SwapParams({
                tokenIn:      settlementToken,
                tokenOut:     decoded.tokenOut,
                amountIn:     amount,
                minAmountOut: decoded.minAmountOut,
                data:         decoded.swapData
            })
        );
        uint256 amountOut = IERC20(decoded.tokenOut).balanceOf(address(this)) - before;

        if (amountOut < decoded.minAmountOut) {
            revert SwapOutputTooLow(decoded.intentId, amountOut, decoded.minAmountOut);
        }

        IERC20(decoded.tokenOut).safeTransfer(decoded.user, amountOut);
        emit IntentSettled(decoded.intentId, decoded.user, decoded.tokenOut, amountOut);
    }

    function _decodeExecutionPayload(bytes calldata payload)
        internal
        pure
        returns (ExecutionPayload memory decoded)
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
        ) = abi.decode(payload, (bytes32, address, address, uint256, address, bytes32, uint256, bytes, bytes32));
    }

    function addApprovedCaller(address caller)    external onlyOwner { approvedCallers[caller] = true; }
    function removeApprovedCaller(address caller) external onlyOwner { approvedCallers[caller] = false; }
    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
