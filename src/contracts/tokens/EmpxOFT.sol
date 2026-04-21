// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {OFT} from "@layerzerolabs/oft-evm/contracts/OFT.sol";

/// @title EmpxOFT
/// @notice Minimal mintable LayerZero OFT implementation for EMPX deployment.
contract EmpxOFT is OFT {
    error ZeroAddress(string field);

    constructor(
        string memory name_,
        string memory symbol_,
        address lzEndpoint_,
        address owner_,
        address initialMintRecipient_,
        uint256 initialMintAmount_
    ) OFT(name_, symbol_, lzEndpoint_, owner_) Ownable(owner_) {
        if (lzEndpoint_ == address(0)) revert ZeroAddress("lzEndpoint");
        if (owner_ == address(0)) revert ZeroAddress("owner");

        if (initialMintAmount_ > 0) {
            if (initialMintRecipient_ == address(0)) revert ZeroAddress("initialMintRecipient");
            _mint(initialMintRecipient_, initialMintAmount_);
        }
    }

    function mint(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress("to");
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyOwner {
        if (from == address(0)) revert ZeroAddress("from");
        _burn(from, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
