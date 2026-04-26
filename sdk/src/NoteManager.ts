import { ethers } from "ethers";
import { Note, StealthPayError } from "./types";
import {
  hashNode,
  deriveSpendingPubkey,
  computeCommitment,
  computeNullifier,
  bytes32ToField,
  fieldToBytes32,
} from "./poseidon2";

// ─────────────────────────────────────────────────────────────────────────────
// Incremental Merkle tree — mirrors IncrementalMerkleTree.sol exactly.
// hash_node(l, r) = Poseidon2([l, r, 0, 2*2^64])[0]  (see hashNode in poseidon2.ts)
// ─────────────────────────────────────────────────────────────────────────────

export class MerkleTree {
  readonly depth: number;
  readonly zeros: bigint[]; // zeros[i] = hash of an empty subtree at level i
  private readonly leaves: bigint[] = [];
  private nodeCache = new Map<string, bigint>();

  constructor(depth = 20) {
    this.depth = depth;
    this.zeros = new Array(depth + 1);
    this.zeros[0] = 0n;
    for (let i = 1; i <= depth; i++) {
      this.zeros[i] = hashNode(this.zeros[i - 1], this.zeros[i - 1]);
    }
  }

  get size(): number { return this.leaves.length; }
  get capacity(): number { return 1 << this.depth; }

  insert(leaf: bigint): void {
    if (this.leaves.length >= this.capacity) {
      throw new StealthPayError("Merkle tree is full", "TREE_FULL");
    }
    this.leaves.push(leaf);
    // Invalidate cached nodes along the insertion path
    let idx = this.leaves.length - 1;
    for (let level = 0; level < this.depth; level++) {
      this.nodeCache.delete(`${level}:${idx >> level}`);
    }
    this.nodeCache.delete(`root`);
  }

  getRoot(): bigint {
    return this._getNode(this.depth, 0);
  }

  /**
   * Returns the 20 sibling hashes for the leaf at `leafIndex`,
   * ordered from leaf level up to root (matching the Noir circuit's path order).
   */
  getSiblings(leafIndex: number): bigint[] {
    if (leafIndex >= this.leaves.length) {
      throw new StealthPayError(`Leaf ${leafIndex} not in tree (size ${this.leaves.length})`, "LEAF_NOT_FOUND");
    }
    const siblings: bigint[] = [];
    let idx = leafIndex;
    for (let level = 0; level < this.depth; level++) {
      const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      siblings.push(this._getNode(level, siblingIdx));
      idx = Math.floor(idx / 2);
    }
    return siblings;
  }

  /** Recompute root after bulk insertion (clears cache). */
  rebuild(): void {
    this.nodeCache.clear();
  }

  private _getNode(level: number, index: number): bigint {
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
    if (cached !== undefined) return cached;

    const left  = this._getNode(level - 1, index * 2);
    const right = this._getNode(level - 1, index * 2 + 1);
    const node  = hashNode(left, right);
    this.nodeCache.set(key, node);
    return node;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NoteManager
// ─────────────────────────────────────────────────────────────────────────────

const POOL_EVENTS_ABI = [
  "event Shielded(address indexed token, address indexed depositor, uint256 netAmount, uint256 fee, bytes32 indexed commitment, bytes32 newRoot, uint256 leafIndex)",
  "event Spent(address indexed token, bytes32[2] nullifiers, bytes32[2] newCommitments, uint256 publicAmount, address indexed recipient, bytes32 newRoot)",
];

export interface ManagedNote extends Note {
  /** siblings are always up-to-date; never zero-filled after sync */
  siblings: bigint[];
}

export class NoteManager {
  private readonly tree: MerkleTree;
  private readonly ownedNotes = new Map<string, ManagedNote>(); // commitment.toString() → note
  private readonly spentNullifiers = new Set<string>(); // nullifier.toString()
  private readonly allLeaves: Array<{ commitment: bigint; token: string }> = [];

  private readonly spendingPubkey: bigint;
  private stopListening?: () => void;

  constructor(
    private readonly spendingPrivkey: bigint,
    private readonly poolContract: ethers.Contract,
    depth = 20,
  ) {
    this.tree          = new MerkleTree(depth);
    this.spendingPubkey = deriveSpendingPubkey(spendingPrivkey);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Sync from chain
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Replay all historical Shielded/Spent events to rebuild the local Merkle tree.
   * Call this once at startup before spending any notes.
   */
  async syncFromChain(
    provider: ethers.Provider,
    poolAddress: string,
    fromBlock = 0,
  ): Promise<void> {
    const pool = new ethers.Contract(poolAddress, POOL_EVENTS_ABI, provider);

    // Fetch Shielded events in order
    const shieldedLogs = await pool.queryFilter(pool.filters.Shielded(), fromBlock, "latest");
    // Fetch Spent events in order
    const spentLogs = await pool.queryFilter(pool.filters.Spent(), fromBlock, "latest");

    // Merge by block + log index to reconstruct insertion order
    const allLogs = [...shieldedLogs, ...spentLogs].sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
      return a.index - b.index;
    });

    for (const log of allLogs) {
      if (!(log instanceof ethers.EventLog)) continue;
      if (log.eventName === "Shielded") {
        const commitment = bytes32ToField(log.args.commitment);
        const token      = log.args.token as string;
        const leafIndex  = Number(log.args.leafIndex);
        this._insertLeaf(commitment, token, leafIndex);
      } else if (log.eventName === "Spent") {
        const nulls    = log.args.nullifiers as string[];
        const commits  = log.args.newCommitments as string[];
        const token    = log.args.token as string;
        for (const n of nulls) {
          const nullifier = bytes32ToField(n);
          if (nullifier !== 0n) this.spentNullifiers.add(nullifier.toString());
        }
        for (const c of commits) {
          const commitment = bytes32ToField(c);
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
  startListening(): () => void {
    const onShielded = (
      token:      string,
      _depositor: string,
      _netAmt:    bigint,
      _fee:       bigint,
      commitment: string,
      _newRoot:   string,
      leafIndex:  bigint,
    ) => {
      const c = bytes32ToField(commitment);
      this._insertLeaf(c, token, Number(leafIndex));
      this._refreshOwnedSiblings();
    };

    const onSpent = (
      token:          string,
      nullifiers:     string[],
      newCommitments: string[],
      _publicAmt:     bigint,
      _recipient:     string,
    ) => {
      for (const n of nullifiers) {
        const nullifier = bytes32ToField(n);
        if (nullifier !== 0n) {
          this.spentNullifiers.add(nullifier.toString());
          // Mark any owned note with this nullifier as spent
          for (const note of this.ownedNotes.values()) {
            if (note.nullifier === nullifier) note.spent = true;
          }
        }
      }
      for (const c of newCommitments) {
        const commitment = bytes32ToField(c);
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
  trackNote(
    commitment: bigint,
    token: string,
    amount: bigint,
    salt: bigint,
    leafIndex: number,
  ): void {
    const nullifier = computeNullifier(this.spendingPrivkey, commitment);
    const siblings  = this.tree.size > leafIndex
      ? this.tree.getSiblings(leafIndex)
      : Array(this.tree.depth).fill(0n);

    const note: ManagedNote = {
      commitment, token, amount, salt,
      index: leafIndex, siblings, nullifier,
      spent: this.spentNullifiers.has(nullifier.toString()),
    };
    this.ownedNotes.set(commitment.toString(), note);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Accessors
  // ─────────────────────────────────────────────────────────────────────────

  getNote(commitment: bigint): ManagedNote | undefined {
    return this.ownedNotes.get(commitment.toString());
  }

  getUnspentNotes(token?: string): ManagedNote[] {
    const all = Array.from(this.ownedNotes.values()).filter((n) => !n.spent);
    return token ? all.filter((n) => n.token.toLowerCase() === token.toLowerCase()) : all;
  }

  isNullifierSpent(nullifier: bigint): boolean {
    return this.spentNullifiers.has(nullifier.toString());
  }

  getCurrentRoot(): bigint {
    return this.tree.getRoot();
  }

  getSiblings(leafIndex: number): bigint[] {
    return this.tree.getSiblings(leafIndex);
  }

  getTreeSize(): number {
    return this.tree.size;
  }

  /** Find the leaf index of a commitment in the local tree, if present. */
  findLeafIndex(commitment: bigint): number | undefined {
    const idx = this.allLeaves.findIndex(l => l.commitment === commitment);
    return idx === -1 ? undefined : idx;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────────────────

  private _insertLeaf(commitment: bigint, token: string, expectedIndex: number): void {
    if (this.allLeaves.length !== expectedIndex) {
      // Out-of-order or duplicate — skip (shouldn't happen with sorted logs)
      return;
    }
    this.allLeaves.push({ commitment, token });
    this.tree.insert(commitment);
  }

  private _refreshOwnedSiblings(): void {
    for (const note of this.ownedNotes.values()) {
      if (note.index >= 0 && note.index < this.tree.size) {
        note.siblings = this.tree.getSiblings(note.index);
      }
    }
  }
}
