/**
 * Poseidon2 over BN254 — matches Barretenberg/Noir stdlib exactly.
 * Uses @zkpassport/poseidon2 which is verified against the BB test vector:
 *   permute([0,1,2,3])[0] === 0x01bd538c...01737
 */
import { permute } from "@zkpassport/poseidon2";

export const BN254_PRIME =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const TWO_POW_64 = 18446744073709551616n; // 2^64

function mod(x: bigint): bigint {
  return ((x % BN254_PRIME) + BN254_PRIME) % BN254_PRIME;
}

/** Poseidon2 sponge over 2 field elements (matches Noir's poseidon2_hash_2). */
function hash2(a: bigint, b: bigint): bigint {
  const iv = mod(2n * TWO_POW_64);
  let state: bigint[] = [a, b, 0n, iv];
  state = permute(state) as bigint[];
  return state[0];
}

/** Poseidon2 sponge over 4 field elements (matches Noir's poseidon2_hash_4). */
function hash4(a: bigint, b: bigint, c: bigint, d: bigint): bigint {
  const iv = mod(4n * TWO_POW_64);
  let state: bigint[] = [a, b, c, iv];
  state = permute(state) as bigint[];
  state[0] = mod(state[0] + d);
  state = permute(state) as bigint[];
  return state[0];
}

/**
 * Derive spending public key from private key.
 * Matches Noir: poseidon2_hash_2(privkey, 1)
 */
export function deriveSpendingPubkey(privkey: bigint): bigint {
  return hash2(privkey, 1n);
}

/**
 * Compute note commitment.
 * Matches Noir: poseidon2_hash_4(spending_pubkey, token, amount, salt)
 * All inputs must already be field elements (bigint mod BN254_PRIME).
 */
export function computeCommitment(
  spendingPubkey: bigint,
  token: bigint,
  amount: bigint,
  salt: bigint,
): bigint {
  return hash4(spendingPubkey, token, amount, salt);
}

/**
 * Compute nullifier for a note.
 * Matches Noir: poseidon2_hash_2(privkey, commitment)
 */
export function computeNullifier(privkey: bigint, commitment: bigint): bigint {
  return hash2(privkey, commitment);
}

/** Compute Merkle tree internal node hash (left || right). */
export function hashNode(left: bigint, right: bigint): bigint {
  return hash2(left, right);
}

/** Convert an Ethereum address string to a BN254 field element. */
export function addressToField(addr: string): bigint {
  return BigInt(addr.toLowerCase()) % BN254_PRIME;
}

/** Convert a 32-byte hex string to a BN254 field element. */
export function bytes32ToField(hex: string): bigint {
  return BigInt(hex) % BN254_PRIME;
}

/** Convert a field element to a 0x-prefixed 32-byte hex string. */
export function fieldToBytes32(x: bigint): string {
  return "0x" + x.toString(16).padStart(64, "0");
}
