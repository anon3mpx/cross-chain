// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title EMPX-Cross-Chain Paymaster — EIP-4337 Token Paymaster
/// @notice Sponsors gas for users paying with their input token (USDC, ARB, etc.)
///         User pays zero native gas — fee is deducted from their swap amountIn.
///
/// @dev Implements IPaymaster from ERC-4337 EntryPoint v0.7.
///      Flow:
///        1. Bundler calls validatePaymasterUserOp — we verify token coverage & sign
///        2. EntryPoint executes the UserOp (RouterV1.initiateSwap)
///        3. EntryPoint calls postOp — we collect the token fee from the user
///
///      Token → ETH rate is provided by our off-chain VPS signer (not on-chain oracle)
///      to keep gas costs low. The signer key is rotated regularly.
contract Paymaster is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // EIP-4337 EntryPoint v0.7
    address public immutable entryPoint;

    // Signer authorises each UserOp — VPS signs with this key
    address public paymasterSigner;

    // ETH held for gas sponsorship (deposited to EntryPoint)
    // Topped up by protocol revenue

    // Per-token exchange rates (token units per 1 ETH wei), updated by VPS keeper
    mapping(address => uint256) public tokenToEthRate; // tokenWei per ethWei

    // Maximum gas we'll sponsor per UserOp (prevents griefing)
    uint256 public constant MAX_GAS_LIMIT = 500_000;

    // Token rates must be refreshed by the VPS keeper before this window expires.
    uint48 public constant RATE_TTL = 10 minutes;

    // Markup on gas cost (covers rate volatility): 120% = 20% buffer
    uint256 public constant GAS_MARKUP_BPS = 12_000; // 120%

    // Per-token last update timestamp for rate freshness checks.
    mapping(address => uint48) public tokenRateUpdatedAt;

    event GasSponsored(address indexed user, address token, uint256 tokenFee, uint256 ethCost);
    event RateUpdated(address indexed token, uint256 rate, uint48 updatedAt);
    event SignerUpdated(address newSigner);

    error InvalidSignature();
    error SignatureExpired();
    error UnsupportedToken(address token);
    error GasLimitExceeded(uint256 limit, uint256 max);
    error InsufficientTokenBalance(address user, address token);
    error OnlyEntryPoint();
    error TokenFeeExceedsMax(uint256 tokenFee, uint256 maxTokenFee);
    error ZeroAddress(string field);
    error InvalidRate(address token, uint256 rate);
    error RateStale(address token, uint48 updatedAt, uint48 currentTimestamp);
    error ArrayLengthMismatch(uint256 tokensLength, uint256 ratesLength);

    modifier onlyEntryPoint() {
        if (msg.sender != entryPoint) revert OnlyEntryPoint();
        _;
    }

    constructor(address _entryPoint, address _signer, address _owner) Ownable(_owner) {
        if (_entryPoint == address(0)) revert ZeroAddress("entryPoint");
        if (_signer == address(0)) revert ZeroAddress("paymasterSigner");
        entryPoint = _entryPoint;
        paymasterSigner = _signer;
    }

    // ── EIP-4337 IPaymaster ────────────────────────────────────────────────────

    /// @notice Called by EntryPoint before execution. Validates we'll cover the gas.
    /// @dev paymasterAndData layout:
    ///        [0:20] paymaster address (this contract)
    ///        [20:]  abi.encode(token, maxTokenFee, signature, expiry)
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external view onlyEntryPoint returns (bytes memory context, uint256 validationData) {
        // Decode paymasterAndData
        (address token, uint256 maxTokenFee, bytes memory sig, uint48 expiry) =
            abi.decode(userOp.paymasterAndData[20:], (address, uint256, bytes, uint48));

        // Validate signature from our VPS signer
        bytes32 digest = keccak256(abi.encodePacked(userOpHash, token, maxTokenFee, expiry));
        address recovered = _recoverSigner(digest, sig);
        if (recovered != paymasterSigner) revert InvalidSignature();

        // Time bounds: validAfter=0, validUntil=expiry
        validationData = (uint256(expiry) << 160);

        // Verify token is supported and user can cover the fee
        uint256 rate = _freshTokenRate(token);
        if (rate == 0) revert UnsupportedToken(token);

        uint256 tokenFee = _ethToToken(maxCost * GAS_MARKUP_BPS / 10_000, rate);
        if (tokenFee > maxTokenFee) revert TokenFeeExceedsMax(tokenFee, maxTokenFee);
        if (IERC20(token).balanceOf(userOp.sender) < tokenFee)
            revert InsufficientTokenBalance(userOp.sender, token);

        // Pass context to postOp
        context = abi.encode(userOp.sender, token, maxTokenFee, rate);
    }

    /// @notice Called by EntryPoint after execution. Collect token fee from user.
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 /*actualUserOpFeePerGas*/
    ) external onlyEntryPoint {
        if (mode == PostOpMode.postOpReverted) return; // UserOp reverted — don't charge

        (address user, address token, uint256 maxTokenFee, uint256 rate) =
            abi.decode(context, (address, address, uint256, uint256));

        // Charge actual cost + markup (not the max quoted)
        uint256 actualTokenFee = _ethToToken(actualGasCost * GAS_MARKUP_BPS / 10_000, rate);
        if (actualTokenFee > maxTokenFee) revert TokenFeeExceedsMax(actualTokenFee, maxTokenFee);

        // Pull token from user (they approved this contract in the UserOp batch)
        IERC20(token).safeTransferFrom(user, address(this), actualTokenFee);

        emit GasSponsored(user, token, actualTokenFee, actualGasCost);
    }

    // ── Admin ──────────────────────────────────────────────────────────────────

    /// @notice VPS keeper updates rates every ~5 minutes
    function setTokenRate(address token, uint256 rate) external onlyOwner {
        if (token == address(0)) revert ZeroAddress("token");
        if (rate == 0) revert InvalidRate(token, rate);
        tokenToEthRate[token] = rate;
        tokenRateUpdatedAt[token] = uint48(block.timestamp);
        emit RateUpdated(token, rate, uint48(block.timestamp));
    }

    function setTokenRateBatch(address[] calldata tokens, uint256[] calldata rates) external onlyOwner {
        if (tokens.length != rates.length) revert ArrayLengthMismatch(tokens.length, rates.length);
        for (uint i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            uint256 rate = rates[i];
            if (token == address(0)) revert ZeroAddress("token");
            if (rate == 0) revert InvalidRate(token, rate);
            tokenToEthRate[token] = rate;
            tokenRateUpdatedAt[token] = uint48(block.timestamp);
            emit RateUpdated(token, rate, uint48(block.timestamp));
        }
    }

    function setSigner(address _signer) external onlyOwner {
        if (_signer == address(0)) revert ZeroAddress("paymasterSigner");
        paymasterSigner = _signer;
        emit SignerUpdated(_signer);
    }

    /// @notice Deposit ETH into EntryPoint for gas sponsorship
    function depositToEntryPoint() external payable {
        IEntryPoint(entryPoint).depositTo{value: msg.value}(address(this));
    }

    function withdrawFromEntryPoint(uint256 amount) external onlyOwner {
        IEntryPoint(entryPoint).withdrawTo(payable(owner()), amount);
    }

    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    // ── Internal ───────────────────────────────────────────────────────────────

    function _ethToToken(uint256 ethAmount, uint256 rate) internal pure returns (uint256) {
        // rate = tokenWei per 1e18 ethWei
        return (ethAmount * rate) / 1e18;
    }

    function _freshTokenRate(address token) internal view returns (uint256 rate) {
        rate = tokenToEthRate[token];
        if (rate == 0) return 0;

        uint48 updatedAt = tokenRateUpdatedAt[token];
        uint48 currentTimestamp = uint48(block.timestamp);
        if (updatedAt == 0 || currentTimestamp > updatedAt + RATE_TTL) {
            revert RateStale(token, updatedAt, currentTimestamp);
        }
    }

    function _recoverSigner(bytes32 digest, bytes memory sig) internal pure returns (address) {
        bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(digest);

        if (sig.length == 65) {
            (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(ethHash, sig);
            return err == ECDSA.RecoverError.NoError ? recovered : address(0);
        }

        if (sig.length == 96) {
            (bytes32 r, bytes32 s, uint8 v) = abi.decode(sig, (bytes32, bytes32, uint8));
            (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(ethHash, v, r, s);
            return err == ECDSA.RecoverError.NoError ? recovered : address(0);
        }

        return address(0);
    }

    receive() external payable {}
}

// ── Minimal EIP-4337 interfaces ───────────────────────────────────────────────

enum PostOpMode { opSucceeded, opReverted, postOpReverted }

struct UserOperation {
    address sender;
    uint256 nonce;
    bytes   initCode;
    bytes   callData;
    uint256 callGasLimit;
    uint256 verificationGasLimit;
    uint256 preVerificationGas;
    uint256 maxFeePerGas;
    uint256 maxPriorityFeePerGas;
    bytes   paymasterAndData;
    bytes   signature;
}

interface IEntryPoint {
    function depositTo(address account) external payable;
    function withdrawTo(address payable withdrawAddress, uint256 withdrawAmount) external;
}
