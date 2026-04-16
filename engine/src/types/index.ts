// ─────────────────────────────────────────────────────────────────────────────
// Core domain types
// ─────────────────────────────────────────────────────────────────────────────

/** A private note — the fundamental unit of value in the privacy pool */
export interface PrivateNote {
  /** EVM address of the note owner */
  owner: string;
  /** ERC-20 token contract address */
  token: string;
  /** Amount in token's base units (no decimals) */
  amount: bigint;
  /** Random 32-byte salt for commitment uniqueness */
  salt: string;
  /** keccak256(abi.encode(owner, token, amount, salt)) — the on-chain commitment */
  commitment: string;
  /** keccak256(enclaveKey + commitment) — prevents double-spend */
  nullifier: string;
  /** Unix timestamp when this note was created */
  createdAt: number;
}

/** Serialisable form stored in 0G Storage (bigint → string) */
export interface SerializedNote {
  owner: string;
  token: string;
  amount: string;
  salt: string;
  commitment: string;
  nullifier: string;
  createdAt: number;
}

/** Encrypted blob written to 0G Storage */
export interface EncryptedNoteBlob {
  /** AES-256-GCM IV (12 bytes, hex) */
  iv: string;
  /** Encrypted note data (hex) */
  ciphertext: string;
  /** GCM auth tag (16 bytes, hex) */
  authTag: string;
  /** Schema version for forward compatibility */
  version: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Intent types — requests from SDK clients
// ─────────────────────────────────────────────────────────────────────────────

export interface ShieldIntent {
  /** Who is shielding (their public address) */
  owner: string;
  token: string;
  /** Net amount after on-chain fee deduction */
  amount: string;
  /** The commitment that was emitted in the on-chain Shielded event */
  commitment: string;
  /** The on-chain tx hash of the shield transaction (used to verify it landed) */
  shieldTxHash: string;
}

export interface UnshieldIntent {
  /** Owner proving they control the note */
  owner: string;
  /** Commitment of the note to spend */
  commitment: string;
  /** Where to send the public tokens */
  recipient: string;
  /** Amount to unshield (must match note amount) */
  amount: string;
  /** Optional: only use a portion (change note created for the rest) */
  partialAmount?: string;
}

export interface PrivateTransferIntent {
  /** Sender — must own at least one note covering the amount */
  from: string;
  /** Receiver's public address */
  to: string;
  token: string;
  amount: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine response types
// ─────────────────────────────────────────────────────────────────────────────

export interface ShieldResult {
  /** New note created for the owner */
  note: PrivateNote;
  /** Updated Merkle root after insertion */
  newRoot: string;
}

export interface UnshieldResult {
  /** EIP-712 signature from the enclave to submit on-chain */
  teeSignature: string;
  /** Params to pass to PrivacyPool.unshield() */
  onChainParams: UnshieldParams;
  /** Any change note (if partial unshield) */
  changeNote?: PrivateNote;
}

export interface PrivateTransferResult {
  /** EIP-712 signature from the enclave to submit on-chain */
  teeSignature: string;
  /** Params to pass to PrivacyPool.privateAction() */
  onChainParams: PrivateActionParams;
  /** New note for the receiver */
  receiverNote: PrivateNote;
  /** Change note for the sender (if any) */
  changeNote?: PrivateNote;
}

export interface PrivateBalanceResult {
  owner: string;
  token: string;
  /** Sum of all unspent notes */
  balance: string;
  /** Individual unspent notes */
  notes: Array<Pick<PrivateNote, 'commitment' | 'amount' | 'createdAt'>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// On-chain parameter types (mirror the Solidity structs)
// ─────────────────────────────────────────────────────────────────────────────

export interface UnshieldParams {
  token: string;
  amount: bigint;
  recipient: string;
  nullifier: string;
  newRoot: string;
  deadline: bigint;
  nonce: bigint;
}

export interface PrivateActionParams {
  nullifiers: string[];
  newCommitments: string[];
  newRoot: string;
  deadline: bigint;
  nonce: bigint;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface EngineConfig {
  enclave: {
    privateKey: string;
  };
  chain: {
    rpc: string;
    chainId: number;
    privacyPoolAddress: string;
    attestationVerifierAddress: string;
  };
  storage: {
    nodeUrl: string;
    indexerUrl: string;
  };
  crypto: {
    noteEncryptionKey: string;
  };
  server: {
    port: number;
    host: string;
    logLevel: string;
    allowedOrigins: string[];
    apiKey: string;
  };
  limits: {
    maxNullifiersPerAction: number;
    maxCommitmentsPerAction: number;
    attestationDeadlineSeconds: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Error types
// ─────────────────────────────────────────────────────────────────────────────

export enum EngineErrorCode {
  NOTE_NOT_FOUND          = "NOTE_NOT_FOUND",
  NULLIFIER_SPENT         = "NULLIFIER_SPENT",
  INSUFFICIENT_BALANCE    = "INSUFFICIENT_BALANCE",
  INVALID_COMMITMENT      = "INVALID_COMMITMENT",
  INVALID_OWNER           = "INVALID_OWNER",
  STORAGE_ERROR           = "STORAGE_ERROR",
  CHAIN_ERROR             = "CHAIN_ERROR",
  ENCRYPTION_ERROR        = "ENCRYPTION_ERROR",
  VALIDATION_ERROR        = "VALIDATION_ERROR",
  UNAUTHORIZED            = "UNAUTHORIZED",
}

export class EngineError extends Error {
  constructor(
    public readonly code: EngineErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "EngineError";
  }
}
