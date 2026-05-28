// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ScriptBase} from "./ScriptBase.sol";
import {LayerZeroRailPlugin} from "src/contracts/rails/LayerZeroRailPlugin.sol";

/// @notice Deploy only LayerZeroRailPlugin on the active chain.
/// @dev Required env vars:
///      - DEPLOYER_PRIVATE_KEY
///      - OWNER
///      - LZ_ENDPOINT
contract DeployLayerZeroRailPlugin is ScriptBase {
    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address owner = vm.envAddress("OWNER");
        address endpoint = vm.envAddress("LZ_ENDPOINT");

        _nonZero(owner, "OWNER is required");
        _nonZero(endpoint, "LZ_ENDPOINT is required");

        vm.startBroadcast(deployerPk);

        LayerZeroRailPlugin plugin = new LayerZeroRailPlugin(endpoint, owner);
        emit ScriptLogAddress("LayerZeroRailPlugin", address(plugin));
        emit ScriptLogBytes32("LayerZeroRailPlugin.railId", plugin.railId());

        vm.stopBroadcast();
    }
}
