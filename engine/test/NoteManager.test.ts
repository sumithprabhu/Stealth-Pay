import { expect } from "chai";
import { ethers } from "ethers";
import { CryptoEngine } from "../src/core/CryptoEngine";
import { NoteManager } from "../src/core/NoteManager";
import { LocalStorageAdapter } from "../src/storage/ZeroGStorage";
import { EngineErrorCode } from "../src/types/index";

const KEY          = ethers.hexlify(ethers.randomBytes(32));
const ENCLAVE_ADDR = ethers.Wallet.createRandom().address;
const OWNER        = ethers.Wallet.createRandom().address;
const TOKEN        = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

function makeManager() {
  const crypto  = new CryptoEngine(KEY);
  const storage = new LocalStorageAdapter();
  return { crypto, storage, manager: new NoteManager(crypto, storage, ENCLAVE_ADDR) };
}

describe("NoteManager", () => {
  describe("createNote / loadNote", () => {
    it("creates a note and loads it back correctly", async () => {
      const { manager, crypto } = makeManager();
      const amount = 1_000_000n;
      const salt   = crypto.generateSalt();
      const commitment = crypto.computeCommitment(OWNER, TOKEN, amount, salt);

      const note = await manager.createNote(OWNER, TOKEN, amount, commitment);

      expect(note.owner).to.equal(OWNER);
      expect(note.token).to.equal(TOKEN);
      expect(note.amount).to.equal(amount);
      expect(note.commitment).to.match(/^0x[0-9a-f]{64}$/);

      const loaded = await manager.loadNote(note.commitment);
      expect(loaded.commitment).to.equal(note.commitment);
      expect(loaded.amount).to.equal(amount);
    });

    it("throws NOTE_NOT_FOUND for unknown commitment", async () => {
      const { manager } = makeManager();
      try {
        await manager.loadNote(ethers.keccak256(ethers.toUtf8Bytes("unknown")));
        expect.fail("Should have thrown");
      } catch (err: unknown) {
        expect((err as { code: string }).code).to.equal(EngineErrorCode.NOTE_NOT_FOUND);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Spending
  // ─────────────────────────────────────────────────────────────────────────

  describe("spendNote", () => {
    it("marks a note as spent and prevents double-spend", async () => {
      const { manager, crypto } = makeManager();
      const note = await manager.createNote(OWNER, TOKEN, 1000n, crypto.computeCommitment(OWNER, TOKEN, 1000n, crypto.generateSalt()));

      expect(await manager.isSpent(note)).to.be.false;
      await manager.spendNote(note);
      expect(await manager.isSpent(note)).to.be.true;

      try {
        await manager.spendNote(note);
        expect.fail("Should have thrown");
      } catch (err: unknown) {
        expect((err as { code: string }).code).to.equal(EngineErrorCode.NULLIFIER_SPENT);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Balance
  // ─────────────────────────────────────────────────────────────────────────

  describe("getBalance", () => {
    it("sums all unspent notes for an owner/token", async () => {
      const { manager, crypto } = makeManager();

      await manager.createNote(OWNER, TOKEN, 1_000_000n, crypto.computeCommitment(OWNER, TOKEN, 1_000_000n, crypto.generateSalt()));
      await manager.createNote(OWNER, TOKEN, 2_000_000n, crypto.computeCommitment(OWNER, TOKEN, 2_000_000n, crypto.generateSalt()));

      const { balance } = await manager.getBalance(OWNER, TOKEN);
      expect(BigInt(balance)).to.equal(3_000_000n);
    });

    it("excludes spent notes from balance", async () => {
      const { manager, crypto } = makeManager();

      const note1 = await manager.createNote(OWNER, TOKEN, 1_000_000n, crypto.computeCommitment(OWNER, TOKEN, 1_000_000n, crypto.generateSalt()));
      await manager.createNote(OWNER, TOKEN, 2_000_000n, crypto.computeCommitment(OWNER, TOKEN, 2_000_000n, crypto.generateSalt()));

      await manager.spendNote(note1);

      const { balance } = await manager.getBalance(OWNER, TOKEN);
      expect(BigInt(balance)).to.equal(2_000_000n);
    });

    it("returns zero for an owner with no notes", async () => {
      const { manager } = makeManager();
      const { balance } = await manager.getBalance(OWNER, TOKEN);
      expect(balance).to.equal("0");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Coin selection
  // ─────────────────────────────────────────────────────────────────────────

  describe("selectNotes", () => {
    it("selects the minimum notes (largest-first) to cover an amount", async () => {
      const { manager, crypto } = makeManager();

      await manager.createNote(OWNER, TOKEN, 1_000_000n, crypto.computeCommitment(OWNER, TOKEN, 1_000_000n, crypto.generateSalt()));
      await manager.createNote(OWNER, TOKEN, 5_000_000n, crypto.computeCommitment(OWNER, TOKEN, 5_000_000n, crypto.generateSalt()));
      await manager.createNote(OWNER, TOKEN, 2_000_000n, crypto.computeCommitment(OWNER, TOKEN, 2_000_000n, crypto.generateSalt()));

      // Asking for 4M — should pick the 5M note only (largest-first)
      const { selected, total } = await manager.selectNotes(OWNER, TOKEN, 4_000_000n);
      expect(selected).to.have.length(1);
      expect(total).to.equal(5_000_000n);
    });

    it("combines multiple notes when needed", async () => {
      const { manager, crypto } = makeManager();

      await manager.createNote(OWNER, TOKEN, 1_000_000n, crypto.computeCommitment(OWNER, TOKEN, 1_000_000n, crypto.generateSalt()));
      await manager.createNote(OWNER, TOKEN, 2_000_000n, crypto.computeCommitment(OWNER, TOKEN, 2_000_000n, crypto.generateSalt()));

      const { selected, total } = await manager.selectNotes(OWNER, TOKEN, 2_500_000n);
      expect(selected.length).to.be.greaterThan(1);
      expect(total >= 2_500_000n).to.be.true;
    });

    it("throws INSUFFICIENT_BALANCE when not enough funds", async () => {
      const { manager, crypto } = makeManager();
      await manager.createNote(OWNER, TOKEN, 100n, crypto.computeCommitment(OWNER, TOKEN, 100n, crypto.generateSalt()));

      try {
        await manager.selectNotes(OWNER, TOKEN, 99999999n);
        expect.fail("Should have thrown");
      } catch (err: unknown) {
        expect((err as { code: string }).code).to.equal(EngineErrorCode.INSUFFICIENT_BALANCE);
      }
    });
  });
});
