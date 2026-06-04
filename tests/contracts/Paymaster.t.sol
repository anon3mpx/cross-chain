// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Paymaster, PostOpMode, UserOperation} from "../../src/contracts/Paymaster.sol";

interface VmPaymaster {
    function addr(uint256 privateKey) external returns (address);
    function prank(address sender) external;
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function warp(uint256 newTimestamp) external;
}

contract MockPaymasterToken is ERC20 {
    constructor() ERC20("Mock Gas Token", "MGT") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract PaymasterTest {
    VmPaymaster private constant vm = VmPaymaster(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant SIGNER_PK = 0xA11CE;
    address private constant USER = address(0xBEEF);
    bytes32 private constant USER_OP_HASH = keccak256("user-op");
    uint48 private constant EXPIRY = 1000;

    MockPaymasterToken private token;
    Paymaster private paymaster;

    function setUp() public {
        token = new MockPaymasterToken();
        paymaster = new Paymaster(address(this), vm.addr(SIGNER_PK), address(this));
        paymaster.setTokenRate(address(token), 1e18);
        token.mint(USER, 1_000_000e18);
    }

    function testConstructorRejectsZeroEntryPoint() public {
        (bool ok,) = address(new PaymasterFactory()).call(
            abi.encodeWithSelector(
                PaymasterFactory.deploy.selector,
                address(0),
                vm.addr(SIGNER_PK),
                address(this)
            )
        );

        _assertTrue(!ok, "expected zero entry point revert");
    }

    function testConstructorRejectsZeroSigner() public {
        (bool ok,) = address(new PaymasterFactory()).call(
            abi.encodeWithSelector(
                PaymasterFactory.deploy.selector,
                address(this),
                address(0),
                address(this)
            )
        );

        _assertTrue(!ok, "expected zero signer revert");
    }

    function testSetSignerRejectsZeroSigner() public {
        (bool ok,) = address(paymaster).call(
            abi.encodeWithSelector(paymaster.setSigner.selector, address(0))
        );

        _assertTrue(!ok, "expected zero signer update revert");
    }

    function testValidateRejectsStaleTokenRate() public {
        vm.warp(block.timestamp + 10 minutes + 1 seconds);
        UserOperation memory userOp = _userOp(120);

        (bool ok,) = address(paymaster).call(
            abi.encodeWithSelector(
                paymaster.validatePaymasterUserOp.selector,
                userOp,
                USER_OP_HASH,
                uint256(100)
            )
        );

        _assertTrue(!ok, "expected stale token rate revert");
    }

    function testValidateRejectsEstimatedFeeAboveSignedMaxTokenFee() public {
        UserOperation memory userOp = _userOp(100);
        token.approve(address(paymaster), type(uint256).max);

        (bool ok,) = address(paymaster).call(
            abi.encodeWithSelector(
                paymaster.validatePaymasterUserOp.selector,
                userOp,
                USER_OP_HASH,
                uint256(101)
            )
        );

        _assertTrue(!ok, "expected estimated fee above signed max to revert");
    }

    function testPostOpRejectsActualFeeAboveSignedMaxTokenFee() public {
        UserOperation memory userOp = _userOp(120);
        (bool validated, bytes memory data) = address(paymaster).call(
            abi.encodeWithSelector(
                paymaster.validatePaymasterUserOp.selector,
                userOp,
                USER_OP_HASH,
                uint256(100)
            )
        );
        _assertTrue(validated, "validation failed");
        (bytes memory context,) = abi.decode(data, (bytes, uint256));

        _approveFromUser(type(uint256).max);

        (bool ok,) = address(paymaster).call(
            abi.encodeWithSelector(
                paymaster.postOp.selector,
                PostOpMode.opSucceeded,
                context,
                uint256(101),
                uint256(0)
            )
        );

        _assertTrue(!ok, "expected actual fee above signed max to revert");
    }

    function testPostOpChargesWhenActualFeeIsWithinSignedMaxTokenFee() public {
        UserOperation memory userOp = _userOp(120);
        (bool validated, bytes memory data) = address(paymaster).call(
            abi.encodeWithSelector(
                paymaster.validatePaymasterUserOp.selector,
                userOp,
                USER_OP_HASH,
                uint256(100)
            )
        );
        _assertTrue(validated, "validation failed");
        (bytes memory context,) = abi.decode(data, (bytes, uint256));

        _approveFromUser(120);

        paymaster.postOp(PostOpMode.opSucceeded, context, 100, 0);

        _assertEq(token.balanceOf(address(paymaster)), 120, "paymaster did not collect expected fee");
    }

    function _userOp(uint256 maxTokenFee) internal returns (UserOperation memory userOp) {
        userOp.sender = USER;
        userOp.paymasterAndData = abi.encodePacked(
            address(paymaster),
            abi.encode(address(token), maxTokenFee, _signature(maxTokenFee), EXPIRY)
        );
    }

    function _signature(uint256 maxTokenFee) internal returns (bytes memory) {
        bytes32 digest = keccak256(abi.encodePacked(USER_OP_HASH, address(token), maxTokenFee, EXPIRY));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_PK, ethHash);
        return abi.encode(r, s, v);
    }

    function _approveFromUser(uint256 amount) internal {
        vm.prank(USER);
        token.approve(address(paymaster), amount);
    }

    function _assertEq(uint256 a, uint256 b, string memory err) internal pure {
        require(a == b, err);
    }

    function _assertTrue(bool ok, string memory err) internal pure {
        require(ok, err);
    }
}

contract PaymasterFactory {
    function deploy(address entryPoint, address signer, address owner) external returns (Paymaster) {
        return new Paymaster(entryPoint, signer, owner);
    }
}
