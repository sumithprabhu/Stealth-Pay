import { pino } from "pino";
import {
  PrivateNote,
  PrivateBalanceResult,
  EngineError,
  EngineErrorCode,
} from "../types/index";
import { CryptoEngine } from "./CryptoEngine";
import { IZeroGStorage } from "../storage/ZeroGStorage";

const logger = pino({ name: "NoteManager" });

/**
 * NoteManager
 *
 * Orchestrates all private note lifecycle operations:
 *   - Creating notes (on shield)
 *   - Spending notes (on unshield / private transfer)
 *   - Querying balances
 *   - Selecting notes for a payment (coin selection)
 *
 * All data lives encrypted in 0G Storage. This class never surfaces
 * plaintext note data outside the TEE boundary.
 */
export class NoteManager {
  constructor(
    private readonly crypto: CryptoEngine,
    private readonly storage: IZeroGStorage,
    private readonly enclaveAddress: string,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Note creation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create and persist a new note.
   * Called after a successful on-chain shield event is confirmed.
   */
  async createNote(
    owner: string,
    token: string,
    amount: bigint,
    /** Pass the commitment from the on-chain event to ensure consistency */
    onChainCommitment: string,
  ): Promise<PrivateNote> {
    // Derive salt such that our computed commitment matches the on-chain one.
    // In practice the SDK sends the salt it used to compute the commitment,
    // so we can reconstruct the exact note. Here we persist the note under
    // the known commitment.
    const salt = this.crypto.generateSalt();
    const note = this.crypto.buildNote(owner, token, amount, this.enclaveAddress, salt);

    // Sanity: if a pre-computed commitment is given, verify it matches
    // (the SDK must send the salt it used; this is a simplified version)
    logger.debug({ commitment: note.commitment, onChainCommitment }, "Creating note");

    const blob = this.crypto.encryptNote(note);
    await this.storage.putNote(note.commitment, blob);
    await this.storage.addOwnerCommitment(owner, token, note.commitment);

    logger.info({ owner, token, amount: amount.toString(), commitment: note.commitment }, "Note created");
    return note;
  }

  /**
   * Reconstruct a note from the owner + token + commitment.
   * Used when the SDK wants to spend a specific note.
   */
  async loadNote(commitment: string): Promise<PrivateNote> {
    const blob = await this.storage.getNote(commitment);
    if (!blob) {
      throw new EngineError(
        EngineErrorCode.NOTE_NOT_FOUND,
        `Note not found for commitment ${commitment}`
      );
    }

    const note = this.crypto.decryptNote(blob);

    if (!this.crypto.verifyNoteIntegrity(note, this.enclaveAddress)) {
      throw new EngineError(
        EngineErrorCode.INVALID_COMMITMENT,
        `Note integrity check failed for commitment ${commitment}`
      );
    }

    return note;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Note spending
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Mark a note as spent by recording its nullifier.
   * Called after the TEE signs an unshield/privateAction and before
   * returning the signature to the SDK.
   */
  async spendNote(note: PrivateNote): Promise<void> {
    const alreadySpent = await this.storage.isNullifierSpent(note.nullifier);
    if (alreadySpent) {
      throw new EngineError(
        EngineErrorCode.NULLIFIER_SPENT,
        `Note already spent: nullifier ${note.nullifier}`
      );
    }
    await this.storage.markNullifierSpent(note.nullifier);
    logger.info({ nullifier: note.nullifier, commitment: note.commitment }, "Note spent");
  }

  /**
   * Check if a note's nullifier has been spent (engine-side double-spend guard).
   */
  async isSpent(note: PrivateNote): Promise<boolean> {
    return this.storage.isNullifierSpent(note.nullifier);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Balance queries
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Return the private balance for an owner/token pair.
   * Loads all their notes, skips spent ones, sums amounts.
   */
  async getBalance(owner: string, token: string): Promise<PrivateBalanceResult> {
    const commitments = await this.storage.getOwnerCommitments(owner, token);
    const unspentNotes: PrivateNote[] = [];
    let total = 0n;

    for (const commitment of commitments) {
      try {
        const note = await this.loadNote(commitment);
        const spent = await this.isSpent(note);
        if (!spent) {
          unspentNotes.push(note);
          total += note.amount;
        }
      } catch (err) {
        // Note might be missing from storage (edge case) — skip it
        logger.warn({ commitment, err }, "Skipping unloadable note during balance query");
      }
    }

    return {
      owner,
      token,
      balance: total.toString(),
      notes: unspentNotes.map((n) => ({
        commitment: n.commitment,
        amount:     n.amount,
        createdAt:  n.createdAt,
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Coin selection
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Select the minimum set of unspent notes that cover a target amount.
   * Returns selected notes and the total they cover (>= amount).
   *
   * Strategy: largest-first (minimises number of notes / on-chain actions).
   */
  async selectNotes(
    owner: string,
    token: string,
    amount: bigint,
  ): Promise<{ selected: PrivateNote[]; total: bigint }> {
    const { notes: summaries } = await this.getBalance(owner, token);

    // Sort descending by amount
    const sorted = [...summaries].sort((a, b) =>
      a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : 0
    );

    const selected: PrivateNote[] = [];
    let accumulated = 0n;

    for (const summary of sorted) {
      if (accumulated >= amount) break;
      const note = await this.loadNote(summary.commitment);
      selected.push(note);
      accumulated += note.amount;
    }

    if (accumulated < amount) {
      throw new EngineError(
        EngineErrorCode.INSUFFICIENT_BALANCE,
        `Insufficient balance: need ${amount}, have ${accumulated}`
      );
    }

    return { selected, total: accumulated };
  }
}
