# StealthPay — Architecture

> End-to-end technical reference. Every design decision, data flow, and component boundary is documented here so any future work starts with full context.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Privacy Model](#2-privacy-model)
3. [Component Map](#3-component-map)
4. [Layer 1 — Contracts](#4-layer-1--contracts)
5. [Layer 2 — Engine (TEE)](#5-layer-2--engine-tee)
6. [Layer 3 — SDK](#6-layer-3--sdk)
7. [0G Infrastructure](#7-0g-infrastructure)
8. [End-to-End Flows](#8-end-to-end-flows)
9. [Cryptographic Primitives](#9-cryptographic-primitives)
10. [Security Model](#10-security-model)
11. [Deployment Architecture](#11-deployment-architecture)

---

## 1. System Overview

StealthPay is a privacy layer on 0G Chain. Users deposit tokens publicly, transact privately, and withdraw publicly. Privacy is enforced by a TEE (Trusted Execution Environment) running on 0G Compute — not by ZK proofs.

**The core idea in one sentence:** The contract only accepts state transitions that are signed by a hardware-attested enclave, so the enclave is the trust anchor instead of a ZK verifier.

```
┌─────────────────────────────────────────────────────────────────┐
│                        User / DApp                              │
│                      (via StealthPay SDK)                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │  HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              Engine  (Node.js inside Intel TDX)                 │
│              running on 0G Compute network                      │
│                                                                 │
│  - reads/writes encrypted notes  ◄──► 0G Storage               │
│  - verifies balances & ownership                                │
│  - signs state transitions with enclave ECDSA key               │
└───────────────────────────┬─────────────────────────────────────┘
                            │  TEE-signed tx
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│           Smart Contracts  (0G Chain / EVM)                     │
│                                                                 │
│  AttestationVerifier  — TEE key registry + signature checks     │
│  PrivacyPool          — token custody + commitment tree         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Privacy Model

### What stays private
| Data | Where it lives | Who can see it |
|------|---------------|----------------|
| Note owner | 0G Storage (encrypted) | Engine (inside TEE only) |
| Note amount | 0G Storage (encrypted) | Engine (inside TEE only) |
| Transfer sender/receiver | 0G Storage (encrypted) | Engine (inside TEE only) |
| Private balance | 0G Storage (encrypted) | Engine (inside TEE only) |

### What is public
| Data | Where it lives | Why public |
|------|---------------|-----------|
| Shield deposit (token, amount, depositor) | 0G Chain event | ERC-20 transfer is inherently public |
| Unshield withdrawal (token, amount, receiver) | 0G Chain event | Token transfer to public address |
| Nullifiers | 0G Chain state | Anti-double-spend, no meaning without private context |
| Commitment root (Merkle root hash) | 0G Chain state | Integrity anchor, reveals nothing about contents |
| "A private action happened" | 0G Chain event | Existence of action, no details |

### Privacy boundary
The privacy boundary is the TEE enclave. Data enters encrypted over HTTPS, is decrypted only inside the hardware-isolated enclave, processed, re-encrypted, and stored. The enclave private key never leaves the chip.

---

## 3. Component Map

```
Stealth-Pay/
├── contracts/          Layer 1 — on-chain settlement
│   ├── contracts/
│   │   ├── AttestationVerifier.sol   TEE key registry (UUPS)
│   │   ├── PrivacyPool.sol           Token custody + Merkle tree (UUPS)
│   │   ├── interfaces/               IAttestationVerifier, IPrivacyPool
│   │   └── libraries/
│   │       └── IncrementalMerkleTree.sol   O(depth) append-only tree
│   ├── scripts/
│   │   ├── deploy.ts                 Deploy proxies, save addresses
│   │   ├── setup.ts                  Register enclave, whitelist tokens
│   │   ├── deployAndSetup.ts         Combined for local dev
│   │   ├── upgrade.ts                UUPS proxy upgrades
│   │   └── verify.ts                 Explorer verification
│   └── deployments/                  Per-network address records (JSON)
│
├── engine/             Layer 2 — TEE execution service
│   └── src/
│       ├── index.ts                  Startup: fetch domain sep, init services
│       ├── core/
│       │   ├── CryptoEngine.ts       Commitment/nullifier math, note encryption
│       │   ├── AttestationSigner.ts  EIP-712 signing with enclave key
│       │   └── NoteManager.ts        Note lifecycle, coin selection, balance
│       ├── chain/
│       │   └── PrivacyPoolClient.ts  Read-only chain queries
│       ├── storage/
│       │   └── ZeroGStorage.ts       IZeroGStorage + ZeroGStorageAdapter + LocalStorageAdapter
│       ├── api/
│       │   ├── server.ts             Fastify setup, plugin registration
│       │   ├── middleware/auth.ts    API key check
│       │   └── routes/
│       │       ├── shield.ts         POST /shield
│       │       ├── unshield.ts       POST /unshield
│       │       ├── privateAction.ts  POST /private-transfer, POST /balance
│       │       └── health.ts         GET /health
│       └── types/index.ts            All shared types + EngineError
│
└── sdk/                Layer 3 — developer-facing client library
    └── src/
        ├── index.ts                  Barrel export
        ├── types.ts                  Public types + StealthPayError
        ├── crypto.ts                 computeCommitment, generateSalt
        ├── EngineClient.ts           HTTP client for engine API
        ├── ChainClient.ts            ERC-20 approve + on-chain submissions
        └── StealthPaySDK.ts          Main class: shield/unshield/privateSend/getPrivateBalance
```

---

## 4. Layer 1 — Contracts

### AttestationVerifier

UUPS upgradeable. Standalone TEE key registry. Does not know about tokens.

**Roles:**
- `DEFAULT_ADMIN_ROLE` — can grant/revoke all roles
- `ENCLAVE_MANAGER_ROLE` — can whitelist measurements, register/deactivate enclave keys
- `UPGRADER_ROLE` — can upgrade the proxy implementation

**Flow to register a TEE:**
```
1. admin: whitelistMeasurement(keccak256(engineBinary))
2. admin: registerEnclave(enclavePublicKey, measurementHash, description)
3. contract: stores EnclaveInfo { signingKey, measurementHash, registeredAt, active }
```

**Signature verification:**
```
verifyAttestation(structHash, signature)
  → digest = keccak256("\x19\x01" || AV_DOMAIN_SEPARATOR || structHash)
  → signer = ecrecover(digest, signature)
  → require(_enclaves[signer].active)
```

Note: AttestationVerifier has its own EIP-712 domain. PrivacyPool passes the `structHash` to `verifyAttestation()` which applies the AV domain. The Pool's own domain is NOT used for TEE signature verification.

### PrivacyPool

UUPS upgradeable. Holds all shielded tokens. Maintains a depth-20 Incremental Merkle Tree of commitments.

**Roles:**
- `DEFAULT_ADMIN_ROLE` — full admin
- `PAUSER_ROLE` — can pause/unpause
- `TOKEN_MANAGER_ROLE` — can whitelist/delist tokens
- `FEE_MANAGER_ROLE` — can change fee settings
- `UPGRADER_ROLE` — can upgrade proxy

**Three operations:**

| Operation | Who calls | TEE sig needed | Tokens move |
|-----------|-----------|----------------|-------------|
| `shield(token, amount, commitment)` | User wallet | No | User → Contract |
| `unshield(params, teeSignature)` | User wallet | Yes | Contract → Recipient |
| `privateAction(params, teeSignature)` | User wallet | Yes | No (only state changes) |

**Commitment formula (must match engine + SDK):**
```
commitment = keccak256(abi.encode(owner, token, amount, salt))
```

**Nullifier formula:**
```
nullifier = keccak256(abi.encode(commitment, enclaveAddress))
```

**PrivateAction struct hash (critical — arrays packed, not ABI-encoded):**
```
structHash = keccak256(abi.encode(
  PRIVATE_ACTION_TYPEHASH,
  keccak256(abi.encodePacked(nullifiers)),   // raw concat, NOT abi.encode
  keccak256(abi.encodePacked(newCommitments)),
  newRoot, deadline, nonce
))
```

**IncrementalMerkleTree:**
- Depth 20 → max ~1 million commitments
- O(depth) storage: stores only `filledSubtrees[depth]`
- Append-only: commitments are never removed, nullifiers track spending
- Zero hash: `keccak256(abi.encodePacked(bytes32(0)))`

---

## 5. Layer 2 — Engine (TEE)

The engine is a Node.js/Fastify HTTP service. In production it runs inside Intel TDX on 0G Compute. In dev/test it runs as a normal process with a simulated enclave key.

### Startup sequence

```
1. Load config from env vars
2. Init CryptoEngine (AES-256-GCM note encryption)
3. Connect PrivacyPoolClient (read-only chain queries)
4. Fetch AttestationVerifier domain separator from chain
   → stored once, used for all EIP-712 signing
5. Init AttestationSigner with (enclavePrivateKey, domainSeparator)
6. Warn if enclaveAddress not registered on-chain
7. Init storage adapter (0G Storage in prod, in-memory in test)
8. Init NoteManager
9. Start Fastify HTTP server
```

### CryptoEngine

All cryptographic operations. Stateless.

```typescript
computeCommitment(owner, token, amount, salt)
  → keccak256(abi.encode(["address","address","uint256","bytes32"], [...]))

computeNullifier(commitment, enclaveAddress)
  → keccak256(abi.encode(["bytes32","address"], [...]))

encryptNote(note) → EncryptedNoteBlob { iv, ciphertext, authTag, version }
  → AES-256-GCM, random IV per note, auth tag for tamper detection

decryptNote(blob) → PrivateNote
  → verifies schema version, throws on wrong version or tampered ciphertext

verifyNoteIntegrity(note, enclaveAddress)
  → recomputes commitment + nullifier from plaintext, compares
```

### AttestationSigner

Builds EIP-712 struct hashes and signs them with the enclave ECDSA key.

```typescript
// Signing pattern (raw EIP-712, no ETH prefix)
digest = keccak256("\x19\x01" || domainSeparator || structHash)
signature = wallet.signingKey.sign(bytes(digest))
return Signature.from(sig).serialized

// Array hashing (matches abi.encodePacked = raw concat)
nullifiersHash = keccak256(ethers.concat(nullifiers))
```

### NoteManager

Manages the lifecycle of private notes. All note I/O goes through 0G Storage.

```
createNote(owner, token, amount, onChainCommitment)
  → builds PrivateNote (generates salt, computes commitment/nullifier)
  → encrypts with CryptoEngine
  → stores blob at key "note:{commitment}" in 0G Storage
  → adds commitment to owner index at "owner:{addr}:{token}"

loadNote(commitment)
  → fetches blob from "note:{commitment}"
  → decrypts
  → verifyNoteIntegrity()

spendNote(note)
  → checks "spent:{nullifier}" → throws NULLIFIER_SPENT if already spent
  → sets "spent:{nullifier}" = true

getBalance(owner, token)
  → loads all commitments from "owner:{addr}:{token}"
  → loads each note, filters spent, sums amounts

selectNotes(owner, token, amount)
  → largest-first greedy coin selection
  → throws INSUFFICIENT_BALANCE if total < amount
```

### 0G Storage Key Schema

```
note:{commitment}           → EncryptedNoteBlob (JSON)
owner:{address}:{token}     → string[] of commitment hashes
spent:{nullifier}           → "1"
```

### API Endpoints

All routes require `x-api-key` header.

```
POST /shield
  body: { owner, token, amount, commitment, shieldTxHash }
  → waits for on-chain Shielded event to confirm
  → verifies amount matches on-chain
  → creates encrypted note in 0G Storage
  → returns: { commitment, message }

POST /unshield
  body: { owner, commitment, recipient, amount }
  → loads note, checks ownership + amount
  → checks nullifier not spent (engine + on-chain)
  → marks note spent BEFORE signing (conservative)
  → signs UnshieldParams
  → returns: { teeSignature, onChainParams }

POST /private-transfer
  body: { from, to, token, amount }
  → coin selection on sender's notes
  → creates receiver note + optional change note
  → spends selected notes
  → stores new notes in 0G Storage
  → signs PrivateActionParams
  → returns: { teeSignature, onChainParams, receiverCommitment, changeCommitment }

POST /balance
  body: { owner, token }
  → returns: { owner, token, balance, noteCount }

GET /health
  → returns: { status: "ok" }
```

---

## 6. Layer 3 — SDK

The only layer app developers touch. Wraps engine + chain into four simple methods.

```typescript
const sdk = new StealthPaySDK({
  signer,                   // ethers.Signer connected to 0G Chain
  engineUrl,                // https://engine.stealthpay.xyz
  privacyPoolAddress,       // from deployments/
  apiKey,                   // engine API key
})

await sdk.shield(token, amount)
// 1. computeCommitment(owner, token, amount, salt)
// 2. ERC-20 approve if needed
// 3. PrivacyPool.shield(token, amount, commitment) on-chain
// 4. POST /shield to engine (engine creates encrypted note)

await sdk.privateSend(senderCommitment, receiverAddress, token, amount)
// 1. POST /private-transfer → engine returns teeSignature + params
// 2. PrivacyPool.privateAction(params, teeSignature) on-chain

await sdk.unshield(commitment, recipient)
// 1. POST /unshield → engine returns teeSignature + params
// 2. PrivacyPool.unshield(params, teeSignature) on-chain

await sdk.getPrivateBalance(token)
// 1. POST /balance → returns { balance, noteCount }
```

### ChainClient (internal)
Handles all on-chain interactions: ERC-20 approve, shield/unshield/privateAction submissions, Shielded event listening.

### EngineClient (internal)
HTTP client with typed request/response shapes for all engine endpoints.

---

## 7. 0G Infrastructure

### 0G Chain
EVM-compatible L1. Contracts deploy here. All public settlement (shield/unshield events, nullifier registry, commitment root) lives here.

- Testnet: Galileo (chainId 16600), RPC: `https://evmrpc-testnet.0g.ai`
- Mainnet: Aristotle, RPC: `https://evmrpc.0g.ai`

### 0G Storage
Distributed encrypted blob storage. The engine's private state layer. Notes are stored here as AES-256-GCM encrypted blobs — not accessible to anyone except the running TEE.

- SDK: `@0glabs/0g-ts-sdk`
- Abstracted behind `IZeroGStorage` interface
- `LocalStorageAdapter` (in-memory Maps) used in dev/test

### 0G Compute — TEE Integration

The engine runs on 0G Compute's Intel TDX infrastructure. Integration approach:

**We use 0G as TEE hardware, not as their AI inference broker.**

```
0G Compute TDX Node
┌──────────────────────────────────────────────┐
│  StealthPay Engine (Node.js container)        │
│                                              │
│  On startup:                                 │
│    1. Generate ECDSA keypair inside TDX      │
│    2. Request TDX attestation quote          │
│       binding the public key                 │
│    3. Expose GET /attestation                │
│                                              │
│  GET /attestation returns:                   │
│    { signingKey, tdxQuote, measurementHash } │
└──────────────────────────────────────────────┘
         │
         │  Admin downloads attestation report
         │  Verifies quote off-chain (Intel/0G verification)
         │  Extracts: signingKey + measurementHash
         ▼
  AttestationVerifier.whitelistMeasurement(measurementHash)
  AttestationVerifier.registerEnclave(signingKey, measurementHash, "...")
         │
         ▼
  Engine is now trusted. Contract accepts its signatures.
```

**For testnet:** Use a regular ECDSA wallet as a simulated enclave. Same flow, no real TDX hardware required.

**For mainnet:** Deploy engine container on a 0G Compute TDX node. Engine reads `/dev/tdx_guest` for attestation. The `GET /attestation` endpoint returns a real TDX quote.

---

## 8. End-to-End Flows

### Shield (public → private)

```
User
 │  sdk.shield("USDC", 100_000000n)
 │
 │  1. SDK computes: commitment = keccak256(abi.encode(owner, token, 100e6, salt))
 │  2. SDK: ERC-20.approve(PrivacyPool, 100e6)
 │  3. SDK: PrivacyPool.shield({ token, amount, commitment })
 │     → Contract: transfers tokens in, inserts commitment into Merkle tree
 │     → emits Shielded(token, depositor, amount, fee, commitment, newRoot, leafIndex)
 │  4. SDK: POST /shield { owner, token, amount, commitment, shieldTxHash }
 │
 ▼
Engine
 │  5. Waits for Shielded event on-chain (confirms funds landed)
 │  6. Verifies amount matches
 │  7. buildNote(owner, token, amount, enclaveAddress)
 │     → generates salt → computes commitment + nullifier
 │  8. encryptNote(note) → AES-256-GCM blob
 │  9. stores blob at "note:{commitment}" in 0G Storage
 │  10. returns { commitment, message: "Note created" }
```

### Private Transfer (private → private)

```
User A
 │  sdk.privateSend(senderCommitment, UserB, "USDC", 50_000000n)
 │
 │  1. SDK: POST /private-transfer { from: A, to: B, token, amount }
 │
 ▼
Engine (inside TDX)
 │  2. selectNotes(A, USDC, 50e6) → picks notes totalling ≥ 50e6 (largest-first)
 │  3. For each selected note: check not spent on-chain
 │  4. buildNote(B, USDC, 50e6, enclaveAddr) → receiver note
 │  5. if overpaid: buildNote(A, USDC, change, enclaveAddr) → change note
 │  6. spendNote(each selected note) → mark nullifiers in 0G Storage
 │  7. createNote(B ...) + createNote(A change ...) → store in 0G Storage
 │  8. Build PrivateActionParams:
 │     { nullifiers, newCommitments, newRoot, deadline, nonce }
 │  9. Sign: teeSignature = signPrivateAction(params)
 │  10. return { teeSignature, onChainParams, receiverCommitment, changeCommitment }
 │
 ▼
User A
 │  11. SDK: PrivacyPool.privateAction(params, teeSignature)
 │      → Contract: verifies TEE signature via AttestationVerifier
 │      → marks nullifiers spent on-chain
 │      → inserts new commitments into Merkle tree
 │      → emits PrivateActionExecuted(newRoot, nullifiers, newCommitments)
 │      → Explorer sees: one generic event, no amounts, no addresses
```

### Unshield (private → public)

```
User B
 │  sdk.unshield(commitment, recipientAddress)
 │
 │  1. SDK: POST /unshield { owner: B, commitment, recipient, amount }
 │
 ▼
Engine (inside TDX)
 │  2. loadNote(commitment) → decrypt + verify integrity
 │  3. Check ownership (note.owner == B)
 │  4. Check amount ≤ note.amount
 │  5. Check nullifier not spent (engine + on-chain)
 │  6. spendNote(note) ← mark spent BEFORE signing
 │  7. Build UnshieldParams:
 │     { token, amount, recipient, nullifier, newRoot, deadline, nonce }
 │  8. Sign: teeSignature = signUnshield(params)
 │  9. return { teeSignature, onChainParams }
 │
 ▼
User B
 │  10. SDK: PrivacyPool.unshield(params, teeSignature)
 │      → Contract: verifies TEE signature
 │      → marks nullifier spent on-chain
 │      → transfers tokens to recipient
 │      → emits Unshielded(token, recipient, amount, fee, nullifier, newRoot)
 │      → Explorer sees: "PrivacyPool → RecipientAddress: 50 USDC"
```

---

## 9. Cryptographic Primitives

### Note

A note is the private representation of a user's token balance.

```typescript
PrivateNote {
  owner:      address     // who owns this note
  token:      address     // ERC-20 token address
  amount:     bigint      // token amount (in wei/smallest unit)
  salt:       bytes32     // random 32-byte entropy
  commitment: bytes32     // keccak256(abi.encode(owner, token, amount, salt))
  nullifier:  bytes32     // keccak256(abi.encode(commitment, enclaveAddress))
  createdAt:  number      // unix timestamp
}
```

### Commitment

Binds owner + token + amount + salt into a single hash. Stored in the public Merkle tree. Does not reveal any of the inputs.

```
commitment = keccak256(abi.encode(owner, token, amount, salt))
```

### Nullifier

Proves a note was spent without revealing which note. Derived deterministically from the commitment and the enclave address — so only the enclave that created the note can produce its nullifier.

```
nullifier = keccak256(abi.encode(commitment, enclaveAddress))
```

### Note Encryption

Notes are encrypted with AES-256-GCM before storage in 0G Storage.

```
EncryptedNoteBlob {
  iv:         hex string   // 12-byte random IV (fresh per encryption)
  ciphertext: hex string   // encrypted note JSON
  authTag:    hex string   // 16-byte GCM auth tag (tamper detection)
  version:    number       // schema version (currently 1)
}
```

Encryption key (`NOTE_ENCRYPTION_KEY`) is a 32-byte hex string stored as an env var. In a real TEE deployment this key is sealed to the enclave measurement — it cannot be read even if the server is compromised.

### EIP-712 Signing (TEE Attestations)

All TEE signatures use raw EIP-712 (no ETH message prefix).

```
digest = keccak256("\x19\x01" || AV_DOMAIN_SEPARATOR || structHash)
signature = enclaveKey.sign(digest)   // raw ECDSA, NOT signMessage()
```

The domain separator belongs to `AttestationVerifier`, not `PrivacyPool`. This is critical — the engine fetches it from `AttestationVerifier.domainSeparator()` at startup.

---

## 10. Security Model

### Trust assumptions

| Component | Trust level | Why |
|-----------|-------------|-----|
| 0G Chain | Trustless | Public L1, anyone can verify |
| AttestationVerifier contract | Trustless | Open source, immutable logic |
| PrivacyPool contract | Trustless | Open source, immutable logic |
| TEE hardware (Intel TDX) | Hardware trust | CPU vendor guarantee |
| Engine code | Verified by measurement | Measurement hash is whitelisted on-chain |
| 0G Storage | Storage availability trust | Data is encrypted before storage |
| Engine operator | Minimal trust | Cannot read notes, cannot forge signatures |

### Double-spend protection

Two independent layers:
1. **Engine-side:** NoteManager marks nullifier spent in 0G Storage before signing
2. **On-chain:** PrivacyPool.unshield/privateAction check `isNullifierSpent` mapping

If the engine state diverges from chain state, the on-chain check is the final arbiter.

### Upgrade security

Both contracts are UUPS proxies. Upgrades require `UPGRADER_ROLE`. The `_authorizeUpgrade` guard ensures only the role holder can upgrade. Storage gaps (`uint256[44/46] private __gap`) prevent storage collisions across upgrades.

### What the contract enforces

- Only registered, active enclave keys can produce valid signatures
- Nullifiers can never be reused (double-spend impossible)
- Token must be whitelisted
- Deadline must not have passed
- Nonce prevents signature replay

### What requires off-chain trust

- The engine must create notes correctly (correct owner, correct amount)
- The engine must not leak note contents outside the TEE
- 0G Storage must be available for the engine to read/write notes

---

## 11. Deployment Architecture

### Contract deployment (per network)

```bash
# 1. Deploy UUPS proxies
npm run deploy:testnet      # → deployments/zeroGTestnet.json

# 2. Register TEE + whitelist tokens
npm run setup:testnet

# 3. Verify on explorer
npm run verify:testnet
```

Address records saved to `contracts/deployments/<network>.json`:
```json
{
  "network": "zeroGTestnet",
  "chainId": 16600,
  "deployedAt": "...",
  "deployer": "0x...",
  "AttestationVerifierImpl": "0x...",
  "AttestationVerifierProxy": "0x...",
  "PrivacyPoolImpl": "0x...",
  "PrivacyPoolProxy": "0x..."
}
```

### Engine deployment

**Testnet (simulated TEE):**
```
1. Generate a dev keypair → ENCLAVE_PRIVATE_KEY + ENCLAVE_SIGNING_KEY
2. Register that key on-chain via setup.ts
3. Run engine: docker-compose up (or npx ts-node src/index.ts)
```

**Mainnet (real TDX on 0G Compute):**
```
1. Provision Intel TDX VM on 0G Compute network
2. Deploy engine container
3. Engine auto-generates keypair inside TDX on first boot
4. Admin: GET /attestation → download TDX quote + signingKey
5. Admin: verify quote off-chain (Intel verification service)
6. Admin: registerEnclave(signingKey, measurementHash) on-chain
7. Engine is now trusted
```

### Required environment variables

**`contracts/.env`**
```
DEPLOYER_PRIVATE_KEY          wallet deploying + managing contracts
INITIAL_ADMIN                 address receiving all admin roles
FEE_RECIPIENT                 protocol fee destination
PROTOCOL_FEE_BPS              fee in basis points (default: 10)
ENCLAVE_SIGNING_KEY           enclave public key (for setup.ts)
ENCLAVE_MEASUREMENT_HASH      keccak256 of engine binary
WHITELIST_TOKENS              comma-separated ERC-20 addresses
ZERO_G_EXPLORER_API_KEY       for contract verification
```

**`engine/.env`**
```
ENCLAVE_PRIVATE_KEY           enclave ECDSA private key (stays in TEE)
NOTE_ENCRYPTION_KEY           32-byte AES key for note encryption
PRIVACY_POOL_ADDRESS          from contracts deployment record
ATTESTATION_VERIFIER_ADDRESS  from contracts deployment record
API_KEY                       secret for SDK x-api-key header
ZERO_G_CHAIN_RPC              0G Chain RPC URL
ZERO_G_STORAGE_NODE           0G Storage node URL
ZERO_G_INDEXER_NODE           0G Storage indexer URL
PORT                          HTTP port (default: 3000)
```
