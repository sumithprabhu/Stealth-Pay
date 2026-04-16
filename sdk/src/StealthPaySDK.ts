import { ethers } from "ethers";
import {
  StealthPayConfig,
  ShieldResult,
  UnshieldResult,
  PrivateSendResult,
  PrivateBalanceResult,
  StealthPayError,
} from "./types";
import { computeCommitment, generateSalt } from "./crypto";
import { EngineClient } from "./EngineClient";
import { ChainClient } from "./ChainClient";

export class StealthPaySDK {
  private readonly engine:  EngineClient;
  private readonly chain:   ChainClient;
  private readonly config:  StealthPayConfig;

  constructor(config: StealthPayConfig) {
    this.config = config;
    this.engine = new EngineClient(config.engineUrl, config.apiKey);
    this.chain  = new ChainClient(config.privacyPoolAddress, config.signer);
  }

  /**
   * Shield tokens: approve ERC-20, call shield() on-chain, then notify the engine
   * so it creates an encrypted note in 0G Storage.
   */
  async shield(token: string, amount: bigint): Promise<ShieldResult> {
    const owner = await this.config.signer.getAddress();
    const salt  = generateSalt();
    const commitment = computeCommitment(owner, token, amount, salt);

    await this.chain.approveIfNeeded(token, amount);

    const receipt = await this.chain.shield({ token, amount, commitment });

    // Engine waits for the Shielded event internally; just notify it now
    await this.engine.notifyShield(owner, token, amount, commitment);

    return {
      txHash:     receipt.hash,
      commitment,
      amount,
      token,
    };
  }

  /**
   * Unshield tokens: ask engine to sign the unshield, then submit on-chain.
   */
  async unshield(
    commitment: string,
    recipient:  string,
  ): Promise<UnshieldResult> {
    const engineResp = await this.engine.requestUnshield(commitment, recipient);
    const p = engineResp.onChainParams;

    const receipt = await this.chain.unshield(
      {
        token:     p.token,
        amount:    BigInt(p.amount),
        recipient: p.recipient,
        nullifier: p.nullifier,
        newRoot:   p.newRoot,
        deadline:  BigInt(p.deadline),
        nonce:     BigInt(p.nonce),
      },
      engineResp.teeSignature,
    );

    return {
      txHash:    receipt.hash,
      amount:    BigInt(p.amount),
      token:     p.token,
      recipient: p.recipient,
    };
  }

  /**
   * Private transfer: ask engine to route funds from sender note to receiver.
   * The engine creates a new note for the receiver; any change note stays with sender.
   */
  async privateSend(
    senderCommitment: string,
    receiverAddress:  string,
    token:            string,
    amount:           bigint,
  ): Promise<PrivateSendResult> {
    const engineResp = await this.engine.requestPrivateTransfer(
      senderCommitment,
      receiverAddress,
      token,
      amount,
    );
    const p = engineResp.onChainParams;

    const receipt = await this.chain.privateAction(
      {
        nullifiers:     p.nullifiers,
        newCommitments: p.newCommitments,
        newRoot:        p.newRoot,
        deadline:       BigInt(p.deadline),
        nonce:          BigInt(p.nonce),
      },
      engineResp.teeSignature,
    );

    return {
      txHash:             receipt.hash,
      amount,
      token,
      receiverCommitment: engineResp.receiverCommitment,
      changeCommitment:   engineResp.changeCommitment,
    };
  }

  /**
   * Query the engine for the caller's private balance.
   */
  async getPrivateBalance(token: string): Promise<PrivateBalanceResult> {
    const owner = await this.config.signer.getAddress();
    const resp  = await this.engine.getBalance(owner, token);
    return {
      owner:     resp.owner,
      token:     resp.token,
      balance:   BigInt(resp.balance),
      noteCount: resp.noteCount,
    };
  }
}
