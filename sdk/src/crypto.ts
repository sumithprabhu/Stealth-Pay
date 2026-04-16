import { ethers } from "ethers";

/** Compute commitment matching the on-chain formula: keccak256(abi.encode(owner, token, amount, salt)) */
export function computeCommitment(
  owner:  string,
  token:  string,
  amount: bigint,
  salt:   string,
): string {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint256", "bytes32"],
      [owner, token, amount, salt],
    ),
  );
}

export function generateSalt(): string {
  return ethers.hexlify(ethers.randomBytes(32));
}
