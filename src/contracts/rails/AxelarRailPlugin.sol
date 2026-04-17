// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "../interfaces/IRailPlugin.sol";
import "../interfaces/IIntentTypes.sol";

/// @title AxelarRailPlugin
/// @notice Messaging rail plugin using Axelar GMP + Interchain Token Service.
contract AxelarRailPlugin is IRailPlugin, ERC165, Ownable2Step {
    using SafeERC20 for IERC20;

    bytes32 public constant override railId = keccak256("AXELAR_V1");
    uint256 public constant DEFAULT_GAS_FOR_DST = 200_000;

    address public immutable usdc;
    IAxelarGasService public immutable gasService;
    IAxelarITS public immutable interchainTokenService;

    // EVM chainId => Axelar chain name (example: "ethereum", "avalanche")
    mapping(uint32 => string) public chainIdToAxelarName;
    // EVM chainId => AxelarReceiverAdapter on destination
    mapping(uint32 => address) public destinationReceivers;
    // EVM chainId => destination ITS token identifier for settlement token
    mapping(uint32 => bytes32) public destinationTokenIds;

    event AxelarBridgeInitiated(
        bytes32 indexed intentId,
        uint32 indexed dstChainId,
        string dstChainName,
        address dstReceiver,
        uint256 amount,
        bytes32 railTxId
    );

    error UnsupportedSettlementToken(uint8 token);
    error UnsupportedRoute(uint32 dstChainId);
    error ReceiverNotConfigured(uint32 dstChainId);
    error DestinationTokenNotConfigured(uint32 dstChainId);
    error SettlementTokenMismatch(address provided, address expected);
    error InsufficientGasPayment(uint256 provided, uint256 required);

    constructor(
        address _usdc,
        address _gasService,
        address _interchainTokenService,
        address _owner
    ) Ownable(_owner) {
        usdc = _usdc;
        gasService = IAxelarGasService(_gasService);
        interchainTokenService = IAxelarITS(_interchainTokenService);
    }

    function supportsRoute(uint32 /*srcChainId*/, uint32 dstChainId)
        external
        view
        override
        returns (bool)
    {
        return bytes(chainIdToAxelarName[dstChainId]).length != 0;
    }

    function settlementTokenAddress(uint8 settlementToken)
        external
        view
        override
        returns (address)
    {
        if (settlementToken != uint8(IntentTypes.SettlementToken.USDC)) {
            revert UnsupportedSettlementToken(settlementToken);
        }
        return usdc;
    }

    function supportsSettlementToken(uint8 settlementToken)
        external
        pure
        override
        returns (bool)
    {
        return settlementToken == uint8(IntentTypes.SettlementToken.USDC);
    }

    function estimateFee(uint32 dstChainId, uint256 /*amount*/, uint8 settlementToken)
        external
        view
        override
        returns (uint256 fee, uint256 eta)
    {
        if (settlementToken != uint8(IntentTypes.SettlementToken.USDC)) {
            revert UnsupportedSettlementToken(settlementToken);
        }

        string memory dstChainName = chainIdToAxelarName[dstChainId];
        address dstReceiver = destinationReceivers[dstChainId];
        if (bytes(dstChainName).length == 0) {
            revert UnsupportedRoute(dstChainId);
        }
        if (dstReceiver == address(0)) revert ReceiverNotConfigured(dstChainId);

        bytes memory payload =
            abi.encode(bytes32(0), address(0), address(0), uint256(0), bytes(""), bytes32(0));

        fee = gasService.estimateGasFee(
            dstChainName,
            _addressToString(dstReceiver),
            payload,
            DEFAULT_GAS_FOR_DST,
            bytes("")
        );
        eta = 90;
    }

    function bridge(IntentTypes.BridgeParams calldata params)
        external
        payable
        override
        returns (bytes32 railTxId)
    {
        string memory dstChainName = chainIdToAxelarName[params.dstChainId];
        address dstReceiver = destinationReceivers[params.dstChainId];
        bytes32 dstTokenId = destinationTokenIds[params.dstChainId];

        if (bytes(dstChainName).length == 0) revert UnsupportedRoute(params.dstChainId);
        if (dstReceiver == address(0)) revert ReceiverNotConfigured(params.dstChainId);
        if (dstTokenId == bytes32(0)) revert DestinationTokenNotConfigured(params.dstChainId);
        if (params.settlementTokenAddr != usdc) {
            revert SettlementTokenMismatch(params.settlementTokenAddr, usdc);
        }

        // Transfer settlement token from RouterV1 and approve ITS for bridging.
        IERC20(usdc).safeTransferFrom(msg.sender, address(this), params.amount);
        IERC20(usdc).forceApprove(address(interchainTokenService), params.amount);

        // Axelar requires source-chain gas prepayment for remote execution.
        uint256 gasFee = gasService.estimateGasFee(
            dstChainName,
            _addressToString(dstReceiver),
            params.dstCalldata,
            params.gasForDst,
            bytes("")
        );
        if (msg.value < gasFee) revert InsufficientGasPayment(msg.value, gasFee);

        interchainTokenService.callContractWithInterchainToken{value: gasFee}(
            dstTokenId,
            dstChainName,
            _addressToBytes(dstReceiver),
            params.amount,
            params.dstCalldata
        );

        if (msg.value > gasFee) {
            (bool ok, ) = payable(msg.sender).call{value: msg.value - gasFee}("");
            require(ok, "AXELAR_REFUND_FAILED");
        }

        railTxId = keccak256(
            abi.encodePacked(
                params.intentId,
                params.dstChainId,
                dstTokenId,
                params.amount,
                block.chainid,
                block.number
            )
        );

        emit AxelarBridgeInitiated(
            params.intentId,
            params.dstChainId,
            dstChainName,
            dstReceiver,
            params.amount,
            railTxId
        );
    }

    function setRouteConfig(
        uint32 chainId,
        string calldata axelarChainName,
        address receiver,
        bytes32 destinationTokenId
    ) external onlyOwner {
        chainIdToAxelarName[chainId] = axelarChainName;
        destinationReceivers[chainId] = receiver;
        destinationTokenIds[chainId] = destinationTokenId;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC165, IRailPlugin)
        returns (bool)
    {
        return interfaceId == type(IRailPlugin).interfaceId || super.supportsInterface(interfaceId);
    }

    function _addressToBytes(address a) internal pure returns (bytes memory) {
        return abi.encodePacked(a);
    }

    function _addressToString(address a) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes20 data = bytes20(a);
        bytes memory str = new bytes(42);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(data[i] >> 4)];
            str[3 + i * 2] = alphabet[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }
}

interface IAxelarGasService {
    function estimateGasFee(
        string memory destinationChain,
        string memory destinationAddress,
        bytes memory payload,
        uint256 executionGasLimit,
        bytes memory params
    ) external view returns (uint256);

    function payNativeGasForContractCall(
        address sender,
        string calldata destinationChain,
        string calldata destinationAddress,
        bytes calldata payload,
        address refundAddress
    ) external payable;
}

interface IAxelarITS {
    function callContractWithInterchainToken(
        bytes32 tokenId,
        string calldata destinationChain,
        bytes calldata destinationAddress,
        uint256 amount,
        bytes calldata data
    ) external payable;
}
