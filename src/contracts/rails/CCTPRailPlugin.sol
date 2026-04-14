// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "../interfaces/IRailPlugin.sol";
import "../interfaces/IIntentTypes.sol";

/// @title CCTPRailPlugin — CCTP V2 rail implementation
/// @notice Bridges USDC natively via Circle's burn/mint mechanism.
///         Zero bridge fee — only gas cost on source chain.
contract CCTPRailPlugin is IRailPlugin, ERC165, Ownable2Step {
    using SafeERC20 for IERC20;

    bytes32 public constant override railId = keccak256("CCTP_V2");
    uint32 public constant FINALITY_THRESHOLD_FINALIZED = 2000;

    // Circle CCTP contracts
    address public immutable tokenMessenger;   // Circle TokenMessenger
    address public immutable usdc;             // Native USDC on this chain

    // chainId => CCTP domain (Circle's internal domain numbering)
    mapping(uint32 => uint32) public chainToDomain;
    // chainId => our ReceiverV1 address on that chain (bytes32 padded)
    mapping(uint32 => bytes32) public destinationReceivers;

    // CCTP domains (Circle's fixed assignment)
    uint32 public constant DOMAIN_ETH      = 0;
    uint32 public constant DOMAIN_AVAX     = 1;
    uint32 public constant DOMAIN_OP       = 2;
    uint32 public constant DOMAIN_ARB      = 3;
    uint32 public constant DOMAIN_BASE     = 6;
    uint32 public constant DOMAIN_POLYGON  = 7;

    event BridgeInitiated(bytes32 indexed intentId, bytes32 railTxId, uint32 dstDomain, uint256 amount);

    error UnsupportedRoute(uint32 dstChainId);
    error UnsupportedSettlementToken(uint8 token);
    error ReceiverNotConfigured(uint32 dstChainId);

    constructor(address _tokenMessenger, address _usdc, address _owner) Ownable(_owner) {
        tokenMessenger = _tokenMessenger;
        usdc = _usdc;
    }

    function supportsRoute(uint32 /*srcChainId*/, uint32 dstChainId)
        external view override returns (bool)
    {
        return chainToDomain[dstChainId] != 0 || dstChainId == 1; // ETH mainnet is domain 0
    }

    function settlementTokenAddress(uint8 settlementToken)
        external view override returns (address)
    {
        if (settlementToken != uint8(IntentTypes.SettlementToken.USDC))
            revert UnsupportedSettlementToken(settlementToken);
        return usdc;
    }

    function supportsSettlementToken(uint8 settlementToken)
        external pure override returns (bool)
    {
        return settlementToken == uint8(IntentTypes.SettlementToken.USDC);
    }

    function estimateFee(uint32 dstChainId, uint256 /*amount*/, uint8 /*settlementToken*/)
        external view override returns (uint256 fee, uint256 eta)
    {
        if (chainToDomain[dstChainId] == 0 && dstChainId != 1)
            revert UnsupportedRoute(dstChainId);
        fee = 0;        // CCTP is free
        eta = dstChainId == 1 ? 780 : 25; // ETH mainnet ~13min, others ~25s
    }

    /// @notice Execute CCTP burn via TokenMessengerV2.depositForBurn().
    ///         ReceiverV1 on destination handles mint+execute flow via Circle attestation relay.
    function bridge(IntentTypes.BridgeParams calldata params)
        external payable override returns (bytes32 railTxId)
    {
        uint32 dstDomain = chainToDomain[params.dstChainId];
        bytes32 receiver = destinationReceivers[params.dstChainId];
        if (receiver == bytes32(0)) revert ReceiverNotConfigured(params.dstChainId);

        // Pull USDC from RouterV1 (already approved)
        IERC20(usdc).safeTransferFrom(msg.sender, address(this), params.amount);
        IERC20(usdc).forceApprove(tokenMessenger, params.amount);

        // Burn USDC via CCTP V2 TokenMessenger.
        // For finalized transfers, maxFee is zero and finality threshold is FINALIZED.
        ITokenMessengerV2(tokenMessenger).depositForBurn(
            params.amount,
            dstDomain,
            receiver,
            usdc,
            receiver, // destinationCaller: only our contract can complete the mint
            0,        // maxFee
            FINALITY_THRESHOLD_FINALIZED
        );

        // TokenMessengerV2.depositForBurn has no nonce return value.
        // Use a deterministic local tracking id for observability.
        railTxId = keccak256(
            abi.encodePacked(
                params.intentId,
                dstDomain,
                receiver,
                params.amount,
                block.chainid,
                block.number
            )
        );
        emit BridgeInitiated(params.intentId, railTxId, dstDomain, params.amount);
    }

    // --- Admin (onlyOwner) ---
    function setChainDomain(uint32 chainId, uint32 domain) external onlyOwner {
        chainToDomain[chainId] = domain;
    }
    function setDestinationReceiver(uint32 chainId, bytes32 receiver) external onlyOwner {
        destinationReceivers[chainId] = receiver;
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC165, IRailPlugin) returns (bool)
    {
        return interfaceId == type(IRailPlugin).interfaceId || super.supportsInterface(interfaceId);
    }
}

// Minimal interface for Circle TokenMessengerV2
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
}
