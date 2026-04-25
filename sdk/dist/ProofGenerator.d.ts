import { deriveSpendingPubkey, computeCommitment, computeNullifier, addressToField, fieldToBytes32 } from "./poseidon2";
export interface ShieldProofInputs {
    spendingPrivkey: bigint;
    token: string;
    amount: bigint;
    salt: bigint;
}
export interface ShieldProofResult {
    proof: Uint8Array;
    commitment: bigint;
}
export interface SpendNote {
    amount: bigint;
    salt: bigint;
    index: number;
    siblings: bigint[];
}
export interface OutputNote {
    receiverPubkey: bigint;
    amount: bigint;
    salt: bigint;
}
export interface SpendProofInputs {
    spendingPrivkey: bigint;
    token: string;
    merkleRoot: bigint;
    inputNotes: (SpendNote | null)[];
    outputNotes: (OutputNote | null)[];
    publicAmount: bigint;
    recipient: string;
}
export interface SpendProofResult {
    proof: Uint8Array;
    nullifiers: [bigint, bigint];
    newCommitments: [bigint, bigint];
}
export declare function generateShieldProof(inputs: ShieldProofInputs): Promise<ShieldProofResult>;
export declare function generateSpendProof(inputs: SpendProofInputs): Promise<SpendProofResult>;
export { deriveSpendingPubkey, computeCommitment, computeNullifier, fieldToBytes32, addressToField, };
//# sourceMappingURL=ProofGenerator.d.ts.map