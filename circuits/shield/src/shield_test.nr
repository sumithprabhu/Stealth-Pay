use stealthpay_lib::note::{derive_pubkey, compute_commitment};
use crate::main as shield_main;

#[test]
fn test_shield_valid() {
    let privkey: Field = 1;
    let pubkey = derive_pubkey(privkey);
    let token: Field = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48; // USDC-like addr
    let amount: Field = 1000;
    let salt: Field = 0xDEADBEEF;

    let commitment = compute_commitment(pubkey, token, amount, salt);

    // Should not panic
    shield_main(pubkey, token, amount, salt, commitment);
}

#[test(should_fail_with = "commitment mismatch")]
fn test_shield_wrong_commitment() {
    let privkey: Field = 1;
    let pubkey = derive_pubkey(privkey);
    let token: Field = 100;
    let amount: Field = 500;
    let salt: Field = 7;

    let bad_commitment: Field = 999;
    shield_main(pubkey, token, amount, salt, bad_commitment);
}

#[test(should_fail_with = "amount must be non-zero")]
fn test_shield_zero_amount() {
    let pubkey: Field = 1;
    let token: Field = 100;
    let amount: Field = 0;
    let salt: Field = 7;

    let commitment = compute_commitment(pubkey, token, amount, salt);
    shield_main(pubkey, token, amount, salt, commitment);
}
