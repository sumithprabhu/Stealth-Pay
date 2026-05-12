# contracts

Solidity smart contracts for StealthPay, deployed on 0G Chain.

## Structure

```
contracts/
├── PrivacyPool.sol           — Core contract: verifies ZK proofs, manages Merkle tree, processes shield/spend
├── ShieldVerifier.sol        — Auto-generated UltraHonk verifier for the shield circuit
├── SpendVerifier.sol         — Auto-generated UltraHonk verifier for the spend circuit
├── interfaces/
│   └── IPrivacyPool.sol
└── libraries/
    ├── IncrementalMerkleTree.sol   — Depth-20 Poseidon2 incremental Merkle tree
    └── poseidon2/                  — On-chain Poseidon2 hash implementation
```

## Deployed Addresses

### 0G Mainnet (chainId 16661)

| Contract | Address |
|---|---|
| PrivacyPool (proxy) | `0x154d75521D449974d18c85600149b885DA5bBA85` |
| PrivacyPool (impl)  | `0x90AC4F119133559b37E4703E6ac30fFD4020c649` |
| ShieldVerifier      | `0x3F2Fd4E070a333446FF0D8886F513a0419A0BAF5` |
| SpendVerifier       | `0x190314E281C7f92bBe0945a4a059Fa74883F0B9C` |

### 0G Testnet — Galileo (chainId 16602)

| Contract | Address |
|---|---|
| PrivacyPool (proxy) | `0x87fECd1AfA436490e3230C8B0B5aD49dcC1283F1` |
| PrivacyPool (impl)  | `0x0c7aEF68936Da0c59c085d1F685dBBBf2509D9Db` |
| ShieldVerifier      | `0x89CD2172470C1aC071117Fe2085780DAA6e9656a` |
| SpendVerifier       | `0xe1E73e47CcbDB78f70A84E8757B51807E1D42386` |

## Commands

```bash
npm run compile          # compile contracts
npm run test             # run tests
npm run deploy:testnet   # deploy to Galileo testnet
npm run deploy:mainnet   # deploy to 0G mainnet
npm run verify:testnet   # verify on testnet explorer
```

## Stack

- Solidity 0.8.24
- Hardhat + TypeChain
- OpenZeppelin Upgradeable (UUPS)
- UltraHonk verifier contracts (Barretenberg / Noir)
