# Stealth Pay — Tweets V2
# Tone: dry, deadpan, intelligent. Let the irony do the work.

---

## GENRE 1 — DEADPAN TAKES (50)

---

**1.**
we built a global financial system on a public ledger

and then were surprised that privacy became a problem

---

**2.**
your wallet address is searchable on Google

this is considered normal

---

**3.**
banks have laws requiring them to protect your financial data

crypto has none

we picked the less regulated option and called it freedom

---

**4.**
"nothing to hide"

interesting. what's your salary?

---

**5.**
the breakthrough in ZK proofs: you can prove something is true without revealing what it is

we shipped this in 2026

it was invented in 1985

---

**6.**
a fresh wallet for privacy, funded from your main wallet

cryptographically speaking, this is not privacy

---

**7.**
your on-chain transaction history will outlive you

the chain does not forget

---

**8.**
ZK proof: valid ✓

what was proved: none of your business

---

**9.**
financial privacy has existed in every monetary system humans have ever built

except this one

we fixed that

---

**10.**
the blockchain sees: one commitment hash

the blockchain knows: nothing

that's the design

---

**11.**
web2: your bank knows your transactions

web3: everyone knows your transactions

one of these has privacy regulations

---

**12.**
we wrote a circuit that proves five things simultaneously and reveals none of them

cryptography is genuinely unreasonable in the best way

---

**13.**
your spending key generates a proof

then it goes back in your pocket

it never touches the chain

the chain has no idea it exists

---

**14.**
the verifier contract has one job

verify(proof, publicInputs)

no state, no owner, no upgrade path

it has been doing its job since deployment and will continue indefinitely

---

**15.**
on-chain in 2026:
- transparent: yes
- decentralized: yes
- censorship-resistant: yes
- private: no

we addressed the last one

---

**16.**
a medical payment reveals your condition

a legal payment reveals your case

a salary payment reveals your negotiating position

none of this was ever meant to be public

---

**17.**
the nullifier:
- one hash
- proves the note was spent
- reveals nothing about the note

double-spend protection with zero information leakage

---

**18.**
zero knowledge means: I proved I know the thing. You cannot learn what the thing is from the proof.

this took forty years to get into production

worth it

---

**19.**
airdrop eligibility tools check your full transaction history to determine eligibility

this is also a complete financial profile of you

both things are true

---

**20.**
the immutable verifier cannot be updated

this is a feature

your proof valid today is valid permanently

---

**21.**
the Merkle root is public

it commits to every valid note in the tree

your proof shows your note is in the tree

without revealing which leaf

without revealing any note details

public root, private everything else

---

**22.**
privacy by policy: a person can override it

privacy by math: no one can

one of these is a guarantee

---

**23.**
every airdrop snapshot that checks your on-chain history

is also building a permanent record of your financial behavior

---

**24.**
three SDK calls

shield(), privateSend(), unshield()

the ZK proving, tree sync, and nullifier tracking are handled

you write the product

---

**25.**
the blockchain is a permanent, globally indexed, publicly searchable record of every financial transaction you've made on it

this was never announced as a privacy tradeoff

it was just the default

---

**26.**
MetaMask displays your balance to every website you connect to

this is standard behavior

---

**27.**
we built proof generation, Merkle tree mirroring, and nullifier tracking into the SDK

so that you don't have to

---

**28.**
the spending key never leaves the client

your app doesn't see it

the backend doesn't see it

the chain doesn't see it

it generates a proof and nothing else

---

**29.**
cash: private by default, for five thousand years

crypto: public by default, for fifteen years

one of these is the historical anomaly

---

**30.**
two businesses can settle invoices on-chain

without revealing the amount, the frequency, or the counterparty

to anyone

this is table stakes for institutional adoption

---

**31.**
the funniest part of "be your own bank" is that actual banks have privacy laws

---

**32.**
your employer searches your wallet before the interview

this is possible today

some employers do this

privacy is not a theoretical concern

---

**33.**
the note hint is encrypted with the receiver's public key

uploaded to 0G Storage

the receiver's next sync finds and decrypts it automatically

no manual communication required

---

**34.**
the contract owner can pause the pool

the contract owner cannot touch user funds

the contract owner cannot generate a valid proof for a note they don't own

some admin capabilities are architecturally impossible

---

**35.**
a commitment is on-chain

the amount inside it is not

the salt is not

the owner's identity is not

just a hash

---

**36.**
proof generation happens on your machine

we never see the witness

we never see the inputs

we never see the spending key

we are not part of the computation

---

**37.**
the question is not "why do you need financial privacy on-chain"

the question is "why did we build a financial system without it"

---

**38.**
private payroll:

shield the total once

distribute to each employee's public key privately

employees withdraw on their own schedule

HR data stays off-chain

---

**39.**
the Merkle tree is depth 20

supports approximately one million notes

the local SDK tree and the on-chain tree use the same hash function

the roots always match

---

**40.**
we built this because financial privacy is a precondition for financial infrastructure

not a preference

a requirement

---

**41.**
your transaction history is one etherscan search away

it has been this way since the beginning

most people have not thought carefully about what that means

---

**42.**
the spend circuit proves value conservation

input sum equals output sum

no inflation, no theft, no shortfall

the math checks itself

---

**43.**
on-chain finance is excellent at transparency

it has never been adequate at privacy

these are separate problems with separate solutions

---

**44.**
the only thing the chain sees after a private transfer:

two hashes

that's the entire on-chain record

---

**45.**
"just use a mixer"

mixers have coordinators

coordinators can be compromised

coordinators can be subpoenaed

we don't have a coordinator

the math is the coordinator

---

**46.**
a DAO distributing grants publicly

reveals grant sizes, recipient addresses, and timing to every competitor watching the chain

none of that needs to be public

---

**47.**
UltraHonk. no trusted setup. sub-2-second prove time. verifier deployed on-chain.

that's the proof system

---

**48.**
the circuit is open source

the verifier is immutable

you can recompile the circuit, re-derive the verification key, and confirm it matches what's deployed

trust is optional here

---

**49.**
your on-chain financial behavior is being analyzed by firms whose entire business model depends on that analysis

this is not a conspiracy theory

it's an industry

---

**50.**
we shipped ZK privacy infrastructure

three function calls to integrate

no relayer, no coordinator, no trusted setup

the hard part is handled

---
---

## GENRE 2 — CONTROLLED RAGEBAIT (30)

---

**1.**
unpopular: DeFi without privacy is not an upgrade over traditional finance

it is a downgrade on the specific dimension that matters most to normal people

---

**2.**
"crypto is for the unbanked"

cash is anonymous

crypto is not

cash has had better privacy than crypto since the beginning

---

**3.**
the same industry that calls itself "trustless"

built a system where you have to trust that no one is watching your transactions

both things cannot be true

---

**4.**
financial surveillance doesn't require a government

it just requires a public ledger and an analytics firm

both exist in abundance

---

**5.**
every privacy-conscious person in crypto uses Signal

and a public wallet

the cognitive dissonance is extraordinary

---

**6.**
the most sophisticated financial rails ever built have less privacy than cash

this will eventually be recognized as the obvious mistake it is

---

**7.**
"ZK privacy is for people with something to hide"

every salary negotiation is private

every legal settlement is private

every medical bill is private

these are not criminal activities

---

**8.**
the reason mass adoption hasn't happened is not UX

it is the fact that normal people will not conduct their financial lives in public

---

**9.**
analytics firms can cluster your wallets by IP, timing, and transaction graph

"fresh wallet" is not a threat model

it is a comfort blanket

---

**10.**
your wallet history is available to your employer, your landlord, your counterparties, and anyone who wants to pay for an analytics subscription

this is not a theoretical risk

---

**11.**
we talk about financial inclusion constantly

we never talk about financial privacy

for anyone who is included in a system that exposes all their transactions publicly, the inclusion is arguably worse

---

**12.**
the people most confident that privacy is unnecessary

are the ones who have never been in a situation where it mattered

---

**13.**
"but the blockchain is immutable and transparent by design"

yes

and personal financial data being permanently public is a design flaw

both things can be true

---

**14.**
every institution that has considered on-chain payments

and rejected them

cited the same reason: we don't want our vendor relationships, payment frequencies, and amounts publicly visible

this is a solved problem now

---

**15.**
building financial infrastructure without privacy

and then being surprised that regulated institutions won't use it

is a very avoidable outcome

---

**16.**
the "nothing to hide" argument collapses immediately when applied to your salary, your rent, your medical bills, your donations, and your legal fees

which are all things you conduct privately

by default

without thinking about it

---

**17.**
on-chain transparency was the correct call for protocol integrity

it was never supposed to apply to individual transactions

we conflated two different things and have spent fifteen years defending the mistake

---

**18.**
a journalist paying a source on-chain

a whistleblower receiving funds on-chain

a domestic abuse survivor transacting on-chain

financial privacy is a safety issue before it is a preference

---

**19.**
the irony: crypto made financial sovereignty possible

and financial surveillance mandatory

at the same time

---

**20.**
calling on-chain payments "permissionless" while every transaction is permanently public

is a very specific definition of permission

---

**21.**
the number of legitimate business use cases that require private payments

is larger than the number of use cases that require public ones

we built for public by default

the market has not forgiven this

---

**22.**
every wallet that connects to a dapp exposes its full balance and transaction history

this is the handshake

this is considered normal

---

**23.**
financial data is among the most sensitive personal information anyone holds

we made it the default public data in the most important new financial system in decades

---

**24.**
the free market requires private negotiation

public ledgers make every negotiation public

these two things are in conflict

we resolved the conflict

---

**25.**
a blockchain that forgets nothing is an excellent tool for institutional accountability

it is a terrible default for personal transactions

the distinction matters

---

**26.**
the reason crypto twitter is comfortable with public wallets

is that crypto twitter treats their wallet as a public identity

normal people do not want a public financial identity

---

**27.**
calling a system that exposes all your transactions "decentralized finance"

without noting that it also centralizes all observable financial information into a global public database

is doing a lot of work with the framing

---

**28.**
privacy by policy means someone decided to protect you

privacy by math means no one has to decide anything

the math does not change its mind

---

**29.**
the organizations most concerned about on-chain privacy are the ones doing the most ordinary things

payroll, grants, B2B settlements, subscriptions

these are not edge cases

---

**30.**
cash has been private for five thousand years

we invented a new form of money and removed that property

and named the removal "transparency"

---
---

## GENRE 3 — DRY BANTER (20)

---

**1.**
"just use a fresh wallet"

step one: fund it
step two: fund it from where
step three: your main wallet
step four: you have linked the wallets

step five: this was not a privacy strategy

---

**2.**
blockchain analytics firm, encountering a Stealth Pay transaction:

two commitments inserted
one nullifier consumed
observable sender: none
observable amount: none
observable recipient: none

report filed: inconclusive

---

**3.**
"how do I know the ZK proof is valid"

the verifier is on-chain

the circuit is open source

you can recompile and verify the key yourself

trust is optional

"but how do I really know"

the math

---

**4.**
"mixers are for criminals"

your salary has been public since you made your first transaction

we'll circle back to who the problem is here

---

**5.**
person: so it's like a privacy coin?

us: no, it's a privacy layer for any ERC-20

person: so USDC can be private?

us: yes

person: and I can still verify the proof on-chain?

us: yes

person: and no one can read the amount?

us: correct

person: hm

---

**6.**
competitor: trust our relayer

competitor: trust our coordinator

competitor: trust our policy

Stealth Pay: trust the circuit

the circuit has never been subpoenaed

---

**7.**
two hashes moved on-chain

that is the entire observable record of a private transfer

the analytics firm can have the two hashes

---

**8.**
"privacy is a feature not a right"

please read any history of financial regulation from any country in the last hundred years

and then resubmit

---

**9.**
fresh wallet strategy:
1. create new wallet ✓
2. bridge gas from main wallet ✗
3. wallets linked forever at step 2
4. return to step 1

---

**10.**
the spending key:
- never signs a transaction
- never touches the chain
- the chain has never heard of it
- generates a proof
- sits there

the quietest key in cryptography

---

**11.**
"ZK proofs are too complex for real users"

the user calls shield()

the SDK calls the circuit

the proof is generated

the transaction is submitted

the user did not interact with a circuit

---

**12.**
every airdrop that snapshots your wallet history

is a complete financial profile

delivered voluntarily

in exchange for tokens

---

**13.**
"the verifier is immutable, what if there's a bug"

the circuit is open source

the proofs have been tested

and the alternative is a mutable verifier that can be changed by someone with an admin key

we chose immutable

---

**14.**
what the blockchain records after unshield:

- nullifier consumed
- tokens at an address

what it does not record:

- any connection to the original deposit

---

**15.**
"but I have nothing to hide"

post your salary

post your medical bills

post your rent payment history

"those are private"

yes

exactly

---

**16.**
the Merkle proof proves your note is in the tree

without revealing which leaf it is

the math is doing a lot of work here

quietly

without recognition

---

**17.**
us: the spending key never leaves the client

developer: what if I want to store it server-side

us: you can, it's your product

developer: but then you'd see it

us: we wouldn't. we never receive it.

developer: right

us: right

---

**18.**
analytics firm: we can trace any transaction on-chain

also analytics firm, three days after Stealth Pay integration: we cannot trace this

---

**19.**
"what if law enforcement needs to trace a transaction"

that's a compliance question, not a cryptography question

the protocol handles cryptography

---

**20.**
the nullifier was published

the note is spent

the double-spend was prevented

the amount was never revealed

the sender was never revealed

the circuit clocked out and went home

---
---

## GENRE 4 — LORE DROPS (20)

---

**1.**
the note has three parts:

commitment — public, on-chain, in the Merkle tree
amount — private, off-chain, yours only
salt — private, randomness that makes each note unique

one thing on-chain

everything that matters: off-chain

---

**2.**
UltraHonk

- no trusted setup
- sub-2-second prove time
- verifier is a deployed smart contract
- generated by Barretenberg from Noir circuits

the proof system Stealth Pay runs on

---

**3.**
the spending key is not your Ethereum private key

completely separate

client-side only

generates ZK proofs

never signs a transaction

never leaves your device

never on-chain

---

**4.**
the Merkle tree

depth 20
Poseidon2 hash function
supports approximately one million notes
local SDK tree mirrors on-chain tree exactly
same hash function, same zero chain, same root

---

**5.**
the nullifier

derived from your spending key and note salt
published when you spend the note
marks the note as used
reveals nothing about the note's amount or origin
double-spend protection with zero information disclosure

---

**6.**
the shield circuit

inputs: spending key, token address, amount, salt
output: one commitment hash

that hash is what goes on-chain

the inputs never do

---

**7.**
the spend circuit proves five things simultaneously

1. ownership of both input notes
2. Merkle membership for both notes
3. correct nullifier derivation from spending key
4. correct output commitment formation
5. value conservation: inputs equal outputs

one proof, five guarantees, one transaction

---

**8.**
the hint system

sender encrypts {amount, salt, commitment} with receiver's public key using ECIES

uploads to 0G Storage

receiver's sync() call finds it, decrypts it, now has everything needed to unshield

no out-of-band communication required

---

**9.**
what the contract owner can do:

pause the pool
whitelist tokens

what the contract owner cannot do:

read your notes
move your funds
generate a valid proof for a note they don't own

the second category is mathematically impossible, not policy-restricted

---

**10.**
ShieldVerifier and SpendVerifier

deployed on 0G Galileo
auto-generated by Barretenberg from compiled Noir circuits
immutable
one function: verify(proof, publicInputs)
returns true or reverts

no state, no owner, no upgrade path

---

**11.**
the 2-in / 2-out model

every spend takes up to two input notes
produces two output notes: one to the recipient, one change note to the sender
no overpayment required
no remainder stranded in the pool

---

**12.**
what happens on shield

1. approve token transfer
2. SDK generates ZK proof locally
3. proof + commitment submitted to contract
4. verifier checks proof on-chain
5. tokens locked in pool
6. commitment inserted into Merkle tree

observable: one commitment hash

---

**13.**
the Merkle root

public, updated on every shield
commits to the entire set of valid notes
your spend proof proves your note is in the tree against this root
without revealing which leaf

root: public
everything else: private

---

**14.**
ECIES — Elliptic Curve Integrated Encryption Scheme

sender encrypts note hint with receiver's public key
only the receiver's private key decrypts it
uploaded to 0G Storage: publicly stored, privately sealed
the chain can see a file exists, no one can read it

---

**15.**
two keys, different jobs

wallet key: signs Ethereum transactions, pays gas
spending key: generates ZK proofs, proves note ownership

compromising one does not compromise the other

designed separate deliberately

---

**16.**
proof generation happens in your browser or your server

nothing is sent to Stealth Pay infrastructure during proof generation

we never see the witness, the inputs, or the spending key

we are not part of the computation

---

**17.**
the full flow

shield → note in Merkle tree, tokens locked
privateSend → old note nullified, new commitment for receiver inserted
unshield → ownership proved, nullifier published, tokens released to recipient address

three operations
two circuits
one Merkle tree
zero revealed information

---

**18.**
note tracking in the SDK

the SDK mirrors the on-chain Merkle tree from events
scans for encrypted hints in 0G Storage that match your key
decrypts and stores notes locally
selects correct notes for each spend automatically

you call unshield()
the SDK knows which note to use

---

**19.**
the verifier contract

no state
no owner
no admin key
no upgradeable proxy
one function

it verifies proofs

it has been doing this since deployment

it will continue until the chain stops

---

**20.**
0G Chain

sub-second finality
near-zero gas
EVM-compatible
0G Storage available for the hint system

proof generation and submission happen in one session

no waiting for block times

---
---

## GENRE 5 — SINGLE-LINE DEADPAN (15)

---

**1.**
your wallet address is a permanent public financial record that you hand to every dapp you use

---

**2.**
the blockchain does not forget

we made sure it can't read what it remembers

---

**3.**
"trustless" meant you don't have to trust the protocol

it was never supposed to mean everyone can read your transaction history

---

**4.**
cash has been private for five thousand years

on-chain payments are sixteen years old and already less private than cash

---

**5.**
the circuit is open source, the verifier is immutable, the proof is on-chain

if you need more than that to trust the system, you have defined trust incorrectly

---

**6.**
we shipped ZK privacy in 2026

it was theoretically possible in 1985

the delay was not technical

---

**7.**
the nullifier knows you spent the note

it does not know what the note was worth

this distinction is the entire design

---

**8.**
your financial history is not content for public analysis

it became that when you moved on-chain

we reverted that decision

---

**9.**
the spending key has never touched a blockchain in its life

---

**10.**
three function calls

shield(), privateSend(), unshield()

the entire ZK privacy stack is abstracted behind three function calls

---

**11.**
a valid ZK proof reveals nothing about the inputs that generated it

this is both the point and the guarantee

---

**12.**
we put the world's most sophisticated proof system in production

so that your counterparties can't read your payment history

---

**13.**
the immutable verifier will verify correct proofs for as long as the chain runs

no policy update will change this

no admin key will override this

the math is not a policy

---

**14.**
your salary negotiation is private

your medical bills are private

your legal fees are private

none of that changes because you moved to on-chain rails

---

**15.**
proof time: under 2 seconds

the argument that ZK privacy is too slow: retired

---
