import { expect } from "chai";
import {
  deriveSpendingPubkey,
  computeCommitment,
  computeNullifier,
  hashNode,
  addressToField,
  fieldToBytes32,
  bytes32ToField,
  BN254_PRIME,
} from "../src/poseidon2";

const PRIVKEY = 0xdeadbeefcafebaben;
const TOKEN   = addressToField("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
const AMOUNT  = 1_000_000n;
const SALT    = 0xabcdef1234567890n;

describe("poseidon2 (BN254, matches Noir stdlib)", () => {

  describe("BN254_PRIME", () => {
    it("is a large prime", () => {
      expect(BN254_PRIME > 0n).to.be.true;
      expect(BN254_PRIME.toString(16)).to.include("30644e72");
    });
  });

  describe("deriveSpendingPubkey", () => {
    it("is deterministic", () => {
      expect(deriveSpendingPubkey(PRIVKEY)).to.equal(deriveSpendingPubkey(PRIVKEY));
    });

    it("is different for different privkeys", () => {
      expect(deriveSpendingPubkey(PRIVKEY)).to.not.equal(deriveSpendingPubkey(PRIVKEY + 1n));
    });

    it("result is within BN254 field", () => {
      expect(deriveSpendingPubkey(PRIVKEY) < BN254_PRIME).to.be.true;
    });
  });

  describe("computeCommitment", () => {
    const PUBKEY = deriveSpendingPubkey(PRIVKEY);

    it("is deterministic", () => {
      expect(computeCommitment(PUBKEY, TOKEN, AMOUNT, SALT))
        .to.equal(computeCommitment(PUBKEY, TOKEN, AMOUNT, SALT));
    });

    it("changes when pubkey changes", () => {
      expect(computeCommitment(PUBKEY, TOKEN, AMOUNT, SALT))
        .to.not.equal(computeCommitment(PUBKEY + 1n, TOKEN, AMOUNT, SALT));
    });

    it("changes when token changes", () => {
      expect(computeCommitment(PUBKEY, TOKEN, AMOUNT, SALT))
        .to.not.equal(computeCommitment(PUBKEY, TOKEN + 1n, AMOUNT, SALT));
    });

    it("changes when amount changes", () => {
      expect(computeCommitment(PUBKEY, TOKEN, AMOUNT, SALT))
        .to.not.equal(computeCommitment(PUBKEY, TOKEN, AMOUNT + 1n, SALT));
    });

    it("changes when salt changes", () => {
      expect(computeCommitment(PUBKEY, TOKEN, AMOUNT, SALT))
        .to.not.equal(computeCommitment(PUBKEY, TOKEN, AMOUNT, SALT + 1n));
    });

    it("result is within BN254 field", () => {
      expect(computeCommitment(PUBKEY, TOKEN, AMOUNT, SALT) < BN254_PRIME).to.be.true;
    });
  });

  describe("computeNullifier", () => {
    const PUBKEY     = deriveSpendingPubkey(PRIVKEY);
    const COMMITMENT = computeCommitment(PUBKEY, TOKEN, AMOUNT, SALT);

    it("is deterministic", () => {
      expect(computeNullifier(PRIVKEY, COMMITMENT))
        .to.equal(computeNullifier(PRIVKEY, COMMITMENT));
    });

    it("changes when privkey changes", () => {
      expect(computeNullifier(PRIVKEY, COMMITMENT))
        .to.not.equal(computeNullifier(PRIVKEY + 1n, COMMITMENT));
    });

    it("changes when commitment changes", () => {
      expect(computeNullifier(PRIVKEY, COMMITMENT))
        .to.not.equal(computeNullifier(PRIVKEY, COMMITMENT + 1n));
    });

    it("is different from the commitment itself", () => {
      expect(computeNullifier(PRIVKEY, COMMITMENT)).to.not.equal(COMMITMENT);
    });
  });

  describe("hashNode (Merkle)", () => {
    it("is deterministic", () => {
      expect(hashNode(1n, 2n)).to.equal(hashNode(1n, 2n));
    });

    it("is not commutative (left != right)", () => {
      expect(hashNode(1n, 2n)).to.not.equal(hashNode(2n, 1n));
    });
  });

  describe("fieldToBytes32 / bytes32ToField roundtrip", () => {
    it("roundtrips correctly", () => {
      const x = deriveSpendingPubkey(PRIVKEY);
      const hex = fieldToBytes32(x);
      expect(hex).to.match(/^0x[0-9a-f]{64}$/);
      expect(bytes32ToField(hex)).to.equal(x);
    });
  });

  describe("addressToField", () => {
    it("converts checksummed address to field element", () => {
      const f = addressToField("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
      expect(f < BN254_PRIME).to.be.true;
      expect(f > 0n).to.be.true;
    });

    it("is case-insensitive", () => {
      const addr = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
      expect(addressToField(addr)).to.equal(addressToField(addr.toLowerCase()));
    });
  });

  describe("BB test vector", () => {
    it("permute([0,1,2,3])[0] matches barretenberg reference", () => {
      // Known test vector from barretenberg crypto/poseidon2/poseidon2.test.cpp
      const { permute } = require("@zkpassport/poseidon2");
      const result = permute([0n, 1n, 2n, 3n]);
      expect(result[0]).to.equal(
        0x01bd538c2ee014ed5141b29e9ae240bf8db3fe5b9a38629a9647cf8d76c01737n,
      );
    });
  });
});
