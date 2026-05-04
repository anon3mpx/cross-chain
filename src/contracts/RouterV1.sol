// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
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
contract RouterV1 is EIP712, ReentrancyGuard, Pausable, Ownable2Step {
    using SafeERC20 for IERC20;

    string private constant SIGNING_DOMAIN = "EMPX-Cross-Chain Router";
    string private constant SIGNATURE_VERSION = "1";
    bytes32 private constant INTENT_EXECUTION_TYPEHASH = keccak256(
        "IntentExecution(bytes swapDataSrc,bytes swapDataDst,bytes32 swapPluginIdSrc,bytes32 dstSwapPluginId,bytes32 railPluginId,bytes railData,uint256 dstGasLimit,address dstReceiver,bytes nativeDstAddress,string thorAssetIdentifier,uint256 minThorOutput,bytes32 intentId,uint256 deadline)"
    );
    bytes32 private constant INTENT_ROUTE_TYPEHASH = keccak256(
        "IntentRoute(address routeToken,bytes32 routeAssetId,address expectedDstRouteToken,bytes32 expectedDstRouteAssetId,uint256 minRouteAmount)"
    );
    bytes32 private constant SWAP_INTENT_TYPEHASH = keccak256(
        "SwapIntent(address user,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 minSrcSwapOut,uint32 dstChainId,uint8 rail,IntentRoute route,uint256 feeAmount,IntentExecution execution)IntentExecution(bytes swapDataSrc,bytes swapDataDst,bytes32 swapPluginIdSrc,bytes32 dstSwapPluginId,bytes32 railPluginId,bytes railData,uint256 dstGasLimit,address dstReceiver,bytes nativeDstAddress,string thorAssetIdentifier,uint256 minThorOutput,bytes32 intentId,uint256 deadline)IntentRoute(address routeToken,bytes32 routeAssetId,address expectedDstRouteToken,bytes32 expectedDstRouteAssetId,uint256 minRouteAmount)"
    );

    PluginRegistry public immutable registry;
    address public feeRecipient;
    address public intentSigner;

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
    event IntentSignerUpdated(address newSigner);

    error IntentExpired(bytes32 intentId);
    error IntentDeadlineTooFar(bytes32 intentId);
    error IntentAlreadyExecuted(bytes32 intentId);
    error InvalidIntentSignature();
    error FeeTooHigh(uint256 feeAmount, uint256 maxAllowed);
    error RouteAmountTooLow(bytes32 intentId, uint256 got, uint256 min);
    error ZeroAmount();
    error AmountBelowMinimum(uint256 amount, uint256 minimum);
    error ZeroAddress(string field);
    error InvalidDstGasLimit(uint256 gasLimit);
    error SrcSwapSlippage(uint256 got, uint256 min);

    constructor(address _registry, address _feeRecipient, address _weth, address _intentSigner, address _owner)
        Ownable(_owner)
        EIP712(SIGNING_DOMAIN, SIGNATURE_VERSION)
    {
        if (_registry    == address(0)) revert ZeroAddress("registry");
        if (_feeRecipient == address(0)) revert ZeroAddress("feeRecipient");
        if (_weth        == address(0)) revert ZeroAddress("weth");
        if (_intentSigner == address(0)) revert ZeroAddress("intentSigner");
        registry     = PluginRegistry(_registry);
        feeRecipient = _feeRecipient;
        WETH         = _weth;
        intentSigner = _intentSigner;
    }

    /// @notice Primary entry point — user calls this to initiate a cross-chain swap
    /// @param intent        Full intent struct, pre-built by VPS / SDK
    /// @param signature     EIP-712 signature from the trusted VPS signer
    /// @dev Source swap plugin and rail plugin are authenticated inside the signed intent.
    function initiateSwap(
        IntentTypes.SwapIntent calldata intent,
        bytes calldata signature
    ) external payable nonReentrant whenNotPaused {
        _validateIntent(intent);
        _verifyIntentSignature(intent, signature);

        // ── Fee cap — VPS cannot charge more than MAX_FEE_BPS ─────────────────
        uint256 maxFee = (intent.amountIn * MAX_FEE_BPS) / 10_000;
        if (intent.feeAmount > maxFee) revert FeeTooHigh(intent.feeAmount, maxFee);

        // ── Replay protection ──────────────────────────────────────────────────
        if (executedIntents[intent.intentId]) revert IntentAlreadyExecuted(intent.intentId);
        executedIntents[intent.intentId] = true;

        // ── Pull tokenIn from user ─────────────────────────────────────────────
        IERC20(intent.tokenIn).safeTransferFrom(msg.sender, address(this), intent.amountIn);

        // ── Collect protocol fee ───────────────────────────────────────────────
        uint256 routeAmount = _collectFee(
            intent.intentId, intent.tokenIn, intent.amountIn, intent.feeAmount
        );
        (address routeToken, uint256 bridgedRouteAmount) = _resolveRouteAmount(intent, routeAmount);
        bytes32 railTxId = _bridgeIntent(intent, routeToken, bridgedRouteAmount, msg.value);

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

    function hashIntent(IntentTypes.SwapIntent calldata intent) external view returns (bytes32) {
        return _hashTypedDataV4(_hashIntentStruct(intent));
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        if (_feeRecipient == address(0)) revert ZeroAddress("feeRecipient");
        feeRecipient = _feeRecipient;
    }
    function setIntentSigner(address _intentSigner) external onlyOwner {
        if (_intentSigner == address(0)) revert ZeroAddress("intentSigner");
        intentSigner = _intentSigner;
        emit IntentSignerUpdated(_intentSigner);
    }
    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    function _verifyIntentSignature(
        IntentTypes.SwapIntent calldata intent,
        bytes calldata signature
    ) internal view {
        bytes32 digest = _hashTypedDataV4(_hashIntentStruct(intent));
        (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, signature);
        if (err != ECDSA.RecoverError.NoError || recovered != intentSigner) {
            revert InvalidIntentSignature();
        }
    }

    function _hashIntentStruct(IntentTypes.SwapIntent calldata intent) internal pure returns (bytes32) {
        return keccak256(
            bytes.concat(
                abi.encode(
                    SWAP_INTENT_TYPEHASH,
                    intent.user,
                    intent.tokenIn,
                    intent.tokenOut,
                    intent.amountIn,
                    intent.minAmountOut,
                    intent.minSrcSwapOut,
                    intent.dstChainId,
                    intent.rail,
                    _hashRoute(intent),
                    intent.feeAmount,
                    _hashExecution(intent)
                )
            )
        );
    }

    function _hashRoute(IntentTypes.SwapIntent calldata intent) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                INTENT_ROUTE_TYPEHASH,
                intent.routeToken,
                intent.routeAssetId,
                intent.expectedDstRouteToken,
                intent.expectedDstRouteAssetId,
                intent.minRouteAmount
            )
        );
    }

    function _hashExecution(IntentTypes.SwapIntent calldata intent) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                INTENT_EXECUTION_TYPEHASH,
                keccak256(intent.swapDataSrc),
                keccak256(intent.swapDataDst),
                intent.swapPluginIdSrc,
                intent.dstSwapPluginId,
                intent.railPluginId,
                keccak256(intent.railData),
                intent.dstGasLimit,
                intent.dstReceiver,
                keccak256(intent.nativeDstAddress),
                keccak256(bytes(intent.thorAssetIdentifier)),
                intent.minThorOutput,
                intent.intentId,
                intent.deadline
            )
        );
    }

    function _validateIntent(IntentTypes.SwapIntent calldata intent) internal view {
        if (intent.amountIn == 0) revert ZeroAmount();
        if (intent.amountIn < MIN_AMOUNT) revert AmountBelowMinimum(intent.amountIn, MIN_AMOUNT);
        if (intent.tokenIn == address(0)) revert ZeroAddress("tokenIn");
        if (intent.user == address(0)) revert ZeroAddress("user");
        if (intent.deadline < block.timestamp) revert IntentExpired(intent.intentId);
        if (intent.deadline > block.timestamp + MAX_DEADLINE_DELTA) revert IntentDeadlineTooFar(intent.intentId);
    }

    function _swapToRouteToken(
        IntentTypes.SwapIntent calldata intent,
        address routeToken,
        uint256 amountAfterFee
    ) internal returns (uint256 routeAmount) {
        ISwapPlugin swapPlugin = registry.getSwapPlugin(intent.swapPluginIdSrc);
        IERC20(intent.tokenIn).forceApprove(address(swapPlugin), amountAfterFee);

        uint256 before = IERC20(routeToken).balanceOf(address(this));
        swapPlugin.swap(
            IntentTypes.SwapParams({
                tokenIn: intent.tokenIn,
                tokenOut: routeToken,
                amountIn: amountAfterFee,
                minAmountOut: intent.minSrcSwapOut,
                data: intent.swapDataSrc
            })
        );
        routeAmount = IERC20(routeToken).balanceOf(address(this)) - before;
        if (routeAmount < intent.minSrcSwapOut) {
            revert SrcSwapSlippage(routeAmount, intent.minSrcSwapOut);
        }
    }

    function _resolveRouteAmount(
        IntentTypes.SwapIntent calldata intent,
        uint256 amountAfterFee
    ) internal returns (address routeToken, uint256 routeAmount) {
        routeToken = intent.routeToken;
        if (routeToken == address(0)) revert ZeroAddress("routeToken");

        routeAmount = amountAfterFee;
        if (intent.tokenIn != routeToken) {
            routeAmount = _swapToRouteToken(intent, routeToken, amountAfterFee);
        }
    }

    function _bridgeIntent(
        IntentTypes.SwapIntent calldata intent,
        address routeToken,
        uint256 routeAmount,
        uint256 msgValue
    ) internal returns (bytes32 railTxId) {
        IRailPlugin railPlugin = registry.getRailPlugin(intent.railPluginId);
        IERC20(routeToken).forceApprove(address(railPlugin), routeAmount);

        bytes memory dstCalldata = _buildDstCalldata(intent);
        _enforceMessagingRouteExpectations(intent, routeAmount);

        IntentTypes.BridgeParams memory bridgeParams = _buildBridgeParams(
            intent,
            routeToken,
            routeAmount,
            dstCalldata
        );

        railTxId = railPlugin.bridge{value: msgValue}(bridgeParams);
    }

    function _enforceMessagingRouteExpectations(
        IntentTypes.SwapIntent calldata intent,
        uint256 routeAmount
    ) internal pure {
        if (intent.dstReceiver == address(0)) return;
        if (intent.dstGasLimit == 0) revert InvalidDstGasLimit(intent.dstGasLimit);
        if (intent.expectedDstRouteToken == address(0)) {
            revert ZeroAddress("expectedDstRouteToken");
        }
        if (routeAmount < intent.minRouteAmount) {
            revert RouteAmountTooLow(intent.intentId, routeAmount, intent.minRouteAmount);
        }
    }

    function _buildDstCalldata(IntentTypes.SwapIntent calldata intent) internal pure returns (bytes memory) {
        return abi.encode(
            intent.intentId,
            intent.user,
            intent.tokenOut,
            intent.minAmountOut,
            intent.expectedDstRouteToken,
            intent.expectedDstRouteAssetId,
            intent.minRouteAmount,
            intent.swapDataDst,
            intent.dstSwapPluginId
        );
    }

    function _buildBridgeParams(
        IntentTypes.SwapIntent calldata intent,
        address routeToken,
        uint256 routeAmount,
        bytes memory dstCalldata
    ) internal pure returns (IntentTypes.BridgeParams memory) {
        return IntentTypes.BridgeParams({
            intentId:            intent.intentId,
            routeTokenAddr:      routeToken,
            amount:              routeAmount,
            routeAssetId:        intent.routeAssetId,
            expectedDstRouteToken: intent.expectedDstRouteToken,
            expectedDstRouteAssetId: intent.expectedDstRouteAssetId,
            minRouteAmount:      intent.minRouteAmount,
            dstChainId:          intent.dstChainId,
            railData:            intent.railData,
            dstReceiver:         intent.dstReceiver,
            finalRecipient:      intent.user,
            dstCalldata:         dstCalldata,
            gasForDst:           intent.dstGasLimit,
            nativeDstAddress:    intent.nativeDstAddress,
            thorAssetIdentifier: intent.thorAssetIdentifier,
            minThorOutput:       intent.minThorOutput
        });
    }

    receive() external payable {}
}
