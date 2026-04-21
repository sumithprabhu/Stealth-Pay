export { StealthPaySDK } from "./StealthPaySDK";
export { ChainClient } from "./ChainClient";
export { NoteManager, MerkleTree } from "./NoteManager";
export type { ManagedNote } from "./NoteManager";
export {
  generateShieldProof,
  generateSpendProof,
  deriveSpendingPubkey,
  computeCommitment,
  computeNullifier,
  addressToField,
  fieldToBytes32,
} from "./ProofGenerator";
export type {
  ShieldProofInputs,
  ShieldProofResult,
  SpendNote,
  OutputNote,
  SpendProofInputs,
  SpendProofResult,
} from "./ProofGenerator";
export { BN254_PRIME } from "./poseidon2";
export type {
  StealthPayConfig,
  Note,
  ShieldResult,
  UnshieldResult,
  PrivateSendResult,
  PrivateBalanceResult,
} from "./types";
export { StealthPayError } from "./types";
