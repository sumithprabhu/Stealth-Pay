/**
 * Deploy a fresh PrivacyPool implementation and upgrade the proxy manually.
 * Bypasses the OZ upgrades plugin cache.
 *
 * Usage:
 *   npx hardhat run scripts/upgradeManual.ts --network zeroGTestnet
 */
import { ethers, network } from "hardhat";
import { loadDeployment, saveDeployment } from "./utils";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\nSigner:  ${await deployer.getAddress()}`);
  console.log(`Network: ${network.name}\n`);

  const deployment = loadDeployment(network.name);
  const PROXY = deployment.PrivacyPoolProxy;

  // Deploy fresh implementation (bypasses OZ manifest cache)
  const Factory = await ethers.getContractFactory("PrivacyPool", deployer);
  const newImpl = await Factory.deploy();
  await newImpl.waitForDeployment();
  const implAddr = await newImpl.getAddress();
  console.log(`New impl:  ${implAddr}`);
  console.log(`Deploy tx: ${newImpl.deploymentTransaction()?.hash}`);

  // Upgrade proxy → new impl via upgradeToAndCall
  const proxy = new ethers.Contract(
    PROXY,
    ["function upgradeToAndCall(address newImplementation, bytes calldata data) external payable"],
    deployer,
  );
  const tx = await proxy.upgradeToAndCall(implAddr, "0x");
  await tx.wait();
  console.log(`\nProxy upgraded: ${PROXY} → ${implAddr}`);
  console.log(`Upgrade tx: ${tx.hash}`);

  deployment.PrivacyPoolImpl = implAddr;
  saveDeployment(deployment);
  console.log(`Deployment record updated.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
