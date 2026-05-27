// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ScriptBase} from "./ScriptBase.sol";
import {PluginRegistry} from "src/contracts/PluginRegistry.sol";
import {EmpsealSwapPluginV2} from "src/contracts/plugins/EmpsealSwapPluginV2.sol";

/// @notice Deploys EmpsealSwapPluginV2 on the current RPC chain and registers it in PluginRegistry.
/// @dev Chain-scoped env keys are supported with suffix: <KEY>_<CHAIN_ID>
///      Example: EMPSEAL_ROUTER_8453, PLUGIN_REGISTRY_10
///
/// Required:
/// - DEPLOYER_PRIVATE_KEY
/// - EMPSEAL_ROUTER or EMPSEAL_ROUTER_<chainId>
/// - OWNER or OWNER_<chainId>
/// - PLUGIN_REGISTRY or PLUGIN_REGISTRY_<chainId>
contract DeployEmpsealSwapPluginV2 is ScriptBase {
    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 chainId = block.chainid;

        address empsealRouter = _envAddressByChain("EMPSEAL_ROUTER", chainId, address(0));
        address owner = _envAddressByChain("OWNER", chainId, address(0));
        address registryAddr = _envAddressByChain("PLUGIN_REGISTRY", chainId, address(0));

        _nonZero(empsealRouter, "EMPSEAL_ROUTER is required");
        _nonZero(owner, "OWNER is required");
        _nonZero(registryAddr, "PLUGIN_REGISTRY is required");

        PluginRegistry registry = PluginRegistry(registryAddr);
        bytes32 pluginId = keccak256("EMPSEAL_V2");
        (address existing,,,) = registry.plugins(pluginId);
        require(existing == address(0), "EMPSEAL_V2 already registered");

        vm.startBroadcast(deployerPk);

        EmpsealSwapPluginV2 plugin = new EmpsealSwapPluginV2(empsealRouter, owner);
        registry.registerSwapPlugin(address(plugin));

        vm.stopBroadcast();

        emit ScriptLogAddress("EmpsealSwapPluginV2", address(plugin));
        emit ScriptLogAddress("EMPSEAL_ROUTER", empsealRouter);
        emit ScriptLogAddress("PLUGIN_REGISTRY", registryAddr);
        emit ScriptLogAddress("OWNER", owner);
        emit ScriptLogBytes32("SwapId", pluginId);
    }

    function _envAddressByChain(string memory key, uint256 chainId, address fallbackValue)
        internal
        returns (address)
    {
        return vm.envOr(_scopedKey(key, chainId), vm.envOr(key, fallbackValue));
    }

    function _scopedKey(string memory key, uint256 chainId) internal pure returns (string memory) {
        return string(abi.encodePacked(key, "_", _uintToString(chainId)));
    }

    function _uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";

        uint256 digits;
        uint256 tmp = value;
        while (tmp != 0) {
            digits++;
            tmp /= 10;
        }

        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            // forge-lint: disable-next-line(unsafe-typecast)
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
