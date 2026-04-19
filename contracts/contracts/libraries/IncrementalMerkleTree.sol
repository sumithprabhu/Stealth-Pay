// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {LibPoseidon2} from "./poseidon2/LibPoseidon2.sol";
import {Field} from "./poseidon2/Field.sol";

/// @title IncrementalMerkleTree
/// @notice Append-only binary Merkle tree using Poseidon2 hashing.
///         Hash function matches the Noir circuit's compute_root() exactly:
///           hash_node(l, r) = Poseidon2::hash([l, r], 2) = poseidon2_permutation([l, r, 0, iv])[0]
///         Stores only the "filled subtree" nodes — O(depth) storage.
/// @dev    Depth 20 supports up to 2^20 (~1 million) commitments.
library IncrementalMerkleTree {
    using LibPoseidon2 for *;
    using Field for *;

    uint256 internal constant MAX_DEPTH = 32;

    error IMT__DepthOutOfRange();
    error IMT__TreeFull();

    struct Tree {
        uint256 depth;
        uint256 nextIndex;
        bytes32 root;
        bytes32[MAX_DEPTH] filledSubtrees;
        bytes32[MAX_DEPTH] zeros;
    }

    /// @notice Initialise a new tree of given depth
    function init(Tree storage self, uint256 depth) internal {
        if (depth == 0 || depth > MAX_DEPTH) revert IMT__DepthOutOfRange();
        self.depth = depth;

        LibPoseidon2.Constants memory constants = LibPoseidon2.load();
        bytes32 currentZero = bytes32(0);
        for (uint256 i = 0; i < depth; ) {
            self.zeros[i] = currentZero;
            self.filledSubtrees[i] = currentZero;
            currentZero = _hash(constants, currentZero, currentZero);
            unchecked { ++i; }
        }
        self.root = currentZero;
    }

    /// @notice Insert a leaf and return the updated root
    function insert(Tree storage self, bytes32 leaf) internal returns (bytes32 newRoot) {
        uint256 depth = self.depth;
        uint256 currentIndex = self.nextIndex;

        if (currentIndex >= (1 << depth)) revert IMT__TreeFull();

        LibPoseidon2.Constants memory constants = LibPoseidon2.load();
        bytes32 currentLevelHash = leaf;

        for (uint256 i = 0; i < depth; ) {
            if (currentIndex & 1 == 0) {
                self.filledSubtrees[i] = currentLevelHash;
                currentLevelHash = _hash(constants, currentLevelHash, self.zeros[i]);
            } else {
                currentLevelHash = _hash(constants, self.filledSubtrees[i], currentLevelHash);
            }
            currentIndex >>= 1;
            unchecked { ++i; }
        }

        self.root = currentLevelHash;
        self.nextIndex = self.nextIndex + 1;
        return currentLevelHash;
    }

    function getRoot(Tree storage self) internal view returns (bytes32) { return self.root; }
    function size(Tree storage self) internal view returns (uint256) { return self.nextIndex; }
    function capacity(Tree storage self) internal view returns (uint256) { return 1 << self.depth; }

    // Poseidon2([left, right], 2) — matches hash_node() in merkle.nr exactly
    function _hash(LibPoseidon2.Constants memory constants, bytes32 left, bytes32 right)
        private
        pure
        returns (bytes32)
    {
        Field.Type result = LibPoseidon2.hash_2(constants, Field.Type.wrap(uint256(left)), Field.Type.wrap(uint256(right)));
        return bytes32(Field.Type.unwrap(result));
    }
}
