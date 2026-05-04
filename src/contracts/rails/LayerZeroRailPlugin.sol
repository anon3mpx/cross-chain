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

    ILayerZeroEndpointV2 public immutable endpoint;

    struct LzRouteConfig {
        uint32 dstEid;
        address dstReceiver;
        bytes options;
    }

    // EVM chainId => LayerZero endpoint ID (eid)
    mapping(uint32 => uint32) public chainIdToEid;
    // EVM chainId => LayerZeroReceiverAdapter composer on destination
    mapping(uint32 => address) public destinationReceivers;
    // EVM chainId => extra options blob (executor config, gas, etc.)
    mapping(uint32 => bytes) public sendOptionsByChain;
    // EVM chainId + LayerZero route family => route config
    mapping(uint32 => mapping(uint8 => LzRouteConfig)) public routeConfigs;

    event LayerZeroBridgeInitiated(
        bytes32 indexed intentId,
        uint32 indexed dstChainId,
        uint32 dstEid,
        address dstReceiver,
        uint256 amount,
        bytes32 railTxId
    );

    error UnsupportedRoute(uint32 dstChainId);
    error RouteFamilyNotConfigured(uint32 dstChainId, uint8 family);
    error ReceiverNotConfigured(uint32 dstChainId);
    error InsufficientNativeFee(uint256 provided, uint256 required);
    error UnsupportedLzTokenFee(uint256 lzTokenFee);
    error UnexpectedRouteAsset(bytes32 provided, bytes32 expected);
    error MissingRailData();
    error InvalidRouteOft(address routeOft);
    error InvalidRouteToken(address routeToken);

    uint8 public constant FAMILY_OFT = 0;
    uint8 public constant FAMILY_OFT_ADAPTER = 1;
    uint8 public constant FAMILY_STARGATE_POOL = 2;
    uint8 public constant FAMILY_STARGATE_OFT = 3;

    struct DecodedRailData {
        uint8 family;
        address routeOft;
        bytes optionsOverride;
    }

    constructor(
        address _endpoint,
        address _owner
    ) Ownable(_owner) {
        endpoint = ILayerZeroEndpointV2(_endpoint);
    }

    function supportsRoute(uint32 /*srcChainId*/, uint32 dstChainId)
        external
        view
        override
        returns (bool)
    {
        return chainIdToEid[dstChainId] != 0;
    }

    function estimateFee(
        uint32 dstChainId,
        uint256 amount,
        address routeToken,
        bytes32 routeAssetId,
        uint256 /*dstGasLimit*/,
        bytes calldata railData
    )
        external
        view
        override
        returns (uint256 fee, uint256 eta)
    {
        DecodedRailData memory decoded = _decodeRailData(routeToken, railData);
        LzRouteConfig memory route = _resolveRouteConfig(dstChainId, decoded.family, routeToken, routeAssetId);
        uint32 dstEid = route.dstEid;
        address dstReceiver = route.dstReceiver;
        if (dstEid == 0 || decoded.routeOft == address(0) || routeToken == address(0)) {
            revert UnsupportedRoute(dstChainId);
        }
        if (dstReceiver == address(0)) revert ReceiverNotConfigured(dstChainId);

        bytes memory payload = abi.encode(
            bytes32(0),
            address(0),
            address(0),
            uint256(0),
            routeToken,
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
            extraOptions: decoded.optionsOverride.length == 0 ? route.options : decoded.optionsOverride,
            composeMsg: payload,
            oftCmd: bytes("")
        });

        MessagingFee memory mFee = ILayerZeroOFT(decoded.routeOft).quoteSend(sendParam, false);
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
        DecodedRailData memory decoded = _decodeRailData(params.routeTokenAddr, params.railData);
        LzRouteConfig memory route = _resolveRouteConfig(
            params.dstChainId,
            decoded.family,
            params.routeTokenAddr,
            params.routeAssetId
        );
        uint32 dstEid = route.dstEid;
        address dstReceiver = route.dstReceiver;
        address routeOft = decoded.routeOft;
        if (dstEid == 0 || params.routeTokenAddr == address(0) || routeOft == address(0)) {
            revert UnsupportedRoute(params.dstChainId);
        }
        if (dstReceiver == address(0)) revert ReceiverNotConfigured(params.dstChainId);

        bytes memory composePayload = params.dstCalldata;

        SendParam memory sendParam = SendParam({
            dstEid: dstEid,
            to: _addressToBytes32(dstReceiver),
            amountLD: params.amount,
            minAmountLD: params.amount,
            extraOptions: decoded.optionsOverride.length == 0 ? route.options : decoded.optionsOverride,
            composeMsg: composePayload,
            oftCmd: bytes("")
        });

        ILayerZeroOFT routeOftContract = ILayerZeroOFT(routeOft);
        MessagingFee memory feeQuote = routeOftContract.quoteSend(sendParam, false);
        if (feeQuote.lzTokenFee != 0) revert UnsupportedLzTokenFee(feeQuote.lzTokenFee);
        if (msg.value < feeQuote.nativeFee) {
            revert InsufficientNativeFee(msg.value, feeQuote.nativeFee);
        }

        IERC20(params.routeTokenAddr).safeTransferFrom(msg.sender, address(this), params.amount);
        IERC20(params.routeTokenAddr).forceApprove(routeOft, params.amount);

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

    function setFamilyRouteConfig(
        uint32 chainId,
        uint8 family,
        uint32 dstEid,
        address receiver,
        bytes calldata sendOptions
    ) external onlyOwner {
        _storeRouteConfig(
            chainId,
            family,
            dstEid,
            receiver,
            sendOptions
        );
    }

    function setRouteConfig(
        uint32 chainId,
        uint32 dstEid,
        address receiver,
        bytes calldata sendOptions,
        address routeOft,
        address /*routeToken*/
    ) external onlyOwner {
        _storeRouteConfig(
            chainId,
            _familyFromRouteOft(routeOft),
            dstEid,
            receiver,
            sendOptions
        );
    }

    function deriveRouteAssetId(address routeToken) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, routeToken));
    }

    function _storeRouteConfig(
        uint32 chainId,
        uint8 family,
        uint32 dstEid,
        address receiver,
        bytes calldata sendOptions
    ) internal {
        LzRouteConfig memory route = LzRouteConfig({
            dstEid: dstEid,
            dstReceiver: receiver,
            options: sendOptions
        });

        routeConfigs[chainId][family] = route;

        if (chainIdToEid[chainId] == 0 || family == FAMILY_OFT) {
            chainIdToEid[chainId] = dstEid;
            destinationReceivers[chainId] = receiver;
            sendOptionsByChain[chainId] = sendOptions;
        }
    }

    function _resolveRouteConfig(uint32 chainId, uint8 family, address routeToken, bytes32 routeAssetId)
        internal
        view
        returns (LzRouteConfig memory route)
    {
        bytes32 expectedRouteAssetId = deriveRouteAssetId(routeToken);
        if (routeAssetId != expectedRouteAssetId) {
            revert UnexpectedRouteAsset(routeAssetId, expectedRouteAssetId);
        }

        route = routeConfigs[chainId][family];
        if (route.dstEid == 0) {
            revert RouteFamilyNotConfigured(chainId, family);
        }
    }

    function _decodeRailData(address routeToken, bytes calldata railData)
        internal
        pure
        returns (DecodedRailData memory decoded)
    {
        if (railData.length == 0) revert MissingRailData();
        if (routeToken == address(0)) revert InvalidRouteToken(routeToken);

        (decoded.family, decoded.routeOft, decoded.optionsOverride) = abi.decode(
            railData,
            (uint8, address, bytes)
        );
        if (decoded.routeOft == address(0)) revert InvalidRouteOft(decoded.routeOft);
    }

    function _familyFromRouteOft(address routeOft) internal pure returns (uint8) {
        if (routeOft == address(0)) revert InvalidRouteOft(routeOft);
        return FAMILY_OFT;
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
