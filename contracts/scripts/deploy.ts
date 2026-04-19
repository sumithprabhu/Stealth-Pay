/**
 * Deploy AttestationVerifier + PrivacyPool as UUPS proxies.
 *
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network zeroGTestnet
 *
 * Required env vars:
 *   DEPLOYER_PRIVATE_KEY
 *
 * Optional env vars (all fall back to deployer address if unset):
 *   INITIAL_ADMIN        — address granted all admin roles
 *   FEE_RECIPIENT        — address that receives protocol fees
 *   PROTOCOL_FEE_BPS     — fee in basis points (default: 10 = 0.1%)
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

  // ── 1. AttestationVerifier ──────────────────────────────────────────────
  console.log("Deploying AttestationVerifier…");
  const AVFactory = await ethers.getContractFactory("AttestationVerifier");
  const av = await upgrades.deployProxy(AVFactory, [admin], {
    kind:        "uups",
    initializer: "initialize",
  });
  await av.waitForDeployment();
  const avProxy = await av.getAddress();
  const avImpl  = await upgrades.erc1967.getImplementationAddress(avProxy);
  console.log(`  Proxy:  ${avProxy}`);
  console.log(`  Impl:   ${avImpl}`);

  // ── 2. PrivacyPool ──────────────────────────────────────────────────────
  console.log("\nDeploying PrivacyPool…");
  const PoolFactory = await ethers.getContractFactory("PrivacyPool");
  const pool = await upgrades.deployProxy(
    PoolFactory,
    [admin, avProxy, feeBps, feeRecipient],
    {
      kind:        "uups",
      initializer: "initialize",
    },
  );
  await pool.waitForDeployment();
  const poolProxy = await pool.getAddress();
  const poolImpl  = await upgrades.erc1967.getImplementationAddress(poolProxy);
  console.log(`  Proxy:  ${poolProxy}`);
  console.log(`  Impl:   ${poolImpl}`);

  // ── 3. Persist addresses ────────────────────────────────────────────────
  const chainId   = Number((await ethers.provider.getNetwork()).chainId);
  const savedPath = saveDeployment({
    network:                  network.name,
    chainId,
    deployedAt:               new Date().toISOString(),
    deployer:                 deployerAddr,
    AttestationVerifierImpl:  avImpl,
    AttestationVerifierProxy: avProxy,
    PrivacyPoolImpl:          poolImpl,
    PrivacyPoolProxy:         poolProxy,
  });

  console.log(`\nDeployment saved to ${savedPath}`);
  console.log("\n─────────────────────────────────────────");
  console.log("Next steps:");
  console.log("  1. npx hardhat run scripts/setup.ts --network <network>");
  console.log("     (registers enclave + whitelists tokens)");
  console.log("  2. npx hardhat verify --network <network> " + avImpl);
  console.log("  3. npx hardhat verify --network <network> " + poolImpl);
  console.log("─────────────────────────────────────────\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
