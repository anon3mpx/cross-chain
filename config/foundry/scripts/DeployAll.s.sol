// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ScriptBase} from "./ScriptBase.sol";

import {PluginRegistry} from "src/contracts/PluginRegistry.sol";
import {RouterV1} from "src/contracts/RouterV1.sol";
import {ReceiverV1} from "src/contracts/ReceiverV1.sol";
import {RufloPaymaster} from "src/contracts/Paymaster.sol";

import {CCTPRailPlugin} from "src/contracts/rails/CCTPRailPlugin.sol";
import {AxelarRailPlugin} from "src/contracts/rails/AxelarRailPlugin.sol";
import {LayerZeroRailPlugin} from "src/contracts/rails/LayerZeroRailPlugin.sol";
import {THORChainRailPlugin} from "src/contracts/rails/THORChainRailPlugin.sol";
import {AxelarReceiverAdapter} from "src/contracts/rails/AxelarReceiverAdapter.sol";
import {LayerZeroReceiverAdapter} from "src/contracts/rails/LayerZeroReceiverAdapter.sol";

import {EmpsealSwapPlugin} from "src/contracts/plugins/EmpsealSwapPlugin.sol";
import {UniswapV2SwapPlugin} from "src/contracts/plugins/UniswapV2SwapPlugin.sol";
import {UniswapV3SwapPlugin} from "src/contracts/plugins/UniswapV3SwapPlugin.sol";

/// @notice Deploys full contract stack with env-driven optional components.
/// @dev Required env vars:
///      - DEPLOYER_PRIVATE_KEY
///      - OWNER
///      - FEE_RECIPIENT
///      - WETH
///
/// Optional env vars (deploys related components when present):
///      - USDC, USDT
///      - TOKEN_MESSENGER
///      - AXELAR_GAS_SERVICE, AXELAR_ITS, AXELAR_GATEWAY
///      - LZ_ENDPOINT, LZ_OFT
///      - THOR_ROUTER
///      - EMPSEAL_ROUTER
///      - UNIV2_ROUTER
///      - UNIV3_ROUTER
///      - ENTRYPOINT, PAYMASTER_SIGNER
contract DeployAll is ScriptBase {
    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");

        address owner = vm.envAddress("OWNER");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");
        address weth = vm.envAddress("WETH");

        _nonZero(owner, "OWNER is required");
        _nonZero(feeRecipient, "FEE_RECIPIENT is required");
        _nonZero(weth, "WETH is required");

        vm.startBroadcast(deployerPk);

        PluginRegistry registry = new PluginRegistry(owner);
        emit ScriptLogAddress("PluginRegistry", address(registry));

        RouterV1 router = new RouterV1(address(registry), feeRecipient, weth, owner);
        emit ScriptLogAddress("RouterV1", address(router));

        ReceiverV1 receiver = new ReceiverV1(address(registry), owner);
        emit ScriptLogAddress("ReceiverV1", address(receiver));
        _deployPaymaster(owner);
        _deploySwapPlugins(owner);
        _deployRailPlugins(owner, weth);
        _deployAdapters(owner, address(receiver));

        vm.stopBroadcast();
    }

    function _deployPaymaster(address owner) internal {
        address entryPoint = vm.envOr("ENTRYPOINT", address(0));
        address paymasterSigner = vm.envOr("PAYMASTER_SIGNER", address(0));
        if (entryPoint == address(0) || paymasterSigner == address(0)) return;

        RufloPaymaster paymaster = new RufloPaymaster(entryPoint, paymasterSigner, owner);
        emit ScriptLogAddress("RufloPaymaster", address(paymaster));
    }

    function _deploySwapPlugins(address owner) internal {
        address empsealRouter = vm.envOr("EMPSEAL_ROUTER", address(0));
        if (empsealRouter != address(0)) {
            EmpsealSwapPlugin empsealSwap = new EmpsealSwapPlugin(empsealRouter, owner);
            emit ScriptLogAddress("EmpsealSwapPlugin", address(empsealSwap));
        }

        address univ2Router = vm.envOr("UNIV2_ROUTER", address(0));
        if (univ2Router != address(0)) {
            UniswapV2SwapPlugin uniSwap = new UniswapV2SwapPlugin(univ2Router, owner);
            emit ScriptLogAddress("UniswapV2SwapPlugin", address(uniSwap));
        }

        address univ3Router = vm.envOr("UNIV3_ROUTER", address(0));
        if (univ3Router != address(0)) {
            UniswapV3SwapPlugin uniSwapV3 = new UniswapV3SwapPlugin(univ3Router, owner);
            emit ScriptLogAddress("UniswapV3SwapPlugin", address(uniSwapV3));
        }
    }

    function _deployRailPlugins(address owner, address weth) internal {
        address usdc = vm.envOr("USDC", address(0));
        address usdt = vm.envOr("USDT", address(0));
        {
            address cctpUsdc = vm.envOr("CCTP_USDC", usdc);
            address tokenMessenger = vm.envOr("TOKEN_MESSENGER", address(0));
            if (tokenMessenger != address(0) && cctpUsdc != address(0)) {
                CCTPRailPlugin cctp = new CCTPRailPlugin(tokenMessenger, cctpUsdc, owner);
                emit ScriptLogAddress("CCTPRailPlugin", address(cctp));
            }
        }

        {
            address axelarUsdc = vm.envOr("AXELAR_USDC", usdc);
            address axelarGasService = vm.envOr("AXELAR_GAS_SERVICE", address(0));
            address axelarIts = vm.envOr("AXELAR_ITS", address(0));
            if (axelarUsdc != address(0) && axelarGasService != address(0) && axelarIts != address(0)) {
                AxelarRailPlugin axelar = new AxelarRailPlugin(axelarUsdc, axelarGasService, axelarIts, owner);
                emit ScriptLogAddress("AxelarRailPlugin", address(axelar));
            }
        }

        {
            address layerZeroUsdc = vm.envOr("LAYERZERO_USDC", vm.envOr("LZ_USDC", usdc));
            address lzEndpoint = vm.envOr("LZ_ENDPOINT", address(0));
            address lzOft = vm.envOr("LZ_OFT", address(0));
            if (layerZeroUsdc != address(0) && lzEndpoint != address(0) && lzOft != address(0)) {
                LayerZeroRailPlugin layerZero = new LayerZeroRailPlugin(layerZeroUsdc, lzEndpoint, lzOft, owner);
                emit ScriptLogAddress("LayerZeroRailPlugin", address(layerZero));
            }
        }

        {
            address thorUsdc = vm.envOr("THOR_USDC", usdc);
            address thorUsdt = vm.envOr("THOR_USDT", usdt);
            address thorRouter = vm.envOr("THOR_ROUTER", address(0));
            if (thorRouter != address(0) && thorUsdc != address(0) && thorUsdt != address(0)) {
                THORChainRailPlugin thor = new THORChainRailPlugin(thorRouter, thorUsdc, weth, thorUsdt, owner);
                emit ScriptLogAddress("THORChainRailPlugin", address(thor));
            }
        }
    }

    function _deployAdapters(address owner, address receiver) internal {
        address axelarGateway = vm.envOr("AXELAR_GATEWAY", address(0));
        if (axelarGateway != address(0)) {
            AxelarReceiverAdapter axAdapter = new AxelarReceiverAdapter(axelarGateway, receiver, owner);
            emit ScriptLogAddress("AxelarReceiverAdapter", address(axAdapter));
        }

        address lzEndpoint = vm.envOr("LZ_ENDPOINT", address(0));
        if (lzEndpoint != address(0)) {
            LayerZeroReceiverAdapter lzAdapter = new LayerZeroReceiverAdapter(lzEndpoint, receiver, owner);
            emit ScriptLogAddress("LayerZeroReceiverAdapter", address(lzAdapter));
        }
    }
}
