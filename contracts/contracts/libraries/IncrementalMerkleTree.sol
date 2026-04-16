// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IncrementalMerkleTree
/// @notice Append-only binary Merkle tree with keccak256 hashing.
///         Stores only the "filled subtree" nodes needed to compute the
///         insertion path — O(depth) storage instead of O(2^depth).
/// @dev    Depth 20 supports up to 2^20 (~1 million) commitments.
library IncrementalMerkleTree {
    uint256 internal constant MAX_DEPTH = 32;

    error IMT__DepthOutOfRange();
    error IMT__TreeFull();

    struct Tree {
        uint256 depth;
        uint256 nextIndex;
        bytes32 root;
        /// @dev filledSubtrees[i] = root of the subtree of height i
        ///      that is completely filled on the left side
        bytes32[MAX_DEPTH] filledSubtrees;
        /// @dev zeros[i] = keccak hash of a zero-valued subtree at height i
        bytes32[MAX_DEPTH] zeros;
    }

    /// @notice Initialise a new tree of given depth
    function init(Tree storage self, uint256 depth) internal {
        if (depth == 0 || depth > MAX_DEPTH) revert IMT__DepthOutOfRange();
        self.depth = depth;

        // Pre-compute zero subtree hashes bottom-up
        bytes32 currentZero = bytes32(0);
        for (uint256 i = 0; i < depth; ) {
            self.zeros[i] = currentZero;
            self.filledSubtrees[i] = currentZero;
            currentZero = _hash(currentZero, currentZero);
            unchecked { ++i; }
        }
        self.root = currentZero;
    }

    /// @notice Insert a leaf and return the updated root
    function insert(Tree storage self, bytes32 leaf) internal returns (bytes32 newRoot) {
        uint256 depth = self.depth;
        uint256 currentIndex = self.nextIndex;

        if (currentIndex >= (1 << depth)) revert IMT__TreeFull();

        bytes32 currentLevelHash = leaf;
        uint256 i;

        for (i = 0; i < depth; ) {
            if (currentIndex & 1 == 0) {
                // Left child: store it, pair with zero on the right
                self.filledSubtrees[i] = currentLevelHash;
                currentLevelHash = _hash(currentLevelHash, self.zeros[i]);
            } else {
                // Right child: pair with stored left sibling
                currentLevelHash = _hash(self.filledSubtrees[i], currentLevelHash);
            }
            currentIndex >>= 1;
            unchecked { ++i; }
        }

        self.root = currentLevelHash;
        self.nextIndex = self.nextIndex + 1;
        return currentLevelHash;
    }

    /// @notice Returns the current Merkle root
    function getRoot(Tree storage self) internal view returns (bytes32) {
        return self.root;
    }

    /// @notice Returns the number of leaves inserted so far
    function size(Tree storage self) internal view returns (uint256) {
        return self.nextIndex;
    }

    /// @notice Returns the maximum number of leaves this tree can hold
    function capacity(Tree storage self) internal view returns (uint256) {
        return 1 << self.depth;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _hash(bytes32 left, bytes32 right) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(left, right));
    }
}
