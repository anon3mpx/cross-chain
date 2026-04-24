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
    bytes32 internal constant LEGACY_ROUTE_ASSET_ID = bytes32(0);

    address public immutable usdc;
    ILayerZeroEndpointV2 public immutable endpoint;
    ILayerZeroOFT public immutable oft;

    struct LzRouteConfig {
        uint32 dstEid;
        address dstReceiver;
        bytes options;
        address oft;
        address settlementToken;
    }

    // EVM chainId => LayerZero endpoint ID (eid)
    mapping(uint32 => uint32) public chainIdToEid;
    // EVM chainId => LayerZeroReceiverAdapter composer on destination
    mapping(uint32 => address) public destinationReceivers;
    // EVM chainId => extra options blob (executor config, gas, etc.)
    mapping(uint32 => bytes) public sendOptionsByChain;
    // EVM chainId + source settlement asset identifier => route config
    mapping(uint32 => mapping(bytes32 => LzRouteConfig)) public routeConfigs;
    // Settlement token enum => source token address on this chain
    mapping(uint8 => address) public settlementTokens;

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
    error SettlementTokenMismatch(address provided, address expected);
    error InsufficientNativeFee(uint256 provided, uint256 required);
    error UnsupportedLzTokenFee(uint256 lzTokenFee);

    constructor(
        address _usdc,
        address _endpoint,
        address _oft,
        address _owner
    ) Ownable(_owner) {
        usdc = _usdc;
        endpoint = ILayerZeroEndpointV2(_endpoint);
        oft = ILayerZeroOFT(_oft);
        settlementTokens[uint8(IntentTypes.SettlementToken.USDC)] = _usdc;
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
        address token = settlementTokens[settlementToken];
        if (token == address(0)) {
            revert UnsupportedSettlementToken(settlementToken);
        }
        return token;
    }

    function supportsSettlementToken(uint8 settlementToken)
        external
        view
        override
        returns (bool)
    {
        return settlementTokens[settlementToken] != address(0);
    }

    function estimateFee(uint32 dstChainId, uint256 amount, uint8 settlementToken)
        external
        view
        override
        returns (uint256 fee, uint256 eta)
    {
        address settlementTokenAddr = settlementTokens[settlementToken];
        if (settlementTokenAddr == address(0)) {
            revert UnsupportedSettlementToken(settlementToken);
        }

        LzRouteConfig memory route = _resolveRouteConfig(
            dstChainId,
            _settlementAssetId(block.chainid, settlementTokenAddr)
        );
        uint32 dstEid = route.dstEid;
        address dstReceiver = route.dstReceiver;
        if (dstEid == 0 || route.oft == address(0) || route.settlementToken == address(0)) {
            revert UnsupportedRoute(dstChainId);
        }
        if (route.settlementToken != settlementTokenAddr) {
            revert UnsupportedRoute(dstChainId);
        }
        if (dstReceiver == address(0)) revert ReceiverNotConfigured(dstChainId);

        bytes memory payload = abi.encode(
            bytes32(0),
            address(0),
            address(0),
            uint256(0),
            settlementTokenAddr,
            bytes32(0),
            uint256(0),
            bytes(""),
            bytes32(0)
        );
        SendParam memory sendParam = SendParam({
            dstEid: dstEid,
            to: _addressToBytes32(dstReceiver),
            amountLD: amount,
            minAmountLD: amount,
            extraOptions: route.options,
            composeMsg: payload,
            oftCmd: bytes("")
        });

        MessagingFee memory mFee = ILayerZeroOFT(route.oft).quoteSend(sendParam, false);
        if (mFee.lzTokenFee != 0) revert UnsupportedLzTokenFee(mFee.lzTokenFee);
        fee = mFee.nativeFee;
        eta = 120;
    }

    function bridge(IntentTypes.BridgeParams calldata params)
        external
        payable
        override
        returns (bytes32 railTxId)
    {
        LzRouteConfig memory route = _resolveRouteConfig(params.dstChainId, params.settlementAssetId);
        uint32 dstEid = route.dstEid;
        address dstReceiver = route.dstReceiver;
        address routeSettlementToken = route.settlementToken;
        address routeOft = route.oft;
        if (dstEid == 0 || routeSettlementToken == address(0) || routeOft == address(0)) {
            revert UnsupportedRoute(params.dstChainId);
        }
        if (dstReceiver == address(0)) revert ReceiverNotConfigured(params.dstChainId);
        if (params.settlementTokenAddr != routeSettlementToken) {
            revert SettlementTokenMismatch(params.settlementTokenAddr, routeSettlementToken);
        }

        bytes memory composePayload = params.dstCalldata;

        SendParam memory sendParam = SendParam({
            dstEid: dstEid,
            to: _addressToBytes32(dstReceiver),
            amountLD: params.amount,
            minAmountLD: params.amount,
            extraOptions: route.options,
            composeMsg: composePayload,
            oftCmd: bytes("")
        });

        ILayerZeroOFT routeOftContract = ILayerZeroOFT(routeOft);
        MessagingFee memory feeQuote = routeOftContract.quoteSend(sendParam, false);
        if (feeQuote.lzTokenFee != 0) revert UnsupportedLzTokenFee(feeQuote.lzTokenFee);
        if (msg.value < feeQuote.nativeFee) {
            revert InsufficientNativeFee(msg.value, feeQuote.nativeFee);
        }

        IERC20(routeSettlementToken).safeTransferFrom(msg.sender, address(this), params.amount);
        IERC20(routeSettlementToken).forceApprove(routeOft, params.amount);

        routeOftContract.send{value: feeQuote.nativeFee}(
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
        _storeRouteConfig(
            chainId,
            LEGACY_ROUTE_ASSET_ID,
            dstEid,
            receiver,
            sendOptions,
            address(oft),
            usdc
        );
    }

    function setRouteConfig(
        uint32 chainId,
        bytes32 settlementAssetId,
        uint32 dstEid,
        address receiver,
        bytes calldata sendOptions,
        address routeOft,
        address routeSettlementToken
    ) external onlyOwner {
        _storeRouteConfig(
            chainId,
            settlementAssetId,
            dstEid,
            receiver,
            sendOptions,
            routeOft,
            routeSettlementToken
        );
    }

    function setSettlementTokenAddress(uint8 settlementToken, address token) external onlyOwner {
        settlementTokens[settlementToken] = token;
    }

    function _storeRouteConfig(
        uint32 chainId,
        bytes32 settlementAssetId,
        uint32 dstEid,
        address receiver,
        bytes calldata sendOptions,
        address routeOft,
        address routeSettlementToken
    ) internal {
        routeConfigs[chainId][settlementAssetId] = LzRouteConfig({
            dstEid: dstEid,
            dstReceiver: receiver,
            options: sendOptions,
            oft: routeOft,
            settlementToken: routeSettlementToken
        });

        if (settlementAssetId == LEGACY_ROUTE_ASSET_ID || chainIdToEid[chainId] == 0) {
            chainIdToEid[chainId] = dstEid;
            destinationReceivers[chainId] = receiver;
            sendOptionsByChain[chainId] = sendOptions;
        }
    }

    function _resolveRouteConfig(uint32 chainId, bytes32 settlementAssetId)
        internal
        view
        returns (LzRouteConfig memory route)
    {
        route = routeConfigs[chainId][settlementAssetId];
        if (route.dstEid == 0) {
            route = routeConfigs[chainId][LEGACY_ROUTE_ASSET_ID];
        }
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

    function _settlementAssetId(uint256 chainId, address token) internal pure returns (bytes32) {
        return keccak256(abi.encode(chainId, token));
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
    ) external payable returns (MessagingReceipt memory receipt, OFTReceipt memory oftReceipt);
}

struct MessagingReceipt {
    bytes32 guid;
    uint64 nonce;
    MessagingFee fee;
}

struct OFTReceipt {
    uint256 amountSentLD;
    uint256 amountReceivedLD;
}
