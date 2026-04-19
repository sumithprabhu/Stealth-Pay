/**
 * Upgrade AttestationVerifier and/or PrivacyPool to a new implementation.
 *
 * Usage:
 *   # Upgrade both
 *   npx hardhat run scripts/upgrade.ts --network zeroGTestnet
 *
 *   # Upgrade only one — set the other to skip
 *   UPGRADE_AV=false   npx hardhat run scripts/upgrade.ts --network zeroGTestnet
 *   UPGRADE_POOL=false npx hardhat run scripts/upgrade.ts --network zeroGTestnet
 *
 * Optional env vars:
 *   UPGRADE_AV    — set to "false" to skip AttestationVerifier upgrade
 *   UPGRADE_POOL  — set to "false" to skip PrivacyPool upgrade
 */
import { ethers, upgrades, network } from "hardhat";
import { loadDeployment, saveDeployment } from "./utils";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\nSigner:  ${await deployer.getAddress()}`);
  console.log(`Network: ${network.name}\n`);

  const deployment = loadDeployment(network.name);
  const skipAV   = process.env.UPGRADE_AV   === "false";
  const skipPool = process.env.UPGRADE_POOL === "false";

  // ── AttestationVerifier ──────────────────────────────────────────────────
  if (!skipAV) {
    console.log("Upgrading AttestationVerifier…");
    const AVFactory = await ethers.getContractFactory("AttestationVerifier", deployer);
    const upgraded  = await upgrades.upgradeProxy(
      deployment.AttestationVerifierProxy,
      AVFactory,
      { kind: "uups" },
    );
    await upgraded.waitForDeployment();
    const newImpl = await upgrades.erc1967.getImplementationAddress(
      deployment.AttestationVerifierProxy,
    );
    console.log(`  Old impl: ${deployment.AttestationVerifierImpl}`);
    console.log(`  New impl: ${newImpl}`);
    deployment.AttestationVerifierImpl = newImpl;
  }

  // ── PrivacyPool ──────────────────────────────────────────────────────────
  if (!skipPool) {
    console.log("Upgrading PrivacyPool…");
    const PoolFactory = await ethers.getContractFactory("PrivacyPool", deployer);
    const upgraded    = await upgrades.upgradeProxy(
      deployment.PrivacyPoolProxy,
      PoolFactory,
      { kind: "uups" },
    );
    await upgraded.waitForDeployment();
    const newImpl = await upgrades.erc1967.getImplementationAddress(
      deployment.PrivacyPoolProxy,
    );
    console.log(`  Old impl: ${deployment.PrivacyPoolImpl}`);
    console.log(`  New impl: ${newImpl}`);
    deployment.PrivacyPoolImpl = newImpl;
  }

  saveDeployment(deployment);
  console.log(`\nDeployment record updated.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
