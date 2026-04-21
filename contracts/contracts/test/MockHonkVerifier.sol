// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Test-only mock that always returns true (or false if disabled).
contract MockHonkVerifier {
    bool public shouldPass = true;

    function setResult(bool pass) external { shouldPass = pass; }

    function verify(bytes calldata, bytes32[] calldata) external view returns (bool) {
        return shouldPass;
    }
}
