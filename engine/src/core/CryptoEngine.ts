import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { ethers } from "ethers";
import {
  PrivateNote,
  SerializedNote,
  EncryptedNoteBlob,
  EngineError,
  EngineErrorCode,
} from "../types/index";

const NOTE_SCHEMA_VERSION = 1;
const AES_ALGO            = "aes-256-gcm";
const IV_BYTES            = 12;
const AUTH_TAG_BYTES      = 16;

/**
 * CryptoEngine
 *
 * Handles all cryptographic operations:
 *  - Note commitment and nullifier derivation
 *  - AES-256-GCM encryption/decryption for note blobs stored in 0G Storage
 *
 * In production this runs inside a hardware TEE enclave (Intel TDX).
 * The encryption key is derived from the enclave's sealed ECDSA key and
 * never leaves the hardware boundary.
 */
export class CryptoEngine {
  private readonly encryptionKey: Buffer;

  constructor(noteEncryptionKeyHex: string) {
    const keyBytes = Buffer.from(noteEncryptionKeyHex.replace(/^0x/, ""), "hex");
    if (keyBytes.length !== 32) {
      throw new EngineError(
        EngineErrorCode.ENCRYPTION_ERROR,
        "Note encryption key must be exactly 32 bytes (AES-256)"
      );
    }
    this.encryptionKey = keyBytes;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Commitment and nullifier
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Compute the on-chain commitment for a note.
   * Must match exactly what the PrivacyPool contract stores in the Merkle tree.
   *
   * commitment = keccak256(abi.encode(owner, token, amount, salt))
   */
  computeCommitment(owner: string, token: string, amount: bigint, salt: string): string {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256", "bytes32"],
        [owner, token, amount, salt]
      )
    );
  }

  /**
   * Compute the nullifier for a note.
   * Nullifier is deterministic per (commitment, enclaveKey) — unique to this enclave.
   *
   * nullifier = keccak256(abi.encode(commitment, enclaveAddress))
   */
  computeNullifier(commitment: string, enclaveAddress: string): string {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address"],
        [commitment, enclaveAddress]
      )
    );
  }

  /**
   * Generate a cryptographically random 32-byte salt
   */
  generateSalt(): string {
    return ethers.hexlify(randomBytes(32));
  }

  /**
   * Build a complete PrivateNote from its components.
   * Computes commitment and nullifier automatically.
   */
  buildNote(
    owner: string,
    token: string,
    amount: bigint,
    enclaveAddress: string,
    salt?: string
  ): PrivateNote {
    const noteSalt   = salt ?? this.generateSalt();
    const commitment = this.computeCommitment(owner, token, amount, noteSalt);
    const nullifier  = this.computeNullifier(commitment, enclaveAddress);

    return {
      owner,
      token,
      amount,
      salt:        noteSalt,
      commitment,
      nullifier,
      createdAt:   Math.floor(Date.now() / 1000),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Encryption / Decryption
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Encrypt a PrivateNote for storage in 0G Storage.
   * Uses AES-256-GCM with a random IV per note.
   */
  encryptNote(note: PrivateNote): EncryptedNoteBlob {
    const serialized: SerializedNote = {
      owner:      note.owner,
      token:      note.token,
      amount:     note.amount.toString(),
      salt:       note.salt,
      commitment: note.commitment,
      nullifier:  note.nullifier,
      createdAt:  note.createdAt,
    };

    const plaintext = Buffer.from(JSON.stringify(serialized), "utf8");
    const iv        = randomBytes(IV_BYTES);
    const cipher    = createCipheriv(AES_ALGO, this.encryptionKey, iv);

    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag   = cipher.getAuthTag();

    return {
      iv:         iv.toString("hex"),
      ciphertext: encrypted.toString("hex"),
      authTag:    authTag.toString("hex"),
      version:    NOTE_SCHEMA_VERSION,
    };
  }

  /**
   * Decrypt a PrivateNote from an encrypted blob.
   */
  decryptNote(blob: EncryptedNoteBlob): PrivateNote {
    if (blob.version !== NOTE_SCHEMA_VERSION) {
      throw new EngineError(
        EngineErrorCode.ENCRYPTION_ERROR,
        `Unknown note schema version: ${blob.version}`
      );
    }

    try {
      const iv         = Buffer.from(blob.iv, "hex");
      const ciphertext = Buffer.from(blob.ciphertext, "hex");
      const authTag    = Buffer.from(blob.authTag, "hex");

      if (iv.length !== IV_BYTES) {
        throw new Error(`Expected IV length ${IV_BYTES}, got ${iv.length}`);
      }
      if (authTag.length !== AUTH_TAG_BYTES) {
        throw new Error(`Expected auth tag length ${AUTH_TAG_BYTES}, got ${authTag.length}`);
      }

      const decipher = createDecipheriv(AES_ALGO, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      const serialized: SerializedNote = JSON.parse(decrypted.toString("utf8"));

      return {
        owner:      serialized.owner,
        token:      serialized.token,
        amount:     BigInt(serialized.amount),
        salt:       serialized.salt,
        commitment: serialized.commitment,
        nullifier:  serialized.nullifier,
        createdAt:  serialized.createdAt,
      };
    } catch (err) {
      throw new EngineError(
        EngineErrorCode.ENCRYPTION_ERROR,
        "Failed to decrypt note — possible tampering or wrong key",
        err
      );
    }
  }

  /**
   * Verify that a note's commitment matches its contents.
   * Used after decryption to detect corruption.
   */
  verifyNoteIntegrity(note: PrivateNote, enclaveAddress: string): boolean {
    const expectedCommitment = this.computeCommitment(note.owner, note.token, note.amount, note.salt);
    const expectedNullifier  = this.computeNullifier(expectedCommitment, enclaveAddress);
    return note.commitment === expectedCommitment && note.nullifier === expectedNullifier;
  }
}
