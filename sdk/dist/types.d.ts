import { ethers } from "ethers";
export interface StealthPayConfig {
    /** Ethers signer (connected to 0G Chain) */
    signer: ethers.Signer;
    /** PrivacyPool proxy contract address */
    privacyPoolAddress: string;
    /** Private spending key (bigint) — kept client-side only */
    spendingPrivkey: bigint;
    /** Timeout for waiting on shield/spend confirmation (ms). Defaults to 120_000. */
    confirmTimeoutMs?: number;
}
export interface Note {
    commitment: bigint;
    token: string;
    amount: bigint;
    salt: bigint;
    index: number;
    siblings: bigint[];
    nullifier: bigint;
    spent: boolean;
}
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
export declare class StealthPayError extends Error {
    readonly code?: string | undefined;
    readonly cause?: unknown | undefined;
    constructor(message: string, code?: string | undefined, cause?: unknown | undefined);
}
//# sourceMappingURL=types.d.ts.map