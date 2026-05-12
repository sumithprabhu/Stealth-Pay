# sdk

TypeScript SDK for StealthPay. All ZK proof generation happens client-side — no server in the loop.

## Install

```bash
npm install @stealthpay/sdk
```

## Usage

```typescript
import { StealthPaySDK, deriveSpendingPubkey } from "@stealthpay/sdk";
import { ethers } from "ethers";

const sdk = new StealthPaySDK({
  signer:             wallet,           // ethers.Signer
  spendingPrivkey:    "0xabc...",       // user's ZK spending key (never leaves client)
  privacyPoolAddress: "0x154d755...",
  storageNodeUrl:     "https://...",    // 0G Storage node
  rpcUrl:             "https://...",    // 0G Chain RPC
});

await sdk.shield(tokenAddress, amount);
await sdk.privateSend(receiverSpendingPubkey, tokenAddress, amount);
await sdk.unshield(tokenAddress, amount, recipientAddress);
const balance = await sdk.getPrivateBalance(tokenAddress);
```

## Structure

```
sdk/src/
├── StealthPaySDK.ts    — main SDK class (shield, privateSend, unshield, getPrivateBalance)
├── ProofGenerator.ts   — ZK proof generation via Barretenberg / Noir
├── NoteManager.ts      — local note cache + 0G Storage sync + incremental Merkle tree
├── ChainClient.ts      — contract interaction (shield, spend, event scanning)
├── HintStore.ts        — encrypted note hints stored on 0G Storage (ECIES)
├── poseidon2.ts        — Poseidon2 hash over BN254
└── types.ts            — shared types
```

## How it works

1. **Spending key** — a random 32-byte secret held only by the user. The corresponding public key is shared to receive notes.
2. **Notes** — private balance units. Each note has a commitment `Poseidon2(pubkey, token, amount, salt)` that sits in an on-chain Merkle tree without revealing any contents.
3. **Proofs** — to shield or spend, the SDK generates a UltraHonk ZK proof (Barretenberg backend) and submits it on-chain. No server signs anything.
4. **Note discovery** — after a private transfer, the sender encrypts the receiver's note with ECIES and stores it on 0G Storage. The receiver scans for their own notes on sync.

## Commands

```bash
npm run build    # compile TypeScript
npm run test     # run tests
npm run e2e      # end-to-end flow against testnet
```

## Dependencies

- `ethers` v6
- `@zkpassport/poseidon2` — Poseidon2 hash
- `@0glabs/0g-ts-sdk` — 0G Storage read/write
