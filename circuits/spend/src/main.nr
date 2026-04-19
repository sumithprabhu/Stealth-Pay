use stealthpay_lib::note::{derive_pubkey, compute_commitment, compute_nullifier};
use stealthpay_lib::merkle::compute_root;

mod spend_test;

// Spend circuit - handles both private transfer and unshield.
//
// Supports up to 2 input notes and 2 output notes (fixed at compile time).
// Unused slots are disabled via the `in_enabled` / `out_enabled` flags:
//   Disabled input  : amount must be 0, nullifier must be 0
//   Disabled output : amount must be 0, new_commitment must be 0
//
// Conservation invariant:
//   sum(enabled input amounts) == sum(enabled output amounts) + public_amount
//
// Private transfer  : public_amount = 0, recipient = 0
// Unshield          : public_amount > 0, recipient = target address
//
// Private inputs (known only to the prover / SDK):
//   spending_privkey   - owner's secret spending key
//   in_amounts         - amounts of the 2 input note slots
//   in_salts           - salts of the 2 input note slots
//   in_paths           - Merkle sibling paths (one per input note)
//   in_indices         - leaf positions in the Merkle tree
//   in_enabled         - which input slots hold real notes
//   out_pubkeys        - spending pubkeys of the 2 output note receivers
//   out_amounts        - amounts for output notes
//   out_salts          - random salts for output notes
//   out_enabled        - which output slots are real notes
//
// Public inputs (verified by the contract):
//   token              - ERC-20 token address (all notes share one token)
//   merkle_root        - current Merkle root the prover proves membership against
//   nullifiers         - revealed nullifiers (2 slots; 0 for disabled inputs)
//   new_commitments    - output commitments to insert (2 slots; 0 for disabled)
//   public_amount      - amount released publicly (0 for private transfer)
//   recipient          - public recipient address (0 for private transfer)

fn main(
    // -- Private ---------------------------------------------------------------
    spending_privkey: Field,

    in_amounts:  [Field; 2],
    in_salts:    [Field; 2],
    in_paths:    [[Field; 20]; 2],
    in_indices:  [Field; 2],
    in_enabled:  [bool; 2],

    out_pubkeys:  [Field; 2],
    out_amounts:  [Field; 2],
    out_salts:    [Field; 2],
    out_enabled:  [bool; 2],

    // -- Public ----------------------------------------------------------------
    token:           pub Field,
    merkle_root:     pub Field,
    nullifiers:      pub [Field; 2],
    new_commitments: pub [Field; 2],
    public_amount:   pub Field,
    recipient:       pub Field,
) {
    // Derive spending pubkey - proves the prover knows the privkey
    let spending_pubkey = derive_pubkey(spending_privkey);

    let mut in_total:  u64 = 0;
    let mut out_total: u64 = 0;

    // -- Verify input notes ----------------------------------------------------
    for i in 0..2 {
        if in_enabled[i] {
            // Range-check amount
            let amount_u64 = in_amounts[i] as u64;
            assert(amount_u64 as Field == in_amounts[i], "input amount overflows u64");
            assert(in_amounts[i] != 0, "enabled input amount must be non-zero");

            // Recompute commitment from private note data
            let commitment = compute_commitment(
                spending_pubkey,
                token,
                in_amounts[i],
                in_salts[i],
            );

            // Prove commitment is in the Merkle tree
            let computed_root = compute_root(commitment, in_indices[i], in_paths[i]);
            assert(computed_root == merkle_root, "merkle root mismatch");

            // Prove the revealed nullifier is correctly derived
            let expected_nullifier = compute_nullifier(spending_privkey, commitment);
            assert(nullifiers[i] == expected_nullifier, "nullifier mismatch");

            in_total += amount_u64;
        } else {
            // Disabled slot: nullifier must be 0 (nothing to reveal)
            assert(nullifiers[i] == 0, "disabled input nullifier must be zero");
            assert(in_amounts[i] == 0, "disabled input amount must be zero");
        }
    }

    // -- Verify output notes ---------------------------------------------------
    for i in 0..2 {
        if out_enabled[i] {
            // Range-check amount
            let amount_u64 = out_amounts[i] as u64;
            assert(amount_u64 as Field == out_amounts[i], "output amount overflows u64");
            assert(out_amounts[i] != 0, "enabled output amount must be non-zero");

            // Verify the revealed commitment matches the private output note
            let commitment = compute_commitment(
                out_pubkeys[i],
                token,
                out_amounts[i],
                out_salts[i],
            );
            assert(new_commitments[i] == commitment, "output commitment mismatch");

            out_total += amount_u64;
        } else {
            // Disabled slot: commitment must be 0 (nothing to insert)
            assert(new_commitments[i] == 0, "disabled output commitment must be zero");
            assert(out_amounts[i] == 0, "disabled output amount must be zero");
        }
    }

    // -- Conservation check ----------------------------------------------------
    // inputs == outputs + public withdrawal (no money created or destroyed)
    let public_u64 = public_amount as u64;
    assert(public_u64 as Field == public_amount, "public_amount overflows u64");

    assert(in_total == out_total + public_u64, "amounts do not balance");

    // -- Consistency checks ----------------------------------------------------
    // If no public withdrawal, recipient must be zero address
    if public_amount == 0 {
        assert(recipient == 0, "recipient must be zero for private transfer");
    }

    // Public amount must be non-negative (always true for u64, but explicit)
    assert(in_total >= public_u64, "insufficient input for public withdrawal");
}
