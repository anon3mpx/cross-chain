// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ScriptBase} from "./ScriptBase.sol";

import {PluginRegistry} from "src/contracts/PluginRegistry.sol";
import {RouterV1} from "src/contracts/RouterV1.sol";
import {ReceiverV1} from "src/contracts/ReceiverV1.sol";
import {Paymaster} from "src/contracts/Paymaster.sol";

import {IRailPlugin} from "src/contracts/interfaces/IRailPlugin.sol";
import {ISwapPlugin} from "src/contracts/interfaces/ISwapPlugin.sol";

import {CCTPRailPlugin} from "src/contracts/rails/CCTPRailPlugin.sol";
import {CCTPFastRailPlugin} from "src/contracts/rails/CCTPFastRailPlugin.sol";
import {LayerZeroRailPlugin} from "src/contracts/rails/LayerZeroRailPlugin.sol";
import {LayerZeroReceiverAdapter} from "src/contracts/rails/LayerZeroReceiverAdapter.sol";

/// @notice Post-deployment configuration script.
/// @dev Run this repeatedly as you add routes/chains. Every config block is opt-in by env flag.
contract ConfigureAll is ScriptBase {
    bytes4 private constant LZ_SET_FAMILY_ROUTE_CONFIG_SELECTOR =
        bytes4(keccak256("setFamilyRouteConfig(uint32,uint8,uint32,address,bytes)"));
    bytes4 private constant LZ_SET_FAMILY_ROUTE_CONFIG_WITH_OFT_SELECTOR =
        bytes4(keccak256("setFamilyRouteConfig(uint32,uint8,uint32,address,bytes,address,address)"));
    bytes4 private constant LZ_SET_ROUTE_CONFIG_LEGACY_SELECTOR =
        bytes4(keccak256("setRouteConfig(uint32,uint32,address,bytes)"));
    bytes4 private constant LZ_SET_ROUTE_CONFIG_WITH_OFT_SELECTOR =
        bytes4(keccak256("setRouteConfig(uint32,uint32,address,bytes,address,address)"));

    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPk);

        _configureRegistry();
        _configureReceiver();
        _configureRouter();
        _configurePaymaster();

        _configureCctpRoutes();
        _configureCctpFastRoutes();
        _configureLayerZeroRoutes();

        _configureLayerZeroAdapter();
        _configureLayerZeroOftPeer();

        vm.stopBroadcast();
    }

    function _configureRegistry() internal {
        address registryAddr = vm.envOr("PLUGIN_REGISTRY", address(0));
        if (registryAddr == address(0)) return;

        PluginRegistry registry = PluginRegistry(registryAddr);

        _registerRailIfProvided(registry, vm.envOr("RAIL_PLUGIN_CCTP", address(0)));
        _registerRailIfProvided(registry, vm.envOr("RAIL_PLUGIN_CCTP_FAST", address(0)));
        _registerRailIfProvided(registry, vm.envOr("RAIL_PLUGIN_LAYERZERO", address(0)));

        _registerSwapIfProvided(registry, vm.envOr("SWAP_PLUGIN_EMPSEAL", address(0)));
        _registerSwapIfProvided(registry, vm.envOr("SWAP_PLUGIN_UNIV2", address(0)));
        _registerSwapIfProvided(registry, vm.envOr("SWAP_PLUGIN_UNIV3", address(0)));
    }

    function _configureReceiver() internal {
        address receiverAddr = vm.envOr("RECEIVER_V1", address(0));
        if (receiverAddr == address(0)) return;

        ReceiverV1 receiver = ReceiverV1(receiverAddr);
        _addApprovedCaller(receiver, vm.envOr("RECEIVER_APPROVED_CALLER_1", address(0)));
        _addApprovedCaller(receiver, vm.envOr("RECEIVER_APPROVED_CALLER_2", address(0)));
        _addApprovedCaller(receiver, vm.envOr("RECEIVER_APPROVED_CALLER_3", address(0)));
        _addApprovedCaller(receiver, vm.envOr("RECEIVER_APPROVED_CALLER_4", address(0)));
        _addApprovedCaller(receiver, vm.envOr("RECEIVER_APPROVED_CALLER_5", address(0)));
    }

    function _configureRouter() internal {
        address routerAddr = vm.envAddress("ROUTER_V1");
        if (routerAddr == address(0)) return;

        RouterV1 router = RouterV1(payable(routerAddr));

        if (vm.envOr("ROUTER_SET_FEE_RECIPIENT", false)) {
            address newFeeRecipient = vm.envAddress("ROUTER_NEW_FEE_RECIPIENT");
            _nonZero(newFeeRecipient, "ROUTER_NEW_FEE_RECIPIENT is required");

            router.setFeeRecipient(newFeeRecipient);
            emit ScriptLogAddress("RouterV1.feeRecipient", newFeeRecipient);
        }

        if (vm.envOr("ROUTER_SET_INTENT_SIGNER", false)) {
            address newIntentSigner = vm.envAddress("ROUTER_NEW_INTENT_SIGNER");
            _nonZero(newIntentSigner, "ROUTER_NEW_INTENT_SIGNER is required");

            router.setIntentSigner(newIntentSigner);
            emit ScriptLogAddress("RouterV1.intentSigner", newIntentSigner);
        }
    }

    function _configurePaymaster() internal {
        address paymasterAddr = vm.envOr("PAYMASTER", address(0));
        if (paymasterAddr == address(0)) return;

        Paymaster paymaster = Paymaster(payable(paymasterAddr));

        if (vm.envOr("PAYMASTER_SET_SIGNER", false)) {
            address newSigner = vm.envAddress("PAYMASTER_NEW_SIGNER");
            _nonZero(newSigner, "PAYMASTER_NEW_SIGNER is required");
            paymaster.setSigner(newSigner);
            emit ScriptLogAddress("Paymaster.signer", newSigner);
        }

        if (vm.envOr("PAYMASTER_SET_TOKEN_RATE", false)) {
            address token = vm.envAddress("PAYMASTER_RATE_TOKEN");
            uint256 rate = vm.envUint("PAYMASTER_RATE_VALUE");
            paymaster.setTokenRate(token, rate);
            emit ScriptLogAddress("Paymaster.rateToken", token);
        }
    }

    function _configureCctpRoutes() internal {
        if (!vm.envOr("CCTP_SET_ROUTE", false)) return;

        address cctpAddr = vm.envAddress("CCTP_PLUGIN");
        uint32 dstChainId = uint32(vm.envUint("CCTP_ROUTE_CHAIN_ID"));
        uint32 domain = uint32(vm.envUint("CCTP_ROUTE_DOMAIN"));
        address dstReceiver = vm.envAddress("CCTP_ROUTE_RECEIVER");
        address dstCaller = vm.envOr("CCTP_ROUTE_CALLER", address(0));

        CCTPRailPlugin cctp = CCTPRailPlugin(cctpAddr);
        cctp.setChainDomain(dstChainId, domain);
        cctp.setDestinationReceiver(dstChainId, bytes32(uint256(uint160(dstReceiver))));
        cctp.setDestinationCaller(dstChainId, bytes32(uint256(uint160(dstCaller))));
    }

    function _configureCctpFastRoutes() internal {
        if (!vm.envOr("CCTP_FAST_SET_ROUTE", false)) return;

        address cctpAddr = vm.envAddress("CCTP_FAST_PLUGIN");
        uint32 dstChainId = uint32(vm.envUint("CCTP_FAST_ROUTE_CHAIN_ID"));
        uint32 domain = uint32(vm.envUint("CCTP_FAST_ROUTE_DOMAIN"));
        address dstReceiver = vm.envAddress("CCTP_FAST_ROUTE_RECEIVER");
        address dstCaller = vm.envOr("CCTP_FAST_ROUTE_CALLER", address(0));
        uint256 maxFeeBpsCap = vm.envOr("CCTP_FAST_MAX_FEE_BPS_CAP", uint256(0));

        CCTPFastRailPlugin cctpFast = CCTPFastRailPlugin(cctpAddr);
        cctpFast.setChainDomain(dstChainId, domain);
        cctpFast.setDestinationReceiver(dstChainId, bytes32(uint256(uint160(dstReceiver))));
        cctpFast.setDestinationCaller(dstChainId, bytes32(uint256(uint160(dstCaller))));
        if (maxFeeBpsCap > 0) {
            cctpFast.setMaxFeeBpsCap(maxFeeBpsCap);
        }
    }

    function _configureLayerZeroRoutes() internal {
        if (!vm.envOr("LZ_SET_ROUTE", false)) return;

        address pluginAddr = vm.envAddress("LZ_PLUGIN");
        uint32 dstChainId = uint32(vm.envUint("LZ_ROUTE_CHAIN_ID"));
        uint32 dstEid = uint32(vm.envUint("LZ_ROUTE_EID"));
        address dstReceiver = vm.envAddress("LZ_ROUTE_RECEIVER");
        bytes memory sendOptions = vm.envOr("LZ_ROUTE_OPTIONS", bytes(""));
        string memory familyValue = vm.envOr("LZ_ROUTE_FAMILY", string("lz_oft"));
        uint8 family = _layerZeroFamilyFromValue(familyValue);
        address routeToken = vm.envOr("LZ_ROUTE_TOKEN", address(0));
        address routeOft = vm.envOr("LZ_ROUTE_OFT", address(0));
        bool ok;
        bytes memory reason;

        if (_hasSelector(pluginAddr, LZ_SET_FAMILY_ROUTE_CONFIG_WITH_OFT_SELECTOR)) {
            _nonZero(routeToken, "LZ_ROUTE_TOKEN is required");
            _nonZero(routeOft, "LZ_ROUTE_OFT is required");
            (ok, reason) = pluginAddr.call(
                abi.encodeWithSelector(
                    LZ_SET_FAMILY_ROUTE_CONFIG_WITH_OFT_SELECTOR,
                    dstChainId,
                    family,
                    dstEid,
                    dstReceiver,
                    sendOptions,
                    routeToken,
                    routeOft
                )
            );
            if (!ok) _revertWithReason(reason, "LZ_SET_FAMILY_ROUTE_CONFIG_WITH_OFT_FAILED");
            return;
        }

        if (_hasSelector(pluginAddr, LZ_SET_ROUTE_CONFIG_WITH_OFT_SELECTOR)) {
            _nonZero(routeToken, "LZ_ROUTE_TOKEN is required");
            _nonZero(routeOft, "LZ_ROUTE_OFT is required");
            (ok, reason) = pluginAddr.call(
                abi.encodeWithSelector(
                    LZ_SET_ROUTE_CONFIG_WITH_OFT_SELECTOR,
                    dstChainId,
                    dstEid,
                    dstReceiver,
                    sendOptions,
                    routeOft,
                    routeToken
                )
            );
            if (!ok) _revertWithReason(reason, "LZ_SET_ROUTE_CONFIG_WITH_OFT_FAILED");
            return;
        }

        if (_hasSelector(pluginAddr, LZ_SET_FAMILY_ROUTE_CONFIG_SELECTOR)) {
            (ok, reason) = pluginAddr.call(
                abi.encodeWithSelector(
                    LZ_SET_FAMILY_ROUTE_CONFIG_SELECTOR,
                    dstChainId,
                    family,
                    dstEid,
                    dstReceiver,
                    sendOptions
                )
            );
            if (!ok) _revertWithReason(reason, "LZ_SET_FAMILY_ROUTE_CONFIG_FAILED");
            return;
        }

        (ok, reason) = pluginAddr.call(
            abi.encodeWithSelector(
                LZ_SET_ROUTE_CONFIG_LEGACY_SELECTOR,
                dstChainId,
                dstEid,
                dstReceiver,
                sendOptions
            )
        );
        if (!ok) _revertWithReason(reason, "LZ_SET_ROUTE_CONFIG_LEGACY_FAILED");
    }

    function _configureLayerZeroAdapter() internal {
        bool setTrustedPeer = vm.envOr("LZ_ADAPTER_SET_TRUSTED_PEER", false);
        bool setAsset = vm.envOr("LZ_ADAPTER_SET_ASSET", false);
        if (!setTrustedPeer && !setAsset) return;

        address adapterAddr = vm.envAddress("LZ_ADAPTER");
        LayerZeroReceiverAdapter adapter = LayerZeroReceiverAdapter(adapterAddr);

        if (setTrustedPeer) {
            uint32 srcEid = uint32(vm.envUint("LZ_SOURCE_EID"));

            address srcPeerAddress = vm.envOr("LZ_SOURCE_PEER_ADDRESS", address(0));
            if (srcPeerAddress != address(0)) {
                adapter.setTrustedPeerAddress(srcEid, srcPeerAddress);
            } else {
                bytes32 srcPeer = vm.envBytes32("LZ_SOURCE_PEER");
                adapter.setTrustedPeer(srcEid, srcPeer);
            }
        }

        if (setAsset) {
            uint32 srcEid = uint32(vm.envUint("LZ_SOURCE_EID"));
            address settlementToken = vm.envAddress("LZ_SETTLEMENT_TOKEN");
            address composeSender = vm.envAddress("LZ_COMPOSE_SENDER");
            bytes32 settlementAssetId = _routeAssetId(settlementToken);

            adapter.setSettlementToken(settlementAssetId, settlementToken);
            adapter.setExpectedComposeSender(srcEid, settlementAssetId, composeSender);
        }
    }

    function _configureLayerZeroOftPeer() internal {
        if (!vm.envOr("LZ_OFT_SET_PEER", false)) return;

        address oft = vm.envAddress("LZ_OFT");
        uint32 peerEid = uint32(vm.envUint("LZ_OFT_PEER_EID"));

        address peerAddress = vm.envOr("LZ_OFT_PEER_ADDRESS", address(0));
        if (peerAddress != address(0)) {
            ILayerZeroOFTPeerConfig(oft).setPeer(peerEid, bytes32(uint256(uint160(peerAddress))));
            emit ScriptLogAddress("LZ_OFT_PEER_ADDRESS", peerAddress);
        } else {
            bytes32 peer = vm.envBytes32("LZ_OFT_PEER");
            ILayerZeroOFTPeerConfig(oft).setPeer(peerEid, peer);
            emit ScriptLogBytes32("LZ_OFT_PEER", peer);
        }

        emit ScriptLogAddress("LZ_OFT", oft);
        emit ScriptLogBytes32("LZ_OFT_PEER_EID", bytes32(uint256(peerEid)));
    }

    function _registerRailIfProvided(PluginRegistry registry, address railPlugin) internal {
        if (railPlugin == address(0)) return;

        bytes32 railId = IRailPlugin(railPlugin).railId();
        (address existing,,,) = registry.plugins(railId);
        if (existing == address(0)) {
            registry.registerRailPlugin(railPlugin);
            emit ScriptLogAddress("RegisteredRail", railPlugin);
            emit ScriptLogBytes32("RailId", railId);
        }
    }

    function _registerSwapIfProvided(PluginRegistry registry, address swapPlugin) internal {
        if (swapPlugin == address(0)) return;

        bytes32 pluginId = ISwapPlugin(swapPlugin).pluginId();
        (address existing,,,) = registry.plugins(pluginId);
        if (existing == address(0)) {
            registry.registerSwapPlugin(swapPlugin);
            emit ScriptLogAddress("RegisteredSwap", swapPlugin);
            emit ScriptLogBytes32("SwapId", pluginId);
        }
    }

    function _addApprovedCaller(ReceiverV1 receiver, address caller) internal {
        if (caller == address(0)) return;
        receiver.addApprovedCaller(caller);
        emit ScriptLogAddress("ReceiverApprovedCaller", caller);
    }

    function _routeAssetId(address token) internal view returns (bytes32) {
        _nonZero(token, "route token is required");
        return keccak256(abi.encode(block.chainid, token));
    }

    function _layerZeroFamilyFromValue(string memory family) internal pure returns (uint8) {
        bytes32 familyHash = keccak256(bytes(family));
        if (familyHash == keccak256("lz_oft")) return 0;
        if (familyHash == keccak256("lz_oft_adapter")) return 1;
        if (familyHash == keccak256("lz_stargate_pool")) return 2;
        if (familyHash == keccak256("lz_stargate_oft")) return 3;
        revert("unknown LayerZero family");
    }

    function _revertWithReason(bytes memory revertData, string memory fallbackMessage) internal pure {
        if (revertData.length == 0) revert(fallbackMessage);
        assembly {
            revert(add(revertData, 0x20), mload(revertData))
        }
    }

    function _hasSelector(address target, bytes4 selector) internal view returns (bool) {
        bytes memory code = target.code;
        bytes memory selectorBytes = abi.encodePacked(selector);
        if (code.length < selectorBytes.length) return false;

        unchecked {
            for (uint256 i = 0; i <= code.length - selectorBytes.length; i++) {
                if (
                    code[i] == selectorBytes[0]
                        && code[i + 1] == selectorBytes[1]
                        && code[i + 2] == selectorBytes[2]
                        && code[i + 3] == selectorBytes[3]
                ) {
                    return true;
                }
            }
        }

        return false;
    }
}

interface ILayerZeroOFTPeerConfig {
    function setPeer(uint32 _eid, bytes32 _peer) external;
}
