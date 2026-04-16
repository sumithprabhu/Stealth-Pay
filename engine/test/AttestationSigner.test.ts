import { expect } from "chai";
import { ethers } from "ethers";
import { AttestationSigner } from "../src/core/AttestationSigner";
import { UnshieldParams, PrivateActionParams } from "../src/types/index";

const enclaveWallet   = ethers.Wallet.createRandom();
const DOMAIN_SEPARATOR = ethers.keccak256(ethers.toUtf8Bytes("test-domain-separator"));

describe("AttestationSigner", () => {
  let signer: AttestationSigner;

  beforeEach(() => {
    signer = new AttestationSigner(enclaveWallet.privateKey, DOMAIN_SEPARATOR);
  });

  describe("address", () => {
    it("exposes the enclave wallet address", () => {
      expect(signer.address.toLowerCase()).to.equal(enclaveWallet.address.toLowerCase());
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // signUnshield
  // ─────────────────────────────────────────────────────────────────────────

  describe("signUnshield", () => {
    const params: UnshieldParams = {
      token:     "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      amount:    ethers.parseUnits("100", 6),
      recipient: "0x1234567890123456789012345678901234567890",
      nullifier: ethers.keccak256(ethers.toUtf8Bytes("test-nullifier")),
      newRoot:   ethers.keccak256(ethers.toUtf8Bytes("test-root")),
      deadline:  BigInt(Math.floor(Date.now() / 1000) + 3600),
      nonce:     12345n,
    };

    it("produces a 65-byte signature", () => {
      const sig = signer.signUnshield(params);
      expect(ethers.getBytes(sig)).to.have.length(65);
    });

    it("recovers the enclave address from the signature", () => {
      const sig        = signer.signUnshield(params);
      const structHash = signer.buildUnshieldStructHash(params);
      const digest     = ethers.solidityPackedKeccak256(
        ["bytes2", "bytes32", "bytes32"],
        ["0x1901", DOMAIN_SEPARATOR, structHash]
      );
      const recovered = ethers.recoverAddress(digest, sig);
      expect(recovered.toLowerCase()).to.equal(enclaveWallet.address.toLowerCase());
    });

    it("produces different signatures for different params (deterministic by input, random by signing)", () => {
      const sig1 = signer.signUnshield(params);
      const sig2 = signer.signUnshield({ ...params, amount: ethers.parseUnits("200", 6) });
      expect(sig1).to.not.equal(sig2);
    });

    it("is invalid if signed with a different domain", () => {
      const wrongDomain = ethers.keccak256(ethers.toUtf8Bytes("wrong-domain"));
      const wrongSigner = new AttestationSigner(enclaveWallet.privateKey, wrongDomain);
      const sig         = wrongSigner.signUnshield(params);

      const structHash = signer.buildUnshieldStructHash(params);
      const digest     = ethers.solidityPackedKeccak256(
        ["bytes2", "bytes32", "bytes32"],
        ["0x1901", DOMAIN_SEPARATOR, structHash]
      );
      const recovered = ethers.recoverAddress(digest, sig);
      expect(recovered.toLowerCase()).to.not.equal(enclaveWallet.address.toLowerCase());
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // signPrivateAction
  // ─────────────────────────────────────────────────────────────────────────

  describe("signPrivateAction", () => {
    const params: PrivateActionParams = {
      nullifiers:     [ethers.keccak256(ethers.toUtf8Bytes("null-1")), ethers.keccak256(ethers.toUtf8Bytes("null-2"))],
      newCommitments: [ethers.keccak256(ethers.toUtf8Bytes("commit-1"))],
      newRoot:        ethers.keccak256(ethers.toUtf8Bytes("new-root")),
      deadline:       BigInt(Math.floor(Date.now() / 1000) + 3600),
      nonce:          99n,
    };

    it("produces a 65-byte signature", () => {
      const sig = signer.signPrivateAction(params);
      expect(ethers.getBytes(sig)).to.have.length(65);
    });

    it("recovers the enclave address", () => {
      const sig        = signer.signPrivateAction(params);
      const structHash = signer.buildPrivateActionStructHash(params);
      const digest     = ethers.solidityPackedKeccak256(
        ["bytes2", "bytes32", "bytes32"],
        ["0x1901", DOMAIN_SEPARATOR, structHash]
      );
      const recovered = ethers.recoverAddress(digest, sig);
      expect(recovered.toLowerCase()).to.equal(enclaveWallet.address.toLowerCase());
    });

    it("changes signature when nullifiers change", () => {
      const sig1 = signer.signPrivateAction(params);
      const sig2 = signer.signPrivateAction({
        ...params,
        nullifiers: [ethers.keccak256(ethers.toUtf8Bytes("different-nullifier"))],
      });
      expect(sig1).to.not.equal(sig2);
    });
  });
});
