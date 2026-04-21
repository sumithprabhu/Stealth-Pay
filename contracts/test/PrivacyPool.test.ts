import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { MockHonkVerifier, PrivacyPool } from "../typechain-types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function deployMockERC20(deployer: SignerWithAddress, supply: bigint) {
  const F = await ethers.getContractFactory("MockERC20", deployer);
  return F.deploy("Mock USDC", "mUSDC", supply);
}

async function deployMockVerifier(): Promise<MockHonkVerifier> {
  const F = await ethers.getContractFactory("MockHonkVerifier");
  return F.deploy() as unknown as Promise<MockHonkVerifier>;
}

function rndBytes32(): string {
  return ethers.hexlify(ethers.randomBytes(32));
}

const MOCK_PROOF = ethers.hexlify(ethers.randomBytes(100));

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────

describe("PrivacyPool (V2 — ZK proof flow)", () => {
  let pool:      PrivacyPool;
  let shieldV:   MockHonkVerifier;
  let spendV:    MockHonkVerifier;
  let usdc:      Awaited<ReturnType<typeof deployMockERC20>>;

  let admin:        SignerWithAddress;
  let user:         SignerWithAddress;
  let recipient:    SignerWithAddress;
  let feeRecipient: SignerWithAddress;
  let stranger:     SignerWithAddress;

  const FEE_BPS    = 10n;
  const SHIELD_AMT = ethers.parseUnits("100", 6);

  beforeEach(async () => {
    [admin, user, recipient, feeRecipient, stranger] = await ethers.getSigners();

    usdc     = await deployMockERC20(admin, ethers.parseUnits("1000000", 6));
    shieldV  = await deployMockVerifier();
    spendV   = await deployMockVerifier();

    await usdc.transfer(user.address, ethers.parseUnits("10000", 6));

    const Factory = await ethers.getContractFactory("PrivacyPool");
    pool = (await upgrades.deployProxy(
      Factory,
      [
        admin.address,
        await shieldV.getAddress(),
        await spendV.getAddress(),
        FEE_BPS,
        feeRecipient.address,
      ],
      { kind: "uups" },
    )) as unknown as PrivacyPool;

    await pool.connect(admin).whitelistToken(await usdc.getAddress());
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Initialize
  // ─────────────────────────────────────────────────────────────────────────

  describe("initialize", () => {
    it("sets fee and fee recipient", async () => {
      expect(await pool.protocolFeeBps()).to.equal(FEE_BPS);
      expect(await pool.feeRecipient()).to.equal(feeRecipient.address);
    });

    it("exposes shieldVerifier and spendVerifier addresses", async () => {
      expect(await pool.shieldVerifier()).to.equal(await shieldV.getAddress());
      expect(await pool.spendVerifier()).to.equal(await spendV.getAddress());
    });

    it("reverts with zero admin", async () => {
      const F = await ethers.getContractFactory("PrivacyPool");
      await expect(
        upgrades.deployProxy(
          F,
          [ethers.ZeroAddress, await shieldV.getAddress(), await spendV.getAddress(), FEE_BPS, feeRecipient.address],
          { kind: "uups" },
        ),
      ).to.be.revertedWithCustomError(pool, "PP__ZeroAddress");
    });

    it("reverts with fee above MAX_FEE_BPS", async () => {
      const F = await ethers.getContractFactory("PrivacyPool");
      await expect(
        upgrades.deployProxy(
          F,
          [admin.address, await shieldV.getAddress(), await spendV.getAddress(), 9999n, feeRecipient.address],
          { kind: "uups" },
        ),
      ).to.be.revertedWithCustomError(pool, "PP__InvalidFee");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Shield
  // ─────────────────────────────────────────────────────────────────────────

  describe("shield()", () => {
    beforeEach(async () => {
      await usdc.connect(user).approve(await pool.getAddress(), SHIELD_AMT);
    });

    it("accepts a valid shield and emits Shielded event", async () => {
      const commitment = rndBytes32();
      await expect(
        pool.connect(user).shield(
          { token: await usdc.getAddress(), amount: SHIELD_AMT, commitment },
          MOCK_PROOF,
        ),
      ).to.emit(pool, "Shielded");
    });

    it("inserts commitment into tree (size += 1)", async () => {
      await pool.connect(user).shield(
        { token: await usdc.getAddress(), amount: SHIELD_AMT, commitment: rndBytes32() },
        MOCK_PROOF,
      );
      expect(await pool.getTreeSize()).to.equal(1n);
    });

    it("transfers protocol fee to feeRecipient", async () => {
      const fee    = (SHIELD_AMT * FEE_BPS) / 10000n;
      const before = await usdc.balanceOf(feeRecipient.address);
      await pool.connect(user).shield(
        { token: await usdc.getAddress(), amount: SHIELD_AMT, commitment: rndBytes32() },
        MOCK_PROOF,
      );
      expect(await usdc.balanceOf(feeRecipient.address)).to.equal(before + fee);
    });

    it("reverts on invalid ZK proof (mock returns false)", async () => {
      await shieldV.setResult(false);
      await expect(
        pool.connect(user).shield(
          { token: await usdc.getAddress(), amount: SHIELD_AMT, commitment: rndBytes32() },
          MOCK_PROOF,
        ),
      ).to.be.revertedWithCustomError(pool, "PP__InvalidZKProof");
    });

    it("reverts with non-whitelisted token", async () => {
      await expect(
        pool.connect(user).shield(
          { token: ethers.ZeroAddress, amount: SHIELD_AMT, commitment: rndBytes32() },
          MOCK_PROOF,
        ),
      ).to.be.revertedWithCustomError(pool, "PP__TokenNotWhitelisted");
    });

    it("reverts with zero amount", async () => {
      await expect(
        pool.connect(user).shield(
          { token: await usdc.getAddress(), amount: 0n, commitment: rndBytes32() },
          MOCK_PROOF,
        ),
      ).to.be.revertedWithCustomError(pool, "PP__ZeroAmount");
    });

    it("reverts on duplicate commitment", async () => {
      const commitment = rndBytes32();
      await pool.connect(user).shield(
        { token: await usdc.getAddress(), amount: SHIELD_AMT, commitment },
        MOCK_PROOF,
      );
      await usdc.connect(user).approve(await pool.getAddress(), SHIELD_AMT);
      await expect(
        pool.connect(user).shield(
          { token: await usdc.getAddress(), amount: SHIELD_AMT, commitment },
          MOCK_PROOF,
        ),
      ).to.be.revertedWithCustomError(pool, "PP__CommitmentAlreadyExists");
    });

    it("reverts when paused", async () => {
      await pool.connect(admin).pause();
      await expect(
        pool.connect(user).shield(
          { token: await usdc.getAddress(), amount: SHIELD_AMT, commitment: rndBytes32() },
          MOCK_PROOF,
        ),
      ).to.be.revertedWithCustomError(pool, "EnforcedPause");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Spend (unshield path: publicAmount > 0)
  // ─────────────────────────────────────────────────────────────────────────

  describe("spend() — unshield", () => {
    const SPEND_AMT = ethers.parseUnits("50", 6);

    async function shieldFirst() {
      await usdc.connect(user).approve(await pool.getAddress(), SHIELD_AMT);
      await pool.connect(user).shield(
        { token: await usdc.getAddress(), amount: SHIELD_AMT, commitment: rndBytes32() },
        MOCK_PROOF,
      );
    }

    it("releases tokens to recipient on valid proof", async () => {
      await shieldFirst();
      const currentRoot = await pool.getRoot();
      const null1 = rndBytes32(), null2 = ethers.ZeroHash;
      const fee = (SPEND_AMT * FEE_BPS) / 10000n;
      const before = await usdc.balanceOf(recipient.address);

      await pool.spend(
        {
          token:          await usdc.getAddress(),
          merkleRoot:     currentRoot,
          nullifiers:     [null1, null2],
          newCommitments: [ethers.ZeroHash, ethers.ZeroHash],
          publicAmount:   SPEND_AMT,
          recipient:      recipient.address,
        },
        MOCK_PROOF,
      );

      expect(await usdc.balanceOf(recipient.address)).to.equal(before + SPEND_AMT - fee);
    });

    it("marks nullifiers as spent", async () => {
      await shieldFirst();
      const currentRoot = await pool.getRoot();
      const null1 = rndBytes32();

      await pool.spend(
        {
          token:          await usdc.getAddress(),
          merkleRoot:     currentRoot,
          nullifiers:     [null1, ethers.ZeroHash],
          newCommitments: [ethers.ZeroHash, ethers.ZeroHash],
          publicAmount:   SPEND_AMT,
          recipient:      recipient.address,
        },
        MOCK_PROOF,
      );

      expect(await pool.isNullifierSpent(null1)).to.be.true;
    });

    it("reverts on double spend", async () => {
      await shieldFirst();
      const currentRoot = await pool.getRoot();
      const null1 = rndBytes32();
      const params = {
        token:          await usdc.getAddress(),
        merkleRoot:     currentRoot,
        nullifiers:     [null1, ethers.ZeroHash] as [string, string],
        newCommitments: [ethers.ZeroHash, ethers.ZeroHash] as [string, string],
        publicAmount:   SPEND_AMT,
        recipient:      recipient.address,
      };

      await pool.spend(params, MOCK_PROOF);
      await expect(pool.spend(params, MOCK_PROOF)).to.be.revertedWithCustomError(
        pool,
        "PP__NullifierAlreadySpent",
      );
    });

    it("reverts on stale merkle root", async () => {
      await shieldFirst();
      await expect(
        pool.spend(
          {
            token:          await usdc.getAddress(),
            merkleRoot:     rndBytes32(),
            nullifiers:     [rndBytes32(), ethers.ZeroHash],
            newCommitments: [ethers.ZeroHash, ethers.ZeroHash],
            publicAmount:   SPEND_AMT,
            recipient:      recipient.address,
          },
          MOCK_PROOF,
        ),
      ).to.be.revertedWithCustomError(pool, "PP__InvalidMerkleRoot");
    });

    it("reverts on invalid ZK proof (mock returns false)", async () => {
      await shieldFirst();
      await spendV.setResult(false);
      const currentRoot = await pool.getRoot();
      await expect(
        pool.spend(
          {
            token:          await usdc.getAddress(),
            merkleRoot:     currentRoot,
            nullifiers:     [rndBytes32(), ethers.ZeroHash],
            newCommitments: [ethers.ZeroHash, ethers.ZeroHash],
            publicAmount:   SPEND_AMT,
            recipient:      recipient.address,
          },
          MOCK_PROOF,
        ),
      ).to.be.revertedWithCustomError(pool, "PP__InvalidZKProof");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Spend (private transfer path: publicAmount == 0)
  // ─────────────────────────────────────────────────────────────────────────

  describe("spend() — private transfer", () => {
    it("inserts new commitments without releasing tokens", async () => {
      await usdc.connect(user).approve(await pool.getAddress(), SHIELD_AMT);
      await pool.connect(user).shield(
        { token: await usdc.getAddress(), amount: SHIELD_AMT, commitment: rndBytes32() },
        MOCK_PROOF,
      );

      const currentRoot  = await pool.getRoot();
      const newCommit1   = rndBytes32();
      const newCommit2   = rndBytes32();
      const poolBefore   = await usdc.balanceOf(await pool.getAddress());

      await pool.spend(
        {
          token:          await usdc.getAddress(),
          merkleRoot:     currentRoot,
          nullifiers:     [rndBytes32(), ethers.ZeroHash],
          newCommitments: [newCommit1, newCommit2],
          publicAmount:   0n,
          recipient:      ethers.ZeroAddress,
        },
        MOCK_PROOF,
      );

      expect(await pool.isCommitmentKnown(newCommit1)).to.be.true;
      expect(await pool.isCommitmentKnown(newCommit2)).to.be.true;
      expect(await usdc.balanceOf(await pool.getAddress())).to.equal(poolBefore); // no tokens moved
      expect(await pool.getTreeSize()).to.equal(3n); // 1 from shield + 2 new
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Admin
  // ─────────────────────────────────────────────────────────────────────────

  describe("admin", () => {
    it("updates protocol fee and emits event", async () => {
      await expect(pool.connect(admin).setProtocolFee(50n))
        .to.emit(pool, "ProtocolFeeUpdated")
        .withArgs(FEE_BPS, 50n, admin.address);
      expect(await pool.protocolFeeBps()).to.equal(50n);
    });

    it("reverts fee above MAX_FEE_BPS", async () => {
      await expect(pool.connect(admin).setProtocolFee(9999n))
        .to.be.revertedWithCustomError(pool, "PP__InvalidFee");
    });

    it("updates fee recipient and emits event", async () => {
      await expect(pool.connect(admin).setFeeRecipient(stranger.address))
        .to.emit(pool, "FeeRecipientUpdated")
        .withArgs(feeRecipient.address, stranger.address, admin.address);
    });

    it("non-admin cannot update fee", async () => {
      await expect(pool.connect(stranger).setProtocolFee(50n)).to.be.reverted;
    });

    it("emergency withdraw transfers pool tokens to admin", async () => {
      await usdc.connect(user).approve(await pool.getAddress(), SHIELD_AMT);
      await pool.connect(user).shield(
        { token: await usdc.getAddress(), amount: SHIELD_AMT, commitment: rndBytes32() },
        MOCK_PROOF,
      );
      const poolBal = await pool.getTokenBalance(await usdc.getAddress());
      const before  = await usdc.balanceOf(admin.address);
      await pool.connect(admin).emergencyWithdraw(await usdc.getAddress(), admin.address, poolBal);
      expect(await usdc.balanceOf(admin.address)).to.equal(before + poolBal);
    });

    it("non-admin cannot emergency withdraw", async () => {
      await expect(
        pool.connect(stranger).emergencyWithdraw(await usdc.getAddress(), stranger.address, 1n),
      ).to.be.reverted;
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Upgrade
  // ─────────────────────────────────────────────────────────────────────────

  describe("upgrade", () => {
    it("can be upgraded by UPGRADER_ROLE", async () => {
      const F = await ethers.getContractFactory("PrivacyPool");
      await expect(upgrades.upgradeProxy(await pool.getAddress(), F)).to.not.be.reverted;
    });
  });
});
