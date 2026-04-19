/**
 * Post-deploy setup: register TEE enclave + whitelist tokens.
 *
 * Usage:
 *   npx hardhat run scripts/setup.ts --network zeroGTestnet
 *
 * Required env vars:
 *   ENCLAVE_SIGNING_KEY         — address of the enclave's ECDSA public key (0x…)
 *   ENCLAVE_MEASUREMENT_HASH    — keccak256 of the TEE measurement (0x…)
 *
 * Optional env vars:
 *   ENCLAVE_DESCRIPTION         — human-readable label (default: "StealthPay TEE")
 *   WHITELIST_TOKENS            — comma-separated ERC-20 addresses to whitelist
 */
import { ethers, network } from "hardhat";
import { loadDeployment, mustEnv, optionalEnv } from "./utils";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\nSigner:  ${await deployer.getAddress()}`);
  console.log(`Network: ${network.name}\n`);

  const deployment = loadDeployment(network.name);

  const avProxy   = deployment.AttestationVerifierProxy;
  const poolProxy = deployment.PrivacyPoolProxy;

  const av   = await ethers.getContractAt("AttestationVerifier", avProxy, deployer);
  const pool = await ethers.getContractAt("PrivacyPool",         poolProxy, deployer);

  // ── 1. Whitelist measurement ────────────────────────────────────────────
  const measurementHash = mustEnv("ENCLAVE_MEASUREMENT_HASH");
  const enclaveKey      = mustEnv("ENCLAVE_SIGNING_KEY");
  const description     = optionalEnv("ENCLAVE_DESCRIPTION", "StealthPay TEE");

  const alreadyWhitelisted = await av.isMeasurementWhitelisted(measurementHash);
  if (alreadyWhitelisted) {
    console.log(`Measurement already whitelisted: ${measurementHash}`);
  } else {
    console.log(`Whitelisting measurement: ${measurementHash}`);
    const tx = await av.whitelistMeasurement(measurementHash);
    await tx.wait();
    console.log(`  ✓ tx: ${tx.hash}`);
  }

  // ── 2. Register enclave ─────────────────────────────────────────────────
  const isActive = await av.isActiveEnclave(enclaveKey);
  if (isActive) {
    console.log(`Enclave already registered: ${enclaveKey}`);
  } else {
    console.log(`Registering enclave key: ${enclaveKey}`);
    const tx = await av.registerEnclave(enclaveKey, measurementHash, description);
    await tx.wait();
    console.log(`  ✓ tx: ${tx.hash}`);
  }

  // ── 3. Whitelist tokens ─────────────────────────────────────────────────
  const tokensEnv = optionalEnv("WHITELIST_TOKENS");
  if (tokensEnv) {
    const tokens = tokensEnv.split(",").map((t) => t.trim()).filter(Boolean);
    for (const token of tokens) {
      const already = await pool.isTokenWhitelisted(token);
      if (already) {
        console.log(`Token already whitelisted: ${token}`);
        continue;
      }
      console.log(`Whitelisting token: ${token}`);
      const tx = await pool.whitelistToken(token);
      await tx.wait();
      console.log(`  ✓ tx: ${tx.hash}`);
    }
  } else {
    console.log("No WHITELIST_TOKENS set — skipping token whitelisting.");
  }

  console.log("\nSetup complete.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
