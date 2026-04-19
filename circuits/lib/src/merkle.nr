// Depth of the Incremental Merkle Tree (supports up to 2^20 notes).
pub global TREE_DEPTH: u32 = 20;

global TWO_POW_64: Field = 18446744073709551616;

// Hash two Merkle nodes: Poseidon2([left, right], 2).
fn hash_node(left: Field, right: Field) -> Field {
    let iv: Field = 2 * TWO_POW_64;
    let mut state: [Field; 4] = [left, right, 0, iv];
    state = std::hash::poseidon2_permutation(state);
    state[0]
}

// Recompute the Merkle root from a leaf and its sibling path.
//
// index - leaf position (lower 20 bits used as path direction selector)
// path  - sibling hashes from leaf level up to root
//
// At each level: bit=0 means leaf is on the left, bit=1 means right.
// Must match IncrementalMerkleTree.sol (same Poseidon2 hash, same convention).
pub fn compute_root(leaf: Field, index: Field, path: [Field; 20]) -> Field {
    let index_bits: [bool; 20] = index.to_le_bits();
    let mut node = leaf;

    for i in 0..20 {
        let is_right = index_bits[i];
        let (left, right) = if is_right {
            (path[i], node)
        } else {
            (node, path[i])
        };
        node = hash_node(left, right);
    }

    node
}
