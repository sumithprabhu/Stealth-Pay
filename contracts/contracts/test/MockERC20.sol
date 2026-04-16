// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Minimal ERC-20 for testing only. NOT for production.
contract MockERC20 is ERC20 {
    uint8 private _dec;

    constructor(string memory name, string memory symbol, uint256 initialSupply) ERC20(name, symbol) {
        _dec = 6;
        _mint(msg.sender, initialSupply);
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }
}
