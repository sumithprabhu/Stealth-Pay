# Stealth Pay — Tweets

---

## THREADS (post manually — can't schedule)

---

**THREAD A — How private transfer works**

1/
how does a private transfer actually work with no relayer?

thread 🧵

---

2/
A shields 100 USDC → commitment goes into the Merkle tree
A calls privateSend(amount, B_pubkey) → new commitment for B is inserted

on-chain: two hashes changed. nothing else visible.

---

3/
B syncs the Merkle tree, finds their note, calls unshield(amount, B_wallet)

ZK proof proves:
• B knows the spending key
• note is in the tree
• nullifier is valid

tokens land in B's wallet. no link to A. ever.

---

4/
the "hint" problem: B needs {amount, salt} to find their note

that's not a protocol problem. that's a product problem.

send it over Signal, an encrypted API, a DM — whatever your stack uses.

we give you the cryptographic guarantee. you design the UX.

---

**THREAD B — Use cases nobody talks about**

1/
use cases nobody talks about when they say "ZK privacy" 🧵

---

2/
payroll

company shields total payroll once. sends to each employee's spending pubkey privately. employees withdraw on their own schedule.

HR data stays off-chain. no public salary discovery.

---

3/
DAO grants

approved grantees receive private notes. claim when ready. grant size never publicly visible.

no front-running. no competitors analyzing your treasury moves.

---

4/
B2B settlement

two businesses settle invoices on-chain without revealing payment amounts, frequency, or counterparty to the world.

on-chain rails. private execution. audit trail stored off-chain, their call.

---

5/
all three of these run on three SDK calls

shield() → privateSend() → unshield()

the protocol doesn't know which use case you're building. it just verifies the math.

that's the point.

---
---

## 30 NEW TWEETS TO SCHEDULE

---

### PUNCHY SHITPOSTS

---

**S1.**
your wallet address is a public resume nobody asked you to publish

---

**S2.**
"decentralized finance"

decentralized: ✅
finance: ✅
private: ❌

we fixed the third one

---

**S3.**
every time you send tokens on-chain an angel loses its privacy

---

**S4.**
web3 in 2024: not your keys not your coins

web3 in 2025: not your keys not your coins and also everyone can see everything you do with them

---

**S5.**
the funniest thing about public blockchains is we called it "permissionless" and forgot that includes permission to watch everything you do

---

**S6.**
on-chain transparency was supposed to mean "no corruption"

not "your salary is public"

---

**S7.**
imagine if venmo was mandatory and public and permanent and indexed by google

that's just defi

---

**S8.**
ZK proof: I did the thing correctly and I can prove it without showing you what the thing was

this is the most useful sentence in cryptography

---

**S9.**
normie: why do you need privacy if you have nothing to hide

me: why do you have curtains

---

**S10.**
we built an entire ZK privacy protocol and the hardest part was explaining why it was necessary

---

---

### gPRIVATE / PRIVACY IS A RIGHT

---

**P1.**
Privacy, Where It Matters

not a feature. not a toggle. not a policy.

a protocol guarantee. verified on-chain. forever.

Stealth Pay.

---

**P2.**
financial privacy is not a luxury for people with something to hide

it is a baseline requirement for any system where real humans do real business

---

**P3.**
the salary you earn is private
the invoice you send is private
the grant you receive is private

none of that changes because you settled it on-chain

---

**P4.**
privacy is not the opposite of transparency

a system can be fully verifiable and fully private at the same time

that's exactly what ZK proofs enable

---

**P5.**
the question isn't "why do you need privacy on-chain"

the question is "why did we build a global financial system without it"

---

**P6.**
you have the right to transact without being watched

that right doesn't disappear because the ledger is distributed

---

**P7.**
the protocol doesn't ask why you need privacy

it just verifies the math and moves on

---

**P8.**
Privacy, Where It Matters

not retroactively. not optionally. not with a trusted third party holding the switch.

from the first transaction.

---

**P9.**
a financial system where every participant can see every other participant's balance and history is not neutral

it is surveillance infrastructure

ZK proofs are the way out

---

**P10.**
the best privacy tool is the one that doesn't ask you to trust anyone

not us. not a relayer. not a ceremony coordinator.

just math.

---

---

### INFRA POSITIONING / BUILDER CALL

---

**B1.**
we are not building a privacy wallet

we are building the primitive that privacy wallets are built on

---

**B2.**
three functions

shield() privateSend() unshield()

that's the entire surface area of the Stealth Pay SDK

proof generation, Merkle tree sync, nullifier management — all internal

you call three functions. ship your product.

---

**B3.**
if you are building

• a payroll protocol
• a DAO treasury tool
• a private B2B settlement layer
• any app where financial privacy matters

the SDK is live

npm install stealthpay-sdk

---

**B4.**
the SDK handles:
• ZK proof generation
• Merkle tree sync
• note management
• nullifier tracking

you handle:
• your product
• your UX
• how you deliver the "hint" to receivers

clean separation. by design.

---

**B5.**
the privacy guarantee is not in our code

it is in the math

your users don't have to trust your server, your company, or your team

they verify the proof. the contract verifies the proof. done.

---

**B6.**
we built Stealth Pay so you don't have to implement ZK proofs yourself

you integrate. we prove. the chain verifies.

---

**B7.**
builders don't need to understand UltraHonk ZK proofs to ship private payments

same way you don't need to understand TLS to ship HTTPS

we're the TLS layer for on-chain privacy

---

**B8.**
what your app sees:

txHash, commitment, amount

what the chain sees:

commitment hash. nullifier. nothing else.

the rest is between your users and the math.

---

**B9.**
deployed on 0G Galileo testnet

immutable verifiers. no admin keys on the proof logic. open source.

if you're building on top of this — come find us.

---

**B10.**
the playground is live

connect wallet → shield real USDC → ZK proof generated on our server → MetaMask signs → real tx on 0G testnet

try the whole flow before you integrate

[link]

---

---

### NEW THREADS (post manually)

---

**THREAD C — Why "just use a fresh wallet" doesn't work**

1/
"just use a fresh wallet for privacy"

let's talk about why this doesn't actually work 🧵

---

2/
fresh wallet has no gas

you bridge from your main wallet → chain of custody established immediately

one transaction and the "fresh" wallet is linked forever

---

3/
ok what if you buy gas from a CEX with KYC

now your fresh wallet is linked to your identity at the exchange

CEX records are subpoenable. they get leaked. they get hacked.

---

4/
the only real solution is breaking the link at the protocol level

deposit → pool → wait → withdraw to new address

no chain of custody. no metadata. just a ZK proof that says the math checks out.

---

5/
that's Stealth Pay

not a workaround. not a heuristic.

a cryptographic guarantee that no link exists between deposit and withdrawal.

---

**THREAD D — The two keys explained**

1/
Stealth Pay uses two completely separate keys

most people get confused about this. let me explain 🧵

---

2/
key 1: your wallet key

this is your normal Ethereum private key — MetaMask, Ledger, whatever you use

it signs transactions. it pays gas. it's the key that moves tokens on-chain.

---

3/
key 2: your spending key

this is a Stealth Pay-specific key

it's used to generate ZK proofs and prove note ownership inside the circuit

it never signs an Ethereum transaction. it never touches the chain.

---

4/
why two keys?

the spending key proves you own a private note without revealing anything about your wallet

they are deliberately separate so compromising one doesn't compromise the other

---

5/
the spending key stays on your client. always.

your app never sees it. our server never sees it. the chain never sees it.

just the ZK proof that was generated with it.

that's the architecture.

---

---

## QUOTE CARDS (image text — drop on your template)

Short, hard-hitting. One idea per image. No explanation needed.

---
**Q1.**
> "Your wallet address is a public resume
> nobody asked you to publish."
>
> — Stealth Pay

---

**Q2.**
> "Trustless doesn't mean private.
> It never did."
>
> — Stealth Pay

---

**Q3.**
> "Privacy is not about hiding.
> It's about choosing who sees."
>
> — Stealth Pay

---

**Q4.**
> "The blockchain remembers everything.
> You don't have to let it."
>
> — Stealth Pay

---

**Q5.**
> "Financial privacy is not a feature.
> It's a fundamental right."
>
> — Stealth Pay

---

**Q6.**
> "You wouldn't hand your bank statement
> to a stranger on the street.
> Why hand it to every node on the network?"
>
> — Stealth Pay

---

**Q7.**
> "Open ledger was supposed to mean
> no corruption.
> Not no privacy."
>
> — Stealth Pay

---

**Q8.**
> "The proof doesn't reveal the secret.
> That's the entire point."
>
> — Stealth Pay

---

**Q9.**
> "We built a global financial system
> and made it public by default.
> That was a mistake."
>
> — Stealth Pay

---

**Q10.**
> "Anyone with a browser
> can read your entire financial history.
> That's not decentralization.
> That's surveillance."
>
> — Stealth Pay

---

**Q11.**
> "Math doesn't have a privacy policy.
> It just works."
>
> — Stealth Pay

---

**Q12.**
> "The most powerful word in cryptography:
> prove."
>
> — Stealth Pay

---

**Q13.** selected
> "Your salary is private.
> Your invoices are private.
> Your grants are private.
> Your on-chain history shouldn't be the exception."
>
> — Stealth Pay

---

**Q14.**
> "Immutable doesn't have to mean visible."
>
> — Stealth Pay

---

**Q15.**
> "We didn't build a privacy toggle.
> We built a privacy guarantee."
>
> — Stealth Pay

---

**Q16.**
> "On-chain transparency was designed
> to eliminate corruption.
> Not to eliminate privacy.
> There's a difference."
>
> — Stealth Pay

---

**Q17.**
> "The nullifier is published.
> The note is not.
> One hash ends double-spend forever.
> The other never existed publicly."
>
> — Stealth Pay

---

**Q18.**
> "Privacy by policy can be revoked.
> Privacy by math cannot."
>
> — Stealth Pay

---

**Q19.**
> "You don't need to trust us.
> You need to verify the proof.
> There's a difference."
>
> — Stealth Pay

---

**Q20.**
> "The organizations most concerned
> about on-chain privacy
> are the ones doing the most
> legitimate things."
>
> — Stealth Pay

---
