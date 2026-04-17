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

    PluginRegistry public immutable registry;

    mapping(bytes32 => bool) public settledIntents;
    mapping(address => bool) public approvedCallers;

    event IntentSettled(bytes32 indexed intentId, address indexed user, address tokenOut, uint256 amountOut);
    event DirectDelivery(bytes32 indexed intentId, address indexed user, address settlementToken, uint256 amount);

    error UnauthorizedCaller(address caller);
    error IntentAlreadySettled(bytes32 intentId);
    error SwapOutputTooLow(bytes32 intentId, uint256 got, uint256 min);
    error ZeroAmount();
    error ZeroAddress(string field);

    constructor(address _registry, address _owner) Ownable(_owner) {
        if (_registry == address(0)) revert ZeroAddress("registry");
        registry = PluginRegistry(_registry);
    }

    /// @notice Called by approved rail infrastructure after settlement tokens arrive.
    /// @param settlementToken  Address of the received settlement token on this chain
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
        (
            bytes32 intentId,
            address user,
            address tokenOut,
            uint256 minAmountOut,
            bytes memory swapData,
            bytes32 swapPluginId
        ) = abi.decode(payload, (bytes32, address, address, uint256, bytes, bytes32));

        if (user == address(0)) revert ZeroAddress("user");
        if (settledIntents[intentId]) revert IntentAlreadySettled(intentId);
        settledIntents[intentId] = true;

        // ── Case 1: Direct delivery — no aggregator on this chain or same token ─
        if (swapPluginId == bytes32(0) || tokenOut == settlementToken) {
            if (amount < minAmountOut) revert SwapOutputTooLow(intentId, amount, minAmountOut);
            IERC20(settlementToken).safeTransfer(user, amount);
            emit DirectDelivery(intentId, user, settlementToken, amount);
            return;
        }

        // ── Case 2: Swap settlement token → tokenOut ───────────────────────────
        ISwapPlugin swapPlugin = registry.getSwapPlugin(swapPluginId);
        IERC20(settlementToken).forceApprove(address(swapPlugin), amount);

        uint256 before    = IERC20(tokenOut).balanceOf(address(this));
        swapPlugin.swap(
            IntentTypes.SwapParams({
                tokenIn:      settlementToken,
                tokenOut:     tokenOut,
                amountIn:     amount,
                minAmountOut: minAmountOut,
                data:         swapData
            })
        );
        uint256 amountOut = IERC20(tokenOut).balanceOf(address(this)) - before;

        if (amountOut < minAmountOut) revert SwapOutputTooLow(intentId, amountOut, minAmountOut);

        IERC20(tokenOut).safeTransfer(user, amountOut);
        emit IntentSettled(intentId, user, tokenOut, amountOut);
    }

    function addApprovedCaller(address caller)    external onlyOwner { approvedCallers[caller] = true; }
    function removeApprovedCaller(address caller) external onlyOwner { approvedCallers[caller] = false; }
    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
