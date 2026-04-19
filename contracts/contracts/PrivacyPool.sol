// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {UUPSUpgradeable}          from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable}      from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {Initializable}            from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {SafeERC20}                from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20}                   from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IPrivacyPool}          from "./interfaces/IPrivacyPool.sol";
import {IncrementalMerkleTree} from "./libraries/IncrementalMerkleTree.sol";
import {Field}                 from "./libraries/poseidon2/Field.sol";

/// @dev Minimal interface for the auto-generated UltraHonk verifier contracts.
interface IHonkVerifier {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}

/// @title PrivacyPool (V2 - ZK proofs)
/// @notice Privacy pool secured by UltraHonk ZK proofs instead of TEE attestations.
///
/// Architecture
/// ------------
///   - shield(): user deposits tokens + submits ShieldVerifier ZK proof that
///     commitment = Poseidon2(pubkey, token, amount, salt).
///   - spend():  user submits SpendVerifier ZK proof proving Merkle membership,
///     correct nullifiers, and conservation of value. Handles both private
///     transfer (public_amount = 0) and unshield (public_amount > 0).
///
/// Public input layout (spend circuit, as declared in spend/src/main.nr):
///   [8 aggregation-object zeros, token, merkle_root, nullifiers[0], nullifiers[1],
///    new_commitments[0], new_commitments[1], public_amount, recipient]
///
/// Public input layout (shield circuit):
///   [8 aggregation-object zeros, commitment]
///
/// @custom:security-contact security@stealthpay.xyz
contract PrivacyPool is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardTransient,
    PausableUpgradeable,
    IPrivacyPool
{
    using SafeERC20            for IERC20;
    using IncrementalMerkleTree for IncrementalMerkleTree.Tree;

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    bytes32 public constant PAUSER_ROLE   = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    uint256 public constant MAX_FEE_BPS = 1000; // 10%
    uint256 public constant TREE_DEPTH  = 20;

    // UltraHonk EVM target adds 8 aggregation-object public inputs before user inputs.
    uint256 private constant AGG_OBJECT_SIZE = 8;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    IncrementalMerkleTree.Tree private _tree;

    mapping(bytes32 => bool) private _knownCommitments;
    mapping(bytes32 => bool) private _spentNullifiers;
    mapping(address => bool) private _whitelistedTokens;

    IHonkVerifier private _shieldVerifier;
    IHonkVerifier private _spendVerifier;

    uint256 public protocolFeeBps;
    address public feeRecipient;

    uint256[42] private __gap;

    // -------------------------------------------------------------------------
    // Constructor / initializer
    // -------------------------------------------------------------------------

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(
        address admin_,
        address shieldVerifier_,
        address spendVerifier_,
        uint256 protocolFeeBps_,
        address feeRecipient_
    ) external initializer {
        if (admin_          == address(0)) revert PP__ZeroAddress();
        if (shieldVerifier_ == address(0)) revert PP__ZeroAddress();
        if (spendVerifier_  == address(0)) revert PP__ZeroAddress();
        if (feeRecipient_   == address(0)) revert PP__ZeroAddress();
        if (protocolFeeBps_ >  MAX_FEE_BPS) revert PP__InvalidFee(protocolFeeBps_);

        __AccessControl_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(PAUSER_ROLE,        admin_);
        _grantRole(UPGRADER_ROLE,      admin_);
        _grantRole(OPERATOR_ROLE,      admin_);

        _tree.init(TREE_DEPTH);
        _shieldVerifier = IHonkVerifier(shieldVerifier_);
        _spendVerifier  = IHonkVerifier(spendVerifier_);
        protocolFeeBps  = protocolFeeBps_;
        feeRecipient    = feeRecipient_;
    }

    // -------------------------------------------------------------------------
    // Core - shield (public -> private)
    // -------------------------------------------------------------------------

    /// @notice Deposit tokens into the pool. Caller must provide a ZK proof that
    ///         commitment = Poseidon2(spending_pubkey, token, amount, salt).
    function shield(ShieldParams calldata params, bytes calldata proof)
        external
        nonReentrant
        whenNotPaused
    {
        if (!_whitelistedTokens[params.token])    revert PP__TokenNotWhitelisted(params.token);
        if (params.amount     == 0)                revert PP__ZeroAmount();
        if (params.commitment == bytes32(0))        revert PP__ZeroAddress();
        if (_knownCommitments[params.commitment])   revert PP__CommitmentAlreadyExists(params.commitment);
        if (_tree.size() >= _tree.capacity())       revert PP__TreeFull();

        // Build public inputs: [8 agg zeros, commitment]
        bytes32[] memory publicInputs = new bytes32[](AGG_OBJECT_SIZE + 1);
        publicInputs[AGG_OBJECT_SIZE] = params.commitment;

        if (!_shieldVerifier.verify(proof, publicInputs)) revert PP__InvalidZKProof();

        // Pull tokens
        uint256 before = IERC20(params.token).balanceOf(address(this));
        IERC20(params.token).safeTransferFrom(msg.sender, address(this), params.amount);
        uint256 received = IERC20(params.token).balanceOf(address(this)) - before;

        uint256 fee      = _computeFee(received);
        uint256 netAmount = received - fee;
        if (fee > 0) IERC20(params.token).safeTransfer(feeRecipient, fee);

        _knownCommitments[params.commitment] = true;
        uint256 leafIndex = _tree.nextIndex;
        bytes32 newRoot   = _tree.insert(params.commitment);

        emit Shielded(params.token, msg.sender, netAmount, fee, params.commitment, newRoot, leafIndex);
    }

    // -------------------------------------------------------------------------
    // Core - spend (private transfer or unshield)
    // -------------------------------------------------------------------------

    /// @notice Execute a private spend. The ZK proof must satisfy the spend circuit:
    ///         - Merkle membership for each enabled input note
    ///         - Correct nullifier derivation
    ///         - Conservation: sum(inputs) == sum(outputs) + public_amount
    ///         - If public_amount > 0, tokens are released to recipient
    function spend(SpendParams calldata params, bytes calldata proof)
        external
        nonReentrant
        whenNotPaused
    {
        if (!_whitelistedTokens[params.token]) revert PP__TokenNotWhitelisted(params.token);

        // The prover must prove against the CURRENT on-chain root
        if (params.merkleRoot != _tree.getRoot()) revert PP__InvalidMerkleRoot(params.merkleRoot);

        // Check no nullifier already spent
        if (_spentNullifiers[params.nullifiers[0]]) revert PP__NullifierAlreadySpent(params.nullifiers[0]);
        if (_spentNullifiers[params.nullifiers[1]]) revert PP__NullifierAlreadySpent(params.nullifiers[1]);

        // Check no output commitment conflict (only for non-zero commitments)
        if (params.newCommitments[0] != bytes32(0) && _knownCommitments[params.newCommitments[0]])
            revert PP__CommitmentAlreadyExists(params.newCommitments[0]);
        if (params.newCommitments[1] != bytes32(0) && _knownCommitments[params.newCommitments[1]])
            revert PP__CommitmentAlreadyExists(params.newCommitments[1]);

        // Build public inputs:
        // [8 agg zeros, token, merkle_root, null[0], null[1], commit[0], commit[1], pub_amount, recipient]
        bytes32[] memory publicInputs = new bytes32[](AGG_OBJECT_SIZE + 8);
        publicInputs[AGG_OBJECT_SIZE + 0] = bytes32(uint256(uint160(params.token)));
        publicInputs[AGG_OBJECT_SIZE + 1] = params.merkleRoot;
        publicInputs[AGG_OBJECT_SIZE + 2] = params.nullifiers[0];
        publicInputs[AGG_OBJECT_SIZE + 3] = params.nullifiers[1];
        publicInputs[AGG_OBJECT_SIZE + 4] = params.newCommitments[0];
        publicInputs[AGG_OBJECT_SIZE + 5] = params.newCommitments[1];
        publicInputs[AGG_OBJECT_SIZE + 6] = bytes32(params.publicAmount);
        publicInputs[AGG_OBJECT_SIZE + 7] = bytes32(uint256(uint160(params.recipient)));

        if (!_spendVerifier.verify(proof, publicInputs)) revert PP__InvalidZKProof();

        // Mark nullifiers spent
        _spentNullifiers[params.nullifiers[0]] = true;
        _spentNullifiers[params.nullifiers[1]] = true;

        // Insert non-zero output commitments into the Merkle tree
        if (params.newCommitments[0] != bytes32(0)) {
            if (_tree.size() >= _tree.capacity()) revert PP__TreeFull();
            _knownCommitments[params.newCommitments[0]] = true;
            _tree.insert(params.newCommitments[0]);
        }
        if (params.newCommitments[1] != bytes32(0)) {
            if (_tree.size() >= _tree.capacity()) revert PP__TreeFull();
            _knownCommitments[params.newCommitments[1]] = true;
            _tree.insert(params.newCommitments[1]);
        }

        bytes32 newRoot = _tree.getRoot();

        // Release public amount if this is an unshield
        if (params.publicAmount > 0) {
            uint256 fee       = _computeFee(params.publicAmount);
            uint256 netRelease = params.publicAmount - fee;
            if (fee > 0) IERC20(params.token).safeTransfer(feeRecipient, fee);
            IERC20(params.token).safeTransfer(params.recipient, netRelease);
        }

        emit Spent(
            params.token,
            params.nullifiers,
            params.newCommitments,
            params.publicAmount,
            params.recipient,
            newRoot
        );
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function whitelistToken(address token) external onlyRole(OPERATOR_ROLE) {
        if (token == address(0)) revert PP__ZeroAddress();
        _whitelistedTokens[token] = true;
        emit TokenWhitelisted(token, msg.sender);
    }

    function delistToken(address token) external onlyRole(OPERATOR_ROLE) {
        _whitelistedTokens[token] = false;
        emit TokenDelisted(token, msg.sender);
    }

    function setProtocolFee(uint256 feeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (feeBps > MAX_FEE_BPS) revert PP__InvalidFee(feeBps);
        emit ProtocolFeeUpdated(protocolFeeBps, feeBps, msg.sender);
        protocolFeeBps = feeBps;
    }

    function setFeeRecipient(address recipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (recipient == address(0)) revert PP__ZeroAddress();
        emit FeeRecipientUpdated(feeRecipient, recipient, msg.sender);
        feeRecipient = recipient;
    }

    function pause()   external onlyRole(PAUSER_ROLE)   { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE)   { _unpause(); }

    function emergencyWithdraw(address token, address to, uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
    {
        if (to == address(0)) revert PP__ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit EmergencyWithdrawal(token, to, amount, msg.sender);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function getRoot()              external view returns (bytes32)  { return _tree.getRoot(); }
    function getTreeSize()          external view returns (uint256)  { return _tree.size(); }
    function isNullifierSpent(bytes32 n) external view returns (bool) { return _spentNullifiers[n]; }
    function isCommitmentKnown(bytes32 c) external view returns (bool) { return _knownCommitments[c]; }
    function isTokenWhitelisted(address t) external view returns (bool) { return _whitelistedTokens[t]; }
    function getTokenBalance(address t)    external view returns (uint256) { return IERC20(t).balanceOf(address(this)); }
    function shieldVerifier() external view returns (address) { return address(_shieldVerifier); }
    function spendVerifier()  external view returns (address) { return address(_spendVerifier); }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    function _computeFee(uint256 amount) internal view returns (uint256) {
        return (amount * protocolFeeBps) / 10_000;
    }

    function _authorizeUpgrade(address) internal override onlyRole(UPGRADER_ROLE) {}
}
