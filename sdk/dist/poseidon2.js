"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BN254_PRIME = void 0;
exports.deriveSpendingPubkey = deriveSpendingPubkey;
exports.computeCommitment = computeCommitment;
exports.computeNullifier = computeNullifier;
exports.hashNode = hashNode;
exports.addressToField = addressToField;
exports.bytes32ToField = bytes32ToField;
exports.fieldToBytes32 = fieldToBytes32;
/**
 * Poseidon2 over BN254 — matches Barretenberg/Noir stdlib exactly.
 * Uses @zkpassport/poseidon2 which is verified against the BB test vector:
 *   permute([0,1,2,3])[0] === 0x01bd538c...01737
 */
const poseidon2_1 = require("@zkpassport/poseidon2");
exports.BN254_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const TWO_POW_64 = 18446744073709551616n; // 2^64
function mod(x) {
    return ((x % exports.BN254_PRIME) + exports.BN254_PRIME) % exports.BN254_PRIME;
}
/** Poseidon2 sponge over 2 field elements (matches Noir's poseidon2_hash_2). */
function hash2(a, b) {
    const iv = mod(2n * TWO_POW_64);
    let state = [a, b, 0n, iv];
    state = (0, poseidon2_1.permute)(state);
    return state[0];
}
/** Poseidon2 sponge over 4 field elements (matches Noir's poseidon2_hash_4). */
function hash4(a, b, c, d) {
    const iv = mod(4n * TWO_POW_64);
    let state = [a, b, c, iv];
    state = (0, poseidon2_1.permute)(state);
    state[0] = mod(state[0] + d);
    state = (0, poseidon2_1.permute)(state);
    return state[0];
}
/**
 * Derive spending public key from private key.
 * Matches Noir: poseidon2_hash_2(privkey, 1)
 */
function deriveSpendingPubkey(privkey) {
    return hash2(privkey, 1n);
}
/**
 * Compute note commitment.
 * Matches Noir: poseidon2_hash_4(spending_pubkey, token, amount, salt)
 * All inputs must already be field elements (bigint mod BN254_PRIME).
 */
function computeCommitment(spendingPubkey, token, amount, salt) {
    return hash4(spendingPubkey, token, amount, salt);
}
/**
 * Compute nullifier for a note.
 * Matches Noir: poseidon2_hash_2(privkey, commitment)
 */
function computeNullifier(privkey, commitment) {
    return hash2(privkey, commitment);
}
/** Compute Merkle tree internal node hash (left || right). */
function hashNode(left, right) {
    return hash2(left, right);
}
/** Convert an Ethereum address string to a BN254 field element. */
function addressToField(addr) {
    return BigInt(addr.toLowerCase()) % exports.BN254_PRIME;
}
/** Convert a 32-byte hex string to a BN254 field element. */
function bytes32ToField(hex) {
    return BigInt(hex) % exports.BN254_PRIME;
}
/** Convert a field element to a 0x-prefixed 32-byte hex string. */
function fieldToBytes32(x) {
    return "0x" + x.toString(16).padStart(64, "0");
}
//# sourceMappingURL=poseidon2.js.map