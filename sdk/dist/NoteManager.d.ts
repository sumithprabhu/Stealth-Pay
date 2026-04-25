import { ethers } from "ethers";
import { Note } from "./types";
export declare class MerkleTree {
    readonly depth: number;
    readonly zeros: bigint[];
    private readonly leaves;
    private nodeCache;
    constructor(depth?: number);
    get size(): number;
    get capacity(): number;
    insert(leaf: bigint): void;
    getRoot(): bigint;
    /**
     * Returns the 20 sibling hashes for the leaf at `leafIndex`,
     * ordered from leaf level up to root (matching the Noir circuit's path order).
     */
    getSiblings(leafIndex: number): bigint[];
    /** Recompute root after bulk insertion (clears cache). */
    rebuild(): void;
    private _getNode;
}
export interface ManagedNote extends Note {
    /** siblings are always up-to-date; never zero-filled after sync */
    siblings: bigint[];
}
export declare class NoteManager {
    private readonly spendingPrivkey;
    private readonly poolContract;
    private readonly tree;
    private readonly ownedNotes;
    private readonly spentNullifiers;
    private readonly allLeaves;
    private readonly spendingPubkey;
    private stopListening?;
    constructor(spendingPrivkey: bigint, poolContract: ethers.Contract, depth?: number);
    /**
     * Replay all historical Shielded/Spent events to rebuild the local Merkle tree.
     * Call this once at startup before spending any notes.
     */
    syncFromChain(provider: ethers.Provider, poolAddress: string, fromBlock?: number): Promise<void>;
    /**
     * Subscribe to real-time Shielded/Spent events and keep the tree up-to-date.
     * Call stopListening() (returned) to unsubscribe.
     */
    startListening(): () => void;
    /**
     * Record a newly shielded note (call after shield() confirms on-chain).
     * `token` and `amount` and `salt` are the private note fields known to the SDK.
     */
    trackNote(commitment: bigint, token: string, amount: bigint, salt: bigint, leafIndex: number): void;
    getNote(commitment: bigint): ManagedNote | undefined;
    getUnspentNotes(token?: string): ManagedNote[];
    isNullifierSpent(nullifier: bigint): boolean;
    getCurrentRoot(): bigint;
    getSiblings(leafIndex: number): bigint[];
    getTreeSize(): number;
    private _insertLeaf;
    private _refreshOwnedSiblings;
}
//# sourceMappingURL=NoteManager.d.ts.map