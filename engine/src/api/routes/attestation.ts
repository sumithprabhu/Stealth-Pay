import fs from "fs";
import { FastifyInstance } from "fastify";
import { ethers } from "ethers";
import { AttestationSigner } from "../../core/AttestationSigner";

const TDX_DEVICE = "/dev/tdx_guest";

/**
 * GET /attestation
 *
 * Returns the enclave signing key + measurement hash so an admin can call:
 *   AttestationVerifier.whitelistMeasurement(measurementHash)
 *   AttestationVerifier.registerEnclave(signingKey, measurementHash, description)
 *
 * In TEE_MODE=tdx: reads a real TDX quote from /dev/tdx_guest and includes it.
 * In TEE_MODE=dev: returns the dev keypair address with a simulated measurement.
 *
 * This endpoint is intentionally unauthenticated — the signing key is public,
 * and the TDX quote must be verifiable by anyone (it contains no secrets).
 */
export async function attestationRoutes(
  app: FastifyInstance,
  opts: { signer: AttestationSigner; teeMode: string },
): Promise<void> {
  app.get("/attestation", {
    config: { skipAuth: true },
    handler: async (_req, reply) => {
      const signingKey = opts.signer.address;
      const teeMode    = opts.teeMode;

      if (teeMode === "tdx") {
        // ── Real TDX attestation ──────────────────────────────────────────
        if (!fs.existsSync(TDX_DEVICE)) {
          return reply.code(503).send({
            error: "TEE_MODE is 'tdx' but /dev/tdx_guest is not available",
            code:  "TDX_UNAVAILABLE",
          });
        }

        try {
          const quote           = await getTdxQuote(signingKey);
          const measurementHash = extractMeasurementFromQuote(quote);

          return reply.send({
            signingKey,
            measurementHash,
            tdxQuote:  quote.toString("hex"),
            teeMode:   "tdx",
            instructions: [
              `1. Verify the TDX quote off-chain using Intel's Attestation Service`,
              `2. npx hardhat run scripts/setup.ts --network <network>`,
              `   with ENCLAVE_SIGNING_KEY=${signingKey}`,
              `   and  ENCLAVE_MEASUREMENT_HASH=${measurementHash}`,
            ],
          });
        } catch (err) {
          app.log.error({ err }, "Failed to read TDX attestation");
          return reply.code(500).send({
            error: "Failed to generate TDX attestation quote",
            code:  "TDX_QUOTE_FAILED",
          });
        }
      } else {
        // ── Dev / simulated enclave ───────────────────────────────────────
        // Measurement is deterministically derived from the signing key so
        // it's stable across restarts with the same ENCLAVE_PRIVATE_KEY.
        const measurementHash = ethers.keccak256(
          ethers.toUtf8Bytes(`stealthpay-dev-enclave:${signingKey}`),
        );

        return reply.send({
          signingKey,
          measurementHash,
          tdxQuote: null,
          teeMode:  "dev",
          instructions: [
            `1. npx hardhat run scripts/setup.ts --network <network>`,
            `   with ENCLAVE_SIGNING_KEY=${signingKey}`,
            `   and  ENCLAVE_MEASUREMENT_HASH=${measurementHash}`,
            `NOTE: This is a simulated enclave. Do NOT use on mainnet.`,
          ],
        });
      }
    },
  });
}

// ─── TDX helpers ──────────────────────────────────────────────────────────────

/**
 * Request a TDX quote from the hardware.
 * The report data field is populated with the enclave signing key so the
 * quote cryptographically binds the key to the hardware measurement.
 */
async function getTdxQuote(signingKey: string): Promise<Buffer> {
  const { tdxQuote } = await import("../tdx/quote");
  return tdxQuote(signingKey);
}

/**
 * Extract the RTMR/measurement hash from a TDX quote.
 * The quote structure follows Intel TDX spec — RTMR[0] at offset 0x1A0.
 */
function extractMeasurementFromQuote(quote: Buffer): string {
  // TDX quote body starts at offset 0x48 (after header).
  // MRTD (measurement of TD) is 48 bytes at offset 0xB0 within the TD report.
  // We keccak256 it to get a 32-byte value matching our contract's bytes32.
  const tdReportOffset = 0x48;
  const mrtdOffset     = tdReportOffset + 0xB0;
  const mrtd           = quote.subarray(mrtdOffset, mrtdOffset + 48);
  return ethers.keccak256(mrtd);
}
