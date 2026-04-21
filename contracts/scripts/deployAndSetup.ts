/**
 * Combined deploy + setup for local development (V2 - ZK proofs).
 * Deploys all contracts and optionally whitelists tokens in one run.
 *
 * Usage:
 *   npx hardhat node                                                    # terminal 1
 *   npx hardhat run scripts/deployAndSetup.ts --network localhost       # terminal 2
 *
 * Optional env vars:
 *   INITIAL_ADMIN, FEE_RECIPIENT, PROTOCOL_FEE_BPS, WHITELIST_TOKENS
 */
import { ethers, upgrades, network } from "hardhat";
import { saveDeployment, optionalEnv } from "./utils";

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddr = await deployer.getAddress();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  console.log(`\nDeployer: ${deployerAddr}`);
  console.log(`Network:  ${network.name} (chainId ${chainId})\n`);

  const admin        = optionalEnv("INITIAL_ADMIN",   deployerAddr);
  const feeRecipient = optionalEnv("FEE_RECIPIENT",   deployerAddr);
  const feeBps       = BigInt(optionalEnv("PROTOCOL_FEE_BPS", "10"));

  // 1. ShieldVerifier
  console.log("Deploying ShieldVerifier...");
  const ShieldTranscriptLib = await ethers.getContractFactory("contracts/ShieldVerifier.sol:ZKTranscriptLib");
  const shieldTranscript = await ShieldTranscriptLib.deploy();
  await shieldTranscript.waitForDeployment();
  const ShieldVerifierFactory = await ethers.getContractFactory("ShieldVerifier", {
    libraries: { ZKTranscriptLib: await shieldTranscript.getAddress() },
  });
  const shieldVerifier = await ShieldVerifierFactory.deploy();
  await shieldVerifier.waitForDeployment();
  const shieldVerifierAddr = await shieldVerifier.getAddress();
  console.log(`  Address: ${shieldVerifierAddr}`);

  // 2. SpendVerifier
  console.log("\nDeploying SpendVerifier...");
  const SpendTranscriptLib = await ethers.getContractFactory("contracts/SpendVerifier.sol:ZKTranscriptLib");
  const spendTranscript = await SpendTranscriptLib.deploy();
  await spendTranscript.waitForDeployment();
  const SpendVerifierFactory = await ethers.getContractFactory("SpendVerifier", {
    libraries: { ZKTranscriptLib: await spendTranscript.getAddress() },
  });
  const spendVerifier = await SpendVerifierFactory.deploy();
  await spendVerifier.waitForDeployment();
  const spendVerifierAddr = await spendVerifier.getAddress();
  console.log(`  Address: ${spendVerifierAddr}`);

  // 3. PrivacyPool (UUPS proxy)
  console.log("\nDeploying PrivacyPool...");
  const PoolFactory = await ethers.getContractFactory("PrivacyPool");
  const pool = await upgrades.deployProxy(
    PoolFactory,
    [admin, shieldVerifierAddr, spendVerifierAddr, feeBps, feeRecipient],
    { kind: "uups", initializer: "initialize" },
  );
  await pool.waitForDeployment();
  const poolProxy = await pool.getAddress();
  const poolImpl  = await upgrades.erc1967.getImplementationAddress(poolProxy);
  console.log(`  Proxy: ${poolProxy}`);
  console.log(`  Impl:  ${poolImpl}`);

  // 4. Save
  saveDeployment({
    network:          network.name,
    chainId,
    deployedAt:       new Date().toISOString(),
    deployer:         deployerAddr,
    ShieldVerifier:   shieldVerifierAddr,
    SpendVerifier:    spendVerifierAddr,
    PrivacyPoolImpl:  poolImpl,
    PrivacyPoolProxy: poolProxy,
  });

  // 5. Whitelist tokens (optional)
  const tokensEnv = optionalEnv("WHITELIST_TOKENS");
  if (tokensEnv) {
    const poolContract = await ethers.getContractAt("PrivacyPool", poolProxy, deployer);
    const tokens = tokensEnv.split(",").map((t) => t.trim()).filter(Boolean);
    console.log("\nWhitelisting tokens...");
    for (const token of tokens) {
      const tx = await poolContract.whitelistToken(token);
      await tx.wait();
      console.log(`  ${token}`);
    }
  }

  console.log("\n========================================");
  console.log("Local deployment ready.");
  console.log(`  ShieldVerifier: ${shieldVerifierAddr}`);
  console.log(`  SpendVerifier:  ${spendVerifierAddr}`);
  console.log(`  PrivacyPool:    ${poolProxy}`);
  console.log("========================================\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
