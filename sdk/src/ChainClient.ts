import { ethers } from "ethers";
import { StealthPayError } from "./types";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const POOL_ABI = [
  // shield
  "function shield(tuple(address token, uint256 amount, bytes32 commitment) params)",
  // unshield
  "function unshield(tuple(address token, uint256 amount, address recipient, bytes32 nullifier, bytes32 newRoot, uint256 deadline, uint256 nonce) params, bytes teeSignature)",
  // privateAction
  "function privateAction(tuple(bytes32[] nullifiers, bytes32[] newCommitments, bytes32 newRoot, uint256 deadline, uint256 nonce) params, bytes teeSignature)",
  // views
  "function currentRoot() view returns (bytes32)",
  "function isNullifierSpent(bytes32 nullifier) view returns (bool)",
  "function isTokenWhitelisted(address token) view returns (bool)",
  // events
  "event Shielded(address indexed token, address indexed depositor, uint256 amount, uint256 fee, bytes32 indexed commitment, bytes32 newRoot, uint256 leafIndex)",
];

export interface ShieldOnChainParams {
  token:      string;
  amount:     bigint;
  commitment: string;
}

export interface UnshieldOnChainParams {
  token:      string;
  amount:     bigint;
  recipient:  string;
  nullifier:  string;
  newRoot:    string;
  deadline:   bigint;
  nonce:      bigint;
}

export interface PrivateActionOnChainParams {
  nullifiers:     string[];
  newCommitments: string[];
  newRoot:        string;
  deadline:       bigint;
  nonce:          bigint;
}

export class ChainClient {
  private readonly pool: ethers.Contract;

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

  async shield(params: ShieldOnChainParams): Promise<ethers.TransactionReceipt> {
    const tx = await this.pool.shield({
      token:      params.token,
      amount:     params.amount,
      commitment: params.commitment,
    });
    const receipt = await tx.wait() as ethers.TransactionReceipt;
    if (!receipt || receipt.status !== 1) {
      throw new StealthPayError("shield transaction reverted", "TX_REVERTED");
    }
    return receipt;
  }

  async unshield(
    params:       UnshieldOnChainParams,
    teeSignature: string,
  ): Promise<ethers.TransactionReceipt> {
    const tx = await this.pool.unshield(
      {
        token:     params.token,
        amount:    params.amount,
        recipient: params.recipient,
        nullifier: params.nullifier,
        newRoot:   params.newRoot,
        deadline:  params.deadline,
        nonce:     params.nonce,
      },
      teeSignature,
    );
    const receipt = await tx.wait() as ethers.TransactionReceipt;
    if (!receipt || receipt.status !== 1) {
      throw new StealthPayError("unshield transaction reverted", "TX_REVERTED");
    }
    return receipt;
  }

  async privateAction(
    params:       PrivateActionOnChainParams,
    teeSignature: string,
  ): Promise<ethers.TransactionReceipt> {
    const tx = await this.pool.privateAction(
      {
        nullifiers:     params.nullifiers,
        newCommitments: params.newCommitments,
        newRoot:        params.newRoot,
        deadline:       params.deadline,
        nonce:          params.nonce,
      },
      teeSignature,
    );
    const receipt = await tx.wait() as ethers.TransactionReceipt;
    if (!receipt || receipt.status !== 1) {
      throw new StealthPayError("privateAction transaction reverted", "TX_REVERTED");
    }
    return receipt;
  }

  async waitForShieldEvent(
    commitment:  string,
    timeoutMs:   number,
  ): Promise<{ txHash: string; amount: bigint; token: string }> {
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
        _leafIndex: bigint,
        event:      ethers.EventLog,
      ) => {
        if (eventCommitment.toLowerCase() === commitment.toLowerCase()) {
          clearTimeout(timer);
          this.pool.off("Shielded", handler);
          resolve({ txHash: event.transactionHash, amount, token });
        }
      };

      this.pool.on("Shielded", handler);
    });
  }

  async currentRoot(): Promise<string> {
    return this.pool.currentRoot() as Promise<string>;
  }

  async isNullifierSpent(nullifier: string): Promise<boolean> {
    return this.pool.isNullifierSpent(nullifier) as Promise<boolean>;
  }
}
