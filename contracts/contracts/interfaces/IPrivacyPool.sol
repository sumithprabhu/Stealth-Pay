// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IPrivacyPool
/// @notice Interface for the StealthPay privacy pool.
///
///  Flow:
///    1. shield()       — user deposits public ERC-20 tokens.
///                        Tokens are locked in this contract.
///                        TEE creates an encrypted private note in 0G Storage.
///                        A commitment (hash of the note) is added to the on-chain Merkle tree.
///
///    2. privateAction() — TEE executes private logic (transfers, swaps, etc.)
///                         inside the enclave, updates encrypted state in 0G Storage,
///                         and submits a new root + nullifiers to mark consumed notes.
///
///    3. unshield()      — TEE burns a private note and authorises the contract to
///                         release real tokens to a chosen public address.
interface IPrivacyPool {
    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Parameters for a shield (deposit) operation
    struct ShieldParams {
        address token;        // ERC-20 token address
        uint256 amount;       // gross amount to shield (fee deducted on-chain)
        bytes32 commitment;   // keccak256 commitment to the new private note
    }

    /// @notice Parameters for an unshield (withdrawal) operation — signed by TEE
    struct UnshieldParams {
        address token;        // ERC-20 token to release
        uint256 amount;       // net amount to send to recipient (after fee)
        address recipient;    // public destination address
        bytes32 nullifier;    // unique ID of the consumed private note
        bytes32 newRoot;      // updated commitment tree root after consuming the note
        uint256 deadline;     // UNIX timestamp — attestation expires after this
        uint256 nonce;        // unique nonce per TEE signer (anti-replay)
    }

    /// @notice Parameters for a private action — signed by TEE
    ///         Covers: private transfer, private swap side-effects, etc.
    struct PrivateActionParams {
        bytes32[] nullifiers;      // consumed note IDs (one or more)
        bytes32[] newCommitments;  // new note commitments created by the action
        bytes32   newRoot;         // updated tree root
        uint256   deadline;
        uint256   nonce;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event Shielded(
        address indexed token,
        address indexed depositor,
        uint256 amount,
        uint256 fee,
        bytes32 indexed commitment,
        bytes32 newRoot,
        uint256 leafIndex
    );

    event Unshielded(
        address indexed token,
        address indexed recipient,
        uint256 amount,
        uint256 fee,
        bytes32 indexed nullifier,
        bytes32 newRoot
    );

    event PrivateActionExecuted(
        bytes32 indexed newRoot,
        bytes32[] nullifiers,
        bytes32[] newCommitments
    );

    event TokenWhitelisted(address indexed token, address indexed by);
    event TokenDelisted(address indexed token, address indexed by);
    event ProtocolFeeUpdated(uint256 oldFeeBps, uint256 newFeeBps, address indexed by);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient, address indexed by);
    event AttestationVerifierUpdated(address indexed oldVerifier, address indexed newVerifier, address indexed by);
    event EmergencyWithdrawal(address indexed token, address indexed to, uint256 amount, address indexed by);

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error PP__TokenNotWhitelisted(address token);
    error PP__CommitmentAlreadyExists(bytes32 commitment);
    error PP__NullifierAlreadySpent(bytes32 nullifier);
    error PP__InvalidNewRoot(bytes32 expected, bytes32 provided);
    error PP__ZeroAmount();
    error PP__ZeroAddress();
    error PP__InvalidFee(uint256 feeBps);
    error PP__TransferFailed();
    error PP__ArrayLengthMismatch();
    error PP__EmptyNullifiers();
    error PP__EmptyCommitments();
    error PP__TreeFull();
    error PP__AttestationExpired(uint256 deadline);

    // ─────────────────────────────────────────────────────────────────────────
    // Core operations
    // ─────────────────────────────────────────────────────────────────────────

    function shield(ShieldParams calldata params) external;

    function unshield(UnshieldParams calldata params, bytes calldata teeSignature) external;

    function privateAction(PrivateActionParams calldata params, bytes calldata teeSignature) external;

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function whitelistToken(address token) external;
    function delistToken(address token) external;
    function setProtocolFee(uint256 feeBps) external;
    function setFeeRecipient(address recipient) external;
    function setAttestationVerifier(address verifier) external;
    function emergencyWithdraw(address token, address to, uint256 amount) external;

    // ─────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────

    function getRoot() external view returns (bytes32);
    function getTreeSize() external view returns (uint256);
    function isNullifierSpent(bytes32 nullifier) external view returns (bool);
    function isCommitmentKnown(bytes32 commitment) external view returns (bool);
    function isTokenWhitelisted(address token) external view returns (bool);
    function getTokenBalance(address token) external view returns (uint256);
    function protocolFeeBps() external view returns (uint256);
    function feeRecipient() external view returns (address);
    function attestationVerifier() external view returns (address);
}
