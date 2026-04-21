import { expect } from "chai";
import sinon from "sinon";
import { ethers } from "ethers";
import { StealthPaySDK } from "../src/StealthPaySDK";
import { ChainClient } from "../src/ChainClient";
import { StealthPayConfig, Note } from "../src/types";
import { StealthPayError } from "../src/types";
import { deriveSpendingPubkey } from "../src/poseidon2";
import * as ProofGenerator from "../src/ProofGenerator";

const TOKEN     = ethers.Wallet.createRandom().address;
const RECIPIENT = ethers.Wallet.createRandom().address;
const TX_HASH   = ethers.hexlify(ethers.randomBytes(32));
const PRIVKEY   = 0xdeadbeefcafebaben;

function fakeReceipt(): ethers.TransactionReceipt {
  return { hash: TX_HASH, status: 1 } as unknown as ethers.TransactionReceipt;
}

function makeSdk() {
  const signer = {
    getAddress: async () => ethers.Wallet.createRandom().address,
  } as unknown as ethers.Signer;

  const config: StealthPayConfig = {
    signer,
    privacyPoolAddress: ethers.Wallet.createRandom().address,
    spendingPrivkey:    PRIVKEY,
  };

  const sdk = new StealthPaySDK(config);
  const chain = (sdk as unknown as { chain: ChainClient }).chain;
  return { sdk, chain };
}

describe("StealthPaySDK (V2 — ZK proof flow)", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => { sandbox = sinon.createSandbox(); });
  afterEach(() => sandbox.restore());

  // ─────────────────────────────────────────────────────────────────────────

  describe("shield()", () => {
    it("calls approveIfNeeded, shield on-chain, and waits for event", async () => {
      const { sdk, chain } = makeSdk();
      const fakeCommitment = 0x1234abcdn;

      sandbox.stub(chain, "approveIfNeeded").resolves();
      sandbox.stub(ProofGenerator, "generateShieldProof").resolves({
        proof: new Uint8Array(10),
        commitment: fakeCommitment,
      });
      sandbox.stub(chain, "shield").resolves(fakeReceipt());
      sandbox.stub(chain, "waitForShieldEvent").resolves({
        txHash: TX_HASH, amount: 1_000_000n, token: TOKEN, leafIndex: 0n,
      });

      const result = await sdk.shield(TOKEN, 1_000_000n);

      expect(result.txHash).to.equal(TX_HASH);
      expect(result.amount).to.equal(1_000_000n);
      expect(result.token).to.equal(TOKEN);
      expect(result.commitment).to.equal(fakeCommitment);
    });

    it("adds note to internal note store after shielding", async () => {
      const { sdk, chain } = makeSdk();
      const fakeCommitment = 0xabcdef01n;

      sandbox.stub(chain, "approveIfNeeded").resolves();
      sandbox.stub(ProofGenerator, "generateShieldProof").resolves({
        proof: new Uint8Array(10),
        commitment: fakeCommitment,
      });
      sandbox.stub(chain, "shield").resolves(fakeReceipt());
      sandbox.stub(chain, "waitForShieldEvent").resolves({
        txHash: TX_HASH, amount: 500_000n, token: TOKEN, leafIndex: 7n,
      });

      await sdk.shield(TOKEN, 500_000n);

      const notes = sdk.getNotes(TOKEN);
      expect(notes).to.have.length(1);
      expect(notes[0].commitment).to.equal(fakeCommitment);
      expect(notes[0].amount).to.equal(500_000n);
      expect(notes[0].index).to.equal(7);
      expect(notes[0].spent).to.be.false;
    });
  });

  // ─────────────────────────────────────────────────────────────────────────

  describe("getPrivateBalance()", () => {
    it("returns zero for unknown token", () => {
      const { sdk } = makeSdk();
      const result = sdk.getPrivateBalance(TOKEN);
      expect(result.balance).to.equal(0n);
      expect(result.noteCount).to.equal(0);
    });

    it("sums unspent notes for given token", async () => {
      const { sdk, chain } = makeSdk();

      sandbox.stub(chain, "approveIfNeeded").resolves();
      sandbox.stub(ProofGenerator, "generateShieldProof")
        .onFirstCall().resolves({ proof: new Uint8Array(10), commitment: 1n })
        .onSecondCall().resolves({ proof: new Uint8Array(10), commitment: 2n });
      sandbox.stub(chain, "shield").resolves(fakeReceipt());
      sandbox.stub(chain, "waitForShieldEvent")
        .onFirstCall().resolves({ txHash: TX_HASH, amount: 100n, token: TOKEN, leafIndex: 0n })
        .onSecondCall().resolves({ txHash: TX_HASH, amount: 200n, token: TOKEN, leafIndex: 1n });

      await sdk.shield(TOKEN, 100n);
      await sdk.shield(TOKEN, 200n);

      const result = sdk.getPrivateBalance(TOKEN);
      expect(result.balance).to.equal(300n);
      expect(result.noteCount).to.equal(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────

  describe("updateNoteSiblings()", () => {
    it("updates siblings on existing note", async () => {
      const { sdk, chain } = makeSdk();
      const commitment = 0x999n;

      sandbox.stub(chain, "approveIfNeeded").resolves();
      sandbox.stub(ProofGenerator, "generateShieldProof").resolves({
        proof: new Uint8Array(10), commitment,
      });
      sandbox.stub(chain, "shield").resolves(fakeReceipt());
      sandbox.stub(chain, "waitForShieldEvent").resolves({
        txHash: TX_HASH, amount: 1n, token: TOKEN, leafIndex: 3n,
      });

      await sdk.shield(TOKEN, 1n);

      const siblings = Array.from({ length: 20 }, (_, i) => BigInt(i + 1));
      sdk.updateNoteSiblings(commitment, siblings);

      const note = sdk.getNotes(TOKEN)[0];
      expect(note.siblings[0]).to.equal(1n);
      expect(note.siblings[19]).to.equal(20n);
    });

    it("throws StealthPayError for unknown commitment", () => {
      const { sdk } = makeSdk();
      expect(() => sdk.updateNoteSiblings(0xdeadn, [])).to.throw(StealthPayError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────

  describe("_selectNotes (via unshield error path)", () => {
    it("throws INSUFFICIENT_BALANCE when no notes exist", async () => {
      const { sdk, chain } = makeSdk();
      sandbox.stub(chain, "getRoot").resolves(0n);

      try {
        await sdk.unshield(TOKEN, 1_000n, RECIPIENT);
        expect.fail("should have thrown");
      } catch (err: unknown) {
        expect(err).to.be.instanceOf(StealthPayError);
        expect((err as StealthPayError).code).to.equal("INSUFFICIENT_BALANCE");
      }
    });
  });
});
