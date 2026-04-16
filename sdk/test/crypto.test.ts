import { expect } from "chai";
import { ethers } from "ethers";
import { computeCommitment, generateSalt } from "../src/crypto";

const OWNER = ethers.Wallet.createRandom().address;
const TOKEN = ethers.Wallet.createRandom().address;

describe("crypto helpers", () => {
  describe("generateSalt", () => {
    it("returns a 32-byte hex string", () => {
      const s = generateSalt();
      expect(s).to.match(/^0x[0-9a-f]{64}$/i);
    });

    it("is unique on each call", () => {
      expect(generateSalt()).to.not.equal(generateSalt());
    });
  });

  describe("computeCommitment", () => {
    it("returns a 32-byte hex string", () => {
      const c = computeCommitment(OWNER, TOKEN, 1000n, generateSalt());
      expect(c).to.match(/^0x[0-9a-f]{64}$/i);
    });

    it("is deterministic for same inputs", () => {
      const salt = generateSalt();
      expect(computeCommitment(OWNER, TOKEN, 1000n, salt))
        .to.equal(computeCommitment(OWNER, TOKEN, 1000n, salt));
    });

    it("differs when owner changes", () => {
      const salt  = generateSalt();
      const other = ethers.Wallet.createRandom().address;
      expect(computeCommitment(OWNER, TOKEN, 1000n, salt))
        .to.not.equal(computeCommitment(other, TOKEN, 1000n, salt));
    });

    it("differs when token changes", () => {
      const salt  = generateSalt();
      const other = ethers.Wallet.createRandom().address;
      expect(computeCommitment(OWNER, TOKEN, 1000n, salt))
        .to.not.equal(computeCommitment(OWNER, other, 1000n, salt));
    });

    it("differs when amount changes", () => {
      const salt = generateSalt();
      expect(computeCommitment(OWNER, TOKEN, 1000n, salt))
        .to.not.equal(computeCommitment(OWNER, TOKEN, 9999n, salt));
    });

    it("differs for different salts", () => {
      expect(computeCommitment(OWNER, TOKEN, 1000n, generateSalt()))
        .to.not.equal(computeCommitment(OWNER, TOKEN, 1000n, generateSalt()));
    });
  });
});
