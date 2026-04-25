/**
 * End-to-end smoke test against 0G Galileo testnet.
 * Usage:  DEPLOYER_PRIVATE_KEY=0x... npm run e2e
 * Optional: MOCK_TOKEN=0x...  RPC_URL=https://...
 */

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { StealthPaySDK } from "../src/StealthPaySDK";

const RPC_URL        = process.env.RPC_URL ?? "https://evmrpc-testnet.0g.ai";
const PROXY_ADDRESS  = "0x87fECd1AfA436490e3230C8B0B5aD49dcC1283F1";
const EXPLORER_BASE  = "https://chainscan-galileo.0g.ai";
const SPENDING_PRIVKEY = 0xdeadbeef_cafebabe_12345678_abcdef01n;

const POOL_ADMIN_ABI = [
  "function whitelistToken(address token) external",
  "function isTokenWhitelisted(address token) view returns (bool)",
  "function protocolFeeBps() view returns (uint256)",
  "function getRoot() view returns (bytes32)",
  "function getTreeSize() view returns (uint256)",
];

function loadMockERC20Artifact() {
  const p = path.resolve(__dirname, "../../contracts/artifacts/contracts/test/MockERC20.sol/MockERC20.json");
  const a = JSON.parse(fs.readFileSync(p, "utf8"));
  return { abi: a.abi, bytecode: a.bytecode };
}

// ─── Logging helpers ──────────────────────────────────────────────────────────

const T = () => new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm

function section(title: string) {
  const bar = "═".repeat(62);
  console.log(`\n${bar}`);
  console.log(`  ${title}`);
  console.log(bar);
}

function step(msg: string)   { console.log(`\n[${T()}]  ▶  ${msg}`); }
function info(msg: string)   { console.log(`[${T()}]     ${msg}`); }
function ok(msg: string)     { console.log(`[${T()}]  ✓  ${msg}`); }
function fail(msg: string)   { console.log(`[${T()}]  ✗  ${msg}`); process.exitCode = 1; }
function txlog(hash: string) { console.log(`[${T()}]     tx:       ${hash}`); console.log(`[${T()}]     explorer: ${EXPLORER_BASE}/tx/${hash}`); }

function check(label: string, actual: unknown, expected: unknown) {
  if (String(actual) === String(expected)) ok(label);
  else { fail(label); console.log(`           expected: ${expected}\n           actual:   ${actual}`); }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const privkey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privkey) { console.error("DEPLOYER_PRIVATE_KEY is required"); process.exit(1); }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer   = new ethers.Wallet(privkey, provider);
  const deployer = await signer.getAddress();

  section("SETUP");
  info(`RPC           : ${RPC_URL}`);
  info(`Signer        : ${deployer}`);
  info(`PrivacyPool   : ${PROXY_ADDRESS}`);
  const ogBal = await provider.getBalance(deployer);
  info(`OG balance    : ${ethers.formatEther(ogBal)} OG`);
  if (ogBal === 0n) { console.error("No gas — fund the signer first"); process.exit(1); }

  // ── 1. Token ────────────────────────────────────────────────────────────────
  section("STEP 1 — ERC-20 TOKEN");

  let tokenAddress: string;
  if (process.env.MOCK_TOKEN) {
    tokenAddress = process.env.MOCK_TOKEN;
    info(`Reusing MockERC20 at ${tokenAddress}`);
  } else {
    step("Deploying MockERC20 (1 000 000 USDC, 6 decimals)");
    const { abi, bytecode } = loadMockERC20Artifact();
    const factory  = new ethers.ContractFactory(abi, bytecode, signer);
    const contract = await factory.deploy("USD Coin", "USDC", 1_000_000n * 10n ** 6n);
    await contract.waitForDeployment();
    tokenAddress = await contract.getAddress();
    const deployTx = contract.deploymentTransaction()!;
    ok(`MockERC20 deployed`);
    info(`contract      : ${tokenAddress}`);
    txlog(deployTx.hash);
  }

  const erc20 = new ethers.Contract(
    tokenAddress,
    ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
    signer,
  );
  const decimals    = await erc20.decimals() as bigint;
  const signerBal   = await erc20.balanceOf(deployer) as bigint;
  info(`Token         : ${tokenAddress}`);
  info(`Signer USDC   : ${ethers.formatUnits(signerBal, decimals)} USDC`);

  // ── 2. Whitelist ────────────────────────────────────────────────────────────
  section("STEP 2 — WHITELIST TOKEN ON POOL");

  const pool = new ethers.Contract(PROXY_ADDRESS, POOL_ADMIN_ABI, signer);
  const alreadyListed = await pool.isTokenWhitelisted(tokenAddress) as boolean;
  if (alreadyListed) {
    ok(`Token already whitelisted — skipping`);
  } else {
    step(`Calling pool.whitelistToken(${tokenAddress})`);
    info(`from          : ${deployer}`);
    info(`to            : ${PROXY_ADDRESS}`);
    const tx = await pool.whitelistToken(tokenAddress);
    await tx.wait();
    ok(`Token whitelisted`);
    txlog(tx.hash);
  }
  const feeBps = await pool.protocolFeeBps() as bigint;
  const root0  = await pool.getRoot() as string;
  const size0  = await pool.getTreeSize() as bigint;
  info(`Protocol fee  : ${feeBps} bps (${Number(feeBps) / 100}%)`);
  info(`Merkle root   : ${root0}`);
  info(`Tree size     : ${size0} leaves`);

  // ── 3. SDK init ─────────────────────────────────────────────────────────────
  section("STEP 3 — INITIALISE SDK");

  const sdk = new StealthPaySDK({
    signer,
    privacyPoolAddress: PROXY_ADDRESS,
    spendingPrivkey: SPENDING_PRIVKEY,
    confirmTimeoutMs: 180_000,
  });
  step("Syncing Merkle tree from chain (replaying Shielded/Spent events)…");
  await sdk.sync(provider, 0);
  ok(`Sync complete — ${size0} leaves loaded`);

  // ── 4. Shield ───────────────────────────────────────────────────────────────
  const SHIELD_AMOUNT = 100n * 10n ** 6n;
  section(`STEP 4 — SHIELD  (${ethers.formatUnits(SHIELD_AMOUNT, decimals)} USDC → private pool)`);

  const poolAddrShort = PROXY_ADDRESS.slice(0, 10) + "…";
  step(`Generating UltraHonk ZK proof for shield…`);
  info(`Signer sends  : ${ethers.formatUnits(SHIELD_AMOUNT, decimals)} USDC`);
  info(`from          : ${deployer}`);
  info(`to (pool)     : ${PROXY_ADDRESS}`);
  info(`(proof generation takes 30–60 s)`);

  const beforeShield = await erc20.balanceOf(deployer) as bigint;
  const shieldResult = await sdk.shield(tokenAddress, SHIELD_AMOUNT);
  const afterShield  = await erc20.balanceOf(deployer) as bigint;

  ok(`Shield confirmed on-chain`);
  txlog(shieldResult.txHash);
  info(`Commitment    : 0x${shieldResult.commitment.toString(16).padStart(64, "0")}`);
  info(`Leaf index    : ${sdk.getNotes(tokenAddress)[0]?.index ?? "?"}`);
  info(`Signer USDC before : ${ethers.formatUnits(beforeShield, decimals)}`);
  info(`Signer USDC after  : ${ethers.formatUnits(afterShield, decimals)}`);
  info(`USDC deducted : ${ethers.formatUnits(beforeShield - afterShield, decimals)}`);
  const poolBalAfterShield = await erc20.balanceOf(PROXY_ADDRESS) as bigint;
  info(`Pool USDC held: ${ethers.formatUnits(poolBalAfterShield, decimals)}`);
  const root1 = await pool.getRoot() as string;
  const size1 = await pool.getTreeSize() as bigint;
  info(`Merkle root   : ${root1}`);
  info(`Tree size     : ${size1} leaves`);

  // ── 5. Private balance ──────────────────────────────────────────────────────
  section("STEP 5 — PRIVATE BALANCE CHECK");

  const balResult = sdk.getPrivateBalance(tokenAddress);
  info(`Notes held    : ${balResult.noteCount}`);
  info(`Private bal   : ${ethers.formatUnits(balResult.balance, decimals)} USDC`);
  check(
    `private balance == ${ethers.formatUnits(SHIELD_AMOUNT, decimals)} USDC`,
    balResult.balance, SHIELD_AMOUNT,
  );

  // ── 6. Unshield ─────────────────────────────────────────────────────────────
  const UNSHIELD_AMOUNT = 50n * 10n ** 6n;
  const recipient = ethers.Wallet.createRandom().address;
  section(`STEP 6 — UNSHIELD  (${ethers.formatUnits(UNSHIELD_AMOUNT, decimals)} USDC → public address)`);

  step(`Generating UltraHonk ZK proof for spend…`);
  info(`Spending note : ${ethers.formatUnits(SHIELD_AMOUNT, decimals)} USDC (leaf ${sdk.getNotes(tokenAddress)[0]?.index})`);
  info(`Public amount : ${ethers.formatUnits(UNSHIELD_AMOUNT, decimals)} USDC  →  recipient ${recipient}`);
  info(`Change        : ${ethers.formatUnits(SHIELD_AMOUNT - UNSHIELD_AMOUNT, decimals)} USDC  →  back to private pool (self)`);
  info(`from (caller) : ${deployer}`);
  info(`to (pool)     : ${PROXY_ADDRESS}`);
  info(`(proof generation takes 30–60 s)`);

  const unshieldResult = await sdk.unshield(tokenAddress, UNSHIELD_AMOUNT, recipient);

  ok(`Unshield confirmed on-chain`);
  txlog(unshieldResult.txHash);
  const feeOnUnshield = (UNSHIELD_AMOUNT * feeBps) / 10_000n;
  info(`Fee taken     : ${ethers.formatUnits(feeOnUnshield, decimals)} USDC (${feeBps} bps)`);
  info(`Net released  : ${ethers.formatUnits(UNSHIELD_AMOUNT - feeOnUnshield, decimals)} USDC → ${recipient}`);

  // ── 7. Verify on-chain ──────────────────────────────────────────────────────
  section("STEP 7 — ON-CHAIN VERIFICATION");

  const recipientBal = await erc20.balanceOf(recipient) as bigint;
  const poolFinalBal = await erc20.balanceOf(PROXY_ADDRESS) as bigint;
  const signerFinalBal = await erc20.balanceOf(deployer) as bigint;
  const root2 = await pool.getRoot() as string;
  const size2 = await pool.getTreeSize() as bigint;
  const finalPriv = sdk.getPrivateBalance(tokenAddress);

  info(`─── Balances ───`);
  info(`Signer USDC   : ${ethers.formatUnits(signerFinalBal, decimals)} USDC  (${deployer})`);
  info(`Recipient USDC: ${ethers.formatUnits(recipientBal, decimals)} USDC  (${recipient})`);
  info(`Pool USDC held: ${ethers.formatUnits(poolFinalBal, decimals)} USDC  (${PROXY_ADDRESS})`);
  info(`─── Private state ───`);
  info(`Private notes : ${finalPriv.noteCount}`);
  info(`Private bal   : ${ethers.formatUnits(finalPriv.balance, decimals)} USDC  (change note)`);
  info(`─── Merkle tree ───`);
  info(`Root before   : ${root1}`);
  info(`Root after    : ${root2}`);
  info(`Tree size     : ${size2} leaves  (was ${size1})`);

  info(`─── Assertions ───`);
  const expectedRecipient = UNSHIELD_AMOUNT - feeOnUnshield;
  check(
    `recipient received ${ethers.formatUnits(expectedRecipient, decimals)} USDC`,
    recipientBal, expectedRecipient,
  );
  const expectedChange = SHIELD_AMOUNT - UNSHIELD_AMOUNT;
  check(
    `change note == ${ethers.formatUnits(expectedChange, decimals)} USDC`,
    finalPriv.balance, expectedChange,
  );
  check(`Merkle root changed after spend`, root2 !== root1 ? "yes" : "no", "yes");
  check(`Tree grew by 2 leaves (1 shield + 1 change)`, size2 - size0, 2n);

  section("COMPLETE");
  info(`shield tx     : ${shieldResult.txHash}`);
  info(`unshield tx   : ${unshieldResult.txHash}`);
  info(`MOCK_TOKEN    : ${tokenAddress}`);
  console.log();
}

main().catch((err) => {
  console.error(`\n[${T()}]  FATAL:`, err?.message ?? err);
  if (err?.transaction) {
    console.error(`           tx data: ${JSON.stringify(err.transaction, null, 2)}`);
  }
  process.exit(1);
});
