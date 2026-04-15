// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ScriptBase} from "./ScriptBase.sol";

import {PluginRegistry} from "src/contracts/PluginRegistry.sol";
import {RouterV1} from "src/contracts/RouterV1.sol";
import {ReceiverV1} from "src/contracts/ReceiverV1.sol";
import {RufloPaymaster} from "src/contracts/Paymaster.sol";

import {IRailPlugin} from "src/contracts/interfaces/IRailPlugin.sol";
import {ISwapPlugin} from "src/contracts/interfaces/ISwapPlugin.sol";

import {CCTPRailPlugin} from "src/contracts/rails/CCTPRailPlugin.sol";
import {AxelarRailPlugin} from "src/contracts/rails/AxelarRailPlugin.sol";
import {LayerZeroRailPlugin} from "src/contracts/rails/LayerZeroRailPlugin.sol";
import {THORChainRailPlugin} from "src/contracts/rails/THORChainRailPlugin.sol";
import {AxelarReceiverAdapter} from "src/contracts/rails/AxelarReceiverAdapter.sol";
import {LayerZeroReceiverAdapter} from "src/contracts/rails/LayerZeroReceiverAdapter.sol";

/// @notice Post-deployment configuration script.
/// @dev Run this repeatedly as you add routes/chains. Every config block is opt-in by env flag.
contract ConfigureAll is ScriptBase {
    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPk);

        _configureRegistry();
        _configureReceiver();
        _configureRouter();
        _configurePaymaster();

        _configureCctpRoutes();
        _configureAxelarRoutes();
        _configureLayerZeroRoutes();
        _configureThor();

        _configureAxelarAdapter();
        _configureLayerZeroAdapter();

        vm.stopBroadcast();
    }

    function _configureRegistry() internal {
        address registryAddr = vm.envOr("PLUGIN_REGISTRY", address(0));
        if (registryAddr == address(0)) return;

        PluginRegistry registry = PluginRegistry(registryAddr);

        _registerRailIfProvided(registry, vm.envOr("RAIL_PLUGIN_CCTP", address(0)));
        _registerRailIfProvided(registry, vm.envOr("RAIL_PLUGIN_AXELAR", address(0)));
        _registerRailIfProvided(registry, vm.envOr("RAIL_PLUGIN_LAYERZERO", address(0)));
        _registerRailIfProvided(registry, vm.envOr("RAIL_PLUGIN_THORCHAIN", address(0)));

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
        bool shouldSet = vm.envOr("ROUTER_SET_FEE_RECIPIENT", false);
        if (!shouldSet) return;

        address routerAddr = vm.envAddress("ROUTER_V1");
        address newFeeRecipient = vm.envAddress("ROUTER_NEW_FEE_RECIPIENT");
        _nonZero(newFeeRecipient, "ROUTER_NEW_FEE_RECIPIENT is required");

        RouterV1(payable(routerAddr)).setFeeRecipient(newFeeRecipient);
        emit ScriptLogAddress("RouterV1.feeRecipient", newFeeRecipient);
    }

    function _configurePaymaster() internal {
        address paymasterAddr = vm.envOr("PAYMASTER", address(0));
        if (paymasterAddr == address(0)) return;

        RufloPaymaster paymaster = RufloPaymaster(payable(paymasterAddr));

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

    function _configureAxelarRoutes() internal {
        if (!vm.envOr("AXELAR_SET_ROUTE", false)) return;

        address pluginAddr = vm.envAddress("AXELAR_PLUGIN");
        uint32 dstChainId = uint32(vm.envUint("AXELAR_ROUTE_CHAIN_ID"));
        string memory chainName = vm.envString("AXELAR_ROUTE_NAME");
        address dstReceiver = vm.envAddress("AXELAR_ROUTE_RECEIVER");
        bytes32 tokenId = vm.envBytes32("AXELAR_ROUTE_TOKEN_ID");

        AxelarRailPlugin(pluginAddr).setRouteConfig(dstChainId, chainName, dstReceiver, tokenId);
    }

    function _configureLayerZeroRoutes() internal {
        if (!vm.envOr("LZ_SET_ROUTE", false)) return;

        address pluginAddr = vm.envAddress("LZ_PLUGIN");
        uint32 dstChainId = uint32(vm.envUint("LZ_ROUTE_CHAIN_ID"));
        uint32 dstEid = uint32(vm.envUint("LZ_ROUTE_EID"));
        address dstReceiver = vm.envAddress("LZ_ROUTE_RECEIVER");
        bytes memory sendOptions = vm.envOr("LZ_ROUTE_OPTIONS", bytes(""));

        LayerZeroRailPlugin(pluginAddr).setRouteConfig(dstChainId, dstEid, dstReceiver, sendOptions);
    }

    function _configureThor() internal {
        address pluginAddr = vm.envOr("THOR_PLUGIN", address(0));
        if (pluginAddr == address(0)) return;

        THORChainRailPlugin thor = THORChainRailPlugin(pluginAddr);

        if (vm.envOr("THOR_SET_VAULT", false)) {
            uint32 chainId = uint32(vm.envUint("THOR_VAULT_CHAIN_ID"));
            address vault = vm.envAddress("THOR_VAULT_ADDRESS");
            thor.setInboundVault(chainId, vault);
        }

        if (vm.envOr("THOR_SET_ROUTER", false)) {
            address newThorRouter = vm.envAddress("THOR_ROUTER");
            thor.setTHORRouter(newThorRouter);
        }
    }

    function _configureAxelarAdapter() internal {
        if (!vm.envOr("AXELAR_ADAPTER_SET_TRUSTED_SOURCE", false)) return;

        address adapterAddr = vm.envAddress("AXELAR_ADAPTER");
        string memory sourceChain = vm.envString("AXELAR_SOURCE_CHAIN");
        string memory sourceAddress = vm.envString("AXELAR_SOURCE_ADDRESS");
        bool trusted = vm.envOr("AXELAR_SOURCE_TRUSTED", true);

        AxelarReceiverAdapter(adapterAddr).setTrustedSource(sourceChain, sourceAddress, trusted);
    }

    function _configureLayerZeroAdapter() internal {
        if (!vm.envOr("LZ_ADAPTER_SET_TRUSTED_PEER", false)) return;

        address adapterAddr = vm.envAddress("LZ_ADAPTER");
        uint32 srcEid = uint32(vm.envUint("LZ_SOURCE_EID"));
        bytes32 srcPeer = vm.envBytes32("LZ_SOURCE_PEER");

        LayerZeroReceiverAdapter(adapterAddr).setTrustedPeer(srcEid, srcPeer);
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
}
