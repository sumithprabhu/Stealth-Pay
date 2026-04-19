import { ethers } from "ethers";
import { pino } from "pino";
import { EngineError, EngineErrorCode } from "../types/index";

const logger = pino({ name: "PrivacyPoolClient" });

// Minimal ABI — only the events and views the engine needs to read
const PRIVACY_POOL_ABI = [
  // Events — used to detect shield deposits
  "event Shielded(address indexed token, address indexed depositor, uint256 amount, uint256 fee, bytes32 indexed commitment, bytes32 newRoot, uint256 leafIndex)",
  "event Unshielded(address indexed token, address indexed recipient, uint256 amount, uint256 fee, bytes32 indexed nullifier, bytes32 newRoot)",
  "event PrivateActionExecuted(bytes32 indexed newRoot, bytes32[] nullifiers, bytes32[] newCommitments)",

  // Views
  "function getRoot() external view returns (bytes32)",
  "function getTreeSize() external view returns (uint256)",
  "function isNullifierSpent(bytes32 nullifier) external view returns (bool)",
  "function isCommitmentKnown(bytes32 commitment) external view returns (bool)",
  "function isTokenWhitelisted(address token) external view returns (bool)",
  "function protocolFeeBps() external view returns (uint256)",
];

const ATTESTATION_VERIFIER_ABI = [
  "function domainSeparator() external view returns (bytes32)",
  "function isActiveEnclave(address signingKey) external view returns (bool)",
];

/**
 * PrivacyPoolClient
 *
 * Read-only interface to the on-chain contracts.
 * The engine reads state from the chain for:
 *  - Verifying shield events landed before creating private notes
 *  - Checking if nullifiers/commitments are already recorded on-chain
 *  - Fetching the AttestationVerifier's domain separator for signing
 *
 * The engine never submits transactions — that's the SDK's job.
 */
export class PrivacyPoolClient {
  private readonly provider: ethers.JsonRpcProvider;
  private readonly pool: ethers.Contract;
  private readonly verifier: ethers.Contract;

  constructor(
    rpcUrl: string,
    poolAddress: string,
    verifierAddress: string,
  ) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.pool     = new ethers.Contract(poolAddress, PRIVACY_POOL_ABI, this.provider);
    this.verifier = new ethers.Contract(verifierAddress, ATTESTATION_VERIFIER_ABI, this.provider);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AttestationVerifier
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Fetch the AttestationVerifier's EIP-712 domain separator.
   * The engine caches this after the first call.
   */
  async getDomainSeparator(): Promise<string> {
    try {
      return await (this.verifier["domainSeparator"] as () => Promise<string>)();
    } catch (err) {
      throw new EngineError(EngineErrorCode.CHAIN_ERROR, "Failed to fetch domain separator", err);
    }
  }

  async isEnclaveActive(enclaveAddress: string): Promise<boolean> {
    try {
      return await (this.verifier["isActiveEnclave"] as (a: string) => Promise<boolean>)(enclaveAddress);
    } catch (err) {
      throw new EngineError(EngineErrorCode.CHAIN_ERROR, "Failed to check enclave status", err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PrivacyPool reads
  // ─────────────────────────────────────────────────────────────────────────

  async getRoot(): Promise<string> {
    return (this.pool["getRoot"] as () => Promise<string>)();
  }

  async getTreeSize(): Promise<bigint> {
    return (this.pool["getTreeSize"] as () => Promise<bigint>)();
  }

  async isNullifierSpent(nullifier: string): Promise<boolean> {
    return (this.pool["isNullifierSpent"] as (n: string) => Promise<boolean>)(nullifier);
  }

  async isCommitmentKnown(commitment: string): Promise<boolean> {
    return (this.pool["isCommitmentKnown"] as (c: string) => Promise<boolean>)(commitment);
  }

  async isTokenWhitelisted(token: string): Promise<boolean> {
    return (this.pool["isTokenWhitelisted"] as (t: string) => Promise<boolean>)(token);
  }

  async getProtocolFeeBps(): Promise<bigint> {
    return (this.pool["protocolFeeBps"] as () => Promise<bigint>)();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Event scanning
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Wait for a shield event to appear on-chain for a given commitment.
   * Polls up to maxWaitMs before timing out.
   *
   * The engine calls this before creating a private note to ensure the
   * tokens actually landed in the contract.
   */
  async waitForShieldEvent(
    commitment: string,
    maxWaitMs = 60_000,
    pollMs    = 2_000,
  ): Promise<{ amount: bigint; token: string; depositor: string }> {
    const deadline = Date.now() + maxWaitMs;
    logger.info({ commitment }, "Waiting for on-chain Shielded event");

    while (Date.now() < deadline) {
      const shieldedFilter = (this.pool.filters as Record<string, ((...args: unknown[]) => ethers.DeferredTopicFilter) | undefined>)["Shielded"];
      if (!shieldedFilter) throw new EngineError(EngineErrorCode.CHAIN_ERROR, "Shielded event filter not found");
      const filter = shieldedFilter(null, null, null, null, commitment);
      const events = await this.pool.queryFilter(filter, -100);

      if (events.length > 0) {
        const ev = events[0] as ethers.EventLog;
        logger.info({ commitment, amount: ev.args[2].toString() }, "Shield event found");
        return {
          amount:    ev.args[2] as bigint,
          token:     ev.args[0] as string,
          depositor: ev.args[1] as string,
        };
      }

      await new Promise((r) => setTimeout(r, pollMs));
    }

    throw new EngineError(
      EngineErrorCode.CHAIN_ERROR,
      `Shield event not found on-chain for commitment ${commitment} after ${maxWaitMs}ms`
    );
  }

  /**
   * Get the current block number (used for deadline calculations).
   */
  async getBlockTimestamp(): Promise<number> {
    const block = await this.provider.getBlock("latest");
    return block?.timestamp ?? Math.floor(Date.now() / 1000);
  }
}
