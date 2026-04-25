import { ethers } from "ethers";
import { StealthPayError } from "./types";
import { fieldToBytes32 } from "./poseidon2";

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
  "event Shielded(address indexed token, address indexed depositor, uint256 netAmount, uint256 fee, bytes32 indexed commitment, bytes32 newRoot, uint256 leafIndex)",
  "event Spent(address indexed token, bytes32[2] nullifiers, bytes32[2] newCommitments, uint256 publicAmount, address indexed recipient, bytes32 newRoot)",
];

export interface ShieldOnChainParams {
  token:      string;
  amount:     bigint;
  commitment: bigint;
  proof:      Uint8Array;
}

export interface SpendOnChainParams {
  token:          string;
  merkleRoot:     bigint;
  nullifiers:     [bigint, bigint];
  newCommitments: [bigint, bigint];
  publicAmount:   bigint;
  recipient:      string;
  proof:          Uint8Array;
}

export class ChainClient {
  readonly pool: ethers.Contract;

  constructor(
    poolAddress:            string,
    private readonly signer: ethers.Signer,
  ) {
    this.pool = new ethers.Contract(poolAddress, POOL_ABI, signer);
  }

  async approveIfNeeded(token: string, amount: bigint): Promise<void> {
    const erc20     = new ethers.Contract(token, ERC20_ABI, this.signer);
    const owner     = await this.signer.getAddress();
    const spender   = await this.pool.getAddress();
    const allowance = await erc20.allowance(owner, spender) as bigint;

    if (allowance < amount) {
      const tx = await erc20.approve(spender, amount);
      await tx.wait();
    }
  }

  async shield(params: ShieldOnChainParams): Promise<{ receipt: ethers.TransactionReceipt; leafIndex: bigint }> {
    const tx = await this.pool.shield(
      {
        token:      params.token,
        amount:     params.amount,
        commitment: fieldToBytes32(params.commitment),
      },
      ethers.hexlify(params.proof),
    );
    const receipt = await tx.wait() as ethers.TransactionReceipt;
    if (!receipt || receipt.status !== 1) {
      throw new StealthPayError("shield transaction reverted", "TX_REVERTED");
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
      } catch { /* non-matching log */ }
    }
    return { receipt, leafIndex };
  }

  async spend(params: SpendOnChainParams): Promise<ethers.TransactionReceipt> {
    const tx = await this.pool.spend(
      {
        token:          params.token,
        merkleRoot:     fieldToBytes32(params.merkleRoot),
        nullifiers:     params.nullifiers.map(fieldToBytes32),
        newCommitments: params.newCommitments.map(fieldToBytes32),
        publicAmount:   params.publicAmount,
        recipient:      params.recipient,
      },
      ethers.hexlify(params.proof),
    );
    const receipt = await tx.wait() as ethers.TransactionReceipt;
    if (!receipt || receipt.status !== 1) {
      throw new StealthPayError("spend transaction reverted", "TX_REVERTED");
    }
    return receipt;
  }

  async waitForShieldEvent(
    commitment:  bigint,
    timeoutMs:   number,
  ): Promise<{ txHash: string; amount: bigint; token: string; leafIndex: bigint }> {
    const commitmentHex = fieldToBytes32(commitment);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pool.off("Shielded", handler);
        reject(new StealthPayError("Timed out waiting for Shielded event", "SHIELD_TIMEOUT"));
      }, timeoutMs);

      const handler = (
        token:      string,
        _depositor: string,
        amount:     bigint,
        _fee:       bigint,
        eventCommitment: string,
        _newRoot:   string,
        leafIndex:  bigint,
        event:      ethers.EventLog,
      ) => {
        if (eventCommitment.toLowerCase() === commitmentHex.toLowerCase()) {
          clearTimeout(timer);
          this.pool.off("Shielded", handler);
          resolve({ txHash: event.transactionHash, amount, token, leafIndex });
        }
      };

      this.pool.on("Shielded", handler);
    });
  }

  async getRoot(): Promise<bigint> {
    const root = await this.pool.getRoot() as string;
    return BigInt(root);
  }

  async getTreeSize(): Promise<number> {
    return Number(await this.pool.getTreeSize());
  }

  async isNullifierSpent(nullifier: bigint): Promise<boolean> {
    return this.pool.isNullifierSpent(fieldToBytes32(nullifier)) as Promise<boolean>;
  }

  async isCommitmentKnown(commitment: bigint): Promise<boolean> {
    return this.pool.isCommitmentKnown(fieldToBytes32(commitment)) as Promise<boolean>;
  }
}
