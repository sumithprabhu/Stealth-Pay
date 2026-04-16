import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseUnits } from "ethers";

/**
 * StealthPay Ignition deployment module.
 *
 * Deploys:
 *   1. AttestationVerifier (UUPS proxy)
 *   2. PrivacyPool (UUPS proxy) — wired to the verifier
 *
 * Parameters (override via ignition/parameters.json or CLI --parameters):
 *   admin           — Address that receives all admin roles
 *   feeRecipient    — Address that receives protocol fees
 *   protocolFeeBps  — Fee in basis points (default: 10 = 0.1%)
 */
const StealthPayModule = buildModule("StealthPay", (m) => {
  // ── Parameters ────────────────────────────────────────────────────────────
  const admin          = m.getParameter("admin",          m.getAccount(0));
  const feeRecipient   = m.getParameter("feeRecipient",   m.getAccount(0));
  const protocolFeeBps = m.getParameter("protocolFeeBps", 10n);

  // ── AttestationVerifier proxy ─────────────────────────────────────────────
  const AttestationVerifierImpl = m.contract("AttestationVerifier");

  // ERC-1967 UUPS proxy for AttestationVerifier
  // initialize(address admin)
  const avInitData = m.encodeFunctionCall(AttestationVerifierImpl, "initialize", [admin]);

  const ERC1967Proxy = m.contract("ERC1967Proxy", [AttestationVerifierImpl, avInitData], {
    id: "AttestationVerifierProxy",
  });

  // ── PrivacyPool proxy ─────────────────────────────────────────────────────
  const PrivacyPoolImpl = m.contract("PrivacyPool");

  // initialize(address admin, address attestationVerifier, uint256 feeBps, address feeRecipient)
  const poolInitData = m.encodeFunctionCall(PrivacyPoolImpl, "initialize", [
    admin,
    ERC1967Proxy,
    protocolFeeBps,
    feeRecipient,
  ]);

  const PrivacyPoolProxy = m.contract("ERC1967Proxy", [PrivacyPoolImpl, poolInitData], {
    id: "PrivacyPoolProxy",
  });

  return {
    AttestationVerifierImpl,
    AttestationVerifierProxy: ERC1967Proxy,
    PrivacyPoolImpl,
    PrivacyPoolProxy,
  };
});

export default StealthPayModule;
