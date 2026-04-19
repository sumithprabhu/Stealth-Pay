/**
 * Combined deploy + setup for local development.
 * Deploys contracts, registers a dev enclave, whitelists tokens — all in one run.
 *
 * Usage:
 *   npx hardhat node                                   # terminal 1
 *   npx hardhat run scripts/deployAndSetup.ts --network localhost   # terminal 2
 *
 * Optional env vars (same as deploy.ts + setup.ts):
 *   INITIAL_ADMIN, FEE_RECIPIENT, PROTOCOL_FEE_BPS
 *   ENCLAVE_SIGNING_KEY, ENCLAVE_MEASUREMENT_HASH, ENCLAVE_DESCRIPTION
 *   WHITELIST_TOKENS
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

  // ── Deploy AttestationVerifier ──────────────────────────────────────────
  console.log("Deploying AttestationVerifier…");
  const AVFactory = await ethers.getContractFactory("AttestationVerifier");
  const av = await upgrades.deployProxy(AVFactory, [admin], {
    kind: "uups", initializer: "initialize",
  });
  await av.waitForDeployment();
  const avProxy = await av.getAddress();
  const avImpl  = await upgrades.erc1967.getImplementationAddress(avProxy);
  console.log(`  Proxy: ${avProxy}`);
  console.log(`  Impl:  ${avImpl}`);

  // ── Deploy PrivacyPool ──────────────────────────────────────────────────
  console.log("\nDeploying PrivacyPool…");
  const PoolFactory = await ethers.getContractFactory("PrivacyPool");
  const pool = await upgrades.deployProxy(
    PoolFactory,
    [admin, avProxy, feeBps, feeRecipient],
    { kind: "uups", initializer: "initialize" },
  );
  await pool.waitForDeployment();
  const poolProxy = await pool.getAddress();
  const poolImpl  = await upgrades.erc1967.getImplementationAddress(poolProxy);
  console.log(`  Proxy: ${poolProxy}`);
  console.log(`  Impl:  ${poolImpl}`);

  // ── Save addresses ──────────────────────────────────────────────────────
  saveDeployment({
    network:                  network.name,
    chainId,
    deployedAt:               new Date().toISOString(),
    deployer:                 deployerAddr,
    AttestationVerifierImpl:  avImpl,
    AttestationVerifierProxy: avProxy,
    PrivacyPoolImpl:          poolImpl,
    PrivacyPoolProxy:         poolProxy,
  });

  // ── Register dev enclave ────────────────────────────────────────────────
  const enclaveKey = optionalEnv(
    "ENCLAVE_SIGNING_KEY",
    ethers.Wallet.createRandom().address, // dev-only random key
  );
  const measurementHash = optionalEnv(
    "ENCLAVE_MEASUREMENT_HASH",
    ethers.keccak256(ethers.toUtf8Bytes("dev-measurement-v1")),
  );
  const description = optionalEnv("ENCLAVE_DESCRIPTION", "StealthPay TEE (dev)");

  console.log("\nRegistering enclave…");
  const avContract   = await ethers.getContractAt("AttestationVerifier", avProxy, deployer);
  const poolContract = await ethers.getContractAt("PrivacyPool",         poolProxy, deployer);

  let tx = await avContract.whitelistMeasurement(measurementHash);
  await tx.wait();
  tx = await avContract.registerEnclave(enclaveKey, measurementHash, description);
  await tx.wait();
  console.log(`  Enclave key:      ${enclaveKey}`);
  console.log(`  Measurement hash: ${measurementHash}`);

  // ── Whitelist tokens ────────────────────────────────────────────────────
  const tokensEnv = optionalEnv("WHITELIST_TOKENS");
  if (tokensEnv) {
    const tokens = tokensEnv.split(",").map((t) => t.trim()).filter(Boolean);
    console.log("\nWhitelisting tokens…");
    for (const token of tokens) {
      tx = await poolContract.whitelistToken(token);
      await tx.wait();
      console.log(`  ✓ ${token}`);
    }
  }

  console.log("\n════════════════════════════════════════");
  console.log("Local deployment ready.");
  console.log(`  AttestationVerifier: ${avProxy}`);
  console.log(`  PrivacyPool:         ${poolProxy}`);
  console.log("════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
