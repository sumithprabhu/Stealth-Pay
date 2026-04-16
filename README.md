# StealthPay

A privacy layer for the 0G Chain — enabling fully private token transfers and DeFi interactions using Trusted Execution Environments (TEE), 0G Storage, and 0G Compute.

## What is StealthPay?

StealthPay lets anyone shield their tokens into a private pool, transact privately (transfer, swap, interact with DeFi), and unshield back to a public wallet — all on 0G Chain. No ZK circuits. No trusted setup. Privacy is enforced by hardware-isolated TEE enclaves running on 0G's decentralized compute network.

Public chain only ever sees: "a valid private action happened." Amounts, senders, and receivers stay hidden inside encrypted state stored on 0G Storage.

## How It Works

```
Shield (public → private)
  User deposits tokens into the Privacy Pool Contract on 0G Chain.
  TEE creates an encrypted private note owned by the user.
  Note is stored in 0G Storage. Funds are locked in the contract.

Private Transfer
  Sender's SDK sends an encrypted intent to a 0G Compute TEE node.
  Inside the enclave: old note is consumed, new note for receiver is created.
  New encrypted state is written back to 0G Storage.
  Only a TEE attestation + nullifier + new commitment root hits 0G Chain.
  Explorer sees: one generic "attested private action" transaction. Nothing else.

Unshield (private → public)
  Receiver's SDK sends an unshield intent to a TEE node.
  Inside the enclave: private note is burned, public release is authorized.
  TEE attestation submitted to 0G Chain.
  Privacy Pool Contract verifies attestation and transfers real tokens to the chosen public address.
  Explorer sees: "PrivacyPoolContract → AddressB : 100 USDC"
```

## Components

### `contracts/`
Smart contracts deployed on 0G Chain (EVM-compatible).
- **PrivacyPoolContract** — holds all shielded tokens, verifies TEE attestations, processes shield/unshield/private-action settlement, maintains the public commitment root and nullifier registry.

### `engine/`
The off-chain TEE execution service running inside 0G Compute nodes.
- Handles encrypted intent routing from SDK clients.
- Decrypts and processes private state inside hardware enclaves (Intel TDX).
- Reads/writes encrypted notes to 0G Storage (KV + Log layers).
- Generates cryptographic attestations for on-chain verification.
- Manages sealed key material (never leaves the enclave).

### `sdk/`
Client-side TypeScript/JavaScript SDK — the only thing app developers touch.
- `shield(token, amount)` — deposit public tokens into the private pool.
- `privateSend(to, amount)` — transfer privately between two addresses.
- `privateSwap(...)` — interact with DEX protocols without revealing trade details.
- `unshield(amount, toAddress)` — exit private pool back to a public wallet.
- `getPrivateBalance()` — query private balance via TEE (never exposed on-chain).
- Handles all encryption, TEE routing, and on-chain submission internally.

### `web/`
Landing page + documentation site.
- Product overview and architecture explanation.
- Integration guide for developers building on StealthPay.
- API reference for the SDK.
- Live demo / playground.

## Architecture Overview

```
User Wallet (SDK)
      │
      │  encrypted intent
      ▼
0G Compute TEE Node  ◄──► 0G Storage (encrypted notes, private state)
      │
      │  attestation + commitment root + nullifier
      ▼
Privacy Pool Contract (0G Chain)
      │
      │  token release (unshield only)
      ▼
Public Wallet
```

## Privacy Guarantees

| What is hidden | What is public |
|---|---|
| Token amounts | That a private action happened |
| Sender identity | Shield deposits (token + amount) |
| Receiver identity | Unshield withdrawals (token + amount + receiver) |
| Full transaction history | Nullifiers (anti-double-spend) |
| Private DeFi positions | New commitment root (hash only) |

## Tech Stack

- **0G Chain** — EVM-compatible L1, public settlement layer
- **0G Compute** — Decentralized TEE network (Intel TDX), private execution layer
- **0G Storage** — Distributed encrypted blob storage, private state layer
- **Solidity** — Smart contracts (Privacy Pool, Attestation Verifier)
- **TypeScript** — SDK and Engine service

## Status

Early development. Architecture is finalized. Implementation in progress.
