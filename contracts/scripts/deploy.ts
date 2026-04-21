/**
 * Deploy ShieldVerifier + SpendVerifier + PrivacyPool (V2 - ZK proofs).
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network zeroGTestnet
 *
 * Required env vars:
 *   DEPLOYER_PRIVATE_KEY
 *
 * Optional env vars:
 *   INITIAL_ADMIN        - address granted all admin roles (default: deployer)
 *   FEE_RECIPIENT        - address that receives protocol fees (default: deployer)
 *   PROTOCOL_FEE_BPS     - fee in basis points (default: 10 = 0.1%)
 */
import { ethers, upgrades, network } from "hardhat";
import { saveDeployment } from "./utils";

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddr = await deployer.getAddress();
  console.log(`\nDeployer: ${deployerAddr}`);
  console.log(`Network:  ${network.name} (chainId ${(await ethers.provider.getNetwork()).chainId})\n`);

  const admin        = process.env.INITIAL_ADMIN   || deployerAddr;
  const feeRecipient = process.env.FEE_RECIPIENT   || deployerAddr;
  const feeBps       = BigInt(process.env.PROTOCOL_FEE_BPS ?? "10");

  // 1. ShieldVerifier (ZKTranscriptLib must be deployed and linked first)
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
  console.log(`  ZKTranscriptLib: ${await shieldTranscript.getAddress()}`);
  console.log(`  ShieldVerifier:  ${shieldVerifierAddr}`);

  // 2. SpendVerifier (same pattern — separate ZKTranscriptLib instance)
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
  console.log(`  ZKTranscriptLib: ${await spendTranscript.getAddress()}`);
  console.log(`  SpendVerifier:   ${spendVerifierAddr}`);

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

  // 4. Save addresses to deployments/<network>.json
  const chainId   = Number((await ethers.provider.getNetwork()).chainId);
  const savedPath = saveDeployment({
    network:          network.name,
    chainId,
    deployedAt:       new Date().toISOString(),
    deployer:         deployerAddr,
    ShieldVerifier:   shieldVerifierAddr,
    SpendVerifier:    spendVerifierAddr,
    PrivacyPoolImpl:  poolImpl,
    PrivacyPoolProxy: poolProxy,
  });

  console.log(`\nDeployment saved to ${savedPath}`);
  console.log("\n-----------------------------------------");
  console.log("Next steps:");
  console.log("  1. npx hardhat run scripts/setup.ts --network <network>");
  console.log("  2. npx hardhat verify --network <network> " + shieldVerifierAddr);
  console.log("  3. npx hardhat verify --network <network> " + spendVerifierAddr);
  console.log("  4. npx hardhat verify --network <network> " + poolImpl);
  console.log("-----------------------------------------\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
