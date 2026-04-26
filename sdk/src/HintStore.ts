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

import { ethers }  from "ethers";
import * as crypto from "crypto";
import * as fs     from "fs";
import * as path   from "path";
import * as os     from "os";

// Dynamic require avoids TypeScript module-resolution issues with 0G SDK
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ZgFile, Indexer } = require("@0glabs/0g-ts-sdk") as {
  ZgFile:   { fromFilePath(p: string): Promise<{ close(): Promise<void> }> };
  Indexer:  new (rpc: string) => {
    upload(f: object, rpc: string, signer: ethers.Signer, opts?: object): Promise<[{ rootHash?: string; rootHashes?: string[] }, unknown]>;
    download(root: string, out: string, verify: boolean): Promise<unknown>;
  };
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const ZG_INDEXER_RPC = "https://indexer-storage-testnet-standard.0g.ai";
export const ZG_RPC         = "https://evmrpc-testnet.0g.ai";

const NOTE_HINT_ABI = [
  "event NoteHint(bytes32 indexed receiverPubkeyHash, bytes32 storageRoot)",
  "function recordHint(bytes32 receiverPubkeyHash, bytes32 storageRoot) external",
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HintPayload {
  commitment: string; // "0x..." hex
  token:      string;
  amount:     string; // bigint serialised as decimal string
  salt:       string; // bigint serialised as decimal string
}

// ─── Encryption keypair ───────────────────────────────────────────────────────

/**
 * Derive a deterministic secp256k1 encryption keypair from a spending privkey.
 * Domain-separated with constant 3 so it never collides with the ZK key.
 */
export function deriveEncryptionKeypair(spendingPrivkey: bigint): {
  privkey: string; // 0x-prefixed 32-byte hex
  pubkey:  string; // 0x04-prefixed uncompressed 65-byte hex
} {
  const privkeyHex = ethers.keccak256(
    ethers.solidityPacked(["uint256", "uint256"], [spendingPrivkey, 3n]),
  );
  const signingKey = new ethers.SigningKey(privkeyHex);
  return { privkey: privkeyHex, pubkey: signingKey.publicKey };
}

/**
 * The on-chain index key for a receiver's hints.
 * Callers store keccak256(encPubkey) so the pubkey itself isn't on-chain.
 */
export function receiverPubkeyHash(encPubkey: string): string {
  return ethers.keccak256(encPubkey);
}

// ─── Encrypt / decrypt ────────────────────────────────────────────────────────

/**
 * ECIES encrypt a hint payload for a receiver's encryption pubkey.
 * Wire format: ephPub(65) | iv(12) | authTag(16) | ciphertext
 */
export function encryptHint(receiverEncPubkey: string, payload: HintPayload): Buffer {
  const ephKey      = new ethers.SigningKey(ethers.hexlify(ethers.randomBytes(32)));
  const sharedSecret = ephKey.computeSharedSecret(receiverEncPubkey);
  const aesKey       = Buffer.from(ethers.keccak256(sharedSecret).slice(2), "hex");

  const iv      = crypto.randomBytes(12);
  const cipher  = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
  const plain   = Buffer.from(JSON.stringify(payload), "utf8");
  const enc     = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag     = cipher.getAuthTag();

  const ephPubBytes = Buffer.from(ephKey.publicKey.slice(2), "hex"); // strip 0x
  return Buffer.concat([ephPubBytes, iv, tag, enc]);
}

/**
 * Try to decrypt a hint with this receiver's encryption privkey.
 * Returns null if the hint is not addressed to this key.
 */
export function decryptHint(encPrivkey: string, data: Buffer): HintPayload | null {
  try {
    const ephPubBytes = data.subarray(0, 65);
    const iv          = data.subarray(65, 77);
    const tag         = data.subarray(77, 93);
    const ciphertext  = data.subarray(93);

    // Reconstruct uncompressed pubkey (0x04 + 64 bytes)
    const ephPubHex    = "0x04" + ephPubBytes.subarray(1).toString("hex");
    const signingKey   = new ethers.SigningKey(encPrivkey);
    const sharedSecret = signingKey.computeSharedSecret(ephPubHex);
    const aesKey       = Buffer.from(ethers.keccak256(sharedSecret).slice(2), "hex");

    const decipher = crypto.createDecipheriv("aes-256-gcm", aesKey, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plain.toString("utf8")) as HintPayload;
  } catch {
    return null; // not for us — wrong key
  }
}

// ─── 0G Storage upload / download ────────────────────────────────────────────

/**
 * Upload encrypted hint bytes to 0G Storage.
 * Returns the root hash that identifies this blob.
 */
export async function uploadToStorage(
  signer:      ethers.Signer,
  data:        Buffer,
  indexerRpc = ZG_INDEXER_RPC,
  rpc         = ZG_RPC,
): Promise<string> {
  const tmpPath = path.join(os.tmpdir(), `sp-hint-${Date.now()}.bin`);
  try {
    fs.writeFileSync(tmpPath, data);
    const zgFile  = await ZgFile.fromFilePath(tmpPath);
    const indexer = new Indexer(indexerRpc);
    const [tx, err] = await indexer.upload(zgFile, rpc, signer);
    if (err) throw new Error(`0G Storage upload error: ${err}`);
    const root = (tx as any).rootHash ?? (tx as any).rootHashes?.[0];
    if (!root) throw new Error("0G Storage upload returned no root hash");
    return root;
  } finally {
    fs.rmSync(tmpPath, { force: true });
  }
}

/**
 * Download hint bytes from 0G Storage by root hash.
 */
export async function downloadFromStorage(
  rootHash:   string,
  indexerRpc = ZG_INDEXER_RPC,
): Promise<Buffer> {
  const tmpPath = path.join(os.tmpdir(), `sp-hint-dl-${Date.now()}.bin`);
  try {
    const indexer = new Indexer(indexerRpc);
    const err     = await indexer.download(rootHash, tmpPath, true);
    if (err) throw new Error(`0G Storage download error: ${err}`);
    return fs.readFileSync(tmpPath);
  } finally {
    fs.rmSync(tmpPath, { force: true });
  }
}

// ─── On-chain hint registry ───────────────────────────────────────────────────

/**
 * Record the 0G Storage root hash on-chain so the receiver can discover it.
 * Emits NoteHint(receiverPubkeyHash, storageRoot).
 */
export async function recordHintOnChain(
  poolContract:      ethers.Contract,
  receiverEncPubkey: string,
  storageRoot:       string,
): Promise<string> {
  const hash = receiverPubkeyHash(receiverEncPubkey);
  const tx   = await poolContract.recordHint(hash, storageRoot);
  const receipt = await tx.wait();
  return receipt.hash;
}

/**
 * Scan NoteHint events and return storage roots addressed to this receiver.
 */
export async function scanHintEvents(
  provider:       ethers.Provider,
  poolAddress:    string,
  myEncPubkey:    string,
  fromBlock = 0,
): Promise<string[]> {
  const pool = new ethers.Contract(poolAddress, NOTE_HINT_ABI, provider);
  const myHash = receiverPubkeyHash(myEncPubkey);
  const logs   = await pool.queryFilter(
    pool.filters.NoteHint(myHash),
    fromBlock,
    "latest",
  );
  return logs
    .filter(l => l instanceof ethers.EventLog)
    .map(l => (l as ethers.EventLog).args.storageRoot as string);
}

// ─── High-level helpers ───────────────────────────────────────────────────────

/**
 * Full send-side flow:
 *   encrypt hint → upload to 0G Storage → record root hash on-chain
 */
export async function postHint(opts: {
  signer:            ethers.Signer;
  poolContract:      ethers.Contract;
  receiverEncPubkey: string;
  payload:           HintPayload;
  indexerRpc?:       string;
  rpc?:              string;
}): Promise<{ storageRoot: string; onChainTx: string }> {
  const encrypted   = encryptHint(opts.receiverEncPubkey, opts.payload);
  const storageRoot = await uploadToStorage(
    opts.signer, encrypted, opts.indexerRpc, opts.rpc,
  );
  const onChainTx = await recordHintOnChain(
    opts.poolContract, opts.receiverEncPubkey, storageRoot,
  );
  return { storageRoot, onChainTx };
}

/**
 * Full receive-side flow:
 *   scan NoteHint events → download each → try to decrypt → return owned payloads
 */
export async function scanHints(opts: {
  provider:        ethers.Provider;
  poolAddress:     string;
  spendingPrivkey: bigint;
  fromBlock?:      number;
  indexerRpc?:     string;
}): Promise<HintPayload[]> {
  const { privkey, pubkey } = deriveEncryptionKeypair(opts.spendingPrivkey);
  const roots = await scanHintEvents(
    opts.provider, opts.poolAddress, pubkey, opts.fromBlock ?? 0,
  );

  const found: HintPayload[] = [];
  for (const root of roots) {
    try {
      const data    = await downloadFromStorage(root, opts.indexerRpc);
      const payload = decryptHint(privkey, data);
      if (payload) found.push(payload);
    } catch {
      // storage node unavailable or corrupt — skip
    }
  }
  return found;
}
