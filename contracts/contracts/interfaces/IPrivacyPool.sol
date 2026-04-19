// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IPrivacyPool (V2 - ZK proofs)
/// @notice Interface for the StealthPay privacy pool using UltraHonk ZK proofs.
///
///  Flow:
///    1. shield()  - user deposits ERC-20 tokens and proves the commitment is
///                   honestly computed via a ShieldVerifier ZK proof.
///
///    2. spend()   - user proves note ownership via a SpendVerifier ZK proof.
///                   Handles both private transfers (new output commitments) and
///                   unshields (public token release). Supports 2-in / 2-out.
interface IPrivacyPool {

    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    struct ShieldParams {
        address token;
        uint256 amount;
        bytes32 commitment;
    }

    struct SpendParams {
        address token;
        bytes32 merkleRoot;
        bytes32[2] nullifiers;
        bytes32[2] newCommitments;
        uint256 publicAmount;
        address recipient;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event Shielded(
        address indexed token,
        address indexed depositor,
        uint256 netAmount,
        uint256 fee,
        bytes32 indexed commitment,
        bytes32 newRoot,
        uint256 leafIndex
    );

    event Spent(
        address indexed token,
        bytes32[2] nullifiers,
        bytes32[2] newCommitments,
        uint256 publicAmount,
        address indexed recipient,
        bytes32 newRoot
    );

    event TokenWhitelisted(address indexed token, address indexed by);
    event TokenDelisted(address indexed token, address indexed by);
    event ProtocolFeeUpdated(uint256 oldFeeBps, uint256 newFeeBps, address indexed by);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient, address indexed by);
    event EmergencyWithdrawal(address indexed token, address indexed to, uint256 amount, address indexed by);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error PP__TokenNotWhitelisted(address token);
    error PP__CommitmentAlreadyExists(bytes32 commitment);
    error PP__NullifierAlreadySpent(bytes32 nullifier);
    error PP__InvalidMerkleRoot(bytes32 provided);
    error PP__InvalidZKProof();
    error PP__ZeroAmount();
    error PP__ZeroAddress();
    error PP__InvalidFee(uint256 feeBps);
    error PP__TreeFull();

    // -------------------------------------------------------------------------
    // Core
    // -------------------------------------------------------------------------

    function shield(ShieldParams calldata params, bytes calldata proof) external;
    function spend(SpendParams calldata params, bytes calldata proof) external;

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function whitelistToken(address token) external;
    function delistToken(address token) external;
    function setProtocolFee(uint256 feeBps) external;
    function setFeeRecipient(address recipient) external;
    function emergencyWithdraw(address token, address to, uint256 amount) external;

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function getRoot() external view returns (bytes32);
    function getTreeSize() external view returns (uint256);
    function isNullifierSpent(bytes32 nullifier) external view returns (bool);
    function isCommitmentKnown(bytes32 commitment) external view returns (bool);
    function isTokenWhitelisted(address token) external view returns (bool);
    function getTokenBalance(address token) external view returns (uint256);
    function protocolFeeBps() external view returns (uint256);
    function feeRecipient() external view returns (address);
}
