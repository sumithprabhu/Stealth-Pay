"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StealthPaySDK = void 0;
const ethers_1 = require("ethers");
const types_1 = require("./types");
const ChainClient_1 = require("./ChainClient");
const NoteManager_1 = require("./NoteManager");
const ProofGenerator_1 = require("./ProofGenerator");
const poseidon2_1 = require("./poseidon2");
const HintStore_1 = require("./HintStore");
function randomField() {
    const bytes = ethers_1.ethers.randomBytes(32);
    return BigInt(ethers_1.ethers.hexlify(bytes)) % poseidon2_1.BN254_PRIME;
}
function toSpendNote(n) {
    return { amount: n.amount, salt: n.salt, index: n.index, siblings: n.siblings };
}
class StealthPaySDK {
    constructor(config) {
        this.config = config;
        this.chain = new ChainClient_1.ChainClient(config.privacyPoolAddress, config.signer);
        this.noteManager = new NoteManager_1.NoteManager(config.spendingPrivkey, this.chain.pool);
    }
    /**
     * Replay historical events and start listening for new ones.
     * Call once after construction, before shielding or spending.
     */
    async sync(provider, fromBlock = 0) {
        await this.noteManager.syncFromChain(provider, this.config.privacyPoolAddress, fromBlock);
        this.stopListening = this.noteManager.startListening();
        // Auto-discover notes sent to us via 0G Storage hints
        if (this.config.zeroGStorage) {
            const hints = await (0, HintStore_1.scanHints)({
                provider,
                poolAddress: this.config.privacyPoolAddress,
                spendingPrivkey: this.config.spendingPrivkey,
                fromBlock,
                indexerRpc: this.config.zeroGStorage.indexerRpc,
            });
            for (const h of hints) {
                const commitment = BigInt(h.commitment);
                // Skip if already tracked
                if (this.noteManager.getNote(commitment))
                    continue;
                const amount = BigInt(h.amount);
                const salt = BigInt(h.salt);
                // Find leaf index from the local tree (commitment was inserted via spend)
                const leafIndex = this.noteManager.findLeafIndex(commitment);
                if (leafIndex !== undefined) {
                    this.noteManager.trackNote(commitment, h.token, amount, salt, leafIndex);
                }
            }
        }
    }
    /** Stop live event subscription. */
    disconnect() {
        this.stopListening?.();
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Shield
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Shield tokens: approve ERC-20 → generate ZK proof → call shield() on-chain.
     */
    async shield(token, amount) {
        await this.chain.approveIfNeeded(token, amount);
        const salt = randomField();
        const { proof, commitment } = await (0, ProofGenerator_1.generateShieldProof)({
            spendingPrivkey: this.config.spendingPrivkey,
            token,
            amount,
            salt,
        });
        const { receipt, leafIndex } = await this.chain.shield({ token, amount, commitment, proof });
        this.noteManager.trackNote(commitment, token, amount, salt, Number(leafIndex));
        return { txHash: receipt.hash, commitment, amount, token };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Unshield
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Unshield tokens: pick notes covering amount → generate ZK proof → spend().
     * Any change is re-shielded as a new note owned by this key.
     */
    async unshield(token, amount, recipient) {
        const { inputNotes, change } = this._selectNotes(token, amount);
        const merkleRoot = this.noteManager.getCurrentRoot();
        const changePubkey = (0, ProofGenerator_1.deriveSpendingPubkey)(this.config.spendingPrivkey);
        const changeSalt = change > 0n ? randomField() : 0n;
        const outputSlots = [
            change > 0n ? { receiverPubkey: changePubkey, amount: change, salt: changeSalt } : null,
            null,
        ];
        const { proof, nullifiers, newCommitments } = await (0, ProofGenerator_1.generateSpendProof)({
            spendingPrivkey: this.config.spendingPrivkey,
            token,
            merkleRoot,
            inputNotes: [toSpendNote(inputNotes[0]), inputNotes[1] ? toSpendNote(inputNotes[1]) : null],
            outputNotes: outputSlots,
            publicAmount: amount,
            recipient,
        });
        const changeLeafIndex = this.noteManager.getTreeSize(); // change goes in at current size
        const receipt = await this.chain.spend({
            token, merkleRoot, nullifiers, newCommitments,
            publicAmount: amount, recipient, proof,
        });
        for (const n of inputNotes)
            n.spent = true;
        if (change > 0n) {
            this.noteManager.trackNote(newCommitments[0], token, change, changeSalt, changeLeafIndex);
        }
        return { txHash: receipt.hash, amount, token, recipient };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Private send
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Private transfer to a receiver identified by their spending pubkey.
     */
    async privateSend(token, amount, receiverPubkey) {
        const { inputNotes, change } = this._selectNotes(token, amount);
        const merkleRoot = this.noteManager.getCurrentRoot();
        const changePubkey = (0, ProofGenerator_1.deriveSpendingPubkey)(this.config.spendingPrivkey);
        const receiverSalt = randomField();
        const changeSalt = change > 0n ? randomField() : 0n;
        const outputSlots = [
            { receiverPubkey, amount, salt: receiverSalt },
            change > 0n ? { receiverPubkey: changePubkey, amount: change, salt: changeSalt } : null,
        ];
        const { proof, nullifiers, newCommitments } = await (0, ProofGenerator_1.generateSpendProof)({
            spendingPrivkey: this.config.spendingPrivkey,
            token,
            merkleRoot,
            inputNotes: [toSpendNote(inputNotes[0]), inputNotes[1] ? toSpendNote(inputNotes[1]) : null],
            outputNotes: outputSlots,
            publicAmount: 0n,
            recipient: ethers_1.ethers.ZeroAddress,
        });
        const changeLeafIndex = this.noteManager.getTreeSize() + 1; // receiver at [0], change at [1]
        const receipt = await this.chain.spend({
            token, merkleRoot, nullifiers, newCommitments,
            publicAmount: 0n, recipient: ethers_1.ethers.ZeroAddress, proof,
        });
        for (const n of inputNotes)
            n.spent = true;
        if (change > 0n) {
            this.noteManager.trackNote(newCommitments[1], token, change, changeSalt, changeLeafIndex);
        }
        // Post encrypted hint to 0G Storage so receiver can auto-discover their note
        if (this.config.zeroGStorage) {
            try {
                const { pubkey: receiverEncPubkey } = (0, HintStore_1.deriveEncryptionKeypair)(receiverPubkey);
                await (0, HintStore_1.postHint)({
                    signer: await this.chain.pool.runner,
                    poolContract: this.chain.pool,
                    receiverEncPubkey,
                    payload: {
                        commitment: "0x" + newCommitments[0].toString(16).padStart(64, "0"),
                        token,
                        amount: amount.toString(),
                        salt: receiverSalt.toString(),
                    },
                    indexerRpc: this.config.zeroGStorage.indexerRpc,
                    rpc: this.config.zeroGStorage.rpc,
                });
            }
            catch {
                // Hint posting is best-effort — don't fail the send if storage is unavailable
            }
        }
        return {
            txHash: receipt.hash,
            amount, token,
            receiverCommitment: newCommitments[0],
            changeCommitment: change > 0n ? newCommitments[1] : null,
        };
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Balance / notes
    // ─────────────────────────────────────────────────────────────────────────
    getPrivateBalance(token) {
        const unspent = this.noteManager.getUnspentNotes(token);
        const balance = unspent.reduce((acc, n) => acc + n.amount, 0n);
        return { token, balance, noteCount: unspent.length };
    }
    getNotes(token) {
        return this.noteManager.getUnspentNotes(token);
    }
    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────
    _selectNotes(token, amount) {
        const unspent = this.noteManager.getUnspentNotes(token);
        unspent.sort((a, b) => (a.amount < b.amount ? -1 : 1));
        const selected = [];
        let total = 0n;
        for (const note of unspent) {
            if (total >= amount)
                break;
            selected.push(note);
            total += note.amount;
            if (selected.length === 2)
                break;
        }
        if (total < amount) {
            throw new types_1.StealthPayError(`Insufficient balance for ${token}: have ${total}, need ${amount}`, "INSUFFICIENT_BALANCE");
        }
        return { inputNotes: selected, change: total - amount };
    }
}
exports.StealthPaySDK = StealthPaySDK;
//# sourceMappingURL=StealthPaySDK.js.map