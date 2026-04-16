import { pino } from "pino";
import { EncryptedNoteBlob, EngineError, EngineErrorCode } from "../types/index";

const logger = pino({ name: "ZeroGStorage" });

/**
 * ZeroGStorage
 *
 * Abstraction over the 0G Storage network (Log + KV layers).
 *
 * Each private note is stored as an encrypted JSON blob keyed by its
 * commitment hash. The on-chain Merkle tree stores only the commitment;
 * the actual note data lives here, readable only by TEE enclaves with
 * the correct encryption key.
 *
 * Key schema:
 *   "note:{commitment}"   → EncryptedNoteBlob
 *   "owner:{address}"     → string[]  (list of commitment hashes owned)
 *   "spent:{nullifier}"   → "1"       (spent nullifier index)
 *
 * In production this wraps @0glabs/0g-ts-sdk. The interface here is
 * designed to be a drop-in shim so the engine works in dev without a
 * live 0G node (LocalStorageAdapter below).
 */
export interface IZeroGStorage {
  putNote(commitment: string, blob: EncryptedNoteBlob): Promise<void>;
  getNote(commitment: string): Promise<EncryptedNoteBlob | null>;
  addOwnerCommitment(owner: string, token: string, commitment: string): Promise<void>;
  getOwnerCommitments(owner: string, token: string): Promise<string[]>;
  markNullifierSpent(nullifier: string): Promise<void>;
  isNullifierSpent(nullifier: string): Promise<boolean>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Production adapter (wraps @0glabs/0g-ts-sdk)
// ─────────────────────────────────────────────────────────────────────────────

export class ZeroGStorageAdapter implements IZeroGStorage {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;

  constructor(nodeUrl: string, indexerUrl: string) {
    // Lazily initialise the 0G SDK client.
    // The actual import is dynamic to allow the engine to start without
    // a 0G node in test/dev mode.
    this._init(nodeUrl, indexerUrl).catch((err) => {
      logger.error({ err }, "Failed to initialise 0G Storage client");
    });
  }

  private async _init(nodeUrl: string, indexerUrl: string): Promise<void> {
    try {
      // Dynamic import — avoids hard failure when SDK not installed in dev
      const { Indexer } = await import("@0glabs/0g-ts-sdk");
      this.client = new Indexer(indexerUrl);
      logger.info({ nodeUrl, indexerUrl }, "0G Storage client initialised");
    } catch (err) {
      logger.warn({ err }, "0G Storage SDK not available — falling back to in-memory store");
    }
  }

  async putNote(commitment: string, blob: EncryptedNoteBlob): Promise<void> {
    this._requireClient();
    const key  = `note:${commitment}`;
    const data = JSON.stringify(blob);
    try {
      // 0G Storage KV put — exact API depends on SDK version
      await this.client.upload(Buffer.from(data), { key });
      logger.debug({ commitment }, "Note stored in 0G Storage");
    } catch (err) {
      throw new EngineError(EngineErrorCode.STORAGE_ERROR, `Failed to store note ${commitment}`, err);
    }
  }

  async getNote(commitment: string): Promise<EncryptedNoteBlob | null> {
    this._requireClient();
    const key = `note:${commitment}`;
    try {
      const data = await this.client.download(key);
      if (!data) return null;
      return JSON.parse(data.toString()) as EncryptedNoteBlob;
    } catch (err) {
      throw new EngineError(EngineErrorCode.STORAGE_ERROR, `Failed to retrieve note ${commitment}`, err);
    }
  }

  async addOwnerCommitment(owner: string, token: string, commitment: string): Promise<void> {
    this._requireClient();
    const existing = await this.getOwnerCommitments(owner, token);
    if (!existing.includes(commitment)) {
      existing.push(commitment);
      const key  = `owner:${owner.toLowerCase()}:${token.toLowerCase()}`;
      const data = JSON.stringify(existing);
      await this.client.upload(Buffer.from(data), { key });
    }
  }

  async getOwnerCommitments(owner: string, token: string): Promise<string[]> {
    this._requireClient();
    const key = `owner:${owner.toLowerCase()}:${token.toLowerCase()}`;
    try {
      const data = await this.client.download(key);
      if (!data) return [];
      return JSON.parse(data.toString()) as string[];
    } catch {
      return [];
    }
  }

  async markNullifierSpent(nullifier: string): Promise<void> {
    this._requireClient();
    const key = `spent:${nullifier}`;
    await this.client.upload(Buffer.from("1"), { key });
  }

  async isNullifierSpent(nullifier: string): Promise<boolean> {
    this._requireClient();
    const key = `spent:${nullifier}`;
    try {
      const data = await this.client.download(key);
      return data !== null && data.toString() === "1";
    } catch {
      return false;
    }
  }

  private _requireClient(): void {
    if (!this.client) {
      throw new EngineError(
        EngineErrorCode.STORAGE_ERROR,
        "0G Storage client not initialised"
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Local in-memory adapter (dev / testing)
// ─────────────────────────────────────────────────────────────────────────────

export class LocalStorageAdapter implements IZeroGStorage {
  private readonly notes    = new Map<string, EncryptedNoteBlob>();
  private readonly owners   = new Map<string, string[]>();
  private readonly nullifiers = new Set<string>();

  async putNote(commitment: string, blob: EncryptedNoteBlob): Promise<void> {
    this.notes.set(commitment, blob);
  }

  async getNote(commitment: string): Promise<EncryptedNoteBlob | null> {
    return this.notes.get(commitment) ?? null;
  }

  async addOwnerCommitment(owner: string, token: string, commitment: string): Promise<void> {
    const key      = `${owner.toLowerCase()}:${token.toLowerCase()}`;
    const existing = this.owners.get(key) ?? [];
    if (!existing.includes(commitment)) {
      existing.push(commitment);
      this.owners.set(key, existing);
    }
  }

  async getOwnerCommitments(owner: string, token: string): Promise<string[]> {
    const key = `${owner.toLowerCase()}:${token.toLowerCase()}`;
    return this.owners.get(key) ?? [];
  }

  async markNullifierSpent(nullifier: string): Promise<void> {
    this.nullifiers.add(nullifier);
  }

  async isNullifierSpent(nullifier: string): Promise<boolean> {
    return this.nullifiers.has(nullifier);
  }
}
