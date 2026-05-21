// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "../interfaces/IRailPlugin.sol";
import "../interfaces/IIntentTypes.sol";

/// @title CCTPFastRailPlugin — CCTP V2 fast-transfer rail implementation
/// @notice Bridges native USDC using Circle CCTP with signed, per-intent fast params.
contract CCTPFastRailPlugin is IRailPlugin, ERC165, Ownable2Step {
    using SafeERC20 for IERC20;

    bytes32 public constant override railId = keccak256("CCTP_V2_FAST");
    uint32 public constant FAST_FINALITY_THRESHOLD_MAX = 1000;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // Circle CCTP contracts
    address public immutable tokenMessenger;   // Circle TokenMessenger
    address public immutable usdc;             // Native USDC on this chain

    // Safety cap for maxFee passed in intent. Default 1%.
    uint256 public maxFeeBpsCap = 100;

    // chainId => CCTP domain (Circle's internal domain numbering)
    mapping(uint32 => uint32) public chainToDomain;
    // chainId => our ReceiverV1 address on that chain (bytes32 padded)
    mapping(uint32 => bytes32) public destinationReceivers;
    // chainId => optional CCTP message caller restriction (bytes32 address). bytes32(0) = open relay.
    mapping(uint32 => bytes32) public destinationCallers;

    event BridgeInitiated(
        bytes32 indexed intentId,
        bytes32 railTxId,
        uint32 dstDomain,
        uint256 amount,
        uint256 maxFee,
        uint32 minFinalityThreshold
    );

    error UnsupportedRoute(uint32 dstChainId);
    error UnsupportedRouteToken(address token);
    error ReceiverNotConfigured(uint32 dstChainId);
    error MissingRailData();
    error InvalidFinalityThreshold(uint32 provided, uint32 maximum);
    error MaxFeeTooHigh(uint256 provided, uint256 maximumAllowed);
    error ZeroMaxFee();
    error InvalidMaxFeeBpsCap(uint256 provided);

    constructor(address _tokenMessenger, address _usdc, address _owner) Ownable(_owner) {
        tokenMessenger = _tokenMessenger;
        usdc = _usdc;
    }

    function supportsRoute(uint32 /*srcChainId*/, uint32 dstChainId)
        external view override returns (bool)
    {
        return chainToDomain[dstChainId] != 0 || dstChainId == 1; // ETH mainnet is domain 0
    }

    function estimateFee(
        uint32 dstChainId,
        uint256 /*amount*/,
        address routeToken,
        bytes32 /*routeAssetId*/,
        uint256 /*dstGasLimit*/,
        bytes calldata /*railData*/
    )
        external view override returns (uint256 fee, uint256 eta)
    {
        if (chainToDomain[dstChainId] == 0 && dstChainId != 1) {
            revert UnsupportedRoute(dstChainId);
        }
        if (routeToken != usdc) {
            revert UnsupportedRouteToken(routeToken);
        }
        fee = 0;
        eta = 8; // Fast attestation target is seconds on supported source chains.
    }

    /// @notice Execute CCTP fast burn via TokenMessengerV2.depositForBurn().
    /// @dev Expects railData = abi.encode(uint32 minFinalityThreshold, uint256 maxFee).
    function bridge(IntentTypes.BridgeParams calldata params)
        external payable override returns (bytes32 railTxId)
    {
        uint32 dstDomain = chainToDomain[params.dstChainId];
        bytes32 receiver = destinationReceivers[params.dstChainId];
        if (receiver == bytes32(0)) revert ReceiverNotConfigured(params.dstChainId);
        if (params.routeTokenAddr != usdc) revert UnsupportedRouteToken(params.routeTokenAddr);

        (uint32 minFinalityThreshold, uint256 maxFee) = _decodeRailData(params.railData);
        if (minFinalityThreshold == 0 || minFinalityThreshold > FAST_FINALITY_THRESHOLD_MAX) {
            revert InvalidFinalityThreshold(minFinalityThreshold, FAST_FINALITY_THRESHOLD_MAX);
        }
        if (maxFee == 0) revert ZeroMaxFee();
        if (maxFee > params.amount) revert MaxFeeTooHigh(maxFee, params.amount);

        uint256 maxFeeAllowed = (params.amount * maxFeeBpsCap) / BPS_DENOMINATOR;
        if (maxFee > maxFeeAllowed) revert MaxFeeTooHigh(maxFee, maxFeeAllowed);

        // Pull USDC from RouterV1 (already approved)
        IERC20(usdc).safeTransferFrom(msg.sender, address(this), params.amount);
        IERC20(usdc).forceApprove(tokenMessenger, params.amount);

        bytes32 destinationCaller = destinationCallers[params.dstChainId];

        _submitBurn(
            params,
            dstDomain,
            receiver,
            destinationCaller,
            maxFee,
            minFinalityThreshold
        );

        railTxId = keccak256(
            abi.encodePacked(
                params.intentId,
                dstDomain,
                receiver,
                params.amount,
                maxFee,
                minFinalityThreshold,
                block.chainid,
                block.number
            )
        );
        emit BridgeInitiated(
            params.intentId,
            railTxId,
            dstDomain,
            params.amount,
            maxFee,
            minFinalityThreshold
        );
    }

    function setChainDomain(uint32 chainId, uint32 domain) external onlyOwner {
        chainToDomain[chainId] = domain;
    }

    function setDestinationReceiver(uint32 chainId, bytes32 receiver) external onlyOwner {
        destinationReceivers[chainId] = receiver;
    }

    function setDestinationCaller(uint32 chainId, bytes32 caller) external onlyOwner {
        destinationCallers[chainId] = caller;
    }

    function setMaxFeeBpsCap(uint256 newCapBps) external onlyOwner {
        if (newCapBps == 0 || newCapBps > 1_000) revert InvalidMaxFeeBpsCap(newCapBps);
        maxFeeBpsCap = newCapBps;
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC165, IRailPlugin) returns (bool)
    {
        return interfaceId == type(IRailPlugin).interfaceId || super.supportsInterface(interfaceId);
    }

    function _decodeRailData(bytes calldata railData)
        internal pure returns (uint32 minFinalityThreshold, uint256 maxFee)
    {
        if (railData.length == 0) revert MissingRailData();
        return abi.decode(railData, (uint32, uint256));
    }

    function _submitBurn(
        IntentTypes.BridgeParams calldata params,
        uint32 dstDomain,
        bytes32 receiver,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold
    ) internal {
        if (params.dstCalldata.length > 0) {
            ITokenMessengerV2(tokenMessenger).depositForBurnWithHook(
                params.amount,
                dstDomain,
                receiver,
                usdc,
                destinationCaller,
                maxFee,
                minFinalityThreshold,
                params.dstCalldata
            );
            return;
        }

        ITokenMessengerV2(tokenMessenger).depositForBurn(
            params.amount,
            dstDomain,
            receiver,
            usdc,
            destinationCaller,
            maxFee,
            minFinalityThreshold
        );
    }
}

interface ITokenMessengerV2 {
    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold
    ) external;

    function depositForBurnWithHook(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold,
        bytes calldata hookData
    ) external;
}
