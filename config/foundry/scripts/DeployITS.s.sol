// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ScriptBase} from "./ScriptBase.sol";

interface IInterchainTokenServiceMinimal {
    function interchainTokenFactory() external view returns (address);
    function registeredTokenAddress(bytes32 tokenId) external view returns (address);
    function tokenManagerAddress(bytes32 tokenId) external view returns (address);
}

interface IInterchainTokenFactoryMinimal {
    function interchainTokenId(address deployer, bytes32 salt) external view returns (bytes32 tokenId);

    function deployInterchainToken(
        bytes32 salt,
        string calldata name,
        string calldata symbol,
        uint8 decimals,
        uint256 initialSupply,
        address minter
    ) external payable returns (bytes32 tokenId);

    function registerCanonicalInterchainToken(address tokenAddress)
        external
        payable
        returns (bytes32 tokenId);

    function deployRemoteInterchainToken(bytes32 salt, string calldata destinationChain, uint256 gasValue)
        external
        payable
        returns (bytes32 tokenId);

    function deployRemoteInterchainTokenWithMinter(
        bytes32 salt,
        address minter,
        string calldata destinationChain,
        bytes calldata destinationMinter,
        uint256 gasValue
    ) external payable returns (bytes32 tokenId);

    function deployRemoteCanonicalInterchainToken(
        address originalTokenAddress,
        string calldata destinationChain,
        uint256 gasValue
    ) external payable returns (bytes32 tokenId);

    function registerCustomToken(bytes32 salt, address tokenAddress, uint8 tokenManagerType, address operator)
        external
        payable
        returns (bytes32 tokenId);

    function linkToken(
        bytes32 salt,
        string calldata destinationChain,
        bytes calldata destinationTokenAddress,
        uint8 tokenManagerType,
        bytes calldata linkParams,
        uint256 gasValue
    ) external payable returns (bytes32 tokenId);

    function approveDeployRemoteInterchainToken(
        address deployer,
        bytes32 salt,
        string calldata destinationChain,
        bytes calldata destinationMinter
    ) external;

    function revokeDeployRemoteInterchainToken(address deployer, bytes32 salt, string calldata destinationChain)
        external;
}

/// @notice Axelar ITS token creation/link deployment helper.
/// @dev Supports chain-scoped env keys with suffixes, e.g. ITS_ACTION_84532.
///
/// Required (all actions):
/// - DEPLOYER_PRIVATE_KEY
/// - ITS_ACTION
///
/// Required by action:
/// - ITS_FACTORY or AXELAR_ITS (factory inferred from service)
/// - DEPLOY_INTERCHAIN_TOKEN: ITS_SALT, ITS_TOKEN_NAME, ITS_TOKEN_SYMBOL, ITS_TOKEN_DECIMALS
/// - REGISTER_CANONICAL: ITS_TOKEN_ADDRESS
/// - DEPLOY_REMOTE_INTERCHAIN_TOKEN: ITS_SALT, ITS_DESTINATION_CHAIN
/// - DEPLOY_REMOTE_CANONICAL: ITS_TOKEN_ADDRESS, ITS_DESTINATION_CHAIN
/// - REGISTER_CUSTOM_TOKEN: ITS_SALT, ITS_TOKEN_ADDRESS, ITS_TOKEN_MANAGER_TYPE
/// - LINK_TOKEN: ITS_SALT, ITS_DESTINATION_CHAIN, ITS_DESTINATION_TOKEN_ADDRESS|ITS_DESTINATION_TOKEN_BYTES, ITS_TOKEN_MANAGER_TYPE
/// - APPROVE_REMOTE_MINTER: ITS_DEPLOYER, ITS_SALT, ITS_DESTINATION_CHAIN, ITS_DESTINATION_MINTER|ITS_DESTINATION_MINTER_BYTES
/// - REVOKE_REMOTE_MINTER: ITS_DEPLOYER, ITS_SALT, ITS_DESTINATION_CHAIN
///
/// Optional:
/// - ITS_CALL_VALUE            (msg.value to send with factory call)
/// - ITS_GAS_VALUE             (cross-chain gas argument for remote actions)
/// - ITS_MINTER
/// - ITS_INITIAL_SUPPLY
/// - ITS_OPERATOR
/// - ITS_LINK_PARAMS           (hex bytes)
/// - ITS_DESTINATION_MINTER    (address)
/// - ITS_DESTINATION_MINTER_BYTES (hex bytes)
/// - ITS_DESTINATION_TOKEN_BYTES  (hex bytes)
/// - ITS_TOKEN_MANAGER_TYPE    (LOCK_UNLOCK/MINT_BURN_FROM/LOCK_UNLOCK_FEE/MINT_BURN/NATIVE_INTERCHAIN_TOKEN)
contract DeployITS is ScriptBase {
    event ScriptLogString(string indexed label, string value);
    event ScriptLogUint256(string indexed label, uint256 value);

    uint8 internal constant TOKEN_MANAGER_TYPE_NATIVE_INTERCHAIN_TOKEN = 0;
    uint8 internal constant TOKEN_MANAGER_TYPE_MINT_BURN_FROM = 1;
    uint8 internal constant TOKEN_MANAGER_TYPE_LOCK_UNLOCK = 2;
    uint8 internal constant TOKEN_MANAGER_TYPE_LOCK_UNLOCK_FEE = 3;
    uint8 internal constant TOKEN_MANAGER_TYPE_MINT_BURN = 4;

    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 chainId = block.chainid;

        string memory action = _envStringByChain("ITS_ACTION", chainId, "");
        require(bytes(action).length != 0, "ITS_ACTION is required");

        address itsFactory = _resolveFactory(chainId);
        address itsService = _envAddressByChain("AXELAR_ITS", chainId, address(0));

        uint256 callValue = _envUintByChain("ITS_CALL_VALUE", chainId, 0);
        bytes32 tokenId = bytes32(0);

        vm.startBroadcast(deployerPk);

        if (_eq(action, "DEPLOY_INTERCHAIN_TOKEN")) {
            tokenId = _deployInterchainToken(itsFactory, chainId, callValue);
        } else if (_eq(action, "REGISTER_CANONICAL")) {
            tokenId = _registerCanonical(itsFactory, chainId, callValue);
        } else if (_eq(action, "DEPLOY_REMOTE_INTERCHAIN_TOKEN")) {
            tokenId = _deployRemoteInterchainToken(itsFactory, chainId, callValue);
        } else if (_eq(action, "DEPLOY_REMOTE_CANONICAL")) {
            tokenId = _deployRemoteCanonical(itsFactory, chainId, callValue);
        } else if (_eq(action, "REGISTER_CUSTOM_TOKEN")) {
            tokenId = _registerCustomToken(itsFactory, chainId, callValue);
        } else if (_eq(action, "LINK_TOKEN")) {
            tokenId = _linkToken(itsFactory, chainId, callValue);
        } else if (_eq(action, "APPROVE_REMOTE_MINTER")) {
            tokenId = _approveRemoteMinter(itsFactory, chainId);
        } else if (_eq(action, "REVOKE_REMOTE_MINTER")) {
            tokenId = _revokeRemoteMinter(itsFactory, chainId);
        } else {
            revert("unsupported ITS_ACTION");
        }

        vm.stopBroadcast();

        emit ScriptLogAddress("ITS_FACTORY", itsFactory);
        emit ScriptLogString("ITS_ACTION", action);
        emit ScriptLogUint256("ITS_CALL_VALUE", callValue);
        if (tokenId != bytes32(0)) {
            emit ScriptLogBytes32("ITS_TOKEN_ID", tokenId);
            _logResolvedAddresses(itsService, tokenId);
        }
    }

    function _resolveFactory(uint256 chainId) internal returns (address factory) {
        factory = _envAddressByChain("ITS_FACTORY", chainId, address(0));
        if (factory != address(0)) return factory;

        address itsService = _envAddressByChain("AXELAR_ITS", chainId, address(0));
        _nonZero(itsService, "ITS_FACTORY or AXELAR_ITS is required");
        factory = IInterchainTokenServiceMinimal(itsService).interchainTokenFactory();
        _nonZero(factory, "interchainTokenFactory() returned zero");
    }

    function _deployInterchainToken(address factory, uint256 chainId, uint256 callValue)
        internal
        returns (bytes32 tokenId)
    {
        bytes32 salt = _envBytes32ByChain("ITS_SALT", chainId, bytes32(0));
        string memory name = _envStringByChain("ITS_TOKEN_NAME", chainId, "");
        string memory symbol = _envStringByChain("ITS_TOKEN_SYMBOL", chainId, "");
        uint256 decimalsRaw = _envUintByChain("ITS_TOKEN_DECIMALS", chainId, 0);
        uint256 initialSupply = _envUintByChain("ITS_INITIAL_SUPPLY", chainId, 0);
        address minter = _envAddressByChain("ITS_MINTER", chainId, address(0));

        require(salt != bytes32(0), "ITS_SALT is required");
        require(bytes(name).length != 0, "ITS_TOKEN_NAME is required");
        require(bytes(symbol).length != 0, "ITS_TOKEN_SYMBOL is required");
        require(decimalsRaw <= type(uint8).max, "ITS_TOKEN_DECIMALS must fit uint8");

        tokenId = IInterchainTokenFactoryMinimal(factory).deployInterchainToken{value: callValue}(
            salt,
            name,
            symbol,
            uint8(decimalsRaw),
            initialSupply,
            minter
        );
    }

    function _registerCanonical(address factory, uint256 chainId, uint256 callValue)
        internal
        returns (bytes32 tokenId)
    {
        address token = _envAddressByChain("ITS_TOKEN_ADDRESS", chainId, address(0));
        _nonZero(token, "ITS_TOKEN_ADDRESS is required");

        tokenId = IInterchainTokenFactoryMinimal(factory).registerCanonicalInterchainToken{value: callValue}(token);
    }

    function _deployRemoteInterchainToken(address factory, uint256 chainId, uint256 callValue)
        internal
        returns (bytes32 tokenId)
    {
        bytes32 salt = _envBytes32ByChain("ITS_SALT", chainId, bytes32(0));
        string memory destinationChain = _envStringByChain("ITS_DESTINATION_CHAIN", chainId, "");
        uint256 gasValue = _envUintByChain("ITS_GAS_VALUE", chainId, 0);

        require(salt != bytes32(0), "ITS_SALT is required");
        require(bytes(destinationChain).length != 0, "ITS_DESTINATION_CHAIN is required");

        address minter = _envAddressByChain("ITS_MINTER", chainId, address(0));
        bytes memory destinationMinter = _destinationMinterBytes(chainId);

        if (minter != address(0) || destinationMinter.length != 0) {
            _nonZero(minter, "ITS_MINTER is required when destination minter is set");
            tokenId = IInterchainTokenFactoryMinimal(factory).deployRemoteInterchainTokenWithMinter{value: callValue}(
                salt,
                minter,
                destinationChain,
                destinationMinter,
                gasValue
            );
        } else {
            tokenId = IInterchainTokenFactoryMinimal(factory).deployRemoteInterchainToken{value: callValue}(
                salt,
                destinationChain,
                gasValue
            );
        }
    }

    function _deployRemoteCanonical(address factory, uint256 chainId, uint256 callValue)
        internal
        returns (bytes32 tokenId)
    {
        address token = _envAddressByChain("ITS_TOKEN_ADDRESS", chainId, address(0));
        string memory destinationChain = _envStringByChain("ITS_DESTINATION_CHAIN", chainId, "");
        uint256 gasValue = _envUintByChain("ITS_GAS_VALUE", chainId, 0);

        _nonZero(token, "ITS_TOKEN_ADDRESS is required");
        require(bytes(destinationChain).length != 0, "ITS_DESTINATION_CHAIN is required");

        tokenId = IInterchainTokenFactoryMinimal(factory).deployRemoteCanonicalInterchainToken{value: callValue}(
            token,
            destinationChain,
            gasValue
        );
    }

    function _registerCustomToken(address factory, uint256 chainId, uint256 callValue)
        internal
        returns (bytes32 tokenId)
    {
        bytes32 salt = _envBytes32ByChain("ITS_SALT", chainId, bytes32(0));
        address token = _envAddressByChain("ITS_TOKEN_ADDRESS", chainId, address(0));
        uint8 tokenManagerType = _tokenManagerTypeByChain(chainId);
        address operator = _envAddressByChain("ITS_OPERATOR", chainId, address(0));

        require(salt != bytes32(0), "ITS_SALT is required");
        _nonZero(token, "ITS_TOKEN_ADDRESS is required");

        tokenId = IInterchainTokenFactoryMinimal(factory).registerCustomToken{value: callValue}(
            salt,
            token,
            tokenManagerType,
            operator
        );
    }

    function _linkToken(address factory, uint256 chainId, uint256 callValue)
        internal
        returns (bytes32 tokenId)
    {
        bytes32 salt = _envBytes32ByChain("ITS_SALT", chainId, bytes32(0));
        string memory destinationChain = _envStringByChain("ITS_DESTINATION_CHAIN", chainId, "");
        uint256 gasValue = _envUintByChain("ITS_GAS_VALUE", chainId, 0);
        uint8 tokenManagerType = _tokenManagerTypeByChain(chainId);

        bytes memory destinationToken = _destinationTokenBytes(chainId);
        bytes memory linkParams = _envBytesByChain("ITS_LINK_PARAMS", chainId, bytes(""));

        require(salt != bytes32(0), "ITS_SALT is required");
        require(bytes(destinationChain).length != 0, "ITS_DESTINATION_CHAIN is required");
        require(destinationToken.length != 0, "ITS_DESTINATION_TOKEN_ADDRESS or ITS_DESTINATION_TOKEN_BYTES is required");

        tokenId = IInterchainTokenFactoryMinimal(factory).linkToken{value: callValue}(
            salt,
            destinationChain,
            destinationToken,
            tokenManagerType,
            linkParams,
            gasValue
        );
    }

    function _approveRemoteMinter(address factory, uint256 chainId) internal returns (bytes32 tokenId) {
        address deployer = _envAddressByChain("ITS_DEPLOYER", chainId, address(0));
        bytes32 salt = _envBytes32ByChain("ITS_SALT", chainId, bytes32(0));
        string memory destinationChain = _envStringByChain("ITS_DESTINATION_CHAIN", chainId, "");
        bytes memory destinationMinter = _destinationMinterBytes(chainId);

        _nonZero(deployer, "ITS_DEPLOYER is required");
        require(salt != bytes32(0), "ITS_SALT is required");
        require(bytes(destinationChain).length != 0, "ITS_DESTINATION_CHAIN is required");
        require(destinationMinter.length != 0, "ITS_DESTINATION_MINTER or ITS_DESTINATION_MINTER_BYTES is required");

        IInterchainTokenFactoryMinimal(factory).approveDeployRemoteInterchainToken(
            deployer,
            salt,
            destinationChain,
            destinationMinter
        );

        tokenId = IInterchainTokenFactoryMinimal(factory).interchainTokenId(deployer, salt);
    }

    function _revokeRemoteMinter(address factory, uint256 chainId) internal returns (bytes32 tokenId) {
        address deployer = _envAddressByChain("ITS_DEPLOYER", chainId, address(0));
        bytes32 salt = _envBytes32ByChain("ITS_SALT", chainId, bytes32(0));
        string memory destinationChain = _envStringByChain("ITS_DESTINATION_CHAIN", chainId, "");

        _nonZero(deployer, "ITS_DEPLOYER is required");
        require(salt != bytes32(0), "ITS_SALT is required");
        require(bytes(destinationChain).length != 0, "ITS_DESTINATION_CHAIN is required");

        IInterchainTokenFactoryMinimal(factory).revokeDeployRemoteInterchainToken(deployer, salt, destinationChain);
        tokenId = IInterchainTokenFactoryMinimal(factory).interchainTokenId(deployer, salt);
    }

    function _destinationMinterBytes(uint256 chainId) internal returns (bytes memory minterBytes) {
        minterBytes = _envBytesByChain("ITS_DESTINATION_MINTER_BYTES", chainId, bytes(""));
        if (minterBytes.length != 0) return minterBytes;

        address destinationMinter = _envAddressByChain("ITS_DESTINATION_MINTER", chainId, address(0));
        if (destinationMinter == address(0)) return bytes("");

        return abi.encodePacked(destinationMinter);
    }

    function _destinationTokenBytes(uint256 chainId) internal returns (bytes memory tokenBytes) {
        tokenBytes = _envBytesByChain("ITS_DESTINATION_TOKEN_BYTES", chainId, bytes(""));
        if (tokenBytes.length != 0) return tokenBytes;

        address destinationToken = _envAddressByChain("ITS_DESTINATION_TOKEN_ADDRESS", chainId, address(0));
        if (destinationToken == address(0)) return bytes("");

        return abi.encodePacked(destinationToken);
    }

    function _tokenManagerTypeByChain(uint256 chainId) internal returns (uint8 tokenManagerType) {
        string memory raw = _envStringByChain("ITS_TOKEN_MANAGER_TYPE", chainId, "LOCK_UNLOCK");

        if (_eq(raw, "NATIVE_INTERCHAIN_TOKEN")) return TOKEN_MANAGER_TYPE_NATIVE_INTERCHAIN_TOKEN;
        if (_eq(raw, "MINT_BURN_FROM")) return TOKEN_MANAGER_TYPE_MINT_BURN_FROM;
        if (_eq(raw, "LOCK_UNLOCK")) return TOKEN_MANAGER_TYPE_LOCK_UNLOCK;
        if (_eq(raw, "LOCK_UNLOCK_FEE")) return TOKEN_MANAGER_TYPE_LOCK_UNLOCK_FEE;
        if (_eq(raw, "MINT_BURN")) return TOKEN_MANAGER_TYPE_MINT_BURN;

        revert("invalid ITS_TOKEN_MANAGER_TYPE");
    }

    function _logResolvedAddresses(address itsService, bytes32 tokenId) internal {
        if (itsService == address(0)) return;

        try IInterchainTokenServiceMinimal(itsService).registeredTokenAddress(tokenId) returns (address token) {
            emit ScriptLogAddress("ITS_REGISTERED_TOKEN", token);
        } catch {}

        try IInterchainTokenServiceMinimal(itsService).tokenManagerAddress(tokenId) returns (address manager) {
            emit ScriptLogAddress("ITS_TOKEN_MANAGER", manager);
        } catch {}
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

    function _envBytes32ByChain(string memory key, uint256 chainId, bytes32 fallbackValue)
        internal
        returns (bytes32)
    {
        return vm.envOr(_scopedKey(key, chainId), vm.envOr(key, fallbackValue));
    }

    function _envStringByChain(string memory key, uint256 chainId, string memory fallbackValue)
        internal
        returns (string memory)
    {
        return vm.envOr(_scopedKey(key, chainId), vm.envOr(key, fallbackValue));
    }

    function _envBytesByChain(string memory key, uint256 chainId, bytes memory fallbackValue)
        internal
        returns (bytes memory)
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

    function _eq(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}
