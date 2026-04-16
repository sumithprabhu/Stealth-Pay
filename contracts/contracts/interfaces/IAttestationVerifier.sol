// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IAttestationVerifier
/// @notice Interface for verifying TEE enclave attestations on-chain.
///         TEE nodes generate an ECDSA keypair inside the hardware enclave.
///         The public key is registered here after off-chain remote attestation.
///         All operation payloads signed by that key are then trusted on-chain.
interface IAttestationVerifier {
    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Metadata stored per registered enclave key
    struct EnclaveInfo {
        address signingKey;      // ECDSA public key (as Ethereum address)
        bytes32 measurementHash; // Intel TDX MRTD / SGX MRENCLAVE measurement
        uint64  registeredAt;    // block timestamp of registration
        bool    active;          // can be deactivated by admin
        string  description;     // human-readable label (e.g. "0G-Compute-Node-1")
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event EnclaveRegistered(
        address indexed signingKey,
        bytes32 indexed measurementHash,
        address indexed registeredBy,
        string  description
    );

    event EnclaveDeactivated(
        address indexed signingKey,
        address indexed deactivatedBy
    );

    event EnclaveReactivated(
        address indexed signingKey,
        address indexed reactivatedBy
    );

    event MeasurementWhitelisted(bytes32 indexed measurementHash, address indexed by);
    event MeasurementRevoked(bytes32 indexed measurementHash, address indexed by);

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error AV__EnclaveAlreadyRegistered(address signingKey);
    error AV__EnclaveNotFound(address signingKey);
    error AV__EnclaveInactive(address signingKey);
    error AV__MeasurementNotWhitelisted(bytes32 measurementHash);
    error AV__InvalidSignature();
    error AV__PayloadExpired(uint256 deadline, uint256 currentTime);
    error AV__ZeroAddress();
    error AV__ZeroHash();

    // ─────────────────────────────────────────────────────────────────────────
    // Admin functions
    // ─────────────────────────────────────────────────────────────────────────

    function whitelistMeasurement(bytes32 measurementHash) external;
    function revokeMeasurement(bytes32 measurementHash) external;
    function registerEnclave(address signingKey, bytes32 measurementHash, string calldata description) external;
    function deactivateEnclave(address signingKey) external;
    function reactivateEnclave(address signingKey) external;

    // ─────────────────────────────────────────────────────────────────────────
    // Verification
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Recover the signer from a structured hash and verify it belongs
    ///         to an active registered enclave. Reverts on failure.
    function verifyAttestation(bytes32 structHash, bytes calldata signature) external view returns (address signer);

    /// @notice Returns true if the address is an active registered enclave key
    function isActiveEnclave(address signingKey) external view returns (bool);

    /// @notice Returns info about a registered enclave
    function getEnclaveInfo(address signingKey) external view returns (EnclaveInfo memory);

    /// @notice Returns true if a measurement hash is whitelisted
    function isMeasurementWhitelisted(bytes32 measurementHash) external view returns (bool);
}
