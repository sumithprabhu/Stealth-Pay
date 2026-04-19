// Poseidon2 sponge (rate=3, state=4) using the public permutation builtin.
// Replicates the internal stdlib Poseidon2::hash exactly:
//   IV = message_len * 2^64
//   Absorb inputs in rate-3 blocks, then squeeze state[0].

global TWO_POW_64: Field = 18446744073709551616;

// 2-input variant: single permutation call.
fn poseidon2_hash_2(a: Field, b: Field) -> Field {
    let iv: Field = 2 * TWO_POW_64;
    let mut state: [Field; 4] = [a, b, 0, iv];
    state = std::hash::poseidon2_permutation(state);
    state[0]
}

// 4-input variant: two permutation calls (rate=3, so 3+1 split).
fn poseidon2_hash_4(a: Field, b: Field, c: Field, d: Field) -> Field {
    let iv: Field = 4 * TWO_POW_64;
    let mut state: [Field; 4] = [a, b, c, iv];
    state = std::hash::poseidon2_permutation(state);
    state[0] += d;
    state = std::hash::poseidon2_permutation(state);
    state[0]
}

// Derive spending pubkey from privkey.
// pubkey = Poseidon2([privkey, 1], 2)
pub fn derive_pubkey(privkey: Field) -> Field {
    poseidon2_hash_2(privkey, 1)
}

// Compute note commitment.
// commitment = Poseidon2([spending_pubkey, token, amount, salt], 4)
// Must match the on-chain Poseidon call in PrivacyPool.sol.
pub fn compute_commitment(
    spending_pubkey: Field,
    token:           Field,
    amount:          Field,
    salt:            Field,
) -> Field {
    poseidon2_hash_4(spending_pubkey, token, amount, salt)
}

// Compute nullifier.
// nullifier = Poseidon2([spending_privkey, commitment], 2)
// Only the spending key holder can compute this.
pub fn compute_nullifier(privkey: Field, commitment: Field) -> Field {
    poseidon2_hash_2(privkey, commitment)
}
