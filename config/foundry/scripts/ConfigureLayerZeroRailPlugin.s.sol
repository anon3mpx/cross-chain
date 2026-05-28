// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ScriptBase} from "./ScriptBase.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {LayerZeroReceiverAdapter} from "src/contracts/rails/LayerZeroReceiverAdapter.sol";
import {PluginRegistry} from "src/contracts/PluginRegistry.sol";
import {IRailPlugin} from "src/contracts/interfaces/IRailPlugin.sol";

/// @notice Configure an already-deployed LayerZero rail plugin on the active chain.
/// @dev Required env vars:
///      - DEPLOYER_PRIVATE_KEY
///      - LZ_PLUGIN
///
/// Optional env vars:
///      - PLUGIN_REGISTRY
///      - LZ_ROUTE_COUNT
///      - LZ_ROUTE_<n>_CHAIN_ID
///      - LZ_ROUTE_<n>_EID
///      - LZ_ROUTE_<n>_RECEIVER
///      - LZ_ROUTE_<n>_OPTIONS
///      - LZ_ROUTE_<n>_FAMILY
///      - LZ_ROUTE_<n>_TOKEN
///      - LZ_ROUTE_<n>_OFT
///      - LZ_ADAPTER
///      - LZ_TRUSTED_PEER_COUNT
///      - LZ_TRUSTED_PEER_<n>_SOURCE_EID
///      - LZ_TRUSTED_PEER_<n>_SOURCE_PEER_ADDRESS
///      - LZ_ASSET_COUNT
///      - LZ_ASSET_<n>_SOURCE_EID
///      - LZ_ASSET_<n>_SETTLEMENT_TOKEN
///      - LZ_ASSET_<n>_COMPOSE_SENDER
contract ConfigureLayerZeroRailPlugin is ScriptBase {
    bytes4 private constant LZ_SET_FAMILY_ROUTE_CONFIG_WITH_OFT_SELECTOR =
        bytes4(keccak256("setFamilyRouteConfig(uint32,uint8,uint32,address,bytes,address,address)"));

    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address pluginAddr = vm.envAddress("LZ_PLUGIN");
        address registryAddr = vm.envOr("PLUGIN_REGISTRY", address(0));
        uint256 routeCount = vm.envOr("LZ_ROUTE_COUNT", uint256(0));
        address adapterAddr = vm.envOr("LZ_ADAPTER", address(0));
        uint256 trustedPeerCount = vm.envOr("LZ_TRUSTED_PEER_COUNT", uint256(0));
        uint256 assetCount = vm.envOr("LZ_ASSET_COUNT", uint256(0));

        _nonZero(pluginAddr, "LZ_PLUGIN is required");

        vm.startBroadcast(deployerPk);

        if (registryAddr != address(0)) {
            PluginRegistry registry = PluginRegistry(registryAddr);
            _registerRailPlugin(registry, pluginAddr);
        }

        for (uint256 i = 1; i <= routeCount; i++) {
            _configureRoute(pluginAddr, i);
        }

        if (adapterAddr != address(0)) {
            LayerZeroReceiverAdapter adapter = LayerZeroReceiverAdapter(adapterAddr);

            for (uint256 i = 1; i <= trustedPeerCount; i++) {
                _configureTrustedPeer(adapter, i);
            }

            for (uint256 i = 1; i <= assetCount; i++) {
                _configureAsset(adapter, i);
            }
        }

        vm.stopBroadcast();
    }

    function _registerRailPlugin(PluginRegistry registry, address railPlugin) internal {
        bytes32 railId = IRailPlugin(railPlugin).railId();
        (address existing,,,) = registry.plugins(railId);
        if (existing == address(0)) {
            registry.registerRailPlugin(railPlugin);
            emit ScriptLogAddress("RegisteredRail", railPlugin);
            emit ScriptLogBytes32("RailId", railId);
        }
    }

    function _configureRoute(address pluginAddr, uint256 index) internal {
        uint32 dstChainId = uint32(vm.envUint(_key("LZ_ROUTE", index, "CHAIN_ID")));
        uint32 dstEid = uint32(vm.envUint(_key("LZ_ROUTE", index, "EID")));
        address dstReceiver = vm.envAddress(_key("LZ_ROUTE", index, "RECEIVER"));
        bytes memory sendOptions = vm.envOr(_key("LZ_ROUTE", index, "OPTIONS"), bytes(""));
        string memory familyValue = vm.envOr(_key("LZ_ROUTE", index, "FAMILY"), string("lz_oft"));
        address routeToken = vm.envAddress(_key("LZ_ROUTE", index, "TOKEN"));
        address routeOft = vm.envAddress(_key("LZ_ROUTE", index, "OFT"));
        uint8 family = _layerZeroFamilyFromValue(familyValue);

        (bool ok, bytes memory reason) = pluginAddr.call(
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
        if (!ok) _revertWithReason(reason, "LZ_ROUTE_CONFIG_FAILED");

        emit ScriptLogBytes32(_label("LZ_ROUTE_CHAIN_ID", index), bytes32(uint256(dstChainId)));
        emit ScriptLogBytes32(_label("LZ_ROUTE_EID", index), bytes32(uint256(dstEid)));
        emit ScriptLogAddress(_label("LZ_ROUTE_RECEIVER", index), dstReceiver);
        emit ScriptLogAddress(_label("LZ_ROUTE_TOKEN", index), routeToken);
        emit ScriptLogAddress(_label("LZ_ROUTE_OFT", index), routeOft);
    }

    function _configureTrustedPeer(LayerZeroReceiverAdapter adapter, uint256 index) internal {
        uint32 srcEid = uint32(vm.envUint(_key("LZ_TRUSTED_PEER", index, "SOURCE_EID")));
        address srcPeerAddress = vm.envAddress(_key("LZ_TRUSTED_PEER", index, "SOURCE_PEER_ADDRESS"));
        adapter.setTrustedPeerAddress(srcEid, srcPeerAddress);

        emit ScriptLogBytes32(_label("LZ_SOURCE_EID", index), bytes32(uint256(srcEid)));
        emit ScriptLogAddress(_label("LZ_SOURCE_PEER_ADDRESS", index), srcPeerAddress);
    }

    function _configureAsset(LayerZeroReceiverAdapter adapter, uint256 index) internal {
        uint32 srcEid = uint32(vm.envUint(_key("LZ_ASSET", index, "SOURCE_EID")));
        address settlementToken = vm.envAddress(_key("LZ_ASSET", index, "SETTLEMENT_TOKEN"));
        address composeSender = vm.envAddress(_key("LZ_ASSET", index, "COMPOSE_SENDER"));
        bytes32 settlementAssetId = keccak256(abi.encode(block.chainid, settlementToken));

        adapter.setSettlementToken(settlementAssetId, settlementToken);
        adapter.setExpectedComposeSender(srcEid, settlementAssetId, composeSender);

        emit ScriptLogBytes32(_label("LZ_ASSET_SOURCE_EID", index), bytes32(uint256(srcEid)));
        emit ScriptLogAddress(_label("LZ_SETTLEMENT_TOKEN", index), settlementToken);
        emit ScriptLogAddress(_label("LZ_COMPOSE_SENDER", index), composeSender);
        emit ScriptLogBytes32(_label("LZ_SETTLEMENT_ASSET_ID", index), settlementAssetId);
    }

    function _layerZeroFamilyFromValue(string memory family) internal pure returns (uint8) {
        bytes32 familyHash = keccak256(bytes(family));
        if (familyHash == keccak256("lz_oft")) return 0;
        if (familyHash == keccak256("lz_oft_adapter")) return 1;
        if (familyHash == keccak256("lz_stargate_pool")) return 2;
        if (familyHash == keccak256("lz_stargate_oft")) return 3;
        revert("unknown LayerZero family");
    }

    function _key(string memory prefix, uint256 index, string memory suffix) internal pure returns (string memory) {
        return string.concat(prefix, "_", Strings.toString(index), "_", suffix);
    }

    function _label(string memory prefix, uint256 index) internal pure returns (string memory) {
        return string.concat(prefix, "_", Strings.toString(index));
    }

    function _revertWithReason(bytes memory revertData, string memory fallbackMessage) internal pure {
        if (revertData.length == 0) revert(fallbackMessage);
        assembly {
            revert(add(revertData, 0x20), mload(revertData))
        }
    }
}
