import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import {
  deriveSpendingPubkey,
  computeCommitment,
  computeNullifier,
  addressToField,
  fieldToBytes32,
  BN254_PRIME,
} from "./poseidon2";

const execFileAsync = promisify(execFile);

// ─────────────────────────────────────────────────────────────────────────────
// Paths
// ─────────────────────────────────────────────────────────────────────────────

const CIRCUITS_DIR = path.resolve(__dirname, "../../circuits");
const BB_BIN    = path.join(os.homedir(), ".bb", "bb");
const NARGO_BIN = path.join(os.homedir(), ".nargo", "bin", "nargo");

// ─────────────────────────────────────────────────────────────────────────────
// Input / output types
// ─────────────────────────────────────────────────────────────────────────────

export interface ShieldProofInputs {
  spendingPrivkey: bigint;
  token: string;    // ERC-20 address
  amount: bigint;   // token amount in smallest unit
  salt: bigint;     // random field element
}

export interface ShieldProofResult {
  proof: Uint8Array;
  commitment: bigint; // insert this into the Merkle tree via shield()
}

export interface SpendNote {
  amount: bigint;
  salt: bigint;
  index: number;
  siblings: bigint[]; // length 20
}

export interface OutputNote {
  receiverPubkey: bigint;
  amount: bigint;
  salt: bigint;
}

export interface SpendProofInputs {
  spendingPrivkey: bigint;
  token: string;      // ERC-20 address
  merkleRoot: bigint;
  inputNotes: (SpendNote | null)[]; // exactly 2 slots; null = disabled
  outputNotes: (OutputNote | null)[]; // exactly 2 slots; null = disabled
  publicAmount: bigint; // 0 for private transfer
  recipient: string;    // "0x0...0" for private transfer
}

export interface SpendProofResult {
  proof: Uint8Array;
  nullifiers: [bigint, bigint];
  newCommitments: [bigint, bigint];
}

// ─────────────────────────────────────────────────────────────────────────────
// TOML helpers
// ─────────────────────────────────────────────────────────────────────────────

function fieldStr(x: bigint): string {
  return `"0x${x.toString(16)}"`;
}

function fieldArrayStr(arr: bigint[]): string {
  return `[${arr.map(fieldStr).join(", ")}]`;
}

function boolArrayStr(arr: boolean[]): string {
  return `[${arr.map((b) => String(b)).join(", ")}]`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI wrappers
// ─────────────────────────────────────────────────────────────────────────────

async function nargoExecute(packageName: "shield" | "spend"): Promise<void> {
  await execFileAsync(NARGO_BIN, ["execute", "--package", packageName], {
    cwd: CIRCUITS_DIR,
  });
}

async function bbProve(
  circuitName: "shield" | "spend",
  witnessPath: string,
  outDir: string,
): Promise<void> {
  const bytecodePath = path.join(CIRCUITS_DIR, "target", `${circuitName}.json`);
  const vkPath       = path.join(CIRCUITS_DIR, "target", `${circuitName}_vk_evm`, "vk");
  await execFileAsync(
    BB_BIN,
    ["prove", "-b", bytecodePath, "-w", witnessPath, "-o", outDir, "-t", "evm", "-k", vkPath],
    { cwd: CIRCUITS_DIR },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shield proof
// ─────────────────────────────────────────────────────────────────────────────

export async function generateShieldProof(
  inputs: ShieldProofInputs,
): Promise<ShieldProofResult> {
  const tokenField = addressToField(inputs.token);
  const spendingPubkey = deriveSpendingPubkey(inputs.spendingPrivkey);
  const commitment = computeCommitment(
    spendingPubkey,
    tokenField,
    inputs.amount % BN254_PRIME,
    inputs.salt,
  );

  const toml = [
    `spending_pubkey = ${fieldStr(spendingPubkey)}`,
    `token           = ${fieldStr(tokenField)}`,
    `amount          = ${fieldStr(inputs.amount)}`,
    `salt            = ${fieldStr(inputs.salt)}`,
    `commitment      = ${fieldStr(commitment)}`,
  ].join("\n") + "\n";

  const proverToml = path.join(CIRCUITS_DIR, "shield", "Prover.toml");
  fs.writeFileSync(proverToml, toml);

  await nargoExecute("shield");

  const witnessPath = path.join(CIRCUITS_DIR, "target", "shield.gz");
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "sp-shield-"));
  try {
    await bbProve("shield", witnessPath, outDir);
    const proof = fs.readFileSync(path.join(outDir, "proof"));
    return { proof: new Uint8Array(proof), commitment };
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Spend proof
// ─────────────────────────────────────────────────────────────────────────────

export async function generateSpendProof(
  inputs: SpendProofInputs,
): Promise<SpendProofResult> {
  const tokenField = addressToField(inputs.token);
  const recipientField = addressToField(inputs.recipient);
  const spendingPubkey = deriveSpendingPubkey(inputs.spendingPrivkey);

  // Build 2-slot arrays (null slots become disabled zeroes)
  const inEnabled = inputs.inputNotes.map((n) => n !== null);
  const inAmounts = inputs.inputNotes.map((n) => (n ? n.amount : 0n));
  const inSalts = inputs.inputNotes.map((n) => (n ? n.salt : 0n));
  const inIndices = inputs.inputNotes.map((n) => (n ? BigInt(n.index) : 0n));
  const inPaths = inputs.inputNotes.map((n) =>
    n ? n.siblings.map((s) => s) : Array(20).fill(0n),
  );

  const outEnabled = inputs.outputNotes.map((n) => n !== null);
  const outPubkeys = inputs.outputNotes.map((n) => (n ? n.receiverPubkey : 0n));
  const outAmounts = inputs.outputNotes.map((n) => (n ? n.amount : 0n));
  const outSalts = inputs.outputNotes.map((n) => (n ? n.salt : 0n));

  // Compute public outputs
  const nullifiers: [bigint, bigint] = [0n, 0n];
  const newCommitments: [bigint, bigint] = [0n, 0n];

  for (let i = 0; i < 2; i++) {
    if (inEnabled[i]) {
      const comm = computeCommitment(
        spendingPubkey,
        tokenField,
        inAmounts[i],
        inSalts[i],
      );
      nullifiers[i] = computeNullifier(inputs.spendingPrivkey, comm);
    }
  }

  for (let i = 0; i < 2; i++) {
    if (outEnabled[i]) {
      newCommitments[i] = computeCommitment(
        outPubkeys[i],
        tokenField,
        outAmounts[i],
        outSalts[i],
      );
    }
  }

  const toml = [
    `spending_privkey = ${fieldStr(inputs.spendingPrivkey)}`,
    `in_amounts  = ${fieldArrayStr(inAmounts)}`,
    `in_salts    = ${fieldArrayStr(inSalts)}`,
    `in_paths    = [${inPaths.map((p) => fieldArrayStr(p)).join(", ")}]`,
    `in_indices  = ${fieldArrayStr(inIndices)}`,
    `in_enabled  = ${boolArrayStr(inEnabled)}`,
    `out_pubkeys = ${fieldArrayStr(outPubkeys)}`,
    `out_amounts = ${fieldArrayStr(outAmounts)}`,
    `out_salts   = ${fieldArrayStr(outSalts)}`,
    `out_enabled = ${boolArrayStr(outEnabled)}`,
    `token           = ${fieldStr(tokenField)}`,
    `merkle_root     = ${fieldStr(inputs.merkleRoot)}`,
    `nullifiers      = ${fieldArrayStr(nullifiers)}`,
    `new_commitments = ${fieldArrayStr(newCommitments)}`,
    `public_amount   = ${fieldStr(inputs.publicAmount)}`,
    `recipient       = ${fieldStr(recipientField)}`,
  ].join("\n") + "\n";

  const proverToml = path.join(CIRCUITS_DIR, "spend", "Prover.toml");
  fs.writeFileSync(proverToml, toml);

  await nargoExecute("spend");

  const witnessPath = path.join(CIRCUITS_DIR, "target", "spend.gz");
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "sp-spend-"));
  try {
    await bbProve("spend", witnessPath, outDir);
    const proof = fs.readFileSync(path.join(outDir, "proof"));
    return { proof: new Uint8Array(proof), nullifiers, newCommitments };
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers re-exported for callers that build SpendProofInputs
// ─────────────────────────────────────────────────────────────────────────────

export {
  deriveSpendingPubkey,
  computeCommitment,
  computeNullifier,
  fieldToBytes32,
  addressToField,
};
