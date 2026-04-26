import { ethers } from "ethers";

// ─────────────────────────────────────────────────────────────────────────────
// SDK Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface StealthPayConfig {
  /** Ethers signer (connected to 0G Chain) */
  signer: ethers.Signer;
  /** PrivacyPool proxy contract address */
  privacyPoolAddress: string;
  /** Private spending key (bigint) — kept client-side only */
  spendingPrivkey: bigint;
  /** Timeout for waiting on shield/spend confirmation (ms). Defaults to 120_000. */
  confirmTimeoutMs?: number;
  /**
   * 0G Storage config — enables automatic hint posting on privateSend()
   * and hint scanning on sync(). Optional: if omitted hints are not posted.
   */
  zeroGStorage?: {
    /** 0G Storage indexer RPC URL. Defaults to standard testnet indexer. */
    indexerRpc?: string;
    /** 0G Chain RPC used by the storage indexer. Defaults to testnet. */
    rpc?: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Note (a shielded UTxO)
// ─────────────────────────────────────────────────────────────────────────────

export interface Note {
  commitment: bigint;
  token: string;          // ERC-20 address
  amount: bigint;         // token amount
  salt: bigint;           // random entropy used when shielding
  index: number;          // leaf index in the on-chain Merkle tree
  siblings: bigint[];     // Merkle sibling path (length 20); populated after sync
  nullifier: bigint;      // pre-computed to detect spent notes
  spent: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Operation result types
// ─────────────────────────────────────────────────────────────────────────────

export interface ShieldResult {
  txHash: string;
  commitment: bigint;
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
  receiverCommitment: bigint;
  changeCommitment: bigint | null;
}

export interface PrivateBalanceResult {
  token: string;
  balance: bigint;
  noteCount: number;
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
