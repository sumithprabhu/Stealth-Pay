import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { AttestationVerifier, PrivacyPool } from "../typechain-types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function deployMockERC20(deployer: SignerWithAddress, supply: bigint) {
  const Factory = await ethers.getContractFactory("MockERC20", deployer);
  return Factory.deploy("Mock USDC", "mUSDC", supply);
}

async function buildAV(admin: SignerWithAddress): Promise<AttestationVerifier> {
  const Factory = await ethers.getContractFactory("AttestationVerifier");
  return upgrades.deployProxy(Factory, [admin.address], {
    kind: "uups",
  }) as unknown as Promise<AttestationVerifier>;
}

function makeCommitment(seed: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(seed));
}

function makeNullifier(seed: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes("nullifier:" + seed));
}

// Sign the raw EIP-712 digest without any extra prefix.
// digest = keccak256("\x19\x01" || domainSep || structHash)
function signRawEIP712(wallet: ethers.Wallet, domainSeparator: string, structHash: string): string {
  const digest = ethers.solidityPackedKeccak256(
    ["bytes2", "bytes32", "bytes32"],
    ["0x1901", domainSeparator, structHash]
  );
  const sig = wallet.signingKey.sign(ethers.getBytes(digest));
  return ethers.Signature.from(sig).serialized;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("PrivacyPool", () => {
  let pool: PrivacyPool;
  let av: AttestationVerifier;
  let usdc: Awaited<ReturnType<typeof deployMockERC20>>;

  let admin: SignerWithAddress;
  let user: SignerWithAddress;
  let recipient: SignerWithAddress;
  let feeRecipient: SignerWithAddress;
  let stranger: SignerWithAddress;

  // Real wallets for TEE simulation so we can sign raw EIP-712
  const enclaveWallet = ethers.Wallet.createRandom();
  const strangerWallet = ethers.Wallet.createRandom();

  const MEASUREMENT = ethers.keccak256(ethers.toUtf8Bytes("tdx-measurement-v1"));
  const FEE_BPS     = 10n; // 0.1%
  const SHIELD_AMT  = ethers.parseUnits("100", 6);

  let domainSep: string;

  beforeEach(async () => {
    [admin, user, recipient, feeRecipient, stranger] = await ethers.getSigners();

    // Deploy mock ERC-20
    usdc = await deployMockERC20(admin, ethers.parseUnits("1000000", 6));
    await usdc.transfer(user.address, ethers.parseUnits("10000", 6));

    // Deploy AttestationVerifier and register our enclave wallet
    av = await buildAV(admin);
    await av.connect(admin).whitelistMeasurement(MEASUREMENT);
    await av.connect(admin).registerEnclave(enclaveWallet.address, MEASUREMENT, "test-enclave");

    // Deploy PrivacyPool
    const Factory = await ethers.getContractFactory("PrivacyPool");
    pool = (await upgrades.deployProxy(
      Factory,
      [admin.address, await av.getAddress(), FEE_BPS, feeRecipient.address],
      { kind: "uups" }
    )) as unknown as PrivacyPool;

    // Whitelist USDC
    await pool.connect(admin).whitelistToken(await usdc.getAddress());

    // The pool passes structHash to AttestationVerifier.verifyAttestation(),
    // which calls _hashTypedDataV4 using the AttestationVerifier's own domain.
    domainSep = await av.domainSeparator();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Signing helpers (build structHash exactly as the contract does, then sign)
  // ─────────────────────────────────────────────────────────────────────────

  async function signUnshield(
    wallet: ethers.Wallet,
    params: {
      token: string;
      amount: bigint;
      recipient: string;
      nullifier: string;
      newRoot: string;
      deadline: bigint;
      nonce: bigint;
    }
  ): Promise<string> {
    const TYPEHASH = await pool.UNSHIELD_TYPEHASH();
    const structHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "uint256", "address", "bytes32", "bytes32", "uint256", "uint256"],
        [TYPEHASH, params.token, params.amount, params.recipient, params.nullifier, params.newRoot, params.deadline, params.nonce]
      )
    );
    return signRawEIP712(wallet, domainSep, structHash);
  }

  async function signPrivateAction(
    wallet: ethers.Wallet,
    params: {
      nullifiers: string[];
      newCommitments: string[];
      newRoot: string;
      deadline: bigint;
      nonce: bigint;
    }
  ): Promise<string> {
    const TYPEHASH = await pool.PRIVATE_ACTION_TYPEHASH();
    // Contract uses abi.encodePacked for the arrays (raw byte concat, no length prefix)
    const nullifiersHash     = ethers.keccak256(ethers.concat(params.nullifiers));
    const commitmentsHash    = ethers.keccak256(ethers.concat(params.newCommitments));
    const structHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "bytes32", "bytes32", "bytes32", "uint256", "uint256"],
        [TYPEHASH, nullifiersHash, commitmentsHash, params.newRoot, params.deadline, params.nonce]
      )
    );
    return signRawEIP712(wallet, domainSep, structHash);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────────────────────────────────────────

  describe("initialize", () => {
    it("sets initial fee and fee recipient", async () => {
      expect(await pool.protocolFeeBps()).to.equal(FEE_BPS);
      expect(await pool.feeRecipient()).to.equal(feeRecipient.address);
    });

    it("sets attestation verifier", async () => {
      expect(await pool.attestationVerifier()).to.equal(await av.getAddress());
    });

    it("reverts with zero admin", async () => {
      const Factory = await ethers.getContractFactory("PrivacyPool");
      await expect(
        upgrades.deployProxy(
          Factory,
          [ethers.ZeroAddress, await av.getAddress(), FEE_BPS, feeRecipient.address],
          { kind: "uups" }
        )
      ).to.be.revertedWithCustomError(pool, "PP__ZeroAddress");
    });

    it("reverts with fee above MAX_FEE_BPS", async () => {
      const Factory = await ethers.getContractFactory("PrivacyPool");
      await expect(
        upgrades.deployProxy(
          Factory,
          [admin.address, await av.getAddress(), 9999n, feeRecipient.address],
          { kind: "uups" }
        )
      ).to.be.revertedWithCustomError(pool, "PP__InvalidFee");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Shield
  // ─────────────────────────────────────────────────────────────────────────

  describe("shield", () => {
    beforeEach(async () => {
      await usdc.connect(user).approve(await pool.getAddress(), SHIELD_AMT);
    });

    it("accepts a valid shield and emits Shielded event", async () => {
      const commitment = makeCommitment("note-1");
      const fee        = (SHIELD_AMT * FEE_BPS) / 10000n;

      await expect(
        pool.connect(user).shield({ token: await usdc.getAddress(), amount: SHIELD_AMT, commitment })
      ).to.emit(pool, "Shielded");

      expect(await pool.isCommitmentKnown(commitment)).to.be.true;
    });

    it("inserts commitment into tree and increments size", async () => {
      const commitment = makeCommitment("note-2");
      await pool.connect(user).shield({ token: await usdc.getAddress(), amount: SHIELD_AMT, commitment });
      expect(await pool.isCommitmentKnown(commitment)).to.be.true;
      expect(await pool.getTreeSize()).to.equal(1n);
    });

    it("transfers fee to feeRecipient", async () => {
      const commitment  = makeCommitment("note-3");
      const expectedFee = (SHIELD_AMT * FEE_BPS) / 10000n;
      const before      = await usdc.balanceOf(feeRecipient.address);
      await pool.connect(user).shield({ token: await usdc.getAddress(), amount: SHIELD_AMT, commitment });
      expect(await usdc.balanceOf(feeRecipient.address)).to.equal(before + expectedFee);
    });

    it("reverts with non-whitelisted token", async () => {
      await expect(
        pool.connect(user).shield({ token: ethers.ZeroAddress, amount: SHIELD_AMT, commitment: makeCommitment("x") })
      ).to.be.revertedWithCustomError(pool, "PP__TokenNotWhitelisted");
    });

    it("reverts with zero amount", async () => {
      await expect(
        pool.connect(user).shield({ token: await usdc.getAddress(), amount: 0n, commitment: makeCommitment("x") })
      ).to.be.revertedWithCustomError(pool, "PP__ZeroAmount");
    });

    it("reverts on duplicate commitment", async () => {
      const commitment = makeCommitment("dupe");
      await pool.connect(user).shield({ token: await usdc.getAddress(), amount: SHIELD_AMT, commitment });
      await usdc.connect(user).approve(await pool.getAddress(), SHIELD_AMT);
      await expect(
        pool.connect(user).shield({ token: await usdc.getAddress(), amount: SHIELD_AMT, commitment })
      ).to.be.revertedWithCustomError(pool, "PP__CommitmentAlreadyExists");
    });

    it("reverts when paused", async () => {
      await pool.connect(admin).pause();
      await expect(
        pool.connect(user).shield({ token: await usdc.getAddress(), amount: SHIELD_AMT, commitment: makeCommitment("p") })
      ).to.be.revertedWithCustomError(pool, "EnforcedPause");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Unshield
  // ─────────────────────────────────────────────────────────────────────────

  describe("unshield", () => {
    const UNSHIELD_AMT = ethers.parseUnits("50", 6);
    let deadline: bigint;
    let params: {
      token: string;
      amount: bigint;
      recipient: string;
      nullifier: string;
      newRoot: string;
      deadline: bigint;
      nonce: bigint;
    };

    beforeEach(async () => {
      // Shield first so pool has funds
      await usdc.connect(user).approve(await pool.getAddress(), SHIELD_AMT);
      await pool.connect(user).shield({
        token: await usdc.getAddress(),
        amount: SHIELD_AMT,
        commitment: makeCommitment("note-for-unshield"),
      });

      deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      params   = {
        token:     await usdc.getAddress(),
        amount:    UNSHIELD_AMT,
        recipient: recipient.address,
        nullifier: makeNullifier("unshield-1"),
        newRoot:   ethers.keccak256(ethers.toUtf8Bytes("new-root-after-unshield")),
        deadline,
        nonce:     1n,
      };
    });

    it("releases tokens to recipient on valid TEE signature", async () => {
      const sig = await signUnshield(enclaveWallet, params);
      const fee = (UNSHIELD_AMT * FEE_BPS) / 10000n;

      const before = await usdc.balanceOf(recipient.address);
      await expect(pool.unshield(params, sig)).to.emit(pool, "Unshielded");
      expect(await usdc.balanceOf(recipient.address)).to.equal(before + UNSHIELD_AMT - fee);
    });

    it("marks nullifier as spent", async () => {
      const sig = await signUnshield(enclaveWallet, params);
      await pool.unshield(params, sig);
      expect(await pool.isNullifierSpent(params.nullifier)).to.be.true;
    });

    it("reverts on double spend of nullifier", async () => {
      const sig = await signUnshield(enclaveWallet, params);
      await pool.unshield(params, sig);
      // Same nullifier, different nonce
      const params2 = { ...params, nonce: 2n };
      const sig2    = await signUnshield(enclaveWallet, params2);
      await expect(pool.unshield(params2, sig2)).to.be.revertedWithCustomError(
        pool,
        "PP__NullifierAlreadySpent"
      );
    });

    it("reverts on expired deadline", async () => {
      const expiredParams = { ...params, deadline: 1n };
      const sig = await signUnshield(enclaveWallet, expiredParams);
      await expect(pool.unshield(expiredParams, sig)).to.be.revertedWithCustomError(
        pool,
        "PP__AttestationExpired"
      );
    });

    it("reverts if signed by unknown wallet", async () => {
      const sig = await signUnshield(strangerWallet, params);
      await expect(pool.unshield(params, sig)).to.be.reverted;
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Private Action
  // ─────────────────────────────────────────────────────────────────────────

  describe("privateAction", () => {
    let params: {
      nullifiers:     string[];
      newCommitments: string[];
      newRoot:        string;
      deadline:       bigint;
      nonce:          bigint;
    };

    beforeEach(async () => {
      // Shield so pool has something in it
      await usdc.connect(user).approve(await pool.getAddress(), SHIELD_AMT);
      await pool.connect(user).shield({
        token: await usdc.getAddress(),
        amount: SHIELD_AMT,
        commitment: makeCommitment("initial-note"),
      });

      params = {
        nullifiers:     [makeNullifier("pa-null-1")],
        newCommitments: [makeCommitment("pa-new-note-1"), makeCommitment("pa-new-note-2")],
        newRoot:        ethers.keccak256(ethers.toUtf8Bytes("pa-root")),
        deadline:       BigInt(Math.floor(Date.now() / 1000) + 3600),
        nonce:          10n,
      };
    });

    it("inserts new commitments and emits event on valid attestation", async () => {
      const sig = await signPrivateAction(enclaveWallet, params);
      await expect(pool.privateAction(params, sig))
        .to.emit(pool, "PrivateActionExecuted")
        .withArgs(params.newRoot, params.nullifiers, params.newCommitments);

      for (const c of params.newCommitments) {
        expect(await pool.isCommitmentKnown(c)).to.be.true;
      }
    });

    it("marks all nullifiers as spent", async () => {
      const sig = await signPrivateAction(enclaveWallet, params);
      await pool.privateAction(params, sig);
      expect(await pool.isNullifierSpent(params.nullifiers[0])).to.be.true;
    });

    it("reverts on double-spent nullifier", async () => {
      const sig = await signPrivateAction(enclaveWallet, params);
      await pool.privateAction(params, sig);
      // Same nullifier, different nonce, fresh commitments
      const params2 = { ...params, nonce: 11n, newCommitments: [makeCommitment("fresh-note")] };
      const sig2    = await signPrivateAction(enclaveWallet, params2);
      await expect(pool.privateAction(params2, sig2)).to.be.revertedWithCustomError(
        pool,
        "PP__NullifierAlreadySpent"
      );
    });

    it("reverts with empty nullifiers array", async () => {
      const bad = { ...params, nullifiers: [] };
      const sig = await signPrivateAction(enclaveWallet, bad);
      await expect(pool.privateAction(bad, sig)).to.be.revertedWithCustomError(
        pool,
        "PP__EmptyNullifiers"
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Admin operations
  // ─────────────────────────────────────────────────────────────────────────

  describe("admin", () => {
    it("updates protocol fee and emits event", async () => {
      await expect(pool.connect(admin).setProtocolFee(50n))
        .to.emit(pool, "ProtocolFeeUpdated")
        .withArgs(FEE_BPS, 50n, admin.address);
      expect(await pool.protocolFeeBps()).to.equal(50n);
    });

    it("reverts fee above MAX_FEE_BPS", async () => {
      await expect(pool.connect(admin).setProtocolFee(9999n)).to.be.revertedWithCustomError(
        pool,
        "PP__InvalidFee"
      );
    });

    it("updates fee recipient", async () => {
      await expect(pool.connect(admin).setFeeRecipient(stranger.address))
        .to.emit(pool, "FeeRecipientUpdated")
        .withArgs(feeRecipient.address, stranger.address, admin.address);
    });

    it("pause blocks shield", async () => {
      await pool.connect(admin).pause();
      await usdc.connect(user).approve(await pool.getAddress(), SHIELD_AMT);
      await expect(
        pool.connect(user).shield({
          token: await usdc.getAddress(),
          amount: SHIELD_AMT,
          commitment: makeCommitment("p"),
        })
      ).to.be.revertedWithCustomError(pool, "EnforcedPause");
      await pool.connect(admin).unpause();
    });

    it("emergency withdraw transfers tokens", async () => {
      await usdc.connect(user).approve(await pool.getAddress(), SHIELD_AMT);
      await pool.connect(user).shield({
        token: await usdc.getAddress(),
        amount: SHIELD_AMT,
        commitment: makeCommitment("ew-note"),
      });

      const poolBalance = await pool.getTokenBalance(await usdc.getAddress());
      const before      = await usdc.balanceOf(admin.address);
      await pool.connect(admin).emergencyWithdraw(await usdc.getAddress(), admin.address, poolBalance);
      expect(await usdc.balanceOf(admin.address)).to.equal(before + poolBalance);
    });

    it("non-admin cannot emergency withdraw", async () => {
      await expect(
        pool.connect(stranger).emergencyWithdraw(await usdc.getAddress(), stranger.address, 1n)
      ).to.be.reverted;
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Upgradeability
  // ─────────────────────────────────────────────────────────────────────────

  describe("upgrade", () => {
    it("can be upgraded by UPGRADER_ROLE", async () => {
      const Factory = await ethers.getContractFactory("PrivacyPool");
      await expect(upgrades.upgradeProxy(await pool.getAddress(), Factory)).to.not.be.reverted;
    });
  });
});
