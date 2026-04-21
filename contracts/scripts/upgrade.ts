/**
 * Upgrade PrivacyPool to a new implementation.
 * ShieldVerifier/SpendVerifier are plain contracts — redeploy via deploy.ts if circuits change.
 *
 * Usage:
 *   npx hardhat run scripts/upgrade.ts --network zeroGTestnet
 */
import { ethers, upgrades, network } from "hardhat";
import { loadDeployment, saveDeployment } from "./utils";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\nSigner:  ${await deployer.getAddress()}`);
  console.log(`Network: ${network.name}\n`);

  const deployment = loadDeployment(network.name);

  console.log("Upgrading PrivacyPool...");
  const PoolFactory = await ethers.getContractFactory("PrivacyPool", deployer);
  const upgraded    = await upgrades.upgradeProxy(
    deployment.PrivacyPoolProxy,
    PoolFactory,
    { kind: "uups" },
  );
  await upgraded.waitForDeployment();
  const newImpl = await upgrades.erc1967.getImplementationAddress(deployment.PrivacyPoolProxy);
  console.log(`  Old impl: ${deployment.PrivacyPoolImpl}`);
  console.log(`  New impl: ${newImpl}`);

  deployment.PrivacyPoolImpl = newImpl;
  saveDeployment(deployment);
  console.log(`\nDeployment record updated.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
