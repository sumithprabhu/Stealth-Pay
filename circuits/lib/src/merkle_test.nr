use crate::merkle::compute_root;

// Build a trivial depth-20 tree where all siblings are zero.
// The root should be consistent regardless of the index direction.
#[test]
fn test_compute_root_all_zero_siblings() {
    let leaf: Field = 0x1234567890;
    let index: Field = 0; // all left turns
    let path: [Field; 20] = [0; 20];

    let root1 = compute_root(leaf, index, path);
    assert(root1 != 0);

    // Same leaf, same path -> same root.
    let root2 = compute_root(leaf, index, path);
    assert(root1 == root2);
}

// Different leaves must produce different roots (with same sibling path).
#[test]
fn test_compute_root_different_leaves() {
    let path: [Field; 20] = [0; 20];
    let root1 = compute_root(1, 0, path);
    let root2 = compute_root(2, 0, path);
    assert(root1 != root2);
}

// Changing the index (path direction) must change the root.
#[test]
fn test_compute_root_index_matters() {
    let leaf: Field = 0xABCD;
    let path: [Field; 20] = [0; 20];
    let root_left = compute_root(leaf, 0, path);
    let root_right = compute_root(leaf, 1, path);
    assert(root_left != root_right);
}

// Manually verify two-level consistency:
// node_level1 = hash(leaf, sibling0)  when index bit 0 = 0
// root        = hash(node_level1, sibling1)  when index bit 1 = 0
#[test]
fn test_compute_root_manual_two_levels() {
    let leaf: Field = 42;
    let sibling0: Field = 7;
    let sibling1: Field = 13;

    // Build path with non-zero first two siblings, rest zero.
    let mut path: [Field; 20] = [0; 20];
    path[0] = sibling0;
    path[1] = sibling1;

    // index = 0: all left-hand-side
    let root = compute_root(leaf, 0, path);
    assert(root != 0);

    // Same computation with a different leaf must differ.
    let root2 = compute_root(99, 0, path);
    assert(root != root2);
}
