/**
 * HintStore — encrypted note hints on 0G Storage
 *
 * Flow:
 *   Sender (A):
 *     1. Derives receiver's encryption pubkey from their spendingPubkey
 *     2. Encrypts { commitment, token, amount, salt } with ECIES
 *     3. Uploads ciphertext to 0G Storage → gets rootHash
 *     4. Calls pool.recordHint(keccak256(receiverEncPubkey), rootHash) on-chain
 *
 *   Receiver (B):
 *     1. Derives their own encryption keypair from spendingPrivkey
 *     2. Queries NoteHint events for their pubkeyHash
 *     3. Downloads each hint from 0G Storage
 *     4. Decrypts — if it works, the note belongs to them
 *     5. Calls noteManager.trackNote() with the discovered payload
 */
import { ethers } from "ethers";
export declare const ZG_INDEXER_RPC = "https://indexer-storage-testnet-standard.0g.ai";
export declare const ZG_RPC = "https://evmrpc-testnet.0g.ai";
export interface HintPayload {
    commitment: string;
    token: string;
    amount: string;
    salt: string;
}
/**
 * Derive a deterministic secp256k1 encryption keypair from a spending privkey.
 * Domain-separated with constant 3 so it never collides with the ZK key.
 */
export declare function deriveEncryptionKeypair(spendingPrivkey: bigint): {
    privkey: string;
    pubkey: string;
};
/**
 * The on-chain index key for a receiver's hints.
 * Callers store keccak256(encPubkey) so the pubkey itself isn't on-chain.
 */
export declare function receiverPubkeyHash(encPubkey: string): string;
/**
 * ECIES encrypt a hint payload for a receiver's encryption pubkey.
 * Wire format: ephPub(65) | iv(12) | authTag(16) | ciphertext
 */
export declare function encryptHint(receiverEncPubkey: string, payload: HintPayload): Buffer;
/**
 * Try to decrypt a hint with this receiver's encryption privkey.
 * Returns null if the hint is not addressed to this key.
 */
export declare function decryptHint(encPrivkey: string, data: Buffer): HintPayload | null;
/**
 * Upload encrypted hint bytes to 0G Storage.
 * Returns the root hash that identifies this blob.
 */
export declare function uploadToStorage(signer: ethers.Signer, data: Buffer, indexerRpc?: string, rpc?: string): Promise<string>;
/**
 * Download hint bytes from 0G Storage by root hash.
 */
export declare function downloadFromStorage(rootHash: string, indexerRpc?: string): Promise<Buffer>;
/**
 * Record the 0G Storage root hash on-chain so the receiver can discover it.
 * Emits NoteHint(receiverPubkeyHash, storageRoot).
 */
export declare function recordHintOnChain(poolContract: ethers.Contract, receiverEncPubkey: string, storageRoot: string): Promise<string>;
/**
 * Scan NoteHint events and return storage roots addressed to this receiver.
 */
export declare function scanHintEvents(provider: ethers.Provider, poolAddress: string, myEncPubkey: string, fromBlock?: number): Promise<string[]>;
/**
 * Full send-side flow:
 *   encrypt hint → upload to 0G Storage → record root hash on-chain
 */
export declare function postHint(opts: {
    signer: ethers.Signer;
    poolContract: ethers.Contract;
    receiverEncPubkey: string;
    payload: HintPayload;
    indexerRpc?: string;
    rpc?: string;
}): Promise<{
    storageRoot: string;
    onChainTx: string;
}>;
/**
 * Full receive-side flow:
 *   scan NoteHint events → download each → try to decrypt → return owned payloads
 */
export declare function scanHints(opts: {
    provider: ethers.Provider;
    poolAddress: string;
    spendingPrivkey: bigint;
    fromBlock?: number;
    indexerRpc?: string;
}): Promise<HintPayload[]>;
//# sourceMappingURL=HintStore.d.ts.map