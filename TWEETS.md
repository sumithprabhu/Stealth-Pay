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

## GENRE 1 — PUNCHY SHITPOSTS (50)

---

**1.** scheduled
your wallet address is a public resume nobody asked you to publish

---

**2.** scheduled
"decentralized finance"

decentralized: ✅
finance: ✅
private: ❌

we fixed the third one

---

**3.**
ZK proof: I did the thing correctly and I can prove it without showing you what the thing was

this is the most useful sentence in cryptography

---

**4.** scheduled
normie: why do you need privacy if you have nothing to hide

me: why do you have curtains

---

**5.**
your entire financial history is one etherscan search away. casual.

---

**6.**
web2: your bank knows everything
web3: everyone knows everything

we picked worse

---

**7.**
"transparency" means everyone can audit the protocol

it was never supposed to mean everyone can audit your transactions

---

**8.**
sending tokens on a public blockchain is like paying at a restaurant and having the receipt announced over the PA system

---

**9.**
the funniest part of "be your own bank" is that actual banks have privacy regulations

---

**10.**
your wallet: publicly visible
your browsing history: private
your location: private
your financial history: publicly visible

we made the wrong thing public

---

**11.**
ZK proof goes brrr

(the brrr is math. the math stays private.)

---

**12.**
blockchain node in 2025: synced all transactions. knows your salary. knows your savings. doesn't even ask.

---

**13.**
"permissionless" was never supposed to include permission to watch every transaction you've ever made

---

**14.**
imagine getting hired for a job and your employer can see every payment you've ever received from anyone

that's on-chain hiring right now

---

**15.**
privacy isn't about hiding your balance

it's about not having to explain it to everyone who asks

---

**16.**
defi has the best financial primitives and the worst privacy defaults

we fixed the second one

---

**17.**
you negotiated that salary for a reason

why should the blockchain know it

---

**18.**
on-chain in 2025:
• transparent: ✅
• decentralized: ✅
• censorship-resistant: ✅
• any privacy at all: ❌

shipping.

---

**19.**
your spending pubkey is a public identity
your spending privkey is a private secret

only one of them touches the chain

---

**20.**
if a CEX knows your name and your wallet shows your history

you don't have financial privacy. you have financial theater.

---

**21.**
hot take: on-chain privacy is not about crime

it's about not wanting your landlord to see your salary

---

**22.**
"nothing to hide" people have the most curtains

---

**23.**
the blockchain sees everything by default

privacy protocols are the private browsing mode that should've been there from day one

---

**24.**
zero knowledge: we prove you know something
without revealing what you know
or that you know it
or anything adjacent to knowing it

love this technology

---

**25.**
your on-chain history will outlive you

think about that

---

**26.**
banks have privacy laws
defi has none

we're fixing that with math instead of lawyers

---

**27.**
everyone obsessed with trustless forgot to make it private too

you had one job. two jobs. you had two jobs.

---

**28.**
yes i know the math. yes i can prove it. no i won't tell you what the numbers are.

that's ZK. that's the whole thing.

---

**29.**
the funniest cope: "but mixers are for criminals"

brother your salary is public

---

**30.**
history of financial privacy:

cash: private by default
banks: private by policy
early crypto: lol
ZK crypto: private by math

---

**31.**
people: we want decentralized money

also people: why does everyone know everything we do with our decentralized money

both things were fixable. we fixed the second one.

---

**32.**
ZK proof:
input: secret
output: verified ✅

nothing leaked. nothing revealed. math wins.

---

**33.**
we put the world's most sophisticated cryptography into production so you don't have to explain your salary to strangers on the internet

---

**34.**
defi privacy in 2023: switch wallets lol
defi privacy in 2025: mathematical proof that no link exists

glow up

---

**35.**
a blockchain that remembers everything forever is an incredible tool for accountability

and a terrible default for personal finance

both can be true

---

**36.**
the irony: crypto was supposed to free us from banks

banks at least pretend your transactions are private

---

**37.**
proof of work: i did the work
proof of stake: i own the stake
zero knowledge proof: i did the thing correctly and none of this is your business

---

**38.**
on-chain privacy before ZK: don't transact
on-chain privacy after ZK: transact, prove, verify, done

---

**39.**
MetaMask shows your balance to every website you visit

this is considered normal apparently

---

**40.**
the smartest thing about Stealth Pay: the contract doesn't care who you are

it cares that the math checks out

---

**41.**
the only people who want full financial transparency for everyone are the people reading everyone else's wallets

---

**42.**
reminder that every airdrop snapshot checking your wallet history is also building a complete financial profile of you

---

**43.**
nullifier: one hash. proves you spent the note. reveals nothing about the note.

cryptography is genuinely unhinged in the best way

---

**44.**
shoutout to everyone who used a "fresh wallet" for privacy and immediately bridged from their main wallet

we see you. so does everyone else.

---

**45.**
privacy is the default in every financial system humans have ever built

except crypto

we invented the one exception and called it progress

---

**46.**
you can have:
• full verifiability (chain sees what happened)
• full privacy (chain doesn't see who or how much)

at the same time. simultaneously. right now.

---

**47.**
the note commitment is public
the amount inside it is not
the spending key is not
the recipient is not

just a hash. just math.

---

**48.**
nobody says "i have nothing to hide" when asked for their salary

but somehow that logic evaporates when it's a public ledger

---

**49.**
imagine if venmo was mandatory and public and permanent and indexed by google

that's just defi

---

**50.**
we built an entire ZK privacy protocol and the hardest part was explaining why it was necessary

---
---

## GENRE 2 — PRIVACY IS A RIGHT (50)

---

**1.** scheduled
Privacy, Where It Matters

not a feature. not a toggle. not a policy.

a protocol guarantee. verified on-chain. forever.

Stealth Pay.

---

**2.** scheduled
financial privacy is not a luxury for people with something to hide

it is a baseline requirement for any system where real humans do real business

---

**3.** scheduled
privacy is not the opposite of transparency

a system can be fully verifiable and fully private at the same time

that's exactly what ZK proofs enable

---

**4.** scheduled
the question isn't "why do you need privacy on-chain"

the question is "why did we build a global financial system without it"

---

**5.** scheduled
you have the right to transact without being watched

that right doesn't disappear because the ledger is distributed

---

**6.**
Privacy, Where It Matters

the right to transact without being surveilled is not a feature request

it is a design requirement

---

**7.**
financial privacy is a precondition for financial freedom

you cannot freely transact in a system where every counterparty can see your full history

---

**8.**
the salary you negotiate is private
the invoice you send is private
the donation you make is private

none of that changes because you moved to on-chain rails

---

**9.**
we talk a lot about financial inclusion

we never talk about financial privacy

they're the same conversation

---

**10.**
Privacy, Where It Matters

your payment history is not public information

it was never supposed to be

---

**11.**
privacy and compliance are not opposites

you can verify that the math is correct
without seeing what the math is about

ZK proofs prove this

---

**12.**
the doctor doesn't publish your diagnosis
the lawyer doesn't publish your case
the bank doesn't publish your statement

the blockchain publishes everything by default

this was always going to be a problem

---

**13.**
a journalist paying a source should not have that on a permanent public ledger

a whistleblower receiving funds should not have that on a permanent public ledger

financial privacy is a safety issue, not just a preference

---

**14.**
financial privacy exists in every analog system

we forgot to include it when we rebuilt finance from scratch

---

**15.**
the ability to transact privately is not about secrecy

it's about autonomy

---

**16.**
Privacy, Where It Matters

not "privacy when convenient"
not "privacy unless law enforcement asks"
not "privacy until we update the policy"

privacy. period.

---

**17.**
the right to financial privacy is the right to economic autonomy

remove one and you've removed the other

---

**18.**
open ledger was the right call for protocol transparency

it was the wrong call for personal transaction data

we can separate the two. ZK proofs do exactly that.

---

**19.**
a financial system that exposes every transaction is a surveillance system with payment features

---

**20.**
the free market depends on private negotiation

on-chain, every negotiation is public

that's not a market. that's an auction with a permanent record.

---

**21.**
privacy doesn't mean unaccountable

a ZK proof is fully verifiable and fully private at the same time

accountability and privacy are compatible technologies

---

**22.**
every human being has the right to conduct economic life without a permanent, public, globally searchable record

that right doesn't disappear on-chain

---

**23.**
Privacy, Where It Matters

we didn't build this because privacy is interesting

we built this because it's necessary

---

**24.**
the organizations most concerned about on-chain privacy are the ones doing the most legitimate things

payroll. grants. B2B payments. healthcare. legal.

these are not criminal use cases.

---

**25.**
privacy by policy: someone can override it
privacy by math: nobody can

one of these is a right. one of these is a service.

---

**26.**
financial information is among the most sensitive data any person holds

we should treat it that way by default, not optionally

---

**27.**
the right to private property implies the right to private transactions

you can't have one without the other

---

**28.**
Privacy, Where It Matters

no admin key
no trusted third party
no policy that can be revoked

just a mathematical guarantee that your transaction history is yours

---

**29.**
what we built is not a privacy option

it is a privacy default for every transaction that runs through it

---

**30.**
the question "what do you have to hide" is designed to shift the burden of proof

you don't have to justify wanting privacy

privacy justifies itself

---

**31.**
the global financial system has operated with transaction privacy as a baseline for centuries

we removed that baseline when we moved to public blockchains

ZK proofs restore it

---

**32.**
financial surveillance doesn't just harm individuals

it concentrates power in whoever does the surveilling

---

**33.**
Privacy, Where It Matters

real privacy. not "we pinky promise we won't look."

cryptographic privacy. the kind where looking is mathematically impossible.

---

**34.**
privacy is what makes experimentation possible

you cannot freely explore new financial patterns if every experiment is permanently public

---

**35.**
the same cryptography that secures your HTTPS connection can secure your financial transactions

we just hadn't deployed it at scale yet

now we have.

---

**36.**
there is a difference between:
a public protocol (everyone can verify the rules)
public transactions (everyone can see your activity)

we want the first. we were never supposed to get the second.

---

**37.**
Privacy, Where It Matters

the chain verifies everything
the chain reveals nothing

both at once. that's the point.

---

**38.**
financial privacy is not the enemy of regulation

regulation can be enforced at the point of entry and exit

what happens in the middle is between the participants

---

**39.**
the most regulated financial systems in the world still give individuals transaction privacy

crypto, the supposedly permissionless alternative, gives less

---

**40.**
you would not accept a banking app that publishes your statement to a global leaderboard

why accept a blockchain that does

---

**41.** till here
Privacy, Where It Matters

we built this for the employee who doesn't want their salary discovered
the company that doesn't want competitors tracking their treasury
the person who doesn't want their donation history public

everyone, actually.

---

**42.** 
the problem with public-by-default isn't who's watching now

it's who will be watching in ten years

permanent records have permanent risks

---

**43.**
financial freedom without financial privacy is incomplete freedom

---

**44.**
there is a version of on-chain finance that is transparent at the protocol level and private at the transaction level

that version exists now

---

**45.**
Privacy, Where It Matters

we are not against transparency

we are against mandatory, permanent, public exposure of personal financial data as a default

---

**46.**
the right to transact privately is not a privilege for the privacy-obsessed

it is a basic feature of any financial system that serves real humans

---

**47.**
a medical payment reveals your condition
a legal payment reveals your case
a donation reveals your beliefs
a salary reveals your negotiating position

none of this should be public by default

---

**48.**
ZK proofs don't just protect individual privacy

they make financial infrastructure safe for legitimate institutions to use on-chain

---

**49.**
Privacy, Where It Matters

the proof is on-chain
the transaction is not

exactly as it should be.

---

**50.**
the long arc of financial privacy: cash → banks with rules → blockchain with none → ZK proofs restoring what was always right

---
---

## GENRE 3 — INFRA / BUILDER CALL (50)

---

**1.** scheduled
we built Stealth Pay so you don't have to implement ZK proofs yourself

you integrate. we prove. the chain verifies.

---

**2.**
the entire StealthPay SDK surface area:

sdk.shield()
sdk.privateSend()
sdk.unshield()

proof generation, tree sync, nullifier tracking — handled.

you ship the product.

---

**3.**
the privacy guarantee is not in our code

it is in the math

your users don't have to trust your server

they verify the proof. the contract verifies the proof. done.

---

**4.**
you don't implement TLS to ship HTTPS

you don't implement UltraHonk to ship private payments

we are the ZK layer. you build the product.

---

**5.**
builders don't write their own cryptography

they import the library

npm install stealthpay-sdk

---

**6.**
what the chain sees when a private transfer happens:

• nullifier consumed
• two new commitment hashes inserted
• nothing else

what an observer can determine: nothing

---

**7.**
the SDK handles:
proof generation
Merkle tree sync
note management
nullifier tracking

you handle:
your users
your UX
your business

---

**8.**
shipped on 0G testnet

immutable verifiers
no admin keys on proof logic
open source

if you're building private payments, this is your foundation

---

**9.**
Stealth Pay is infrastructure

the SDK gives you three primitives
the protocol gives you the cryptographic guarantee

the product is yours to build

---

**10.**
what your app receives after a private send:

txHash — for your records
commitment — share with the receiver
amount, salt — private, never on-chain

the chain saw nothing useful. you have everything you need.

---

**11.**
the proof is generated locally
the proof is verified on-chain
the proof reveals nothing about the inputs

three properties. none of them require you to trust us.

---

**12.**
no relayer. no mixer coordinator. no trusted setup per user.

your proof. the contract. done.

---

**13.**
if your product involves moving money between people who don't want that movement public

we have the primitive

---

**14.**
the contract owner can pause the pool
the contract owner cannot read your notes
the contract owner cannot construct a valid proof for a note they don't own

there is a class of admin actions that are architecturally impossible. that's the design.

---

**15.**
every shield operation:
• generates a ZK proof
• inserts one commitment
• locks tokens

on-chain footprint: one hash. one event. nothing readable.

---

**16.**
the playground is live

connect wallet → shield USDC → proof generates → MetaMask signs → real tx on 0G testnet

try the whole flow before you integrate

---

**17.**
developers ask: "how do I know it's secure?"

the verifier is immutable
the circuit is open source
the proof system is UltraHonk

read the math. don't trust us. verify the circuit.

---

**18.**
three SDK calls
two ZK circuits
one Merkle tree

complete mental model for integrating private payments

---

**19.**
what Stealth Pay does not do:
• store your keys
• see your notes
• know your amounts
• log your transactions

what it does:
• verify the math

---

**20.**
private payroll in three lines:

await sdk.shield(USDC, totalPayroll)
for (employee of employees) await sdk.privateSend(USDC, salary, employee.pubkey)
// employees unshield on their own schedule

---

**21.**
the hint system is yours to design

{amount, salt, commitment} delivered over Signal, an API, encrypted email — your call

we handle the cryptography. you handle the channel.

---

**22.**
immutable verifiers mean no upgrade path for the proof logic

that's a feature, not a limitation

your proofs are valid forever. the verification key is permanent.

---

**23.**
what gets stored on-chain: one commitment hash per shield

what gets stored off-chain: your business logic

clean separation. by design.

---

**24.**
Stealth Pay doesn't care what you're building

payroll. grants. B2B. custody. anything.

the protocol just verifies the math.

---

**25.**
the spending key never leaves the client

your app doesn't see it
our server doesn't see it
the chain doesn't see it

just the proof that was generated with it

---

**26.**
for builders shipping their first private transaction:

no infrastructure to spin up
no relayer to run
no ceremony to coordinate

npm install. configure. ship.

---

**27.**
a DAO treasurer can:
• shield the grants pool publicly
• privately distribute to each grantee's pubkey
• let grantees claim on their own timeline

all three steps are one SDK integration

---

**28.**
the two things the chain knows after an unshield:
• a nullifier was consumed
• tokens arrived at an address

what it doesn't know: any connection between deposit and withdrawal

---

**29.**
ZK proof generation happens in your user's browser or server

nothing is sent to us

we never see the witness
we never see the inputs
we never see the privkey

---

**30.**
the Merkle tree is mirrored locally

no RPC needed to generate proofs
no server needed for path computation

offline-capable after initial sync

---

**31.**
B2B use case:

A pays B on-chain
on-chain record: two hashes moved
observable link between payment and parties: none

that's the product

---

**32.**
built on 0G for a reason: sub-second finality, near-zero gas, EVM-compatible

users proof-generate and submit in one session. no waiting.

---

**33.**
the note is:
• a commitment (public, on-chain)
• a salt (private, off-chain)
• an amount (private, off-chain)

two of three never touch the chain. the one that does reveals nothing.

---

**34.**
there's no "privacy setting" to toggle

every transaction through Stealth Pay is private

not optional. not configurable. default.

---

**35.**
subscription payments:

platform shields total monthly revenue
distributes to each subscriber's pubkey
subscribers withdraw in bulk

full on-chain settlement, zero revenue intelligence leaked to competitors

---

**36.**
the verifier contract has no state

no owner
no admin
no upgradeable

it verifies proofs. that's the entire contract.

---

**37.**
building a private wallet?
building a private DEX?
building private payroll?

the ZK infrastructure is the same. the SDK is the same. you customize the product layer.

---

**38.**
a Stealth Pay integration gives your users:

• notes on-chain (as hashes)
• amounts off-chain (as your data)
• privacy by math (not policy)

---

**39.**
what "open source ZK verifier" means in practice:

anyone can recompile the circuit
anyone can re-derive the verification key
anyone can confirm it matches what's deployed

trust is optional. verification is available.

---

**40.**
the SDK returns after a privateSend:

txHash — the on-chain tx
receiverCommitment — share this with the receiver
changeCommitment — your change note

three values. amounts never visible.

---

**41.**
we handle the hard part: Merkle membership proof, nullifier derivation, value conservation

you handle the easy part: building the product

---

**42.**
spending key architecture:
derived client-side
never serialized
never transmitted
never on-chain

generates proofs. nothing else.

---

**43.**
Stealth Pay works for any ERC-20

USDC. USDT. your token. any token the operator whitelists.

the circuit is token-agnostic. one integration covers all.

---

**44.**
two-in two-out note model

send partial amounts
receive change automatically
no overpay, no remainder stuck in the pool

full amount flexibility in one proof

---

**45.**
the spend proof simultaneously proves:
• ownership of both input notes
• Merkle membership for both
• correct nullifier derivation
• output commitment integrity
• value conservation

one proof. five guarantees. one transaction.

---

**46.**
the contract verifies and forgets

no state about your identity
no state about your amount
no state about your counterparty

one bit: this nullifier has been used. that's it.

---

**47.**
every tool in the DeFi stack — DEX, lending, yield — operates with full transaction visibility

Stealth Pay is the primitive that operates without it

---

**48.**
what a Stealth Pay integration gives your users that no other payment rail gives:

mathematical certainty that their financial history is private

not a setting. not a policy. math.

---

**49.**
the docs are live
the SDK is live
the contracts are deployed
the playground is up

if you're building private payments on 0G, everything you need is there

---

**50.**
builders don't need to understand UltraHonk ZK proofs to ship private payments

same way you don't need to understand TLS to ship HTTPS

we're the TLS layer for on-chain privacy

---
