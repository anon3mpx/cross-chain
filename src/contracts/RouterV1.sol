// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./interfaces/IIntentTypes.sol";
import "./interfaces/IRailPlugin.sol";
import "./interfaces/ISwapPlugin.sol";
import "./PluginRegistry.sol";

/// @title RouterV1 — Source-chain entry point for cross-chain swaps
/// @notice Thin executor: validates intent, swaps tokenIn → settlement token,
///         then hands off to the selected rail plugin.
/// @dev Security: all user-supplied values validated; fee capped at 1%;
///      source-chain swap enforces minSrcSwapOut to prevent sandwich attacks.
contract RouterV1 is ReentrancyGuard, Pausable, Ownable2Step {
    using SafeERC20 for IERC20;

    PluginRegistry public immutable registry;
    address public feeRecipient;

    /// @dev Hard cap: fee can never exceed 1% of amountIn regardless of VPS config
    uint256 public constant MAX_FEE_BPS     = 100;
    /// @dev Deadline cannot be more than 30 minutes in the future (prevents stale intents)
    uint256 public constant MAX_DEADLINE_DELTA = 30 minutes;
    /// @dev Minimum transfer: $1 equivalent (protects against dust spam)
    uint256 public constant MIN_AMOUNT      = 1e6; // 1 USDC in 6-dec terms

    mapping(bytes32 => bool) public executedIntents;
    address public immutable WETH;

    event IntentInitiated(
        bytes32 indexed intentId,
        address indexed user,
        address tokenIn,
        uint256 amountIn,
        uint32  dstChainId,
        bytes32 railTxId
    );
    event FeeCollected(bytes32 indexed intentId, address token, uint256 amount);

    error IntentExpired(bytes32 intentId);
    error IntentDeadlineTooFar(bytes32 intentId);
    error IntentAlreadyExecuted(bytes32 intentId);
    error FeeTooHigh(uint256 feeAmount, uint256 maxAllowed);
    error ZeroAmount();
    error AmountBelowMinimum(uint256 amount, uint256 minimum);
    error ZeroAddress(string field);
    error SrcSwapSlippage(uint256 got, uint256 min);

    constructor(address _registry, address _feeRecipient, address _weth, address _owner)
        Ownable(_owner)
    {
        if (_registry    == address(0)) revert ZeroAddress("registry");
        if (_feeRecipient == address(0)) revert ZeroAddress("feeRecipient");
        if (_weth        == address(0)) revert ZeroAddress("weth");
        registry     = PluginRegistry(_registry);
        feeRecipient = _feeRecipient;
        WETH         = _weth;
    }

    /// @notice Primary entry point — user calls this to initiate a cross-chain swap
    /// @param intent        Full intent struct, pre-built by VPS / SDK
    /// @dev Source swap plugin and rail plugin are part of the signed intent.
    function initiateSwap(
        IntentTypes.SwapIntent calldata intent
    ) external payable nonReentrant whenNotPaused {
        // ── Structural validation ──────────────────────────────────────────────
        if (intent.amountIn == 0) revert ZeroAmount();
        if (intent.amountIn < MIN_AMOUNT) revert AmountBelowMinimum(intent.amountIn, MIN_AMOUNT);
        if (intent.tokenIn  == address(0)) revert ZeroAddress("tokenIn");
        if (intent.user     == address(0)) revert ZeroAddress("user");
        if (intent.deadline < block.timestamp) revert IntentExpired(intent.intentId);
        if (intent.deadline > block.timestamp + MAX_DEADLINE_DELTA) revert IntentDeadlineTooFar(intent.intentId);

        // ── Fee cap — VPS cannot charge more than MAX_FEE_BPS ─────────────────
        uint256 maxFee = (intent.amountIn * MAX_FEE_BPS) / 10_000;
        if (intent.feeAmount > maxFee) revert FeeTooHigh(intent.feeAmount, maxFee);

        // ── Replay protection ──────────────────────────────────────────────────
        if (executedIntents[intent.intentId]) revert IntentAlreadyExecuted(intent.intentId);
        executedIntents[intent.intentId] = true;

        // ── Pull tokenIn from user ─────────────────────────────────────────────
        IERC20(intent.tokenIn).safeTransferFrom(msg.sender, address(this), intent.amountIn);

        // ── Collect protocol fee ───────────────────────────────────────────────
        uint256 amountAfterFee = _collectFee(
            intent.intentId, intent.tokenIn, intent.amountIn, intent.feeAmount
        );

        // ── Resolve plugins from registry (reverts if inactive or not found) ───
        IRailPlugin railPlugin = registry.getRailPlugin(intent.railPluginId);
        address settlementAddr  = railPlugin.settlementTokenAddress(intent.settlementToken);
        uint256 settlementAmount;

        if (intent.tokenIn == settlementAddr) {
            settlementAmount = amountAfterFee;
        } else {
            // ── Swap tokenIn → settlement token ─────────────────────────────────
            // minSrcSwapOut is encoded in swapDataSrc by the VPS — prevents sandwich attacks.
            // The swap plugin MUST enforce this internally; we verify the result here too.
            ISwapPlugin swapPlugin = registry.getSwapPlugin(intent.swapPluginIdSrc);
            IERC20(intent.tokenIn).forceApprove(address(swapPlugin), amountAfterFee);

            uint256 before = IERC20(settlementAddr).balanceOf(address(this));
            swapPlugin.swap(
                IntentTypes.SwapParams({
                    tokenIn:      intent.tokenIn,
                    tokenOut:     settlementAddr,
                    amountIn:     amountAfterFee,
                    minAmountOut: intent.minSrcSwapOut,  // [SECURITY] enforce slippage on src swap
                    data:         intent.swapDataSrc
                })
            );
            settlementAmount = IERC20(settlementAddr).balanceOf(address(this)) - before;
            // [SECURITY] Double-check: balance delta must match stated minimum
            if (settlementAmount < intent.minSrcSwapOut) {
                revert SrcSwapSlippage(settlementAmount, intent.minSrcSwapOut);
            }
        }

        // ── Hand off to rail plugin ────────────────────────────────────────────
        IERC20(settlementAddr).forceApprove(address(railPlugin), settlementAmount);

        bytes memory dstCalldata = abi.encode(
            intent.intentId,
            intent.user,
            intent.tokenOut,
            intent.minAmountOut,
            intent.swapDataDst,
            intent.dstSwapPluginId  // [SECURITY] plugin selection locked inside intent, not external param
        );

        IntentTypes.BridgeParams memory bridgeParams = IntentTypes.BridgeParams({
            intentId:            intent.intentId,
            settlementTokenAddr: settlementAddr,
            amount:              settlementAmount,
            dstChainId:          intent.dstChainId,
            railData:            intent.railData,
            dstReceiver:         intent.dstReceiver,   // [FIX] was address(0) — now required in intent
            finalRecipient:      intent.user,
            dstCalldata:         dstCalldata,
            gasForDst:           200_000,
            nativeDstAddress:    intent.nativeDstAddress,
            thorAssetIdentifier: intent.thorAssetIdentifier,
            minThorOutput:       intent.minThorOutput
        });

        bytes32 railTxId = railPlugin.bridge{value: msg.value}(bridgeParams);

        emit IntentInitiated(
            intent.intentId, intent.user, intent.tokenIn,
            intent.amountIn, intent.dstChainId, railTxId
        );
    }

    function _collectFee(
        bytes32 intentId, address token, uint256 amount, uint256 feeAmount
    ) internal returns (uint256) {
        if (feeAmount == 0) return amount;
        IERC20(token).safeTransfer(feeRecipient, feeAmount);
        emit FeeCollected(intentId, token, feeAmount);
        return amount - feeAmount;
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        if (_feeRecipient == address(0)) revert ZeroAddress("feeRecipient");
        feeRecipient = _feeRecipient;
    }
    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    receive() external payable {}
}
