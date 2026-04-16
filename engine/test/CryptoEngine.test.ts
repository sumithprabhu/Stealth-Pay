import { expect } from "chai";
import { ethers } from "ethers";
import { CryptoEngine } from "../src/core/CryptoEngine";
import { EngineErrorCode } from "../src/types/index";

const ENCRYPTION_KEY = ethers.hexlify(ethers.randomBytes(32));
const ENCLAVE_ADDR   = ethers.Wallet.createRandom().address;
const OWNER_ADDR     = ethers.Wallet.createRandom().address;
const TOKEN_ADDR     = ethers.Wallet.createRandom().address;
const OTHER_OWNER    = ethers.Wallet.createRandom().address;
const OTHER_TOKEN    = ethers.Wallet.createRandom().address;

describe("CryptoEngine", () => {
  let engine: CryptoEngine;

  beforeEach(() => {
    engine = new CryptoEngine(ENCRYPTION_KEY);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Commitment
  // ─────────────────────────────────────────────────────────────────────────

  describe("computeCommitment", () => {
    it("produces a deterministic 32-byte hash", () => {
      const salt   = engine.generateSalt();
      const c1     = engine.computeCommitment(OWNER_ADDR, TOKEN_ADDR, 100n, salt);
      const c2     = engine.computeCommitment(OWNER_ADDR, TOKEN_ADDR, 100n, salt);
      expect(c1).to.equal(c2);
      expect(c1).to.match(/^0x[0-9a-f]{64}$/);
    });

    it("changes when any input changes", () => {
      const salt = engine.generateSalt();
      const base = engine.computeCommitment(OWNER_ADDR, TOKEN_ADDR, 100n, salt);
      expect(engine.computeCommitment(OTHER_OWNER, TOKEN_ADDR, 100n, salt)).to.not.equal(base);
      expect(engine.computeCommitment(OWNER_ADDR, OTHER_TOKEN, 100n, salt)).to.not.equal(base);
      expect(engine.computeCommitment(OWNER_ADDR, TOKEN_ADDR, 200n, salt)).to.not.equal(base);
      expect(engine.computeCommitment(OWNER_ADDR, TOKEN_ADDR, 100n, engine.generateSalt())).to.not.equal(base);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Nullifier
  // ─────────────────────────────────────────────────────────────────────────

  describe("computeNullifier", () => {
    it("is deterministic per (commitment, enclaveAddress)", () => {
      const commitment = engine.computeCommitment(OWNER_ADDR, TOKEN_ADDR, 100n, engine.generateSalt());
      const n1         = engine.computeNullifier(commitment, ENCLAVE_ADDR);
      const n2         = engine.computeNullifier(commitment, ENCLAVE_ADDR);
      expect(n1).to.equal(n2);
    });

    it("differs for different enclave addresses", () => {
      const commitment = engine.computeCommitment(OWNER_ADDR, TOKEN_ADDR, 100n, engine.generateSalt());
      const other      = ethers.Wallet.createRandom().address;
      expect(engine.computeNullifier(commitment, ENCLAVE_ADDR)).to.not.equal(
        engine.computeNullifier(commitment, other)
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // buildNote
  // ─────────────────────────────────────────────────────────────────────────

  describe("buildNote", () => {
    it("builds a complete note with valid commitment and nullifier", () => {
      const note = engine.buildNote(OWNER_ADDR, TOKEN_ADDR, 1000n, ENCLAVE_ADDR);
      expect(note.owner).to.equal(OWNER_ADDR);
      expect(note.token).to.equal(TOKEN_ADDR);
      expect(note.amount).to.equal(1000n);
      expect(note.commitment).to.match(/^0x[0-9a-f]{64}$/);
      expect(note.nullifier).to.match(/^0x[0-9a-f]{64}$/);
      expect(note.createdAt).to.be.a("number");
    });

    it("uses provided salt if given", () => {
      const salt  = engine.generateSalt();
      const note  = engine.buildNote(OWNER_ADDR, TOKEN_ADDR, 1000n, ENCLAVE_ADDR, salt);
      expect(note.salt).to.equal(salt);
    });

    it("produces unique notes for same owner/token/amount (different salts)", () => {
      const n1 = engine.buildNote(OWNER_ADDR, TOKEN_ADDR, 1000n, ENCLAVE_ADDR);
      const n2 = engine.buildNote(OWNER_ADDR, TOKEN_ADDR, 1000n, ENCLAVE_ADDR);
      expect(n1.commitment).to.not.equal(n2.commitment);
      expect(n1.nullifier).to.not.equal(n2.nullifier);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Encryption / Decryption
  // ─────────────────────────────────────────────────────────────────────────

  describe("encryptNote / decryptNote", () => {
    it("round-trips a note correctly", () => {
      const original = engine.buildNote(OWNER_ADDR, TOKEN_ADDR, 9999999999n, ENCLAVE_ADDR);
      const blob     = engine.encryptNote(original);
      const decoded  = engine.decryptNote(blob);

      expect(decoded.owner).to.equal(original.owner);
      expect(decoded.token).to.equal(original.token);
      expect(decoded.amount).to.equal(original.amount);
      expect(decoded.commitment).to.equal(original.commitment);
      expect(decoded.nullifier).to.equal(original.nullifier);
      expect(decoded.salt).to.equal(original.salt);
    });

    it("produces different ciphertext for the same note (random IV)", () => {
      const note   = engine.buildNote(OWNER_ADDR, TOKEN_ADDR, 1n, ENCLAVE_ADDR);
      const blob1  = engine.encryptNote(note);
      const blob2  = engine.encryptNote(note);
      expect(blob1.iv).to.not.equal(blob2.iv);
      expect(blob1.ciphertext).to.not.equal(blob2.ciphertext);
    });

    it("throws on tampered ciphertext", () => {
      const note = engine.buildNote(OWNER_ADDR, TOKEN_ADDR, 1n, ENCLAVE_ADDR);
      const blob = engine.encryptNote(note);

      // Flip one byte in the ciphertext
      const tampered = blob.ciphertext.slice(0, -2) + (
        blob.ciphertext.slice(-2) === "ff" ? "00" : "ff"
      );

      expect(() => engine.decryptNote({ ...blob, ciphertext: tampered }))
        .to.throw();
    });

    it("throws on wrong schema version", () => {
      const note = engine.buildNote(OWNER_ADDR, TOKEN_ADDR, 1n, ENCLAVE_ADDR);
      const blob = engine.encryptNote(note);
      expect(() => engine.decryptNote({ ...blob, version: 99 }))
        .to.throw();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Integrity check
  // ─────────────────────────────────────────────────────────────────────────

  describe("verifyNoteIntegrity", () => {
    it("returns true for a valid note", () => {
      const note = engine.buildNote(OWNER_ADDR, TOKEN_ADDR, 1n, ENCLAVE_ADDR);
      expect(engine.verifyNoteIntegrity(note, ENCLAVE_ADDR)).to.be.true;
    });

    it("returns false if amount is tampered", () => {
      const note = engine.buildNote(OWNER_ADDR, TOKEN_ADDR, 1n, ENCLAVE_ADDR);
      expect(engine.verifyNoteIntegrity({ ...note, amount: 9999n }, ENCLAVE_ADDR)).to.be.false;
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Key validation
  // ─────────────────────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("throws for a key that is not 32 bytes", () => {
      expect(() => new CryptoEngine(ethers.hexlify(ethers.randomBytes(16)))).to.throw();
    });
  });
});
