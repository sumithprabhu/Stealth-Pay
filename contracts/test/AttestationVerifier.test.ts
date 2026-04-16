import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { AttestationVerifier } from "../typechain-types";

describe("AttestationVerifier", () => {
  let av: AttestationVerifier;
  let admin: SignerWithAddress;
  let manager: SignerWithAddress;
  let stranger: SignerWithAddress;

  // Use a real ethers.Wallet for the "enclave" so we can sign raw EIP-712 digests
  const enclaveWallet = ethers.Wallet.createRandom();

  const MEASUREMENT = ethers.keccak256(ethers.toUtf8Bytes("valid-tdx-measurement-v1"));
  const DESCRIPTION = "0G-Compute-Node-1";

  beforeEach(async () => {
    [admin, manager, stranger] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("AttestationVerifier");
    av = (await upgrades.deployProxy(Factory, [admin.address], {
      kind: "uups",
    })) as unknown as AttestationVerifier;

    const ENCLAVE_MANAGER_ROLE = await av.ENCLAVE_MANAGER_ROLE();
    await av.connect(admin).grantRole(ENCLAVE_MANAGER_ROLE, manager.address);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────────────────────────────────────────

  describe("initialize", () => {
    it("grants DEFAULT_ADMIN_ROLE to admin", async () => {
      const role = await av.DEFAULT_ADMIN_ROLE();
      expect(await av.hasRole(role, admin.address)).to.be.true;
    });

    it("reverts with zero admin address", async () => {
      const Factory = await ethers.getContractFactory("AttestationVerifier");
      await expect(
        upgrades.deployProxy(Factory, [ethers.ZeroAddress], { kind: "uups" })
      ).to.be.revertedWithCustomError(av, "AV__ZeroAddress");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Measurement whitelist
  // ─────────────────────────────────────────────────────────────────────────

  describe("whitelistMeasurement", () => {
    it("whitelists a measurement and emits event", async () => {
      await expect(av.connect(manager).whitelistMeasurement(MEASUREMENT))
        .to.emit(av, "MeasurementWhitelisted")
        .withArgs(MEASUREMENT, manager.address);

      expect(await av.isMeasurementWhitelisted(MEASUREMENT)).to.be.true;
    });

    it("reverts with zero hash", async () => {
      await expect(
        av.connect(manager).whitelistMeasurement(ethers.ZeroHash)
      ).to.be.revertedWithCustomError(av, "AV__ZeroHash");
    });

    it("reverts if caller lacks ENCLAVE_MANAGER_ROLE", async () => {
      await expect(av.connect(stranger).whitelistMeasurement(MEASUREMENT)).to.be.reverted;
    });
  });

  describe("revokeMeasurement", () => {
    it("revokes a whitelisted measurement and emits event", async () => {
      await av.connect(manager).whitelistMeasurement(MEASUREMENT);
      await expect(av.connect(manager).revokeMeasurement(MEASUREMENT))
        .to.emit(av, "MeasurementRevoked")
        .withArgs(MEASUREMENT, manager.address);

      expect(await av.isMeasurementWhitelisted(MEASUREMENT)).to.be.false;
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Enclave registry
  // ─────────────────────────────────────────────────────────────────────────

  describe("registerEnclave", () => {
    beforeEach(async () => {
      await av.connect(manager).whitelistMeasurement(MEASUREMENT);
    });

    it("registers an enclave and emits event", async () => {
      await expect(
        av.connect(manager).registerEnclave(enclaveWallet.address, MEASUREMENT, DESCRIPTION)
      )
        .to.emit(av, "EnclaveRegistered")
        .withArgs(enclaveWallet.address, MEASUREMENT, manager.address, DESCRIPTION);

      const info = await av.getEnclaveInfo(enclaveWallet.address);
      expect(info.signingKey).to.equal(enclaveWallet.address);
      expect(info.measurementHash).to.equal(MEASUREMENT);
      expect(info.active).to.be.true;
      expect(info.description).to.equal(DESCRIPTION);
    });

    it("increments totalEnclaves", async () => {
      const before = await av.totalEnclaves();
      await av.connect(manager).registerEnclave(enclaveWallet.address, MEASUREMENT, DESCRIPTION);
      expect(await av.totalEnclaves()).to.equal(before + 1n);
    });

    it("reverts if measurement not whitelisted", async () => {
      const otherMeasurement = ethers.keccak256(ethers.toUtf8Bytes("unknown-build"));
      await expect(
        av.connect(manager).registerEnclave(enclaveWallet.address, otherMeasurement, DESCRIPTION)
      ).to.be.revertedWithCustomError(av, "AV__MeasurementNotWhitelisted");
    });

    it("reverts on duplicate registration", async () => {
      await av.connect(manager).registerEnclave(enclaveWallet.address, MEASUREMENT, DESCRIPTION);
      await expect(
        av.connect(manager).registerEnclave(enclaveWallet.address, MEASUREMENT, DESCRIPTION)
      ).to.be.revertedWithCustomError(av, "AV__EnclaveAlreadyRegistered");
    });

    it("reverts with zero signing key", async () => {
      await expect(
        av.connect(manager).registerEnclave(ethers.ZeroAddress, MEASUREMENT, DESCRIPTION)
      ).to.be.revertedWithCustomError(av, "AV__ZeroAddress");
    });
  });

  describe("deactivateEnclave / reactivateEnclave", () => {
    beforeEach(async () => {
      await av.connect(manager).whitelistMeasurement(MEASUREMENT);
      await av.connect(manager).registerEnclave(enclaveWallet.address, MEASUREMENT, DESCRIPTION);
    });

    it("deactivates and reactivates an enclave", async () => {
      await expect(av.connect(manager).deactivateEnclave(enclaveWallet.address))
        .to.emit(av, "EnclaveDeactivated")
        .withArgs(enclaveWallet.address, manager.address);

      expect(await av.isActiveEnclave(enclaveWallet.address)).to.be.false;

      await expect(av.connect(manager).reactivateEnclave(enclaveWallet.address))
        .to.emit(av, "EnclaveReactivated")
        .withArgs(enclaveWallet.address, manager.address);

      expect(await av.isActiveEnclave(enclaveWallet.address)).to.be.true;
    });

    it("reverts reactivation if measurement was revoked", async () => {
      await av.connect(manager).deactivateEnclave(enclaveWallet.address);
      await av.connect(manager).revokeMeasurement(MEASUREMENT);
      await expect(
        av.connect(manager).reactivateEnclave(enclaveWallet.address)
      ).to.be.revertedWithCustomError(av, "AV__MeasurementNotWhitelisted");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Attestation verification
  // ─────────────────────────────────────────────────────────────────────────

  describe("verifyAttestation", () => {
    let domainSep: string;

    beforeEach(async () => {
      await av.connect(manager).whitelistMeasurement(MEASUREMENT);
      await av.connect(manager).registerEnclave(enclaveWallet.address, MEASUREMENT, DESCRIPTION);
      domainSep = await av.domainSeparator();
    });

    // Sign the raw EIP-712 digest without any extra prefix
    // digest = keccak256("\x19\x01" || domainSep || structHash)
    function signRawEIP712(wallet: ethers.Wallet, domainSeparator: string, structHash: string): string {
      const digest = ethers.solidityPackedKeccak256(
        ["bytes2", "bytes32", "bytes32"],
        ["0x1901", domainSeparator, structHash]
      );
      const sig = wallet.signingKey.sign(ethers.getBytes(digest));
      return ethers.Signature.from(sig).serialized;
    }

    it("accepts a valid attestation from registered enclave", async () => {
      const structHash = ethers.keccak256(ethers.randomBytes(32));
      const sig = signRawEIP712(enclaveWallet, domainSep, structHash);

      const recovered = await av.verifyAttestation(structHash, sig);
      expect(recovered.toLowerCase()).to.equal(enclaveWallet.address.toLowerCase());
    });

    it("reverts if enclave is deactivated", async () => {
      await av.connect(manager).deactivateEnclave(enclaveWallet.address);
      const structHash = ethers.keccak256(ethers.randomBytes(32));
      const sig = signRawEIP712(enclaveWallet, domainSep, structHash);
      await expect(av.verifyAttestation(structHash, sig)).to.be.revertedWithCustomError(
        av,
        "AV__EnclaveInactive"
      );
    });

    it("reverts if signer is not a registered enclave", async () => {
      const randomWallet = ethers.Wallet.createRandom();
      const structHash = ethers.keccak256(ethers.randomBytes(32));
      const sig = signRawEIP712(randomWallet, domainSep, structHash);
      await expect(av.verifyAttestation(structHash, sig)).to.be.revertedWithCustomError(
        av,
        "AV__EnclaveNotFound"
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Upgradeability
  // ─────────────────────────────────────────────────────────────────────────

  describe("upgrade", () => {
    it("can be upgraded by UPGRADER_ROLE", async () => {
      const Factory = await ethers.getContractFactory("AttestationVerifier");
      await expect(upgrades.upgradeProxy(await av.getAddress(), Factory)).to.not.be.reverted;
    });

    it("reverts upgrade by non-upgrader", async () => {
      const Factory = await ethers.getContractFactory("AttestationVerifier", stranger);
      await expect(upgrades.upgradeProxy(await av.getAddress(), Factory)).to.be.reverted;
    });
  });
});
