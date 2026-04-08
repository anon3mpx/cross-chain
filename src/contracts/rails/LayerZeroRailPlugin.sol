// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "../interfaces/IRailPlugin.sol";
import "../interfaces/IIntentTypes.sol";

/// @title LayerZeroRailPlugin
/// @notice Messaging rail plugin using LayerZero OFT send flow.
contract LayerZeroRailPlugin is IRailPlugin, ERC165, Ownable2Step {
    using SafeERC20 for IERC20;

    bytes32 public constant override railId = keccak256("LZ_V2");

    address public immutable usdc;
    ILayerZeroEndpointV2 public immutable endpoint;
    ILayerZeroOFT public immutable oft;

    // EVM chainId => LayerZero endpoint ID (eid)
    mapping(uint32 => uint32) public chainIdToEid;
    // EVM chainId => ReceiverV1 on destination
    mapping(uint32 => address) public destinationReceivers;
    // EVM chainId => extra options blob (executor config, gas, etc.)
    mapping(uint32 => bytes) public sendOptionsByChain;

    event LayerZeroBridgeInitiated(
        bytes32 indexed intentId,
        uint32 indexed dstChainId,
        uint32 dstEid,
        address dstReceiver,
        uint256 amount,
        bytes32 railTxId
    );

    error UnsupportedSettlementToken(uint8 token);
    error UnsupportedRoute(uint32 dstChainId);
    error ReceiverNotConfigured(uint32 dstChainId);
    error InsufficientNativeFee(uint256 provided, uint256 required);

    constructor(
        address _usdc,
        address _endpoint,
        address _oft,
        address _owner
    ) Ownable(_owner) {
        usdc = _usdc;
        endpoint = ILayerZeroEndpointV2(_endpoint);
        oft = ILayerZeroOFT(_oft);
    }

    function supportsRoute(uint32 /*srcChainId*/, uint32 dstChainId)
        external
        view
        override
        returns (bool)
    {
        return chainIdToEid[dstChainId] != 0;
    }

    function settlementTokenAddress(uint8 settlementToken)
        external
        view
        override
        returns (address)
    {
        if (settlementToken != uint8(IntentTypes.SettlementToken.USDC)) {
            revert UnsupportedSettlementToken(settlementToken);
        }
        return usdc;
    }

    function supportsSettlementToken(uint8 settlementToken)
        external
        pure
        override
        returns (bool)
    {
        return settlementToken == uint8(IntentTypes.SettlementToken.USDC);
    }

    function estimateFee(uint32 dstChainId, uint256 amount, uint8 /*settlementToken*/)
        external
        view
        override
        returns (uint256 fee, uint256 eta)
    {
        uint32 dstEid = chainIdToEid[dstChainId];
        if (dstEid == 0) revert UnsupportedRoute(dstChainId);

        bytes memory payload = abi.encode(bytes32(0), bytes(""));
        SendParam memory sendParam = SendParam({
            dstEid: dstEid,
            to: bytes32(0),
            amountLD: amount,
            minAmountLD: amount,
            extraOptions: sendOptionsByChain[dstChainId],
            composeMsg: payload,
            oftCmd: bytes("")
        });

        MessagingFee memory mFee = oft.quoteSend(sendParam, false);
        fee = mFee.nativeFee;
        eta = 120;
    }

    function bridge(IntentTypes.BridgeParams calldata params)
        external
        payable
        override
        returns (bytes32 railTxId)
    {
        uint32 dstEid = chainIdToEid[params.dstChainId];
        address dstReceiver = destinationReceivers[params.dstChainId];
        if (dstEid == 0) revert UnsupportedRoute(params.dstChainId);
        if (dstReceiver == address(0)) revert ReceiverNotConfigured(params.dstChainId);

        bytes memory composePayload = abi.encode(params.intentId, params.dstCalldata);

        SendParam memory sendParam = SendParam({
            dstEid: dstEid,
            to: _addressToBytes32(dstReceiver),
            amountLD: params.amount,
            minAmountLD: params.amount,
            extraOptions: sendOptionsByChain[params.dstChainId],
            composeMsg: composePayload,
            oftCmd: bytes("")
        });

        MessagingFee memory feeQuote = oft.quoteSend(sendParam, false);
        if (msg.value < feeQuote.nativeFee) {
            revert InsufficientNativeFee(msg.value, feeQuote.nativeFee);
        }

        IERC20(usdc).safeTransferFrom(msg.sender, address(this), params.amount);
        IERC20(usdc).forceApprove(address(oft), params.amount);

        oft.send{value: feeQuote.nativeFee}(
            sendParam,
            feeQuote,
            payable(msg.sender)
        );

        if (msg.value > feeQuote.nativeFee) {
            (bool ok, ) = payable(msg.sender).call{value: msg.value - feeQuote.nativeFee}("");
            require(ok, "LZ_REFUND_FAILED");
        }

        railTxId = keccak256(
            abi.encodePacked(
                params.intentId,
                params.dstChainId,
                dstEid,
                params.amount,
                block.chainid,
                block.number
            )
        );

        emit LayerZeroBridgeInitiated(
            params.intentId,
            params.dstChainId,
            dstEid,
            dstReceiver,
            params.amount,
            railTxId
        );
    }

    function setRouteConfig(
        uint32 chainId,
        uint32 dstEid,
        address receiver,
        bytes calldata sendOptions
    ) external onlyOwner {
        chainIdToEid[chainId] = dstEid;
        destinationReceivers[chainId] = receiver;
        sendOptionsByChain[chainId] = sendOptions;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC165, IRailPlugin)
        returns (bool)
    {
        return interfaceId == type(IRailPlugin).interfaceId || super.supportsInterface(interfaceId);
    }

    function _addressToBytes32(address a) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(a)));
    }
}

struct SendParam {
    uint32 dstEid;
    bytes32 to;
    uint256 amountLD;
    uint256 minAmountLD;
    bytes extraOptions;
    bytes composeMsg;
    bytes oftCmd;
}

struct MessagingFee {
    uint256 nativeFee;
    uint256 lzTokenFee;
}

interface ILayerZeroEndpointV2 {}

interface ILayerZeroOFT {
    function quoteSend(
        SendParam calldata _sendParam,
        bool _payInLzToken
    ) external view returns (MessagingFee memory fee);

    function send(
        SendParam calldata _sendParam,
        MessagingFee calldata _fee,
        address payable _refundAddress
    ) external payable returns (bytes32 guid);
}
