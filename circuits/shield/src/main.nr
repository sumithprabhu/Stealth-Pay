use stealthpay_lib::note::compute_commitment;

mod shield_test;

// Shield circuit
//
// Proves that `commitment` was honestly computed from the private note inputs.
// The contract verifies this proof before inserting the commitment into the
// Merkle tree, ensuring only valid commitments enter the pool.
//
// Private inputs (never revealed on-chain):
//   spending_pubkey  - owner's public key (derived from their spending privkey)
//   token            - ERC-20 token address as Field
//   amount           - token amount (fits in u64, range-checked below)
//   salt             - random 32-byte entropy
//
// Public inputs (visible on-chain):
//   commitment       - the hash the contract will insert into the Merkle tree
fn main(
    // Private
    spending_pubkey: Field,
    token:           Field,
    amount:          Field,
    salt:            Field,

    // Public
    commitment: pub Field,
) {
    // 1. Verify commitment = Poseidon(pubkey, token, amount, salt)
    let computed = compute_commitment(spending_pubkey, token, amount, salt);
    assert(computed == commitment, "commitment mismatch");

    // 2. Amount must be non-zero (can't shield 0 tokens)
    assert(amount != 0, "amount must be non-zero");

    // 3. Range check: amount fits in 64 bits (prevents field-wrapping attacks)
    let _amount_u64 = amount as u64;
    assert(_amount_u64 as Field == amount, "amount overflows u64");
}
