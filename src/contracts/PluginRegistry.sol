// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "./interfaces/IRailPlugin.sol";
import "./interfaces/ISwapPlugin.sol";

/// @title PluginRegistry — On-chain registry of approved rail and swap plugins
/// @notice Only the owner (multisig) can register or deactivate plugins.
///         RouterV1 queries this registry before executing any plugin call.
contract PluginRegistry is Ownable2Step {

    enum PluginType { Rail, Swap }

    struct PluginEntry {
        address plugin;
        PluginType pluginType;
        bool active;
        uint256 registeredAt;
    }

    // pluginId => PluginEntry
    mapping(bytes32 => PluginEntry) public plugins;
    bytes32[] public railPluginIds;
    bytes32[] public swapPluginIds;

    // Interface IDs for EIP-165 validation
    bytes4 private constant RAIL_INTERFACE_ID  = type(IRailPlugin).interfaceId;
    bytes4 private constant SWAP_INTERFACE_ID  = type(ISwapPlugin).interfaceId;

    event PluginRegistered(bytes32 indexed pluginId, address plugin, PluginType pluginType);
    event PluginDeactivated(bytes32 indexed pluginId);
    event PluginReactivated(bytes32 indexed pluginId);

    error InvalidInterface(address plugin);
    error PluginAlreadyRegistered(bytes32 pluginId);
    error PluginNotFound(bytes32 pluginId);
    error PluginNotActive(bytes32 pluginId);

    constructor(address _owner) Ownable(_owner) {}

    /// @notice Register a new rail plugin. Validates EIP-165 interface compliance.
    function registerRailPlugin(address plugin) external onlyOwner {
        if (!ERC165Checker.supportsInterface(plugin, RAIL_INTERFACE_ID))
            revert InvalidInterface(plugin);

        bytes32 id = IRailPlugin(plugin).railId();
        if (plugins[id].plugin != address(0)) revert PluginAlreadyRegistered(id);

        plugins[id] = PluginEntry(plugin, PluginType.Rail, true, block.timestamp);
        railPluginIds.push(id);
        emit PluginRegistered(id, plugin, PluginType.Rail);
    }

    /// @notice Register a new swap plugin.
    function registerSwapPlugin(address plugin) external onlyOwner {
        if (!ERC165Checker.supportsInterface(plugin, SWAP_INTERFACE_ID))
            revert InvalidInterface(plugin);

        bytes32 id = ISwapPlugin(plugin).pluginId();
        if (plugins[id].plugin != address(0)) revert PluginAlreadyRegistered(id);

        plugins[id] = PluginEntry(plugin, PluginType.Swap, true, block.timestamp);
        swapPluginIds.push(id);
        emit PluginRegistered(id, plugin, PluginType.Swap);
    }

    function deactivatePlugin(bytes32 pluginId) external onlyOwner {
        if (plugins[pluginId].plugin == address(0)) revert PluginNotFound(pluginId);
        plugins[pluginId].active = false;
        emit PluginDeactivated(pluginId);
    }

    function reactivatePlugin(bytes32 pluginId) external onlyOwner {
        if (plugins[pluginId].plugin == address(0)) revert PluginNotFound(pluginId);
        plugins[pluginId].active = true;
        emit PluginReactivated(pluginId);
    }

    /// @notice Get an active rail plugin. Reverts if not found or inactive.
    function getRailPlugin(bytes32 pluginId) external view returns (IRailPlugin) {
        PluginEntry storage e = plugins[pluginId];
        if (e.plugin == address(0)) revert PluginNotFound(pluginId);
        if (!e.active) revert PluginNotActive(pluginId);
        return IRailPlugin(e.plugin);
    }

    /// @notice Get an active swap plugin.
    function getSwapPlugin(bytes32 pluginId) external view returns (ISwapPlugin) {
        PluginEntry storage e = plugins[pluginId];
        if (e.plugin == address(0)) revert PluginNotFound(pluginId);
        if (!e.active) revert PluginNotActive(pluginId);
        return ISwapPlugin(e.plugin);
    }

    function getRailPluginIds() external view returns (bytes32[] memory) { return railPluginIds; }
    function getSwapPluginIds() external view returns (bytes32[] memory) { return swapPluginIds; }
}
