import { ethers } from "ethers";
import { StealthPayConfig, ShieldResult, UnshieldResult, PrivateSendResult, PrivateBalanceResult } from "./types";
import { NoteManager, ManagedNote } from "./NoteManager";
export declare class StealthPaySDK {
    private readonly chain;
    private readonly config;
    readonly noteManager: NoteManager;
    private stopListening?;
    constructor(config: StealthPayConfig);
    /**
     * Replay historical events and start listening for new ones.
     * Call once after construction, before shielding or spending.
     */
    sync(provider: ethers.Provider, fromBlock?: number): Promise<void>;
    /** Stop live event subscription. */
    disconnect(): void;
    /**
     * Shield tokens: approve ERC-20 → generate ZK proof → call shield() on-chain.
     */
    shield(token: string, amount: bigint): Promise<ShieldResult>;
    /**
     * Unshield tokens: pick notes covering amount → generate ZK proof → spend().
     * Any change is re-shielded as a new note owned by this key.
     */
    unshield(token: string, amount: bigint, recipient: string): Promise<UnshieldResult>;
    /**
     * Private transfer to a receiver identified by their spending pubkey.
     */
    privateSend(token: string, amount: bigint, receiverPubkey: bigint): Promise<PrivateSendResult>;
    getPrivateBalance(token: string): PrivateBalanceResult;
    getNotes(token?: string): ManagedNote[];
    private _selectNotes;
}
//# sourceMappingURL=StealthPaySDK.d.ts.map