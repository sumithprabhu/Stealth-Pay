# StealthPay V2 — ZK Architecture

> This document replaces the TEE execution model (V1) with a Zero-Knowledge proof model.
> The engine folder is kept as-is for reference. Everything below is the new design.

---

## Table of Contents

1. [What Changes from V1](#1-what-changes-from-v1)
2. [Core Mental Model](#2-core-mental-model)
3. [Component Map](#3-component-map)
4. [Notes and Spending Keys](#4-notes-and-spending-keys)
5. [Circuits](#5-circuits)
6. [Contracts](#6-contracts)
7. [SDK](#7-sdk)
8. [Note Storage and Discovery](#8-note-storage-and-discovery)
9. [End-to-End Flows](#9-end-to-end-flows)
10. [Cryptographic Primitives](#10-cryptographic-primitives)
11. [Tooling](#11-tooling)
12. [What Stays the Same](#12-what-stays-the-same)
13. [Build Order](#13-build-order)

---

## 1. What Changes from V1

| | V1 (TEE) | V2 (ZK) |
|---|---|---|
| Trust anchor | TEE hardware (Intel TDX) | Math (ZK proof) |
| Who verifies validity | Enclave running on a server | Anyone, on-chain |
| Signature source | Enclave ECDSA key | ZK proof |
| Engine needed | Yes — signs every tx | No — proof generated in SDK |
| `AttestationVerifier.sol` | Required | Removed |
| Contract checks | `ecrecover` against enclave key | `verifier.verify(proof)` |
| Proof generation | Server-side (engine) | Client-side (SDK / browser) |
| Note secrets held by | Engine (server) | User (client) |
| Trust assumption | "Engine operator is honest" | None — pure math |
| 0G Storage | Used for encrypted notes | Still used for encrypted notes |
| 0G Chain | Settlement layer | Settlement layer (unchanged) |

**The fundamental shift:** In V1, the engine knew all secrets. In V2, users hold their own spending keys. Nobody but the user can spend their notes — not even the developer.

---

## 2. Core Mental Model

### UTXO model (same as Bitcoin, Zcash, Tornado Cash)

StealthPay V2 uses a **UTXO (Unspent Transaction Output)** model for private balances.

```
A "note" is a private token balance unit:
  - owner spending key (private)
  - token address
  - amount
  - random salt

Each note has:
  - commitment = hash(spending_pubkey, token, amount, salt)
    → goes into the public Merkle tree on-chain
    → reveals NOTHING about the contents

  - nullifier = hash(spending_privkey, commitment)
    → revealed when the note is spent
    → proves spending without revealing WHICH note was spent
```

### What the chain sees

```
Shield:
  on-chain: commitment inserted into Merkle tree
  off-chain: who owns it, how much, for what token — all hidden

Private Transfer:
  on-chain: old nullifiers revealed + new commitments inserted
  off-chain: sender, receiver, amount — all hidden

Unshield:
  on-chain: nullifier revealed + tokens released to recipient
  off-chain: which note was spent — hidden (nullifier has no visible link to commitment)
```

### Why ZK makes this work

The user generates a proof that says:
> "I know a secret note whose commitment is in the Merkle tree,
>  I computed the nullifier correctly from my spending key,
>  and the output amounts balance correctly — without revealing any of this."

The contract verifies the proof in one call. No trusted party. No server.

---

## 3. Component Map

```
Stealth-Pay/
├── circuits/               NEW — Noir ZK circuits
│   ├── src/
│   │   ├── shield.nr           Commitment computation circuit
│   │   ├── spend.nr            Unshield + transfer circuit (core)
│   │   └── lib/
│   │       ├── merkle.nr       Merkle inclusion proof
│   │       ├── note.nr         Note hash helpers
│   │       └── nullifier.nr    Nullifier derivation
│   ├── Nargo.toml
│   └── target/                 Compiled artifacts (proving key, vkey, verifier)
│
├── contracts/              UPDATED — ZK verifier replaces AttestationVerifier
│   └── contracts/
│       ├── verifiers/
│       │   ├── ShieldVerifier.sol      Auto-generated from shield circuit
│       │   └── SpendVerifier.sol       Auto-generated from spend circuit
│       ├── PrivacyPool.sol             Updated: verifies ZK proofs, no TEE
│       ├── interfaces/
│       │   └── IPrivacyPool.sol
│       └── libraries/
│           └── IncrementalMerkleTree.sol   Unchanged
│
├── sdk/                    UPDATED — proof generation added, engine calls removed
│   └── src/
│       ├── index.ts
│       ├── types.ts
│       ├── crypto.ts               Commitment + nullifier math (updated)
│       ├── SpendingKey.ts          NEW — spending key generation and management
│       ├── ProofGenerator.ts       NEW — generates ZK proofs via Noir JS
│       ├── NoteManager.ts          NEW — local note tracking + 0G Storage sync
│       ├── ChainClient.ts          Updated — submits proofs instead of TEE sigs
│       └── StealthPaySDK.ts        Updated — no engine calls
│
├── engine/                 UNCHANGED — kept for reference, TEE path
│
├── ARCHITECTURE.md         V1 reference
└── ARCHITECTURE-V2.md      This document
```

---

## 4. Notes and Spending Keys

### Spending Key

Every StealthPay user has a **spending keypair** — separate from their Ethereum wallet.

```
spending_privkey  →  random 32 bytes (held only by user, never on-chain)
spending_pubkey   →  derived from privkey (Poseidon-based or Baby Jubjub curve)
```

This key is:
- Stored locally (browser localStorage, hardware wallet, or encrypted in 0G Storage)
- Used to receive notes (share your spending_pubkey with senders)
- Used to spend notes (sign inside the ZK circuit — never revealed on-chain)

### Note Structure

```
Note {
  spending_pubkey:  Field      // who can spend this note
  token:            Field      // ERC-20 address as field element
  amount:           Field      // token amount
  salt:             Field      // random 32 bytes for uniqueness
}

commitment = Poseidon(spending_pubkey, token, amount, salt)
nullifier  = Poseidon(spending_privkey, commitment)
```

Why Poseidon hash? It's ZK-friendly — extremely cheap to compute inside a circuit compared to keccak256.

### Note Lifecycle

```
Created   → commitment in Merkle tree, note stored encrypted in 0G Storage
Pending   → waiting for on-chain confirmation
Active    → spendable (not nullified)
Spent     → nullifier revealed on-chain, note archived
```

---

## 5. Circuits

Two circuits cover all three operations.

---

### Circuit 1: ShieldCircuit

**Purpose:** Prove the commitment was computed correctly from valid inputs.

Shield is actually simple enough that it might not need a circuit at all — the contract can compute and verify the commitment directly in Solidity. We include it for uniformity and future extensibility.

```
// shield.nr
fn main(
  // Private inputs (not revealed on-chain)
  spending_pubkey : Field,
  token           : Field,
  amount          : Field,
  salt            : Field,

  // Public inputs (visible on-chain)
  commitment      : pub Field,
) {
  // Prove: commitment = Poseidon(spending_pubkey, token, amount, salt)
  let computed = std::hash::poseidon::bn254::hash_4(
    [spending_pubkey, token, amount, salt]
  );
  assert(computed == commitment);
}
```

**Public inputs on-chain:** `commitment`
**What the contract does:** inserts commitment into Merkle tree, pulls tokens from user

---

### Circuit 2: SpendCircuit

**Purpose:** Covers both unshield and private transfer. The most important circuit.

```
// spend.nr
fn main(
  // ── Private inputs ────────────────────────────────────────────────────────
  spending_privkey    : Field,           // owner's secret key
  spending_pubkey     : Field,           // derived from privkey
  token               : Field,
  input_amounts       : [Field; MAX_IN], // up to MAX_IN input notes
  input_salts         : [Field; MAX_IN],
  merkle_paths        : [[Field; DEPTH]; MAX_IN], // Merkle inclusion proofs
  merkle_indices      : [Field; MAX_IN],           // leaf positions

  // ── Public inputs ─────────────────────────────────────────────────────────
  merkle_root         : pub Field,       // current on-chain root
  nullifiers          : pub [Field; MAX_IN],
  new_commitments     : pub [Field; MAX_OUT], // outputs (transfer) or empty (unshield)
  recipient           : pub Field,       // unshield recipient (0 for transfer)
  output_amount       : pub Field,       // amount released/transferred
) {
  let mut input_total = 0;

  for i in 0..MAX_IN {
    // 1. Recompute commitment from private inputs
    let commitment = poseidon([spending_pubkey, token, input_amounts[i], input_salts[i]]);

    // 2. Verify commitment is in the Merkle tree
    let root = merkle_root_from_path(commitment, merkle_paths[i], merkle_indices[i]);
    assert(root == merkle_root);

    // 3. Verify nullifier is correctly derived from spending key
    let expected_nullifier = poseidon([spending_privkey, commitment]);
    assert(nullifiers[i] == expected_nullifier);

    // 4. Verify ownership: spending_pubkey derived from spending_privkey
    assert(derive_pubkey(spending_privkey) == spending_pubkey);

    input_total += input_amounts[i];
  }

  // 5. Conservation: inputs >= outputs (no money created from thin air)
  assert(input_total >= output_amount);

  // 6. If outputs exist (private transfer): verify new commitments are correct
  //    (receiver's spending_pubkey is embedded in new_commitments)
  //    change goes back to sender's spending_pubkey
}
```

**Public inputs on-chain:** `merkle_root`, `nullifiers[]`, `new_commitments[]`, `recipient`, `output_amount`
**What the contract does:**
- For unshield: verifies proof, marks nullifiers, transfers tokens to `recipient`
- For private transfer: verifies proof, marks nullifiers, inserts `new_commitments` into tree

**`MAX_IN` and `MAX_OUT`** are fixed at compile time (e.g. 2 inputs, 2 outputs). This is standard in ZK systems.

---

### Merkle Inclusion Proof (lib)

```
// lib/merkle.nr
fn merkle_root_from_path(
  leaf:    Field,
  path:    [Field; DEPTH],
  indices: Field,         // bitmask: 0=left, 1=right at each level
) -> Field {
  let mut current = leaf;
  for i in 0..DEPTH {
    let is_right = (indices >> i) & 1;
    current = if is_right == 1 {
      poseidon([path[i], current])
    } else {
      poseidon([current, path[i]])
    };
  }
  current
}
```

The Merkle tree depth is 20 (same as V1, supports ~1M notes). Zero value: `Poseidon(0)`.

---

## 6. Contracts

### What's removed
- `AttestationVerifier.sol` — entirely gone
- All TEE signature verification logic from `PrivacyPool.sol`

### What's added
- `SpendVerifier.sol` — auto-generated by `nargo` from the spend circuit
- `ShieldVerifier.sol` — auto-generated from the shield circuit

### PrivacyPool.sol — updated

```solidity
// Old (V1):
function unshield(UnshieldParams calldata params, bytes calldata teeSignature) {
    _attestationVerifier.verifyAttestation(structHash, teeSignature);
    ...
}

// New (V2):
function unshield(
    UnshieldPublicInputs calldata inputs,
    bytes calldata proof
) {
    require(SpendVerifier.verify(proof, inputs.toArray()), "Invalid proof");
    require(!nullifierSpent[inputs.nullifier], "Already spent");
    require(inputs.merkleRoot == currentRoot(), "Stale root");
    require(block.timestamp <= inputs.deadline, "Expired");
    ...
}
```

**New struct shapes:**

```solidity
struct ShieldInputs {
    bytes32 commitment;    // public input to ShieldVerifier
}

struct UnshieldInputs {
    bytes32   merkleRoot;
    bytes32[] nullifiers;
    address   recipient;
    uint256   amount;
    address   token;
    uint256   deadline;
}

struct PrivateTransferInputs {
    bytes32   merkleRoot;
    bytes32[] nullifiers;
    bytes32[] newCommitments;
    uint256   deadline;
}
```

### Merkle tree hash function change

V1 used `keccak256` in the Merkle tree.
V2 must use **Poseidon** — the same hash used in circuits, otherwise the Merkle root won't match.

This means the `IncrementalMerkleTree` library needs to be updated to use an on-chain Poseidon implementation.

---

## 7. SDK

### SpendingKey (new)

```typescript
class SpendingKey {
  static generate(): SpendingKey           // random new key
  static fromMnemonic(m: string): SpendingKey
  static fromPrivateKey(hex: string): SpendingKey

  get privateKey(): string                 // never send this anywhere
  get publicKey(): string                  // share this to receive notes
  get address(): string                    // deterministic "stealth address"

  deriveNullifier(commitment: string): string
}
```

### ProofGenerator (new)

```typescript
class ProofGenerator {
  constructor(circuitArtifacts: CircuitArtifacts)

  // Called during shield
  async proveShield(
    spendingPubkey: string,
    token:          string,
    amount:         bigint,
    salt:           string,
  ): Promise<{ proof: Uint8Array; commitment: string }>

  // Called during unshield or private transfer
  async proveSpend(
    spendingKey:    SpendingKey,
    inputNotes:     Note[],
    merklePaths:    MerklePath[],
    merkleRoot:     string,
    outputAmount:   bigint,
    recipient?:     string,      // unshield: public address; transfer: undefined
    outputNotes?:   Note[],      // transfer: new notes for receiver
  ): Promise<{ proof: Uint8Array; publicInputs: SpendPublicInputs }>
}
```

### NoteManager (updated)

In V2, notes are **owned by the user's spending key** and stored encrypted in 0G Storage. The SDK manages a local cache and syncs with the chain.

```typescript
class NoteManager {
  // Scan 0G Storage + on-chain events to find notes owned by this spending key
  async syncNotes(spendingKey: SpendingKey): Promise<Note[]>

  // Get spendable notes for a token
  async getUnspentNotes(token: string): Promise<Note[]>

  // Get Merkle path for a note (needed for proof generation)
  async getMerklePath(commitment: string): Promise<MerklePath>

  // Mark notes as spent after tx confirms
  async markSpent(nullifiers: string[]): Promise<void>
}
```

### StealthPaySDK (updated)

```typescript
class StealthPaySDK {
  constructor(config: {
    signer:              ethers.Signer,   // Ethereum wallet
    spendingKey:         SpendingKey,     // ZK spending key
    privacyPoolAddress:  string,
    storageNodeUrl:      string,          // 0G Storage
  })

  // Shield: lock tokens, create note
  async shield(token: string, amount: bigint): Promise<ShieldResult>

  // Private transfer: send to receiver's spending pubkey
  async privateSend(
    receiverSpendingPubkey: string,
    token:                  string,
    amount:                 bigint,
  ): Promise<PrivateSendResult>

  // Unshield: release tokens to a public address
  async unshield(
    token:     string,
    amount:    bigint,
    recipient: string,
  ): Promise<UnshieldResult>

  // Balance: sum of unspent notes
  async getPrivateBalance(token: string): Promise<bigint>
}
```

Notice: **no `engineUrl`, no `apiKey`** — there is no server in the loop for core operations.

---

## 8. Note Storage and Discovery

Without an engine, how does the receiver know they received a note?

### The problem

When User A sends to User B privately:
- The commitment goes on-chain (but reveals nothing)
- The note details (amount, token, salt) need to reach User B somehow
- User B needs these details to generate a spend proof later

### The solution — encrypted note transmission via 0G Storage

```
A sends to B:

1. A creates new note for B:
   note = { spending_pubkey: B.pubkey, token, amount, salt }
   commitment = Poseidon(B.pubkey, token, amount, salt)

2. A encrypts the note with B's spending public key (ECIES encryption)
   encrypted_note = ECIES.encrypt(B.pubkey, JSON.stringify(note))

3. A stores encrypted_note in 0G Storage at key:
   "incoming:{B.pubkey_hash}:{commitment}"

4. B scans 0G Storage for keys matching "incoming:{B.pubkey_hash}:*"
   Decrypts each one with B.privkey
   Checks if commitment is in on-chain Merkle tree
   → Found a new note!
```

This is similar to how Zcash handles note transmission (the "memo field").

### Sync flow in SDK

```
sdk.syncNotes()
  │
  ├─ 1. Fetch all keys "incoming:{myPubkeyHash}:*" from 0G Storage
  ├─ 2. Decrypt each blob with spending_privkey
  ├─ 3. Verify commitment is in on-chain Merkle tree
  ├─ 4. Check nullifier is not spent on-chain
  └─ 5. Cache valid unspent notes locally
```

---

## 9. End-to-End Flows

### Shield (public → private)

```
User A  (spending_pubkey = PK_A)
 │
 │  sdk.shield("USDC", 100e6)
 │
 │  1. SDK: salt = random()
 │  2. SDK: commitment = Poseidon(PK_A, USDC, 100e6, salt)
 │  3. SDK: proof = proveShield(PK_A, USDC, 100e6, salt)
 │     → proves: commitment was computed correctly
 │  4. SDK: ERC-20.approve(PrivacyPool, 100e6)
 │  5. SDK: PrivacyPool.shield({ commitment }, proof)
 │     → contract: verifies proof
 │     → contract: pulls 100 USDC from user
 │     → contract: inserts commitment into Merkle tree
 │     → emits: Shielded(token, amount, commitment)
 │  6. SDK: stores note encrypted in 0G Storage at
 │     "incoming:{PK_A_hash}:{commitment}"
```

### Private Transfer (private → private)

```
User A sends 50 USDC to User B (B's spending_pubkey = PK_B)

 │  sdk.privateSend(PK_B, "USDC", 50e6)
 │
 │  1. SDK: load A's unspent USDC notes (e.g. one note of 100 USDC)
 │  2. SDK: get Merkle path for A's note
 │  3. SDK: create receiver note:
 │          receiver_note = { PK_B, USDC, 50e6, random_salt }
 │          receiver_commitment = Poseidon(PK_B, USDC, 50e6, salt)
 │  4. SDK: create change note:
 │          change_note = { PK_A, USDC, 50e6, random_salt }
 │          change_commitment = Poseidon(PK_A, USDC, 50e6, salt)
 │  5. SDK: proof = proveSpend(
 │            input: [A's 100 USDC note],
 │            outputs: [receiver_commitment, change_commitment],
 │            merkle_root: current_root
 │          )
 │  6. SDK: PrivacyPool.privateTransfer(inputs, proof)
 │     → contract: verifies proof
 │     → contract: marks A's nullifier spent
 │     → contract: inserts receiver_commitment + change_commitment into tree
 │     → emits: PrivateTransfer(nullifiers[], newCommitments[])
 │     → explorer: one generic event, no amounts, no addresses
 │  7. SDK: encrypt receiver_note with PK_B → store in 0G Storage
 │     "incoming:{PK_B_hash}:{receiver_commitment}"
 │  8. SDK: store change_note encrypted for self in 0G Storage
```

### Unshield (private → public)

```
User B unshields 50 USDC to their public wallet

 │  sdk.unshield("USDC", 50e6, recipientAddress)
 │
 │  1. SDK: sync notes → finds receiver_note from step 7 above
 │  2. SDK: get Merkle path for receiver_commitment
 │  3. SDK: proof = proveSpend(
 │            input: [B's 50 USDC note],
 │            recipient: recipientAddress,
 │            output_amount: 50e6
 │            // no new_commitments — this is a full unshield
 │          )
 │  4. SDK: PrivacyPool.unshield(inputs, proof)
 │     → contract: verifies proof
 │     → contract: marks B's nullifier spent
 │     → contract: transfers 50 USDC to recipientAddress
 │     → emits: Unshielded(token, recipient, amount, nullifier)
 │     → explorer: "PrivacyPool → RecipientAddress: 50 USDC" ✓
```

---

## 10. Cryptographic Primitives

### Hash function: Poseidon

All hashes inside circuits use **Poseidon**, a ZK-friendly hash. Standard keccak256 costs ~30,000 constraints in a circuit; Poseidon costs ~240.

```
commitment = Poseidon(spending_pubkey, token, amount, salt)
nullifier  = Poseidon(spending_privkey, commitment)
merkle_node = Poseidon(left_child, right_child)
```

On-chain Poseidon: use `iden3/contracts` or `lurk-lab/solidity-verifier` Poseidon Solidity implementation.

### Curve: BN254

Noir defaults to BN254 (same as Ethereum's `ecPairing` precompile). ZK proof verification on BN254 is cheap on EVM (~200k gas for Groth16).

### Proof system: UltraHonk (Noir default)

Noir's default backend is Barretenberg with UltraHonk:
- No trusted setup required (unlike Groth16)
- Constant-size proofs (~256 bytes)
- Fast verification on-chain

### ECIES for note encryption

Notes are encrypted in 0G Storage using ECIES (Elliptic Curve Integrated Encryption Scheme) with the receiver's spending public key. Only the spending private key holder can decrypt.

### Merkle tree

- Depth: 20 (supports ~1M notes)
- Hash: Poseidon(left, right)
- Zero value: Poseidon(0, 0) at each level
- Same IncrementalMerkleTree structure as V1, hash function swapped

---

## 11. Tooling

| Tool | Purpose |
|---|---|
| **Noir** | Circuit language — Rust-like, TypeScript-friendly |
| **Barretenberg** | Noir's proving backend (UltraHonk) |
| **nargo** | Noir compiler + test runner |
| **@noir-lang/noir_js** | Proof generation in TypeScript/browser |
| **@noir-lang/backend_barretenberg** | Barretenberg WASM backend for JS |
| **iden3/circomlibjs** | Poseidon hash in JavaScript (for SDK) |
| **Poseidon.sol** | On-chain Poseidon for Merkle tree |

### Noir vs Circom

We chose **Noir** over Circom because:
- TypeScript-native: `noir_js` generates proofs directly in the SDK
- No trusted setup needed
- Cleaner syntax — looks like regular code
- Better error messages
- Active development (Aztec team)

---

## 12. What Stays the Same

| Component | Status | Notes |
|---|---|---|
| `IncrementalMerkleTree.sol` | Minor update | Swap keccak256 → Poseidon |
| 0G Chain deployment | Unchanged | Same networks, same Hardhat config |
| 0G Storage for note blobs | Unchanged | Notes still stored encrypted there |
| Deploy scripts | Minor update | Deploy verifier contracts too |
| SDK `ChainClient.ts` | Updated | Submit proofs instead of TEE sigs |
| `engine/` folder | Kept, unused | V1 reference |

---

## 13. Build Order

```
Phase 1 — Circuits (Noir)
  1. Set up Nargo project in circuits/
  2. Write lib/poseidon.nr, lib/merkle.nr, lib/note.nr
  3. Write shield.nr
  4. Write spend.nr (the main circuit)
  5. Write circuit tests
  6. Compile → generate verifier contracts

Phase 2 — Contracts
  7. Add Poseidon.sol library
  8. Update IncrementalMerkleTree to use Poseidon
  9. Replace AttestationVerifier with SpendVerifier + ShieldVerifier
  10. Update PrivacyPool: verify proofs instead of TEE signatures
  11. Update + run contract tests

Phase 3 — SDK
  12. Add SpendingKey.ts
  13. Add ProofGenerator.ts (wraps noir_js)
  14. Add NoteManager.ts (note sync + 0G Storage)
  15. Update ChainClient.ts (submit proofs)
  16. Update StealthPaySDK.ts (no engine calls)
  17. Update SDK tests

Phase 4 — Deploy & Test
  18. Deploy updated contracts to Galileo testnet
  19. Run full shield → privateSend → unshield end-to-end
```
