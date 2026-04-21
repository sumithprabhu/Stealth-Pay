/**
 * Post-deploy setup: whitelist tokens on the PrivacyPool.
 *
 * Usage:
 *   npx hardhat run scripts/setup.ts --network zeroGTestnet
 *
 * Optional env vars:
 *   WHITELIST_TOKENS  - comma-separated ERC-20 addresses to whitelist
 */
import { ethers, network } from "hardhat";
import { loadDeployment, optionalEnv } from "./utils";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\nSigner:  ${await deployer.getAddress()}`);
  console.log(`Network: ${network.name}\n`);

  const deployment = loadDeployment(network.name);
  const pool = await ethers.getContractAt("PrivacyPool", deployment.PrivacyPoolProxy, deployer);

  const tokensEnv = optionalEnv("WHITELIST_TOKENS");
  if (!tokensEnv) {
    console.log("No WHITELIST_TOKENS set — nothing to do.");
    console.log("Set WHITELIST_TOKENS=0xAddr1,0xAddr2 to whitelist ERC-20 tokens.\n");
    return;
  }

  const tokens = tokensEnv.split(",").map((t) => t.trim()).filter(Boolean);
  for (const token of tokens) {
    const already = await pool.isTokenWhitelisted(token);
    if (already) {
      console.log(`Already whitelisted: ${token}`);
      continue;
    }
    console.log(`Whitelisting: ${token}`);
    const tx = await pool.whitelistToken(token);
    await tx.wait();
    console.log(`  tx: ${tx.hash}`);
  }

  console.log("\nSetup complete.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
