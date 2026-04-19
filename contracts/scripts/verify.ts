/**
 * Verify implementation contracts on the block explorer.
 *
 * Usage:
 *   npx hardhat run scripts/verify.ts --network zeroGTestnet
 *
 * Reads proxy + impl addresses from deployments/<network>.json.
 * Verifies the two implementation contracts (proxies are auto-verified
 * by the explorer once the impl is known).
 */
import { run, network } from "hardhat";
import { loadDeployment } from "./utils";

async function verify(address: string, constructorArgs: unknown[] = []) {
  try {
    await run("verify:verify", { address, constructorArguments: constructorArgs });
    console.log(`  ✓ Verified: ${address}`);
  } catch (err: unknown) {
    const msg = (err as Error).message ?? String(err);
    if (msg.includes("Already Verified") || msg.includes("already verified")) {
      console.log(`  Already verified: ${address}`);
    } else {
      console.error(`  ✗ Failed (${address}):`, msg);
    }
  }
}

async function main() {
  console.log(`\nNetwork: ${network.name}\n`);
  const d = loadDeployment(network.name);

  console.log("Verifying AttestationVerifier implementation…");
  await verify(d.AttestationVerifierImpl);

  console.log("Verifying PrivacyPool implementation…");
  await verify(d.PrivacyPoolImpl);

  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
