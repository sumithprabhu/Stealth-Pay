import { ethers } from "ethers";

// ─────────────────────────────────────────────────────────────────────────────
// SDK Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface StealthPayConfig {
  /** Ethers signer (connected to 0G Chain) */
  signer: ethers.Signer;
  /** StealthPay engine URL (e.g. "https://engine.stealthpay.xyz") */
  engineUrl: string;
  /** PrivacyPool contract address on 0G Chain */
  privacyPoolAddress: string;
  /** API key for engine authentication */
  apiKey: string;
  /**
   * Max ms to wait for shield event confirmation before giving up.
   * Defaults to 60_000 (1 min).
   */
  shieldConfirmTimeoutMs?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Operation result types
// ─────────────────────────────────────────────────────────────────────────────

export interface ShieldResult {
  txHash: string;
  commitment: string;
  amount: bigint;
  token: string;
}

export interface UnshieldResult {
  txHash: string;
  amount: bigint;
  token: string;
  recipient: string;
}

export interface PrivateSendResult {
  txHash: string;
  amount: bigint;
  token: string;
  receiverCommitment: string;
  changeCommitment: string | null;
}

export interface PrivateBalanceResult {
  owner: string;
  token: string;
  balance: bigint;
  noteCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine API response types (internal)
// ─────────────────────────────────────────────────────────────────────────────

export interface EngineUnshieldResponse {
  teeSignature: string;
  onChainParams: {
    token:     string;
    amount:    string;
    recipient: string;
    nullifier: string;
    newRoot:   string;
    deadline:  string;
    nonce:     string;
  };
}

export interface EnginePrivateTransferResponse {
  teeSignature: string;
  onChainParams: {
    nullifiers:     string[];
    newCommitments: string[];
    newRoot:        string;
    deadline:       string;
    nonce:          string;
  };
  receiverCommitment: string;
  changeCommitment:   string | null;
}

export interface EngineBalanceResponse {
  owner:     string;
  token:     string;
  balance:   string;
  noteCount: number;
}

export interface EngineShieldResponse {
  commitment: string;
  message:    string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Error
// ─────────────────────────────────────────────────────────────────────────────

export class StealthPayError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "StealthPayError";
  }
}
