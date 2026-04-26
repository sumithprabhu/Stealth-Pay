"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.addressToField = exports.fieldToBytes32 = exports.computeNullifier = exports.computeCommitment = exports.deriveSpendingPubkey = void 0;
exports.generateShieldProof = generateShieldProof;
exports.generateSpendProof = generateSpendProof;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const poseidon2_1 = require("./poseidon2");
Object.defineProperty(exports, "deriveSpendingPubkey", { enumerable: true, get: function () { return poseidon2_1.deriveSpendingPubkey; } });
Object.defineProperty(exports, "computeCommitment", { enumerable: true, get: function () { return poseidon2_1.computeCommitment; } });
Object.defineProperty(exports, "computeNullifier", { enumerable: true, get: function () { return poseidon2_1.computeNullifier; } });
Object.defineProperty(exports, "addressToField", { enumerable: true, get: function () { return poseidon2_1.addressToField; } });
Object.defineProperty(exports, "fieldToBytes32", { enumerable: true, get: function () { return poseidon2_1.fieldToBytes32; } });
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
// ─────────────────────────────────────────────────────────────────────────────
// Paths
// ─────────────────────────────────────────────────────────────────────────────
const CIRCUITS_DIR = process.env.STEALTH_PAY_CIRCUITS_DIR
    ?? path.resolve(__dirname, "../../circuits");
const BB_BIN = process.env.STEALTH_PAY_BB_BIN
    ?? path.join(os.homedir(), ".bb", "bb");
const NARGO_BIN = process.env.STEALTH_PAY_NARGO_BIN
    ?? path.join(os.homedir(), ".nargo", "bin", "nargo");
// ─────────────────────────────────────────────────────────────────────────────
// TOML helpers
// ─────────────────────────────────────────────────────────────────────────────
function fieldStr(x) {
    return `"0x${x.toString(16)}"`;
}
function fieldArrayStr(arr) {
    return `[${arr.map(fieldStr).join(", ")}]`;
}
function boolArrayStr(arr) {
    return `[${arr.map((b) => String(b)).join(", ")}]`;
}
// ─────────────────────────────────────────────────────────────────────────────
// CLI wrappers
// ─────────────────────────────────────────────────────────────────────────────
async function nargoExecute(packageName) {
    await execFileAsync(NARGO_BIN, ["execute", "--package", packageName], {
        cwd: CIRCUITS_DIR,
    });
}
async function bbProve(circuitName, witnessPath, outDir) {
    const bytecodePath = path.join(CIRCUITS_DIR, "target", `${circuitName}.json`);
    const vkPath = path.join(CIRCUITS_DIR, "target", `${circuitName}_vk_evm`, "vk");
    await execFileAsync(BB_BIN, ["prove", "-b", bytecodePath, "-w", witnessPath, "-o", outDir, "-t", "evm", "-k", vkPath], { cwd: CIRCUITS_DIR });
}
// ─────────────────────────────────────────────────────────────────────────────
// Shield proof
// ─────────────────────────────────────────────────────────────────────────────
async function generateShieldProof(inputs) {
    const tokenField = (0, poseidon2_1.addressToField)(inputs.token);
    const spendingPubkey = (0, poseidon2_1.deriveSpendingPubkey)(inputs.spendingPrivkey);
    const commitment = (0, poseidon2_1.computeCommitment)(spendingPubkey, tokenField, inputs.amount % poseidon2_1.BN254_PRIME, inputs.salt);
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
    }
    finally {
        fs.rmSync(outDir, { recursive: true, force: true });
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Spend proof
// ─────────────────────────────────────────────────────────────────────────────
async function generateSpendProof(inputs) {
    const tokenField = (0, poseidon2_1.addressToField)(inputs.token);
    const recipientField = (0, poseidon2_1.addressToField)(inputs.recipient);
    const spendingPubkey = (0, poseidon2_1.deriveSpendingPubkey)(inputs.spendingPrivkey);
    // Build 2-slot arrays (null slots become disabled zeroes)
    const inEnabled = inputs.inputNotes.map((n) => n !== null);
    const inAmounts = inputs.inputNotes.map((n) => (n ? n.amount : 0n));
    const inSalts = inputs.inputNotes.map((n) => (n ? n.salt : 0n));
    const inIndices = inputs.inputNotes.map((n) => (n ? BigInt(n.index) : 0n));
    const inPaths = inputs.inputNotes.map((n) => n ? n.siblings.map((s) => s) : Array(20).fill(0n));
    const outEnabled = inputs.outputNotes.map((n) => n !== null);
    const outPubkeys = inputs.outputNotes.map((n) => (n ? n.receiverPubkey : 0n));
    const outAmounts = inputs.outputNotes.map((n) => (n ? n.amount : 0n));
    const outSalts = inputs.outputNotes.map((n) => (n ? n.salt : 0n));
    // Compute public outputs
    const nullifiers = [0n, 0n];
    const newCommitments = [0n, 0n];
    for (let i = 0; i < 2; i++) {
        if (inEnabled[i]) {
            const comm = (0, poseidon2_1.computeCommitment)(spendingPubkey, tokenField, inAmounts[i], inSalts[i]);
            nullifiers[i] = (0, poseidon2_1.computeNullifier)(inputs.spendingPrivkey, comm);
        }
    }
    for (let i = 0; i < 2; i++) {
        if (outEnabled[i]) {
            newCommitments[i] = (0, poseidon2_1.computeCommitment)(outPubkeys[i], tokenField, outAmounts[i], outSalts[i]);
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
    }
    finally {
        fs.rmSync(outDir, { recursive: true, force: true });
    }
}
//# sourceMappingURL=ProofGenerator.js.map