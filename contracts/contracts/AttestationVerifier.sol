// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {UUPSUpgradeable}         from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {EIP712Upgradeable}        from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {Initializable}            from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ECDSA}                    from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import {IAttestationVerifier} from "./interfaces/IAttestationVerifier.sol";

/// @title AttestationVerifier
/// @notice Manages a registry of trusted TEE enclave signing keys and verifies
///         EIP-712 structured attestation payloads signed by those enclaves.
///
/// Trust model
/// ───────────
///   1. An Intel TDX (or compatible) TEE node starts up, generates an ECDSA
///      keypair *inside* the hardware enclave (key never leaves).
///   2. The enclave produces a hardware quote that binds the public key to the
///      enclave measurement (MRTD / MR_ENCLAVE).
///   3. An off-chain verifier (or DCAP contract) validates the quote and
///      confirms the measurement matches an approved build.
///   4. An admin calls registerEnclave() with the validated public key and
///      measurement hash — that key is now trusted on-chain.
///   5. Every subsequent operation signed by that key is accepted without
///      further hardware interaction.
///
/// @custom:security-contact security@stealthpay.xyz
contract AttestationVerifier is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    EIP712Upgradeable,
    IAttestationVerifier
{
    using ECDSA for bytes32;

    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────

    bytes32 public constant ENCLAVE_MANAGER_ROLE = keccak256("ENCLAVE_MANAGER_ROLE");
    bytes32 public constant UPGRADER_ROLE         = keccak256("UPGRADER_ROLE");

    // ─────────────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev signingKey => EnclaveInfo
    mapping(address => EnclaveInfo) private _enclaves;

    /// @dev measurementHash => whitelisted
    mapping(bytes32 => bool) private _whitelistedMeasurements;

    /// @dev Total number of ever-registered enclaves (for off-chain indexing)
    uint256 public totalEnclaves;

    // ─────────────────────────────────────────────────────────────────────────
    // Storage gap for future upgrades
    // ─────────────────────────────────────────────────────────────────────────

    uint256[46] private __gap;

    // ─────────────────────────────────────────────────────────────────────────
    // Initializer
    // ─────────────────────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialise the contract (called once via proxy deploy)
    /// @param admin   Address granted DEFAULT_ADMIN_ROLE and UPGRADER_ROLE
    function initialize(address admin) external initializer {
        if (admin == address(0)) revert AV__ZeroAddress();

        __AccessControl_init();
        __EIP712_init("StealthPayAttestationVerifier", "1");

        _grantRole(DEFAULT_ADMIN_ROLE,    admin);
        _grantRole(ENCLAVE_MANAGER_ROLE,  admin);
        _grantRole(UPGRADER_ROLE,         admin);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin — Measurement whitelist
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Approve a TEE build measurement so its keys can be registered
    function whitelistMeasurement(bytes32 measurementHash)
        external
        onlyRole(ENCLAVE_MANAGER_ROLE)
    {
        if (measurementHash == bytes32(0)) revert AV__ZeroHash();
        _whitelistedMeasurements[measurementHash] = true;
        emit MeasurementWhitelisted(measurementHash, msg.sender);
    }

    /// @notice Revoke a previously whitelisted measurement
    ///         All enclaves with this measurement are effectively untrusted
    ///         from the next verification onward (active flag unchanged —
    ///         deactivate individually if needed).
    function revokeMeasurement(bytes32 measurementHash)
        external
        onlyRole(ENCLAVE_MANAGER_ROLE)
    {
        if (measurementHash == bytes32(0)) revert AV__ZeroHash();
        _whitelistedMeasurements[measurementHash] = false;
        emit MeasurementRevoked(measurementHash, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin — Enclave registry
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Register a TEE enclave signing key after off-chain attestation
    ///         verification. The measurement hash must be pre-whitelisted.
    function registerEnclave(
        address signingKey,
        bytes32 measurementHash,
        string calldata description
    ) external onlyRole(ENCLAVE_MANAGER_ROLE) {
        if (signingKey     == address(0)) revert AV__ZeroAddress();
        if (measurementHash == bytes32(0)) revert AV__ZeroHash();
        if (_enclaves[signingKey].registeredAt != 0)
            revert AV__EnclaveAlreadyRegistered(signingKey);
        if (!_whitelistedMeasurements[measurementHash])
            revert AV__MeasurementNotWhitelisted(measurementHash);

        _enclaves[signingKey] = EnclaveInfo({
            signingKey:      signingKey,
            measurementHash: measurementHash,
            registeredAt:    uint64(block.timestamp),
            active:          true,
            description:     description
        });
        unchecked { ++totalEnclaves; }

        emit EnclaveRegistered(signingKey, measurementHash, msg.sender, description);
    }

    /// @notice Deactivate an enclave key (e.g. if the node is compromised)
    function deactivateEnclave(address signingKey)
        external
        onlyRole(ENCLAVE_MANAGER_ROLE)
    {
        _requireEnclaveExists(signingKey);
        _enclaves[signingKey].active = false;
        emit EnclaveDeactivated(signingKey, msg.sender);
    }

    /// @notice Re-enable a previously deactivated enclave key
    function reactivateEnclave(address signingKey)
        external
        onlyRole(ENCLAVE_MANAGER_ROLE)
    {
        _requireEnclaveExists(signingKey);
        // Measurement must still be whitelisted
        if (!_whitelistedMeasurements[_enclaves[signingKey].measurementHash])
            revert AV__MeasurementNotWhitelisted(_enclaves[signingKey].measurementHash);
        _enclaves[signingKey].active = true;
        emit EnclaveReactivated(signingKey, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Verification
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Recover signer from an EIP-712 struct hash and verify it is an
    ///         active registered enclave. Reverts on any failure.
    /// @param  structHash  EIP-712 hashStruct of the operation payload
    /// @param  signature   65-byte ECDSA signature from the TEE enclave
    /// @return signer      The recovered enclave signing address
    function verifyAttestation(bytes32 structHash, bytes calldata signature)
        external
        view
        returns (address signer)
    {
        bytes32 digest = _hashTypedDataV4(structHash);
        signer = ECDSA.recover(digest, signature);
        if (signer == address(0)) revert AV__InvalidSignature();

        EnclaveInfo storage info = _enclaves[signer];
        if (info.registeredAt == 0)  revert AV__EnclaveNotFound(signer);
        if (!info.active)            revert AV__EnclaveInactive(signer);
        // Double-check measurement is still whitelisted (handles revocation)
        if (!_whitelistedMeasurements[info.measurementHash])
            revert AV__MeasurementNotWhitelisted(info.measurementHash);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────

    function isActiveEnclave(address signingKey) external view returns (bool) {
        EnclaveInfo storage info = _enclaves[signingKey];
        return info.registeredAt != 0 &&
               info.active &&
               _whitelistedMeasurements[info.measurementHash];
    }

    function getEnclaveInfo(address signingKey)
        external
        view
        returns (EnclaveInfo memory)
    {
        _requireEnclaveExists(signingKey);
        return _enclaves[signingKey];
    }

    function isMeasurementWhitelisted(bytes32 measurementHash)
        external
        view
        returns (bool)
    {
        return _whitelistedMeasurements[measurementHash];
    }

    /// @notice Expose the EIP-712 domain separator for off-chain signers
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    function _requireEnclaveExists(address signingKey) internal view {
        if (_enclaves[signingKey].registeredAt == 0)
            revert AV__EnclaveNotFound(signingKey);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UUPS upgrade guard
    // ─────────────────────────────────────────────────────────────────────────

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {}
}
