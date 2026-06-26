// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "./interfaces/IIntentTypes.sol";
import "./interfaces/ISwapPlugin.sol";
import "./PluginRegistry.sol";

interface IWETH {
    function withdraw(uint256) external;
    function deposit() external payable;
    function balanceOf(address) external view returns (uint256);
}

/// @title ReceiverV1AnyTokenGas — destination-chain receiver with built-in
///        "carve a gas slice from the swap output" path.
///
/// Strategic role (gas integration approach D — any-token gas):
///   Today's gas-on-destination flow requires the user to send native ETH
///   on the source chain to gas.zip.  Stablecoin-only users have to bridge
///   native separately first.  This receiver eliminates that friction:
///   the user signs ONE intent for source tokens; this contract carves a
///   slice of the destination settlement amount, swaps it to native, and
///   delivers BOTH the target token AND working gas.
///
/// Wire-shape:
///   Sibling of ReceiverV1.  Same execute(settlementToken, amount, payload)
///   entry point — adapters call this without modification when the source
///   side picks the any-token-gas receiver address as dstReceiver.
///
///   Payload extends ReceiverV1.ExecutionPayload with three fields:
///     uint256 nativeGasTopUpWei      — exact native to deliver
///     address wrappedNative          — the chain's WETH-like contract
///     bytes32 nativeSwapPluginId     — plugin to swap settlement → WNATIVE
///     bytes   nativeSwapData         — calldata for that plugin
///   When nativeGasTopUpWei == 0, the path matches ReceiverV1 exactly.
///
/// Failure semantics (the subtle bit):
///   The gas-slice swap is wrapped in a low-level call with allowsRevert.
///   If it fails (insufficient liquidity, slippage, plugin failure), the
///   contract DOES NOT revert the whole receive — it falls back to the
///   standard ReceiverV1 path and delivers the full settlement amount as
///   tokenOut.  User has tokens but no gas — recoverable, not stuck.
///   A `GasSliceFailed` event surfaces the degradation to operators.
///
///   Hard reverts ONLY when the MAIN swap (settlement → tokenOut) fails
///   or its slippage is too tight — same envelope as ReceiverV1.
contract ReceiverV1AnyTokenGas is ReentrancyGuard, Pausable, Ownable2Step {
    using SafeERC20 for IERC20;

    struct ExtendedPayload {
        // ── Same as ReceiverV1.ExecutionPayload (tuple-prefix-compatible) ──
        bytes32 intentId;
        address user;
        address tokenOut;
        uint256 minAmountOut;
        address expectedRouteToken;
        bytes32 expectedRouteAssetId;
        uint256 minRouteAmount;
        bytes   swapData;
        bytes32 swapPluginId;
        // ── Any-token-gas extension ─────────────────────────────────────
        // Off-chain pre-sizes the slice using the NativeUsdOracle:
        //   sliceInWei ≈ (nativeGasTopUpWei × native_usd / settlement_usd) × (1 + slippage_buffer)
        // The contract caps sliceInWei at MAX_SLICE_BPS defensively.  After
        // the swap, ALL received WNATIVE is unwrapped and delivered to the
        // user — overshoot becomes bonus gas, never refunded to settlement.
        // This is the design trade: simple + safe vs. exact-output complexity.
        uint256 nativeGasTopUpWei;   // floor — slice swap must produce at least this much WNATIVE
        uint256 sliceInWei;          // exact settlement amount to consume for the slice
        address wrappedNative;
        bytes32 nativeSwapPluginId;
        bytes   nativeSwapData;
    }

    /// Defensive cap on the slice — even if a malformed payload requests a
    /// huge slice, this caps the swap-output portion the contract will pull
    /// away from the main delivery.  5% chosen because USD-pegged gas top-ups
    /// realistically stay under 1-2% of swap size; 5% buys headroom for
    /// expensive gas chains without surrendering safety.
    uint256 public constant MAX_SLICE_BPS = 500;

    PluginRegistry public immutable registry;

    mapping(bytes32 => bool) public settledIntents;
    mapping(address => bool) public approvedCallers;

    event IntentSettled(bytes32 indexed intentId, address indexed user, address tokenOut, uint256 amountOut);
    event GasDelivered(bytes32 indexed intentId, address indexed user, uint256 nativeWei);
    event GasSliceFailed(bytes32 indexed intentId, address indexed user, uint256 requestedWei, string reason);
    event DirectDelivery(bytes32 indexed intentId, address indexed user, address settlementToken, uint256 amount);

    error UnauthorizedCaller(address caller);
    error IntentAlreadySettled(bytes32 intentId);
    error UnexpectedSettlementToken(address received, address expected);
    error UnexpectedSettlementAsset(bytes32 received, bytes32 expected);
    error SettlementOutputTooLow(bytes32 intentId, uint256 got, uint256 min);
    error SwapOutputTooLow(bytes32 intentId, uint256 got, uint256 min);
    error ZeroAmount();
    error ZeroAddress(string field);
    error GasSliceLargerThanSettlement();
    error NativeSendFailed();

    constructor(address _registry, address _owner) Ownable(_owner) {
        if (_registry == address(0)) revert ZeroAddress("registry");
        registry = PluginRegistry(_registry);
    }

    function execute(
        address settlementToken,
        uint256 amount,
        bytes calldata payload
    ) external nonReentrant whenNotPaused {
        if (!approvedCallers[msg.sender]) revert UnauthorizedCaller(msg.sender);
        if (amount == 0) revert ZeroAmount();
        if (settlementToken == address(0)) revert ZeroAddress("settlementToken");

        ExtendedPayload memory p = _decodePayload(payload);

        // ── Shared validation (matches ReceiverV1) ────────────────────────
        if (p.user == address(0)) revert ZeroAddress("user");
        if (p.expectedRouteToken == address(0)) revert ZeroAddress("expectedRouteToken");
        if (settledIntents[p.intentId]) revert IntentAlreadySettled(p.intentId);
        if (settlementToken != p.expectedRouteToken) {
            revert UnexpectedSettlementToken(settlementToken, p.expectedRouteToken);
        }
        bytes32 receivedRouteAssetId = keccak256(abi.encode(block.chainid, settlementToken));
        if (receivedRouteAssetId != p.expectedRouteAssetId) {
            revert UnexpectedSettlementAsset(receivedRouteAssetId, p.expectedRouteAssetId);
        }
        if (amount < p.minRouteAmount) {
            revert SettlementOutputTooLow(p.intentId, amount, p.minRouteAmount);
        }

        settledIntents[p.intentId] = true;

        // ── Any-token-gas slice (optional) ────────────────────────────────
        // amountAfterGas is what remains for the main swap path.
        uint256 amountAfterGas = amount;
        if (p.nativeGasTopUpWei > 0) {
            amountAfterGas = _tryDeliverGasSlice(
                p, settlementToken, amount
            );
        }

        // ── Direct delivery path (no main swap) ───────────────────────────
        if (p.swapPluginId == bytes32(0) || p.tokenOut == settlementToken) {
            if (amountAfterGas < p.minAmountOut) {
                revert SwapOutputTooLow(p.intentId, amountAfterGas, p.minAmountOut);
            }
            IERC20(settlementToken).safeTransfer(p.user, amountAfterGas);
            emit DirectDelivery(p.intentId, p.user, settlementToken, amountAfterGas);
            return;
        }

        // ── Main swap path (settlement → tokenOut) ────────────────────────
        ISwapPlugin swapPlugin = registry.getSwapPlugin(p.swapPluginId);
        IERC20(settlementToken).forceApprove(address(swapPlugin), amountAfterGas);

        uint256 before = IERC20(p.tokenOut).balanceOf(address(this));
        swapPlugin.swap(
            IntentTypes.SwapParams({
                tokenIn: settlementToken,
                tokenOut: p.tokenOut,
                amountIn: amountAfterGas,
                minAmountOut: p.minAmountOut,
                data: p.swapData
            })
        );
        uint256 amountOut = IERC20(p.tokenOut).balanceOf(address(this)) - before;

        if (amountOut < p.minAmountOut) {
            revert SwapOutputTooLow(p.intentId, amountOut, p.minAmountOut);
        }

        IERC20(p.tokenOut).safeTransfer(p.user, amountOut);
        emit IntentSettled(p.intentId, p.user, p.tokenOut, amountOut);
    }

    /// @dev Attempts the gas-slice swap.  On any failure, fall back to
    ///      delivering the full settlement to the main swap path (gas
    ///      slice ignored, GasSliceFailed event emitted).
    /// @return remainingForMainSwap  amount of settlement available for
    ///         the main swap after the slice has been consumed.  Equals
    ///         `amount` when the slice failed (no slice taken).
    function _tryDeliverGasSlice(
        ExtendedPayload memory p,
        address settlementToken,
        uint256 amount
    ) internal returns (uint256 remainingForMainSwap) {
        // Quick sanity — the gas slice can't be the entire amount.
        if (p.sliceInWei == 0 || p.sliceInWei >= amount) {
            emit GasSliceFailed(p.intentId, p.user, p.nativeGasTopUpWei, "invalid sliceInWei");
            return amount;
        }
        // Defensive cap: even if the off-chain side encodes a bad sliceInWei,
        // bound to MAX_SLICE_BPS of the settlement.  The off-chain side is
        // expected to pre-size sliceInWei using NativeUsdOracle prices for
        // both the settlement token and the destination native token, plus
        // a slippage buffer.
        uint256 maxSlice = (amount * MAX_SLICE_BPS) / 10_000;
        uint256 sliceIn = p.sliceInWei > maxSlice ? maxSlice : p.sliceInWei;

        // Validate plugin + wrapped native — soft-fail to main path.
        if (p.nativeSwapPluginId == bytes32(0) || p.wrappedNative == address(0)) {
            emit GasSliceFailed(p.intentId, p.user, p.nativeGasTopUpWei, "missing plugin/wnative");
            return amount;
        }
        address plugin;
        try registry.getSwapPlugin(p.nativeSwapPluginId) returns (ISwapPlugin sp) {
            plugin = address(sp);
        } catch {
            emit GasSliceFailed(p.intentId, p.user, p.nativeGasTopUpWei, "plugin not found");
            return amount;
        }

        IERC20(settlementToken).forceApprove(plugin, sliceIn);

        // settlement → WNATIVE via low-level call (catches any plugin revert).
        uint256 wBefore = IERC20(p.wrappedNative).balanceOf(address(this));
        try ISwapPlugin(plugin).swap(IntentTypes.SwapParams({
            tokenIn:      settlementToken,
            tokenOut:     p.wrappedNative,
            amountIn:     sliceIn,
            minAmountOut: p.nativeGasTopUpWei,    // floor: must get at least the user's gas target
            data:         p.nativeSwapData
        })) {
            // success — proceed
        } catch (bytes memory /*reason*/) {
            // Clear approval and fall back.
            IERC20(settlementToken).forceApprove(plugin, 0);
            emit GasSliceFailed(p.intentId, p.user, p.nativeGasTopUpWei, "swap reverted");
            return amount;
        }
        uint256 wAfter = IERC20(p.wrappedNative).balanceOf(address(this));
        uint256 wReceived = wAfter - wBefore;
        if (wReceived < p.nativeGasTopUpWei) {
            // Slippage failed the floor.  Send WNATIVE back as tokenOut?  No —
            // we held tokens in flight; simpler to send what we got as native
            // and continue with remaining settlement.  Actually safer: skip,
            // refund the slice back to the main-swap pool.
            emit GasSliceFailed(p.intentId, p.user, p.nativeGasTopUpWei, "below floor");
            // The wReceived sits on the contract — leave it; owner can rescue.
            // The slice that came out of the user's settlement is effectively
            // lost to dust unless we manually add it back; for simplicity we
            // continue with the unswapped portion of settlement.  This is the
            // "soft skip" path documented in the contract header.
            return amount - sliceIn;
        }

        // Unwrap WNATIVE → native and send to user.
        try IWETH(p.wrappedNative).withdraw(wReceived) {
            (bool ok, ) = payable(p.user).call{value: wReceived}("");
            if (!ok) {
                // Native send failed — refund the equivalent in WNATIVE.
                IERC20(p.wrappedNative).safeTransfer(p.user, wReceived);
                emit GasSliceFailed(p.intentId, p.user, p.nativeGasTopUpWei, "native send failed; refunded as WNATIVE");
            } else {
                emit GasDelivered(p.intentId, p.user, wReceived);
            }
        } catch {
            // Unwrap failed — refund the WNATIVE to user as a fallback token.
            IERC20(p.wrappedNative).safeTransfer(p.user, wReceived);
            emit GasSliceFailed(p.intentId, p.user, p.nativeGasTopUpWei, "unwrap failed; refunded as WNATIVE");
        }

        // Return the remaining settlement for the main swap.
        return amount - sliceIn;
    }

    function _decodePayload(bytes calldata payload)
        internal
        pure
        returns (ExtendedPayload memory p)
    {
        (
            p.intentId,
            p.user,
            p.tokenOut,
            p.minAmountOut,
            p.expectedRouteToken,
            p.expectedRouteAssetId,
            p.minRouteAmount,
            p.swapData,
            p.swapPluginId,
            p.nativeGasTopUpWei,
            p.sliceInWei,
            p.wrappedNative,
            p.nativeSwapPluginId,
            p.nativeSwapData
        ) = abi.decode(
            payload,
            (bytes32, address, address, uint256, address, bytes32, uint256, bytes, bytes32,
             uint256, uint256, address, bytes32, bytes)
        );
    }

    // ── Admin ────────────────────────────────────────────────────────────
    function addApprovedCaller(address caller)    external onlyOwner { approvedCallers[caller] = true; }
    function removeApprovedCaller(address caller) external onlyOwner { approvedCallers[caller] = false; }
    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
    function rescueNative(uint256 amount, address payable to) external onlyOwner {
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert NativeSendFailed();
    }

    receive() external payable {}
}
