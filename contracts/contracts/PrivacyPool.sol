// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {UUPSUpgradeable}          from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable}      from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {EIP712Upgradeable}        from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {Initializable}            from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
// ReentrancyGuardTransient uses EIP-1153 transient storage (cancun) — no initializer needed,
// fully compatible with UUPS proxies since transient slots reset every transaction.
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {SafeERC20}                from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20}                   from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ECDSA}                    from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import {IPrivacyPool}       from "./interfaces/IPrivacyPool.sol";
import {IAttestationVerifier} from "./interfaces/IAttestationVerifier.sol";
import {IncrementalMerkleTree} from "./libraries/IncrementalMerkleTree.sol";

/// @title PrivacyPool
/// @notice The on-chain settlement layer for StealthPay.
///
/// Architecture
/// ────────────
///   • All shielded tokens are held by this contract (the "privacy pool").
///   • Private state (note contents, balances) lives encrypted in 0G Storage —
///     *never* on-chain.
///   • The on-chain Merkle tree tracks commitments (hashes of private notes)
///     so the contract can verify a note existed without knowing its contents.
///   • Nullifiers prevent double-spending: once a note is consumed the TEE
///     submits its nullifier; any replay is rejected.
///   • Every state transition that touches private logic is authorised by a
///     hardware-attested TEE signature verified via AttestationVerifier.
///
/// EIP-712 type hashes
/// ───────────────────
///   UnshieldPayload(address token,uint256 amount,address recipient,
///     bytes32 nullifier,bytes32 newRoot,uint256 deadline,uint256 nonce)
///
///   PrivateActionPayload(bytes32[] nullifiers,bytes32[] newCommitments,
///     bytes32 newRoot,uint256 deadline,uint256 nonce)
///
/// @custom:security-contact security@stealthpay.xyz
contract PrivacyPool is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardTransient,
    PausableUpgradeable,
    EIP712Upgradeable,
    IPrivacyPool
{
    using SafeERC20            for IERC20;
    using IncrementalMerkleTree for IncrementalMerkleTree.Tree;

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    bytes32 public constant PAUSER_ROLE   = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    uint256 public constant MAX_FEE_BPS   = 1000; // 10%
    uint256 public constant TREE_DEPTH    = 20;   // 2^20 ≈ 1 million leaves

    // EIP-712 type hashes
    bytes32 public constant UNSHIELD_TYPEHASH =
        keccak256(
            "UnshieldPayload(address token,uint256 amount,address recipient,"
            "bytes32 nullifier,bytes32 newRoot,uint256 deadline,uint256 nonce)"
        );

    bytes32 public constant PRIVATE_ACTION_TYPEHASH =
        keccak256(
            "PrivateActionPayload(bytes32[] nullifiers,bytes32[] newCommitments,"
            "bytes32 newRoot,uint256 deadline,uint256 nonce)"
        );

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    /// @dev Commitment Merkle tree — append-only, one leaf per shielded note
    IncrementalMerkleTree.Tree private _tree;

    /// @dev commitmentHash => has been inserted into the tree
    mapping(bytes32 => bool) private _knownCommitments;

    /// @dev nullifier => has been spent (prevents double-spend)
    mapping(bytes32 => bool) private _spentNullifiers;

    /// @dev token address => whitelisted
    mapping(address => bool) private _whitelistedTokens;

    /// @dev (signingKey, nonce) => used (TEE replay protection)
    mapping(address => mapping(uint256 => bool)) private _usedNonces;

    IAttestationVerifier private _attestationVerifier;
    uint256              public protocolFeeBps;
    address              public feeRecipient;

    // ─────────────────────────────────────────────────────────────────────────
    // Storage gap
    // ─────────────────────────────────────────────────────────────────────────

    uint256[44] private __gap;

    // ─────────────────────────────────────────────────────────────────────────
    // Initializer
    // ─────────────────────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Deploy and configure the privacy pool
    /// @param admin_              Admin address (all privileged roles)
    /// @param attestationVerifier_ AttestationVerifier proxy address
    /// @param protocolFeeBps_     Initial fee in basis points (e.g. 10 = 0.1%)
    /// @param feeRecipient_       Address that receives protocol fees
    function initialize(
        address admin_,
        address attestationVerifier_,
        uint256 protocolFeeBps_,
        address feeRecipient_
    ) external initializer {
        if (admin_              == address(0)) revert PP__ZeroAddress();
        if (attestationVerifier_ == address(0)) revert PP__ZeroAddress();
        if (feeRecipient_       == address(0)) revert PP__ZeroAddress();
        if (protocolFeeBps_     >  MAX_FEE_BPS) revert PP__InvalidFee(protocolFeeBps_);

        __AccessControl_init();
        __Pausable_init();
        __EIP712_init("StealthPayPrivacyPool", "1");
        // ReentrancyGuardTransient uses transient storage — no init needed

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(PAUSER_ROLE,        admin_);
        _grantRole(UPGRADER_ROLE,      admin_);
        _grantRole(OPERATOR_ROLE,      admin_);

        _tree.init(TREE_DEPTH);
        _attestationVerifier = IAttestationVerifier(attestationVerifier_);
        protocolFeeBps      = protocolFeeBps_;
        feeRecipient        = feeRecipient_;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core — Shield (public → private)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Deposit ERC-20 tokens into the privacy pool.
    ///         The TEE will create an encrypted private note in 0G Storage.
    ///         The commitment (hash of the note) is inserted into the Merkle tree.
    /// @dev    No TEE signature required: shield is a fully public, user-initiated action.
    function shield(ShieldParams calldata params)
        external
        nonReentrant
        whenNotPaused
    {
        if (!_whitelistedTokens[params.token]) revert PP__TokenNotWhitelisted(params.token);
        if (params.amount     == 0)             revert PP__ZeroAmount();
        if (params.commitment == bytes32(0))     revert PP__ZeroAddress(); // reuse zero-check error
        if (_knownCommitments[params.commitment]) revert PP__CommitmentAlreadyExists(params.commitment);
        if (_tree.size() >= _tree.capacity())    revert PP__TreeFull();

        // Pull tokens from user (reverts if allowance insufficient)
        uint256 balanceBefore = IERC20(params.token).balanceOf(address(this));
        IERC20(params.token).safeTransferFrom(msg.sender, address(this), params.amount);
        uint256 received = IERC20(params.token).balanceOf(address(this)) - balanceBefore;

        // Deduct protocol fee
        uint256 fee       = _computeFee(received);
        uint256 netAmount = received - fee;
        if (fee > 0) {
            IERC20(params.token).safeTransfer(feeRecipient, fee);
        }

        // Insert commitment into Merkle tree
        _knownCommitments[params.commitment] = true;
        uint256 leafIndex = _tree.nextIndex;
        bytes32 newRoot   = _tree.insert(params.commitment);

        emit Shielded(
            params.token,
            msg.sender,
            netAmount,
            fee,
            params.commitment,
            newRoot,
            leafIndex
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core — Unshield (private → public)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Exit the privacy pool: TEE burns a private note and authorises
    ///         release of real tokens to a public recipient address.
    /// @param  params       Unshield parameters (signed by TEE)
    /// @param  teeSignature EIP-712 signature from an active registered TEE enclave
    function unshield(UnshieldParams calldata params, bytes calldata teeSignature)
        external
        nonReentrant
        whenNotPaused
    {
        // ── Validations ───────────────────────────────────────────────────────
        if (!_whitelistedTokens[params.token])  revert PP__TokenNotWhitelisted(params.token);
        if (params.amount    == 0)               revert PP__ZeroAmount();
        if (params.recipient == address(0))      revert PP__ZeroAddress();
        if (block.timestamp  > params.deadline)  revert PP__AttestationExpired(params.deadline);
        if (_spentNullifiers[params.nullifier])  revert PP__NullifierAlreadySpent(params.nullifier);

        // ── Verify TEE attestation ────────────────────────────────────────────
        bytes32 structHash = keccak256(abi.encode(
            UNSHIELD_TYPEHASH,
            params.token,
            params.amount,
            params.recipient,
            params.nullifier,
            params.newRoot,
            params.deadline,
            params.nonce
        ));
        address enclaveSigner = _attestationVerifier.verifyAttestation(structHash, teeSignature);

        // ── Nonce replay protection per TEE signer ────────────────────────────
        if (_usedNonces[enclaveSigner][params.nonce])
            revert PP__NullifierAlreadySpent(bytes32(params.nonce)); // reuse error
        _usedNonces[enclaveSigner][params.nonce] = true;

        // ── State updates ─────────────────────────────────────────────────────
        _spentNullifiers[params.nullifier] = true;

        // Note: for unshield the TEE consumes a note but doesn't insert a new one.
        // The newRoot reflects the updated private state in 0G Storage — we store
        // it as the authoritative root so future proofs reference correct state.
        // (The on-chain tree only grows; newRoot here is an off-chain state root.)
        // We emit it for indexers but do NOT overwrite the on-chain Merkle root.

        // Deduct protocol fee from the released amount
        uint256 fee         = _computeFee(params.amount);
        uint256 netRelease  = params.amount - fee;

        if (fee > 0) {
            IERC20(params.token).safeTransfer(feeRecipient, fee);
        }
        IERC20(params.token).safeTransfer(params.recipient, netRelease);

        emit Unshielded(
            params.token,
            params.recipient,
            netRelease,
            fee,
            params.nullifier,
            params.newRoot
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core — Private Action (private transfer / swap / etc.)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Record the result of a TEE-executed private operation.
    ///         The TEE consumed one or more private notes (nullifiers) and
    ///         created new ones (commitments). New commitments are inserted into
    ///         the on-chain Merkle tree. No tokens move publicly.
    function privateAction(PrivateActionParams calldata params, bytes calldata teeSignature)
        external
        nonReentrant
        whenNotPaused
    {
        // ── Validations ───────────────────────────────────────────────────────
        if (params.nullifiers.length    == 0) revert PP__EmptyNullifiers();
        if (params.newCommitments.length == 0) revert PP__EmptyCommitments();
        if (block.timestamp > params.deadline) revert PP__AttestationExpired(params.deadline);

        // Check no nullifier already spent
        for (uint256 i; i < params.nullifiers.length; ) {
            if (_spentNullifiers[params.nullifiers[i]])
                revert PP__NullifierAlreadySpent(params.nullifiers[i]);
            unchecked { ++i; }
        }

        // ── Verify TEE attestation ────────────────────────────────────────────
        bytes32 structHash = keccak256(abi.encode(
            PRIVATE_ACTION_TYPEHASH,
            keccak256(abi.encodePacked(params.nullifiers)),
            keccak256(abi.encodePacked(params.newCommitments)),
            params.newRoot,
            params.deadline,
            params.nonce
        ));
        address enclaveSigner = _attestationVerifier.verifyAttestation(structHash, teeSignature);

        // ── Nonce replay protection ───────────────────────────────────────────
        if (_usedNonces[enclaveSigner][params.nonce])
            revert PP__NullifierAlreadySpent(bytes32(params.nonce));
        _usedNonces[enclaveSigner][params.nonce] = true;

        // ── Mark nullifiers spent ─────────────────────────────────────────────
        for (uint256 i; i < params.nullifiers.length; ) {
            _spentNullifiers[params.nullifiers[i]] = true;
            unchecked { ++i; }
        }

        // ── Insert new commitments ─────────────────────────────────────────────
        if (_tree.size() + params.newCommitments.length > _tree.capacity())
            revert PP__TreeFull();

        for (uint256 i; i < params.newCommitments.length; ) {
            bytes32 c = params.newCommitments[i];
            if (_knownCommitments[c]) revert PP__CommitmentAlreadyExists(c);
            _knownCommitments[c] = true;
            _tree.insert(c);
            unchecked { ++i; }
        }

        emit PrivateActionExecuted(params.newRoot, params.nullifiers, params.newCommitments);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin — Token management
    // ─────────────────────────────────────────────────────────────────────────

    function whitelistToken(address token)
        external
        onlyRole(OPERATOR_ROLE)
    {
        if (token == address(0)) revert PP__ZeroAddress();
        _whitelistedTokens[token] = true;
        emit TokenWhitelisted(token, msg.sender);
    }

    function delistToken(address token)
        external
        onlyRole(OPERATOR_ROLE)
    {
        _whitelistedTokens[token] = false;
        emit TokenDelisted(token, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin — Protocol parameters
    // ─────────────────────────────────────────────────────────────────────────

    function setProtocolFee(uint256 feeBps)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (feeBps > MAX_FEE_BPS) revert PP__InvalidFee(feeBps);
        emit ProtocolFeeUpdated(protocolFeeBps, feeBps, msg.sender);
        protocolFeeBps = feeBps;
    }

    function setFeeRecipient(address recipient)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (recipient == address(0)) revert PP__ZeroAddress();
        emit FeeRecipientUpdated(feeRecipient, recipient, msg.sender);
        feeRecipient = recipient;
    }

    function setAttestationVerifier(address verifier)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (verifier == address(0)) revert PP__ZeroAddress();
        emit AttestationVerifierUpdated(address(_attestationVerifier), verifier, msg.sender);
        _attestationVerifier = IAttestationVerifier(verifier);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin — Emergency controls
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Pause all user-facing operations (shield/unshield/privateAction)
    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }

    /// @notice Resume operations
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    /// @notice Emergency token recovery — only callable by DEFAULT_ADMIN_ROLE
    ///         Intended for stuck funds or critical security incidents only.
    function emergencyWithdraw(address token, address to, uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
    {
        if (to == address(0)) revert PP__ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit EmergencyWithdrawal(token, to, amount, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────────────────

    function attestationVerifier() external view returns (address) {
        return address(_attestationVerifier);
    }

    function getRoot() external view returns (bytes32) {
        return _tree.getRoot();
    }

    function getTreeSize() external view returns (uint256) {
        return _tree.size();
    }

    function isNullifierSpent(bytes32 nullifier) external view returns (bool) {
        return _spentNullifiers[nullifier];
    }

    function isCommitmentKnown(bytes32 commitment) external view returns (bool) {
        return _knownCommitments[commitment];
    }

    function isTokenWhitelisted(address token) external view returns (bool) {
        return _whitelistedTokens[token];
    }

    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    /// @notice Expose the EIP-712 domain separator for off-chain signers
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    function _computeFee(uint256 amount) internal view returns (uint256) {
        return (amount * protocolFeeBps) / 10_000;
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
