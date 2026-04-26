"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoteManager = exports.MerkleTree = void 0;
const ethers_1 = require("ethers");
const types_1 = require("./types");
const poseidon2_1 = require("./poseidon2");
// ─────────────────────────────────────────────────────────────────────────────
// Incremental Merkle tree — mirrors IncrementalMerkleTree.sol exactly.
// hash_node(l, r) = Poseidon2([l, r, 0, 2*2^64])[0]  (see hashNode in poseidon2.ts)
// ─────────────────────────────────────────────────────────────────────────────
class MerkleTree {
    constructor(depth = 20) {
        this.leaves = [];
        this.nodeCache = new Map();
        this.depth = depth;
        this.zeros = new Array(depth + 1);
        this.zeros[0] = 0n;
        for (let i = 1; i <= depth; i++) {
            this.zeros[i] = (0, poseidon2_1.hashNode)(this.zeros[i - 1], this.zeros[i - 1]);
        }
    }
    get size() { return this.leaves.length; }
    get capacity() { return 1 << this.depth; }
    insert(leaf) {
        if (this.leaves.length >= this.capacity) {
            throw new types_1.StealthPayError("Merkle tree is full", "TREE_FULL");
        }
        this.leaves.push(leaf);
        // Invalidate cached nodes along the insertion path
        let idx = this.leaves.length - 1;
        for (let level = 0; level < this.depth; level++) {
            this.nodeCache.delete(`${level}:${idx >> level}`);
        }
        this.nodeCache.delete(`root`);
    }
    getRoot() {
        return this._getNode(this.depth, 0);
    }
    /**
     * Returns the 20 sibling hashes for the leaf at `leafIndex`,
     * ordered from leaf level up to root (matching the Noir circuit's path order).
     */
    getSiblings(leafIndex) {
        if (leafIndex >= this.leaves.length) {
            throw new types_1.StealthPayError(`Leaf ${leafIndex} not in tree (size ${this.leaves.length})`, "LEAF_NOT_FOUND");
        }
        const siblings = [];
        let idx = leafIndex;
        for (let level = 0; level < this.depth; level++) {
            const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
            siblings.push(this._getNode(level, siblingIdx));
            idx = Math.floor(idx / 2);
        }
        return siblings;
    }
    /** Recompute root after bulk insertion (clears cache). */
    rebuild() {
        this.nodeCache.clear();
    }
    _getNode(level, index) {
        // If the entire subtree is beyond inserted leaves, return the zero subtree hash
        const firstLeaf = index << level;
        if (firstLeaf >= this.leaves.length) {
            return this.zeros[level];
        }
        if (level === 0) {
            return this.leaves[index] ?? 0n;
        }
        const key = `${level}:${index}`;
        const cached = this.nodeCache.get(key);
        if (cached !== undefined)
            return cached;
        const left = this._getNode(level - 1, index * 2);
        const right = this._getNode(level - 1, index * 2 + 1);
        const node = (0, poseidon2_1.hashNode)(left, right);
        this.nodeCache.set(key, node);
        return node;
    }
}
exports.MerkleTree = MerkleTree;
// ─────────────────────────────────────────────────────────────────────────────
// NoteManager
// ─────────────────────────────────────────────────────────────────────────────
const POOL_EVENTS_ABI = [
    "event Shielded(address indexed token, address indexed depositor, uint256 netAmount, uint256 fee, bytes32 indexed commitment, bytes32 newRoot, uint256 leafIndex)",
    "event Spent(address indexed token, bytes32[2] nullifiers, bytes32[2] newCommitments, uint256 publicAmount, address indexed recipient, bytes32 newRoot)",
];
class NoteManager {
    constructor(spendingPrivkey, poolContract, depth = 20) {
        this.spendingPrivkey = spendingPrivkey;
        this.poolContract = poolContract;
        this.ownedNotes = new Map(); // commitment.toString() → note
        this.spentNullifiers = new Set(); // nullifier.toString()
        this.allLeaves = [];
        this.tree = new MerkleTree(depth);
        this.spendingPubkey = (0, poseidon2_1.deriveSpendingPubkey)(spendingPrivkey);
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Sync from chain
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Replay all historical Shielded/Spent events to rebuild the local Merkle tree.
     * Call this once at startup before spending any notes.
     */
    async syncFromChain(provider, poolAddress, fromBlock = 0) {
        const pool = new ethers_1.ethers.Contract(poolAddress, POOL_EVENTS_ABI, provider);
        // Fetch Shielded events in order
        const shieldedLogs = await pool.queryFilter(pool.filters.Shielded(), fromBlock, "latest");
        // Fetch Spent events in order
        const spentLogs = await pool.queryFilter(pool.filters.Spent(), fromBlock, "latest");
        // Merge by block + log index to reconstruct insertion order
        const allLogs = [...shieldedLogs, ...spentLogs].sort((a, b) => {
            if (a.blockNumber !== b.blockNumber)
                return a.blockNumber - b.blockNumber;
            return a.index - b.index;
        });
        for (const log of allLogs) {
            if (!(log instanceof ethers_1.ethers.EventLog))
                continue;
            if (log.eventName === "Shielded") {
                const commitment = (0, poseidon2_1.bytes32ToField)(log.args.commitment);
                const token = log.args.token;
                const leafIndex = Number(log.args.leafIndex);
                this._insertLeaf(commitment, token, leafIndex);
            }
            else if (log.eventName === "Spent") {
                const nulls = log.args.nullifiers;
                const commits = log.args.newCommitments;
                const token = log.args.token;
                for (const n of nulls) {
                    const nullifier = (0, poseidon2_1.bytes32ToField)(n);
                    if (nullifier !== 0n)
                        this.spentNullifiers.add(nullifier.toString());
                }
                for (const c of commits) {
                    const commitment = (0, poseidon2_1.bytes32ToField)(c);
                    if (commitment !== 0n) {
                        const leafIndex = this.allLeaves.length;
                        this._insertLeaf(commitment, token, leafIndex);
                    }
                }
            }
        }
        // After full rebuild, recompute siblings for all owned notes
        this._refreshOwnedSiblings();
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Live event subscription
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Subscribe to real-time Shielded/Spent events and keep the tree up-to-date.
     * Call stopListening() (returned) to unsubscribe.
     */
    startListening() {
        const onShielded = (token, _depositor, _netAmt, _fee, commitment, _newRoot, leafIndex) => {
            const c = (0, poseidon2_1.bytes32ToField)(commitment);
            this._insertLeaf(c, token, Number(leafIndex));
            this._refreshOwnedSiblings();
        };
        const onSpent = (token, nullifiers, newCommitments, _publicAmt, _recipient) => {
            for (const n of nullifiers) {
                const nullifier = (0, poseidon2_1.bytes32ToField)(n);
                if (nullifier !== 0n) {
                    this.spentNullifiers.add(nullifier.toString());
                    // Mark any owned note with this nullifier as spent
                    for (const note of this.ownedNotes.values()) {
                        if (note.nullifier === nullifier)
                            note.spent = true;
                    }
                }
            }
            for (const c of newCommitments) {
                const commitment = (0, poseidon2_1.bytes32ToField)(c);
                if (commitment !== 0n) {
                    const leafIndex = this.allLeaves.length;
                    this._insertLeaf(commitment, token, leafIndex);
                }
            }
            this._refreshOwnedSiblings();
        };
        this.poolContract.on("Shielded", onShielded);
        this.poolContract.on("Spent", onSpent);
        const stop = () => {
            this.poolContract.off("Shielded", onShielded);
            this.poolContract.off("Spent", onSpent);
        };
        this.stopListening = stop;
        return stop;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Note tracking — call these when the user shields a new note
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Record a newly shielded note (call after shield() confirms on-chain).
     * `token` and `amount` and `salt` are the private note fields known to the SDK.
     */
    trackNote(commitment, token, amount, salt, leafIndex) {
        const nullifier = (0, poseidon2_1.computeNullifier)(this.spendingPrivkey, commitment);
        const siblings = this.tree.size > leafIndex
            ? this.tree.getSiblings(leafIndex)
            : Array(this.tree.depth).fill(0n);
        const note = {
            commitment, token, amount, salt,
            index: leafIndex, siblings, nullifier,
            spent: this.spentNullifiers.has(nullifier.toString()),
        };
        this.ownedNotes.set(commitment.toString(), note);
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Accessors
    // ─────────────────────────────────────────────────────────────────────────
    getNote(commitment) {
        return this.ownedNotes.get(commitment.toString());
    }
    getUnspentNotes(token) {
        const all = Array.from(this.ownedNotes.values()).filter((n) => !n.spent);
        return token ? all.filter((n) => n.token.toLowerCase() === token.toLowerCase()) : all;
    }
    isNullifierSpent(nullifier) {
        return this.spentNullifiers.has(nullifier.toString());
    }
    getCurrentRoot() {
        return this.tree.getRoot();
    }
    getSiblings(leafIndex) {
        return this.tree.getSiblings(leafIndex);
    }
    getTreeSize() {
        return this.tree.size;
    }
    /** Find the leaf index of a commitment in the local tree, if present. */
    findLeafIndex(commitment) {
        const idx = this.allLeaves.findIndex(l => l.commitment === commitment);
        return idx === -1 ? undefined : idx;
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────
    _insertLeaf(commitment, token, expectedIndex) {
        if (this.allLeaves.length !== expectedIndex) {
            // Out-of-order or duplicate — skip (shouldn't happen with sorted logs)
            return;
        }
        this.allLeaves.push({ commitment, token });
        this.tree.insert(commitment);
    }
    _refreshOwnedSiblings() {
        for (const note of this.ownedNotes.values()) {
            if (note.index >= 0 && note.index < this.tree.size) {
                note.siblings = this.tree.getSiblings(note.index);
            }
        }
    }
}
exports.NoteManager = NoteManager;
//# sourceMappingURL=NoteManager.js.map