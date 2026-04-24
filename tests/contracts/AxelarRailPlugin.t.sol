// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {
    AxelarRailPlugin,
    IAxelarGasService,
    IAxelarITS,
    IAxelarInterchainToken
} from "../../src/contracts/rails/AxelarRailPlugin.sol";
import {IntentTypes} from "../../src/contracts/interfaces/IIntentTypes.sol";

contract MockUSDCAxelar is ERC20, IAxelarInterchainToken {
    address public immutable its;

    string public lastDestinationChain;
    bytes public lastDestinationAddress;
    uint256 public lastAmount;
    bytes public lastMetadata;
    uint256 public lastPaidNativeFee;

    constructor(address _its) ERC20("Mock USDC", "mUSDC") {
        its = _its;
    }

    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }

    function interchainTokenService() external view returns (address interchainTokenServiceAddress) {
        return its;
    }

    function interchainTransfer(
        string calldata destinationChain,
        bytes calldata recipient,
        uint256 amount,
        bytes calldata metadata
    ) external payable {
        lastDestinationChain = destinationChain;
        lastDestinationAddress = recipient;
        lastAmount = amount;
        lastMetadata = metadata;
        lastPaidNativeFee = msg.value;
        _transfer(msg.sender, address(this), amount);
    }
}

contract MockAxelarGasService is IAxelarGasService {
    uint256 public fixedFee;
    string public lastDestinationChain;
    string public lastDestinationAddress;
    bytes public lastPayload;
    uint256 public lastGasLimit;
    uint256 public lastPaid;

    constructor(uint256 _fixedFee) {
        fixedFee = _fixedFee;
    }

    function estimateGasFee(
        string memory destinationChain,
        string memory destinationAddress,
        bytes memory payload,
        uint256 executionGasLimit,
        bytes memory params
    ) external view returns (uint256) {
        destinationChain; destinationAddress; payload; executionGasLimit; params;
        return fixedFee;
    }

    function payNativeGasForContractCall(
        address,
        string calldata destinationChain,
        string calldata destinationAddress,
        bytes calldata payload,
        address
    ) external payable {
        lastDestinationChain = destinationChain;
        lastDestinationAddress = destinationAddress;
        lastPayload = payload;
        lastGasLimit = 200_000;
        lastPaid = msg.value;
    }
}

contract MockAxelarITS is IAxelarITS {
    function callContractWithInterchainToken(
        bytes32,
        string calldata,
        bytes calldata,
        uint256,
        bytes calldata
    ) external payable {}
}

contract AxelarRailPluginTest {
    MockUSDCAxelar private usdc;
    MockAxelarGasService private gasService;
    MockAxelarITS private its;
    AxelarRailPlugin private plugin;

    uint32 private constant DST_CHAIN = 42161;
    bytes32 private constant DST_TOKEN_ID = keccak256("ARBITRUM_USDC");
    uint256 private constant GAS_FEE = 0.01 ether;

    function setUp() public {
        its = new MockAxelarITS();
        usdc = new MockUSDCAxelar(address(its));
        gasService = new MockAxelarGasService(GAS_FEE);
        plugin = new AxelarRailPlugin(address(usdc), address(gasService), address(its), address(this));

        plugin.setRouteConfig(DST_CHAIN, "arbitrum", address(0xBEEF), DST_TOKEN_ID);
        usdc.mint(address(this), 1_000_000e6);
    }

    function testBridgeHappyPath() public {
        uint256 amount = 100e6;
        usdc.approve(address(plugin), amount);

        IntentTypes.BridgeParams memory params = IntentTypes.BridgeParams({
            intentId: keccak256("intent-1"),
            settlementTokenAddr: address(usdc),
            amount: amount,
            settlementAssetId: bytes32(0),
            expectedDstSettlementToken: address(0),
            expectedDstSettlementAssetId: bytes32(0),
            minSettlementAmount: 0,
            dstChainId: DST_CHAIN,
            railData: bytes(""),
            dstReceiver: address(0xBEEF),
            dstCalldata: hex"1234",
            gasForDst: 200_000,
            finalRecipient: address(0xABCD),
            nativeDstAddress: bytes(""),
            thorAssetIdentifier: "",
            minThorOutput: 0
        });

        bytes32 railTxId = plugin.bridge{value: GAS_FEE + 1 wei}(params);

        _assertTrue(railTxId != bytes32(0), "rail tx id is zero");
        _assertEq(usdc.lastAmount(), amount, "bridged amount mismatch");
        _assertEq(keccak256(bytes(usdc.lastDestinationChain())), keccak256(bytes("arbitrum")), "dst chain mismatch");
        _assertEq(usdc.balanceOf(address(usdc)), amount, "token contract did not take funds");
        _assertEq(usdc.lastPaidNativeFee(), GAS_FEE, "gas fee mismatch");
        _assertEq(
            keccak256(usdc.lastMetadata()),
            keccak256(bytes.concat(bytes4(0), hex"1234")),
            "payload metadata mismatch"
        );
    }

    function testEstimateFeeRevertsOnUnsupportedRoute() public {
        (bool ok, ) = address(plugin).call(
            abi.encodeWithSelector(plugin.estimateFee.selector, uint32(999999), uint256(1e6), uint8(0))
        );
        _assertTrue(!ok, "expected unsupported route revert");
    }

    receive() external payable {}

    function _assertEq(uint256 a, uint256 b, string memory err) internal pure {
        require(a == b, err);
    }

    function _assertEq(bytes32 a, bytes32 b, string memory err) internal pure {
        require(a == b, err);
    }

    function _assertTrue(bool ok, string memory err) internal pure {
        require(ok, err);
    }
}
