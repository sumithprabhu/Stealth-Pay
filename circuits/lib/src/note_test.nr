use crate::note::{derive_pubkey, compute_commitment, compute_nullifier};

// Test that derive_pubkey is deterministic and non-zero.
#[test]
fn test_derive_pubkey_deterministic() {
    let privkey: Field = 42;
    let pk1 = derive_pubkey(privkey);
    let pk2 = derive_pubkey(privkey);
    assert(pk1 == pk2);
    assert(pk1 != 0);
}

// Different privkeys must yield different pubkeys.
#[test]
fn test_derive_pubkey_unique() {
    let pk1 = derive_pubkey(1);
    let pk2 = derive_pubkey(2);
    assert(pk1 != pk2);
}

// Commitment is deterministic and non-zero.
#[test]
fn test_commitment_deterministic() {
    let pubkey: Field = 0x1234;
    let token: Field = 0xABCD;
    let amount: Field = 1000;
    let salt: Field = 0xDEAD;
    let c1 = compute_commitment(pubkey, token, amount, salt);
    let c2 = compute_commitment(pubkey, token, amount, salt);
    assert(c1 == c2);
    assert(c1 != 0);
}

// Changing any input changes the commitment.
#[test]
fn test_commitment_sensitivity() {
    let base = compute_commitment(1, 2, 3, 4);
    assert(base != compute_commitment(9, 2, 3, 4));
    assert(base != compute_commitment(1, 9, 3, 4));
    assert(base != compute_commitment(1, 2, 9, 4));
    assert(base != compute_commitment(1, 2, 3, 9));
}

// Nullifier is deterministic, non-zero, and unique per privkey/commitment pair.
#[test]
fn test_nullifier_deterministic() {
    let privkey: Field = 99;
    let commitment: Field = 0xCAFE;
    let n1 = compute_nullifier(privkey, commitment);
    let n2 = compute_nullifier(privkey, commitment);
    assert(n1 == n2);
    assert(n1 != 0);
}

#[test]
fn test_nullifier_unique() {
    let n1 = compute_nullifier(1, 100);
    let n2 = compute_nullifier(2, 100);
    let n3 = compute_nullifier(1, 200);
    assert(n1 != n2);
    assert(n1 != n3);
    assert(n2 != n3);
}
