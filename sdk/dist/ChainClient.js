"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChainClient = void 0;
const ethers_1 = require("ethers");
const types_1 = require("./types");
const poseidon2_1 = require("./poseidon2");
const ERC20_ABI = [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
];
const POOL_ABI = [
    "function shield(tuple(address token, uint256 amount, bytes32 commitment) params, bytes proof) external",
    "function spend(tuple(address token, bytes32 merkleRoot, bytes32[2] nullifiers, bytes32[2] newCommitments, uint256 publicAmount, address recipient) params, bytes proof) external",
    "function getRoot() view returns (bytes32)",
    "function getTreeSize() view returns (uint256)",
    "function isNullifierSpent(bytes32 nullifier) view returns (bool)",
    "function isCommitmentKnown(bytes32 commitment) view returns (bool)",
    "function isTokenWhitelisted(address token) view returns (bool)",
    "function recordHint(bytes32 receiverPubkeyHash, bytes32 storageRoot) external",
    "event Shielded(address indexed token, address indexed depositor, uint256 netAmount, uint256 fee, bytes32 indexed commitment, bytes32 newRoot, uint256 leafIndex)",
    "event Spent(address indexed token, bytes32[2] nullifiers, bytes32[2] newCommitments, uint256 publicAmount, address indexed recipient, bytes32 newRoot)",
    "event NoteHint(bytes32 indexed receiverPubkeyHash, bytes32 storageRoot)",
];
class ChainClient {
    constructor(poolAddress, signer) {
        this.signer = signer;
        this.pool = new ethers_1.ethers.Contract(poolAddress, POOL_ABI, signer);
    }
    async approveIfNeeded(token, amount) {
        const erc20 = new ethers_1.ethers.Contract(token, ERC20_ABI, this.signer);
        const owner = await this.signer.getAddress();
        const spender = await this.pool.getAddress();
        const allowance = await erc20.allowance(owner, spender);
        if (allowance < amount) {
            const tx = await erc20.approve(spender, amount);
            await tx.wait();
        }
    }
    async shield(params) {
        const tx = await this.pool.shield({
            token: params.token,
            amount: params.amount,
            commitment: (0, poseidon2_1.fieldToBytes32)(params.commitment),
        }, ethers_1.ethers.hexlify(params.proof));
        const receipt = await tx.wait();
        if (!receipt || receipt.status !== 1) {
            throw new types_1.StealthPayError("shield transaction reverted", "TX_REVERTED");
        }
        // Parse leafIndex from the Shielded event in the receipt logs
        const iface = this.pool.interface;
        let leafIndex = 0n;
        for (const log of receipt.logs) {
            try {
                const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
                if (parsed?.name === "Shielded") {
                    leafIndex = BigInt(parsed.args.leafIndex);
                    break;
                }
            }
            catch { /* non-matching log */ }
        }
        return { receipt, leafIndex };
    }
    async spend(params) {
        const tx = await this.pool.spend({
            token: params.token,
            merkleRoot: (0, poseidon2_1.fieldToBytes32)(params.merkleRoot),
            nullifiers: params.nullifiers.map(poseidon2_1.fieldToBytes32),
            newCommitments: params.newCommitments.map(poseidon2_1.fieldToBytes32),
            publicAmount: params.publicAmount,
            recipient: params.recipient,
        }, ethers_1.ethers.hexlify(params.proof));
        const receipt = await tx.wait();
        if (!receipt || receipt.status !== 1) {
            throw new types_1.StealthPayError("spend transaction reverted", "TX_REVERTED");
        }
        return receipt;
    }
    async waitForShieldEvent(commitment, timeoutMs) {
        const commitmentHex = (0, poseidon2_1.fieldToBytes32)(commitment);
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pool.off("Shielded", handler);
                reject(new types_1.StealthPayError("Timed out waiting for Shielded event", "SHIELD_TIMEOUT"));
            }, timeoutMs);
            const handler = (token, _depositor, amount, _fee, eventCommitment, _newRoot, leafIndex, event) => {
                if (eventCommitment.toLowerCase() === commitmentHex.toLowerCase()) {
                    clearTimeout(timer);
                    this.pool.off("Shielded", handler);
                    resolve({ txHash: event.transactionHash, amount, token, leafIndex });
                }
            };
            this.pool.on("Shielded", handler);
        });
    }
    async getRoot() {
        const root = await this.pool.getRoot();
        return BigInt(root);
    }
    async getTreeSize() {
        return Number(await this.pool.getTreeSize());
    }
    async isNullifierSpent(nullifier) {
        return this.pool.isNullifierSpent((0, poseidon2_1.fieldToBytes32)(nullifier));
    }
    async isCommitmentKnown(commitment) {
        return this.pool.isCommitmentKnown((0, poseidon2_1.fieldToBytes32)(commitment));
    }
}
exports.ChainClient = ChainClient;
//# sourceMappingURL=ChainClient.js.map