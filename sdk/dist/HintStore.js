"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZG_RPC = exports.ZG_INDEXER_RPC = void 0;
exports.deriveEncryptionKeypair = deriveEncryptionKeypair;
exports.receiverPubkeyHash = receiverPubkeyHash;
exports.encryptHint = encryptHint;
exports.decryptHint = decryptHint;
exports.uploadToStorage = uploadToStorage;
exports.downloadFromStorage = downloadFromStorage;
exports.recordHintOnChain = recordHintOnChain;
exports.scanHintEvents = scanHintEvents;
exports.postHint = postHint;
exports.scanHints = scanHints;
const ethers_1 = require("ethers");
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
// Dynamic require avoids TypeScript module-resolution issues with 0G SDK
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ZgFile, Indexer } = require("@0glabs/0g-ts-sdk");
// ─── Constants ────────────────────────────────────────────────────────────────
exports.ZG_INDEXER_RPC = "https://indexer-storage-testnet-standard.0g.ai";
exports.ZG_RPC = "https://evmrpc-testnet.0g.ai";
const NOTE_HINT_ABI = [
    "event NoteHint(bytes32 indexed receiverPubkeyHash, bytes32 storageRoot)",
    "function recordHint(bytes32 receiverPubkeyHash, bytes32 storageRoot) external",
];
// ─── Encryption keypair ───────────────────────────────────────────────────────
/**
 * Derive a deterministic secp256k1 encryption keypair from a spending privkey.
 * Domain-separated with constant 3 so it never collides with the ZK key.
 */
function deriveEncryptionKeypair(spendingPrivkey) {
    const privkeyHex = ethers_1.ethers.keccak256(ethers_1.ethers.solidityPacked(["uint256", "uint256"], [spendingPrivkey, 3n]));
    const signingKey = new ethers_1.ethers.SigningKey(privkeyHex);
    return { privkey: privkeyHex, pubkey: signingKey.publicKey };
}
/**
 * The on-chain index key for a receiver's hints.
 * Callers store keccak256(encPubkey) so the pubkey itself isn't on-chain.
 */
function receiverPubkeyHash(encPubkey) {
    return ethers_1.ethers.keccak256(encPubkey);
}
// ─── Encrypt / decrypt ────────────────────────────────────────────────────────
/**
 * ECIES encrypt a hint payload for a receiver's encryption pubkey.
 * Wire format: ephPub(65) | iv(12) | authTag(16) | ciphertext
 */
function encryptHint(receiverEncPubkey, payload) {
    const ephKey = new ethers_1.ethers.SigningKey(ethers_1.ethers.hexlify(ethers_1.ethers.randomBytes(32)));
    const sharedSecret = ephKey.computeSharedSecret(receiverEncPubkey);
    const aesKey = Buffer.from(ethers_1.ethers.keccak256(sharedSecret).slice(2), "hex");
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
    const plain = Buffer.from(JSON.stringify(payload), "utf8");
    const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    const ephPubBytes = Buffer.from(ephKey.publicKey.slice(2), "hex"); // strip 0x
    return Buffer.concat([ephPubBytes, iv, tag, enc]);
}
/**
 * Try to decrypt a hint with this receiver's encryption privkey.
 * Returns null if the hint is not addressed to this key.
 */
function decryptHint(encPrivkey, data) {
    try {
        const ephPubBytes = data.subarray(0, 65);
        const iv = data.subarray(65, 77);
        const tag = data.subarray(77, 93);
        const ciphertext = data.subarray(93);
        // Reconstruct uncompressed pubkey (0x04 + 64 bytes)
        const ephPubHex = "0x04" + ephPubBytes.subarray(1).toString("hex");
        const signingKey = new ethers_1.ethers.SigningKey(encPrivkey);
        const sharedSecret = signingKey.computeSharedSecret(ephPubHex);
        const aesKey = Buffer.from(ethers_1.ethers.keccak256(sharedSecret).slice(2), "hex");
        const decipher = crypto.createDecipheriv("aes-256-gcm", aesKey, iv);
        decipher.setAuthTag(tag);
        const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return JSON.parse(plain.toString("utf8"));
    }
    catch {
        return null; // not for us — wrong key
    }
}
// ─── 0G Storage upload / download ────────────────────────────────────────────
/**
 * Upload encrypted hint bytes to 0G Storage.
 * Returns the root hash that identifies this blob.
 */
async function uploadToStorage(signer, data, indexerRpc = exports.ZG_INDEXER_RPC, rpc = exports.ZG_RPC) {
    const tmpPath = path.join(os.tmpdir(), `sp-hint-${Date.now()}.bin`);
    try {
        fs.writeFileSync(tmpPath, data);
        const zgFile = await ZgFile.fromFilePath(tmpPath);
        const indexer = new Indexer(indexerRpc);
        const [tx, err] = await indexer.upload(zgFile, rpc, signer);
        if (err)
            throw new Error(`0G Storage upload error: ${err}`);
        const root = tx.rootHash ?? tx.rootHashes?.[0];
        if (!root)
            throw new Error("0G Storage upload returned no root hash");
        return root;
    }
    finally {
        fs.rmSync(tmpPath, { force: true });
    }
}
/**
 * Download hint bytes from 0G Storage by root hash.
 */
async function downloadFromStorage(rootHash, indexerRpc = exports.ZG_INDEXER_RPC) {
    const tmpPath = path.join(os.tmpdir(), `sp-hint-dl-${Date.now()}.bin`);
    try {
        const indexer = new Indexer(indexerRpc);
        const err = await indexer.download(rootHash, tmpPath, true);
        if (err)
            throw new Error(`0G Storage download error: ${err}`);
        return fs.readFileSync(tmpPath);
    }
    finally {
        fs.rmSync(tmpPath, { force: true });
    }
}
// ─── On-chain hint registry ───────────────────────────────────────────────────
/**
 * Record the 0G Storage root hash on-chain so the receiver can discover it.
 * Emits NoteHint(receiverPubkeyHash, storageRoot).
 */
async function recordHintOnChain(poolContract, receiverEncPubkey, storageRoot) {
    const hash = receiverPubkeyHash(receiverEncPubkey);
    const tx = await poolContract.recordHint(hash, storageRoot);
    const receipt = await tx.wait();
    return receipt.hash;
}
/**
 * Scan NoteHint events and return storage roots addressed to this receiver.
 */
async function scanHintEvents(provider, poolAddress, myEncPubkey, fromBlock = 0) {
    const pool = new ethers_1.ethers.Contract(poolAddress, NOTE_HINT_ABI, provider);
    const myHash = receiverPubkeyHash(myEncPubkey);
    const logs = await pool.queryFilter(pool.filters.NoteHint(myHash), fromBlock, "latest");
    return logs
        .filter(l => l instanceof ethers_1.ethers.EventLog)
        .map(l => l.args.storageRoot);
}
// ─── High-level helpers ───────────────────────────────────────────────────────
/**
 * Full send-side flow:
 *   encrypt hint → upload to 0G Storage → record root hash on-chain
 */
async function postHint(opts) {
    const encrypted = encryptHint(opts.receiverEncPubkey, opts.payload);
    const storageRoot = await uploadToStorage(opts.signer, encrypted, opts.indexerRpc, opts.rpc);
    const onChainTx = await recordHintOnChain(opts.poolContract, opts.receiverEncPubkey, storageRoot);
    return { storageRoot, onChainTx };
}
/**
 * Full receive-side flow:
 *   scan NoteHint events → download each → try to decrypt → return owned payloads
 */
async function scanHints(opts) {
    const { privkey, pubkey } = deriveEncryptionKeypair(opts.spendingPrivkey);
    const roots = await scanHintEvents(opts.provider, opts.poolAddress, pubkey, opts.fromBlock ?? 0);
    const found = [];
    for (const root of roots) {
        try {
            const data = await downloadFromStorage(root, opts.indexerRpc);
            const payload = decryptHint(privkey, data);
            if (payload)
                found.push(payload);
        }
        catch {
            // storage node unavailable or corrupt — skip
        }
    }
    return found;
}
//# sourceMappingURL=HintStore.js.map