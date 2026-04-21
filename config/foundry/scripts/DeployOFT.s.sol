// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ScriptBase} from "./ScriptBase.sol";
import {EmpxOFT} from "src/contracts/tokens/EmpxOFT.sol";

/// @notice Deploys EmpxOFT on the current RPC chain.
/// @dev Chain-scoped env keys are supported with suffix: <KEY>_<CHAIN_ID>
///      Example: LZ_ENDPOINT_421614, OFT_OWNER_421614
///
/// Required:
/// - DEPLOYER_PRIVATE_KEY
/// - OFT_NAME or OFT_NAME_<chainId>
/// - OFT_SYMBOL or OFT_SYMBOL_<chainId>
/// - LZ_ENDPOINT or LZ_ENDPOINT_<chainId>
/// - OFT_OWNER or OFT_OWNER_<chainId>
///
/// Optional:
/// - OFT_INITIAL_SUPPLY or OFT_INITIAL_SUPPLY_<chainId> (raw token units)
/// - OFT_INITIAL_SUPPLY_RECIPIENT or OFT_INITIAL_SUPPLY_RECIPIENT_<chainId>
contract DeployOFT is ScriptBase {
    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 chainId = block.chainid;

        string memory oftName = _envStringByChain("OFT_NAME", chainId, "");
        string memory oftSymbol = _envStringByChain("OFT_SYMBOL", chainId, "");
        address endpoint = _envAddressByChain("LZ_ENDPOINT", chainId, address(0));
        address owner = _envAddressByChain("OFT_OWNER", chainId, address(0));

        require(bytes(oftName).length != 0, "OFT_NAME is required");
        require(bytes(oftSymbol).length != 0, "OFT_SYMBOL is required");
        _nonZero(endpoint, "LZ_ENDPOINT is required");
        _nonZero(owner, "OFT_OWNER is required");

        uint256 initialSupply = _envUintByChain("OFT_INITIAL_SUPPLY", chainId, 0);
        address initialSupplyRecipient =
            _envAddressByChain("OFT_INITIAL_SUPPLY_RECIPIENT", chainId, owner);

        vm.startBroadcast(deployerPk);
        EmpxOFT oft = new EmpxOFT(
            oftName,
            oftSymbol,
            endpoint,
            owner,
            initialSupplyRecipient,
            initialSupply
        );
        vm.stopBroadcast();

        emit ScriptLogAddress("EmpxOFT", address(oft));
        emit ScriptLogAddress("LZ_ENDPOINT", endpoint);
        emit ScriptLogAddress("OFT_OWNER", owner);
    }

    function _envAddressByChain(string memory key, uint256 chainId, address fallbackValue)
        internal
        returns (address)
    {
        return vm.envOr(_scopedKey(key, chainId), vm.envOr(key, fallbackValue));
    }

    function _envUintByChain(string memory key, uint256 chainId, uint256 fallbackValue)
        internal
        returns (uint256)
    {
        return vm.envOr(_scopedKey(key, chainId), vm.envOr(key, fallbackValue));
    }

    function _envStringByChain(string memory key, uint256 chainId, string memory fallbackValue)
        internal
        returns (string memory)
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
