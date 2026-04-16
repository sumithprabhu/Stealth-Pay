import { ethers } from "ethers";
import { UnshieldParams, PrivateActionParams } from "../types/index";

// EIP-712 type hashes — must match exactly what AttestationVerifier.sol expects
const UNSHIELD_TYPEHASH = ethers.keccak256(
  ethers.toUtf8Bytes(
    "UnshieldPayload(address token,uint256 amount,address recipient," +
    "bytes32 nullifier,bytes32 newRoot,uint256 deadline,uint256 nonce)"
  )
);

const PRIVATE_ACTION_TYPEHASH = ethers.keccak256(
  ethers.toUtf8Bytes(
    "PrivateActionPayload(bytes32[] nullifiers,bytes32[] newCommitments," +
    "bytes32 newRoot,uint256 deadline,uint256 nonce)"
  )
);

/**
 * AttestationSigner
 *
 * The enclave's signing oracle. Signs EIP-712 structured operation payloads
 * using the enclave's ECDSA key (sealed inside the hardware TEE).
 *
 * Signatures are verified on-chain by AttestationVerifier.sol using the
 * registered enclave public key.
 *
 * Important: signatures are produced over the AttestationVerifier's EIP-712
 * domain, not the PrivacyPool's domain. The PrivacyPool passes the structHash
 * to AttestationVerifier.verifyAttestation() which applies its own domain.
 */
export class AttestationSigner {
  private readonly wallet: ethers.Wallet;

  constructor(
    enclavePrivateKey: string,
    private readonly domainSeparator: string,
  ) {
    this.wallet = new ethers.Wallet(enclavePrivateKey);
  }

  get address(): string {
    return this.wallet.address;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Signing
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Sign an unshield operation payload.
   * Returns the 65-byte ECDSA signature to submit alongside UnshieldParams.
   */
  signUnshield(params: UnshieldParams): string {
    const structHash = this._buildUnshieldStructHash(params);
    return this._signStructHash(structHash);
  }

  /**
   * Sign a private action (transfer/swap) payload.
   */
  signPrivateAction(params: PrivateActionParams): string {
    const structHash = this._buildPrivateActionStructHash(params);
    return this._signStructHash(structHash);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Struct hash builders (mirror the Solidity abi.encode logic exactly)
  // ─────────────────────────────────────────────────────────────────────────

  buildUnshieldStructHash(params: UnshieldParams): string {
    return this._buildUnshieldStructHash(params);
  }

  buildPrivateActionStructHash(params: PrivateActionParams): string {
    return this._buildPrivateActionStructHash(params);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private
  // ─────────────────────────────────────────────────────────────────────────

  private _buildUnshieldStructHash(params: UnshieldParams): string {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "uint256", "address", "bytes32", "bytes32", "uint256", "uint256"],
        [
          UNSHIELD_TYPEHASH,
          params.token,
          params.amount,
          params.recipient,
          params.nullifier,
          params.newRoot,
          params.deadline,
          params.nonce,
        ]
      )
    );
  }

  private _buildPrivateActionStructHash(params: PrivateActionParams): string {
    // Arrays are abi.encodePacked (raw concat) before hashing — matches Solidity
    const nullifiersHash     = ethers.keccak256(ethers.concat(params.nullifiers));
    const commitmentsHash    = ethers.keccak256(ethers.concat(params.newCommitments));

    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "bytes32", "bytes32", "bytes32", "uint256", "uint256"],
        [
          PRIVATE_ACTION_TYPEHASH,
          nullifiersHash,
          commitmentsHash,
          params.newRoot,
          params.deadline,
          params.nonce,
        ]
      )
    );
  }

  private _signStructHash(structHash: string): string {
    // EIP-712 digest: keccak256("\x19\x01" || domainSeparator || structHash)
    const digest = ethers.solidityPackedKeccak256(
      ["bytes2", "bytes32", "bytes32"],
      ["0x1901", this.domainSeparator, structHash]
    );

    // Raw ECDSA sign — no \x19Ethereum Signed Message prefix
    // This is what ECDSA.recover in the Solidity contract expects
    const sig = this.wallet.signingKey.sign(ethers.getBytes(digest));
    return ethers.Signature.from(sig).serialized;
  }
}
