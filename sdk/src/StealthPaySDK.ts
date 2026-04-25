import { ethers } from "ethers";
import {
  StealthPayConfig,
  Note,
  ShieldResult,
  UnshieldResult,
  PrivateSendResult,
  PrivateBalanceResult,
  StealthPayError,
} from "./types";
import { ChainClient } from "./ChainClient";
import { NoteManager, ManagedNote } from "./NoteManager";
import {
  generateShieldProof,
  generateSpendProof,
  deriveSpendingPubkey,
  SpendNote,
  OutputNote,
} from "./ProofGenerator";
import { BN254_PRIME } from "./poseidon2";

function randomField(): bigint {
  const bytes = ethers.randomBytes(32);
  return BigInt(ethers.hexlify(bytes)) % BN254_PRIME;
}

function toSpendNote(n: ManagedNote): SpendNote {
  return { amount: n.amount, salt: n.salt, index: n.index, siblings: n.siblings };
}

export class StealthPaySDK {
  private readonly chain:  ChainClient;
  private readonly config: StealthPayConfig;
  readonly noteManager:    NoteManager;
  private stopListening?:  () => void;

  constructor(config: StealthPayConfig) {
    this.config      = config;
    this.chain       = new ChainClient(config.privacyPoolAddress, config.signer);
    this.noteManager = new NoteManager(config.spendingPrivkey, this.chain.pool);
  }

  /**
   * Replay historical events and start listening for new ones.
   * Call once after construction, before shielding or spending.
   */
  async sync(provider: ethers.Provider, fromBlock = 0): Promise<void> {
    await this.noteManager.syncFromChain(provider, this.config.privacyPoolAddress, fromBlock);
    this.stopListening = this.noteManager.startListening();
  }

  /** Stop live event subscription. */
  disconnect(): void {
    this.stopListening?.();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Shield
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Shield tokens: approve ERC-20 → generate ZK proof → call shield() on-chain.
   */
  async shield(token: string, amount: bigint): Promise<ShieldResult> {
    await this.chain.approveIfNeeded(token, amount);

    const salt = randomField();

    const { proof, commitment } = await generateShieldProof({
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
  async unshield(
    token:     string,
    amount:    bigint,
    recipient: string,
  ): Promise<UnshieldResult> {
    const { inputNotes, change } = this._selectNotes(token, amount);
    const merkleRoot = this.noteManager.getCurrentRoot();

    const changePubkey = deriveSpendingPubkey(this.config.spendingPrivkey);
    const changeSalt   = change > 0n ? randomField() : 0n;

    const outputSlots: [OutputNote | null, OutputNote | null] = [
      change > 0n ? { receiverPubkey: changePubkey, amount: change, salt: changeSalt } : null,
      null,
    ];

    const { proof, nullifiers, newCommitments } = await generateSpendProof({
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

    for (const n of inputNotes) n.spent = true;

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
  async privateSend(
    token:          string,
    amount:         bigint,
    receiverPubkey: bigint,
  ): Promise<PrivateSendResult> {
    const { inputNotes, change } = this._selectNotes(token, amount);
    const merkleRoot   = this.noteManager.getCurrentRoot();
    const changePubkey = deriveSpendingPubkey(this.config.spendingPrivkey);
    const receiverSalt = randomField();
    const changeSalt   = change > 0n ? randomField() : 0n;

    const outputSlots: [OutputNote | null, OutputNote | null] = [
      { receiverPubkey, amount, salt: receiverSalt },
      change > 0n ? { receiverPubkey: changePubkey, amount: change, salt: changeSalt } : null,
    ];

    const { proof, nullifiers, newCommitments } = await generateSpendProof({
      spendingPrivkey: this.config.spendingPrivkey,
      token,
      merkleRoot,
      inputNotes: [toSpendNote(inputNotes[0]), inputNotes[1] ? toSpendNote(inputNotes[1]) : null],
      outputNotes: outputSlots,
      publicAmount: 0n,
      recipient:    ethers.ZeroAddress,
    });

    const changeLeafIndex = this.noteManager.getTreeSize() + 1; // receiver at [0], change at [1]

    const receipt = await this.chain.spend({
      token, merkleRoot, nullifiers, newCommitments,
      publicAmount: 0n, recipient: ethers.ZeroAddress, proof,
    });

    for (const n of inputNotes) n.spent = true;

    if (change > 0n) {
      this.noteManager.trackNote(newCommitments[1], token, change, changeSalt, changeLeafIndex);
    }

    return {
      txHash:             receipt.hash,
      amount, token,
      receiverCommitment: newCommitments[0],
      changeCommitment:   change > 0n ? newCommitments[1] : null,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Balance / notes
  // ─────────────────────────────────────────────────────────────────────────

  getPrivateBalance(token: string): PrivateBalanceResult {
    const unspent = this.noteManager.getUnspentNotes(token);
    const balance = unspent.reduce((acc, n) => acc + n.amount, 0n);
    return { token, balance, noteCount: unspent.length };
  }

  getNotes(token?: string): ManagedNote[] {
    return this.noteManager.getUnspentNotes(token);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────────────────

  private _selectNotes(token: string, amount: bigint): { inputNotes: ManagedNote[]; change: bigint } {
    const unspent = this.noteManager.getUnspentNotes(token);
    unspent.sort((a, b) => (a.amount < b.amount ? -1 : 1));

    const selected: ManagedNote[] = [];
    let total = 0n;

    for (const note of unspent) {
      if (total >= amount) break;
      selected.push(note);
      total += note.amount;
      if (selected.length === 2) break;
    }

    if (total < amount) {
      throw new StealthPayError(
        `Insufficient balance for ${token}: have ${total}, need ${amount}`,
        "INSUFFICIENT_BALANCE",
      );
    }

    return { inputNotes: selected, change: total - amount };
  }
}
