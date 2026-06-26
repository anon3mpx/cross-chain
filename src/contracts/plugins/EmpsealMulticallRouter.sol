// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

interface IEmpsealRouter {
    struct Trade {
        uint256 amountIn;
        uint256 amountOut;
        address[] path;
        address[] adapters;
    }

    function findBestPath(uint256, address, address, uint256)
        external
        view
        returns (address[] memory, address[] memory, address[] memory, uint256);

    function swapNoSplit(Trade calldata _trade, address _to, uint256 _fee) external;
    function swapNoSplitFromETH(Trade calldata _trade, address _to, uint256 _fee) external payable;
    function swapNoSplitToETH(Trade calldata _trade, address _to, uint256 _fee) external;
    function swapNoSplitFromPLS(Trade calldata _trade, address _to, uint256 _fee) external payable;
    function swapNoSplitToPLS(Trade calldata _trade, address _to, uint256 _fee) external;
}

contract EmpsealMulticallRouter is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IEmpsealRouter public immutable empsealRouter;
    bool public immutable usesPLS;

    uint8 public constant MAX_LEGS_PER_BATCH = 10;

    enum Kind {
        ERC20_TO_ERC20,
        NATIVE_TO_ERC20,
        ERC20_TO_NATIVE
    }

    struct MulticallLeg {
        Kind kind;
        IEmpsealRouter.Trade trade;
        address recipient;
        uint256 fee;
        uint256 nativeValue;
    }

    event MultiSwapExecuted(address indexed caller, uint8 legCount, uint256 totalNativeValue);
    event LegExecuted(
        address indexed caller,
        uint8 legIndex,
        Kind kind,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        address recipient
    );

    error TooManyLegs(uint8 got, uint8 max);
    error NoLegs();
    error EmptyPath();
    error ZeroAmount(uint8 legIndex);
    error NativeValueMismatch(uint256 sent, uint256 required);
    error UnexpectedNativeValue(uint8 legIndex);
    error UnknownKind();

    constructor(address _empsealRouter, bool _usesPLS, address _owner) Ownable(_owner) {
        require(_empsealRouter != address(0), "EmpsealMulticallRouter: zero router");
        empsealRouter = IEmpsealRouter(_empsealRouter);
        usesPLS = _usesPLS;
    }

    function multiSwap(MulticallLeg[] calldata legs) external payable nonReentrant {
        uint8 legCount = uint8(legs.length);
        if (legCount == 0) revert NoLegs();
        if (legCount > MAX_LEGS_PER_BATCH) revert TooManyLegs(legCount, MAX_LEGS_PER_BATCH);

        uint256 nativeRequired = 0;
        for (uint8 i = 0; i < legCount; i++) {
            if (legs[i].kind == Kind.NATIVE_TO_ERC20) {
                nativeRequired += legs[i].nativeValue;
            } else if (legs[i].nativeValue != 0) {
                revert UnexpectedNativeValue(i);
            }
            if (legs[i].trade.amountIn == 0) revert ZeroAmount(i);
            if (legs[i].trade.path.length < 2) revert EmptyPath();
        }
        if (msg.value != nativeRequired) revert NativeValueMismatch(msg.value, nativeRequired);

        for (uint8 i = 0; i < legCount; i++) {
            _executeLeg(i, legs[i]);
        }

        emit MultiSwapExecuted(msg.sender, legCount, nativeRequired);
    }

    function _executeLeg(uint8 i, MulticallLeg calldata leg) internal {
        address tokenIn = leg.trade.path[0];
        address tokenOut = leg.trade.path[leg.trade.path.length - 1];

        if (leg.kind == Kind.ERC20_TO_ERC20) {
            IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), leg.trade.amountIn);
            IERC20(tokenIn).forceApprove(address(empsealRouter), leg.trade.amountIn);
            empsealRouter.swapNoSplit(leg.trade, leg.recipient, leg.fee);
        } else if (leg.kind == Kind.NATIVE_TO_ERC20) {
            if (usesPLS) {
                empsealRouter.swapNoSplitFromPLS{value: leg.nativeValue}(leg.trade, leg.recipient, leg.fee);
            } else {
                empsealRouter.swapNoSplitFromETH{value: leg.nativeValue}(leg.trade, leg.recipient, leg.fee);
            }
        } else if (leg.kind == Kind.ERC20_TO_NATIVE) {
            IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), leg.trade.amountIn);
            IERC20(tokenIn).forceApprove(address(empsealRouter), leg.trade.amountIn);
            if (usesPLS) {
                empsealRouter.swapNoSplitToPLS(leg.trade, leg.recipient, leg.fee);
            } else {
                empsealRouter.swapNoSplitToETH(leg.trade, leg.recipient, leg.fee);
            }
        } else {
            revert UnknownKind();
        }

        emit LegExecuted(msg.sender, i, leg.kind, tokenIn, tokenOut, leg.trade.amountIn, leg.recipient);
    }

    function rescueTokens(address token, uint256 amount, address to) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }

    function rescueNative(uint256 amount, address payable to) external onlyOwner {
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "EmpsealMulticallRouter: native rescue failed");
    }

    receive() external payable {}
}
