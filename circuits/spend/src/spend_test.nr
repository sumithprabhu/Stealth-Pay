use stealthpay_lib::note::{derive_pubkey, compute_commitment, compute_nullifier};
use stealthpay_lib::merkle::compute_root;
use crate::main as spend_main;

// Build test state: single note at a given index, all siblings = 0.
fn make_single_note_state(
    privkey: Field,
    token: Field,
    amount: Field,
    salt: Field,
    index: Field,
) -> (Field, Field, [Field; 20]) {
    let pubkey = derive_pubkey(privkey);
    let commitment = compute_commitment(pubkey, token, amount, salt);
    let path: [Field; 20] = [0; 20];
    let root = compute_root(commitment, index, path);
    (commitment, root, path)
}

// Private transfer: 1 input -> 1 output, public_amount = 0.
#[test]
fn test_spend_private_transfer() {
    let privkey: Field = 1;
    let token: Field = 100;
    let amount: Field = 500;
    let in_salt: Field = 11;
    let out_salt: Field = 22;
    let index: Field = 0;

    let pubkey = derive_pubkey(privkey);
    let (commitment, root, path) = make_single_note_state(privkey, token, amount, in_salt, index);
    let nullifier = compute_nullifier(privkey, commitment);
    let out_commitment = compute_commitment(pubkey, token, amount, out_salt);

    spend_main(
        privkey,
        [amount, 0], [in_salt, 0],
        [path, [0; 20]], [index, 0],
        [true, false],
        [pubkey, 0], [amount, 0], [out_salt, 0],
        [true, false],
        token, root,
        [nullifier, 0], [out_commitment, 0],
        0, 0,
    );
}

// Unshield: 1 input -> 0 outputs + public amount.
#[test]
fn test_spend_unshield() {
    let privkey: Field = 2;
    let token: Field = 200;
    let amount: Field = 300;
    let in_salt: Field = 55;
    let index: Field = 3;
    let recipient: Field = 0xdeadbeef;

    let (commitment, root, path) = make_single_note_state(privkey, token, amount, in_salt, index);
    let nullifier = compute_nullifier(privkey, commitment);

    spend_main(
        privkey,
        [amount, 0], [in_salt, 0],
        [path, [0; 20]], [index, 0],
        [true, false],
        [0, 0], [0, 0], [0, 0],
        [false, false],
        token, root,
        [nullifier, 0], [0, 0],
        amount, recipient,
    );
}

// 2-input merge: two notes -> 1 output note.
#[test]
fn test_spend_merge_two_inputs() {
    let privkey: Field = 3;
    let token: Field = 300;
    let amount1: Field = 100;
    let amount2: Field = 200;
    let salt1: Field = 1;
    let salt2: Field = 2;
    let out_salt: Field = 3;

    let pubkey = derive_pubkey(privkey);
    let c1 = compute_commitment(pubkey, token, amount1, salt1);
    let c2 = compute_commitment(pubkey, token, amount2, salt2);

    let path1: [Field; 20] = [c2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let path2: [Field; 20] = [c1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    let root1 = compute_root(c1, 0, path1);
    let root2 = compute_root(c2, 1, path2);
    assert(root1 == root2); // both notes must be in the same tree

    let n1 = compute_nullifier(privkey, c1);
    let n2 = compute_nullifier(privkey, c2);
    let total: Field = 300;
    let out_c = compute_commitment(pubkey, token, total, out_salt);

    spend_main(
        privkey,
        [amount1, amount2], [salt1, salt2],
        [path1, path2], [0, 1],
        [true, true],
        [pubkey, 0], [total, 0], [out_salt, 0],
        [true, false],
        token, root1,
        [n1, n2], [out_c, 0],
        0, 0,
    );
}

#[test(should_fail_with = "amounts do not balance")]
fn test_spend_imbalanced_amounts() {
    let privkey: Field = 4;
    let token: Field = 400;
    let amount: Field = 100;
    let salt: Field = 77;
    let out_salt: Field = 88;
    let index: Field = 0;

    let pubkey = derive_pubkey(privkey);
    let (commitment, root, path) = make_single_note_state(privkey, token, amount, salt, index);
    let nullifier = compute_nullifier(privkey, commitment);

    // Output amount is 200 but input is only 100 -> should fail
    let bad_out_amount: Field = 200;
    let out_c = compute_commitment(pubkey, token, bad_out_amount, out_salt);

    spend_main(
        privkey,
        [amount, 0], [salt, 0],
        [path, [0; 20]], [index, 0],
        [true, false],
        [pubkey, 0], [bad_out_amount, 0], [out_salt, 0],
        [true, false],
        token, root,
        [nullifier, 0], [out_c, 0],
        0, 0,
    );
}

#[test(should_fail_with = "nullifier mismatch")]
fn test_spend_wrong_nullifier() {
    let privkey: Field = 5;
    let token: Field = 500;
    let amount: Field = 50;
    let salt: Field = 99;
    let out_salt: Field = 100;
    let index: Field = 0;

    let pubkey = derive_pubkey(privkey);
    let (_commitment, root, path) = make_single_note_state(privkey, token, amount, salt, index);
    let bad_nullifier: Field = 0x1234;
    let out_c = compute_commitment(pubkey, token, amount, out_salt);

    spend_main(
        privkey,
        [amount, 0], [salt, 0],
        [path, [0; 20]], [index, 0],
        [true, false],
        [pubkey, 0], [amount, 0], [out_salt, 0],
        [true, false],
        token, root,
        [bad_nullifier, 0], [out_c, 0],
        0, 0,
    );
}
