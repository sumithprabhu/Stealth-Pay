import { ethers } from "ethers";
export interface ShieldOnChainParams {
    token: string;
    amount: bigint;
    commitment: bigint;
    proof: Uint8Array;
}
export interface SpendOnChainParams {
    token: string;
    merkleRoot: bigint;
    nullifiers: [bigint, bigint];
    newCommitments: [bigint, bigint];
    publicAmount: bigint;
    recipient: string;
    proof: Uint8Array;
}
export declare class ChainClient {
    private readonly signer;
    readonly pool: ethers.Contract;
    constructor(poolAddress: string, signer: ethers.Signer);
    approveIfNeeded(token: string, amount: bigint): Promise<void>;
    shield(params: ShieldOnChainParams): Promise<{
        receipt: ethers.TransactionReceipt;
        leafIndex: bigint;
    }>;
    spend(params: SpendOnChainParams): Promise<ethers.TransactionReceipt>;
    waitForShieldEvent(commitment: bigint, timeoutMs: number): Promise<{
        txHash: string;
        amount: bigint;
        token: string;
        leafIndex: bigint;
    }>;
    getRoot(): Promise<bigint>;
    getTreeSize(): Promise<number>;
    isNullifierSpent(nullifier: bigint): Promise<boolean>;
    isCommitmentKnown(commitment: bigint): Promise<boolean>;
}
//# sourceMappingURL=ChainClient.d.ts.map