// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface Vm {
    function envUint(string calldata key) external returns (uint256 value);
    function envAddress(string calldata key) external returns (address value);
    function envBytes32(string calldata key) external returns (bytes32 value);
    function envString(string calldata key) external returns (string memory value);
    function envBytes(string calldata key) external returns (bytes memory value);

    function envOr(string calldata key, bool defaultValue) external returns (bool value);
    function envOr(string calldata key, uint256 defaultValue) external returns (uint256 value);
    function envOr(string calldata key, address defaultValue) external returns (address value);
    function envOr(string calldata key, bytes32 defaultValue) external returns (bytes32 value);
    function envOr(string calldata key, string calldata defaultValue) external returns (string memory value);
    function envOr(string calldata key, bytes calldata defaultValue) external returns (bytes memory value);

    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

abstract contract ScriptBase {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    event ScriptLogAddress(string indexed label, address value);
    event ScriptLogBytes32(string indexed label, bytes32 value);

    function _nonZero(address value, string memory label) internal pure {
        require(value != address(0), label);
    }
}
