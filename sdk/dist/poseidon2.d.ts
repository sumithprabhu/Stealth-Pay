export declare const BN254_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
/**
 * Derive spending public key from private key.
 * Matches Noir: poseidon2_hash_2(privkey, 1)
 */
export declare function deriveSpendingPubkey(privkey: bigint): bigint;
/**
 * Compute note commitment.
 * Matches Noir: poseidon2_hash_4(spending_pubkey, token, amount, salt)
 * All inputs must already be field elements (bigint mod BN254_PRIME).
 */
export declare function computeCommitment(spendingPubkey: bigint, token: bigint, amount: bigint, salt: bigint): bigint;
/**
 * Compute nullifier for a note.
 * Matches Noir: poseidon2_hash_2(privkey, commitment)
 */
export declare function computeNullifier(privkey: bigint, commitment: bigint): bigint;
/** Compute Merkle tree internal node hash (left || right). */
export declare function hashNode(left: bigint, right: bigint): bigint;
/** Convert an Ethereum address string to a BN254 field element. */
export declare function addressToField(addr: string): bigint;
/** Convert a 32-byte hex string to a BN254 field element. */
export declare function bytes32ToField(hex: string): bigint;
/** Convert a field element to a 0x-prefixed 32-byte hex string. */
export declare function fieldToBytes32(x: bigint): string;
//# sourceMappingURL=poseidon2.d.ts.map