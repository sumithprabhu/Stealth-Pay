import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Code, Callout, H2, H3, P,
  ShieldFlowDiagram, MerkleTreeDiagram, SpendFlowDiagram,
} from "../_components/shared";

const deployments = [
  { name: "ShieldVerifier",   address: "0x89CD2172470C1aC071117Fe2085780DAA6e9656a" },
  { name: "SpendVerifier",    address: "0xe1E73e47CcbDB78f70A84E8757B51807E1D42386" },
  { name: "PrivacyPoolImpl",  address: "0x0c7aEF68936Da0c59c085d1F685dBBBf2509D9Db" },
  { name: "PrivacyPoolProxy", address: "0x87fECd1AfA436490e3230C8B0B5aD49dcC1283F1" },
];

function PageFooter({ prev, next }: { prev?: { href: string; label: string }; next?: { href: string; label: string } }) {
  return (
    <div className="mt-14 pt-8 border-t border-white/[0.07] flex items-center justify-between gap-4">
      <div>
        {prev && (
          <Link href={prev.href} className="flex items-center gap-2 text-sm text-white/35 hover:text-white/65 transition-colors group">
            <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
            <span>{prev.label}</span>
          </Link>
        )}
      </div>
      <div className="text-right">
        {next && (
          <Link href={next.href} className="flex items-center gap-2 text-sm text-white/35 hover:text-white/65 transition-colors group">
            <span>{next.label}</span>
            <span className="group-hover:translate-x-0.5 transition-transform">→</span>
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Page map ─────────────────────────────────────────────────────────────────

import type { ReactElement } from "react";

const pages: Record<string, { eyebrow: string; title: string; content: ReactElement; prev?: { href: string; label: string }; next?: { href: string; label: string } }> = {

  // ── Use Cases ─────────────────────────────────────────────────────────────
  usecases: {
    eyebrow: "Overview",
    title: "Use Cases",
    prev: { href: "/docs", label: "What is Stealth Pay?" },
    next: { href: "/docs/architecture", label: "Architecture" },
    content: (
      <>
        <P>
          Stealth <span className="text-[#eca8d6]">Pay</span> is infrastructure. The SDK gives you three
          primitives: <strong className="text-white/80">shield</strong>,{" "}
          <strong className="text-white/80">privateSend</strong>, and{" "}
          <strong className="text-white/80">unshield</strong>, with cryptographic guarantees that
          nobody can link sender to receiver on-chain. What you build on top, and how you store or
          communicate note data privately, is entirely your architecture decision.
        </P>

        <Callout type="info">
          Every operation produces a <strong className="text-white/80">commitment hash</strong> and a{" "}
          <strong className="text-white/80">nullifier</strong>. These are the only things that ever
          touch the chain. Amounts, recipients, and salt values stay off-chain, in your database,
          encrypted in a message, or wherever your product stores them.
        </Callout>

        {/* ── Payment patterns ── */}
        <H2>The three payment patterns</H2>
        <P>
          Every use case below is a combination of these three calls. Mix them to fit your product.
        </P>

        <div className="overflow-x-auto my-6">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08]">
                <th className="text-left px-4 py-3 text-white/35 font-mono text-xs uppercase tracking-widest">Pattern</th>
                <th className="text-left px-4 py-3 text-white/35 font-mono text-xs uppercase tracking-widest">Who calls it</th>
                <th className="text-left px-4 py-3 text-white/35 font-mono text-xs uppercase tracking-widest">What happens on-chain</th>
                <th className="text-left px-4 py-3 text-white/35 font-mono text-xs uppercase tracking-widest">What stays off-chain</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["shield(token, amount)", "Sender (A)", "Commitment inserted into Merkle tree. Tokens locked in pool.", "amount, salt, spending pubkey"],
                ["privateSend(token, amount, B_pubkey)", "Sender (A)", "A's note nullified. New commitment for B inserted.", "Auto-posted to 0G Storage if zeroGStorage configured"],
                ["unshield(token, amount, recipient)", "Note owner", "Nullifier published. Tokens released to recipient.", "Nothing (this is the exit)"],
              ].map(([p, w, on, off]) => (
                <tr key={p} className="border-b border-white/[0.05] last:border-0 align-top">
                  <td className="px-4 py-3 font-mono text-[#eca8d6]/80 text-xs">{p}</td>
                  <td className="px-4 py-3 text-white/50">{w}</td>
                  <td className="px-4 py-3 text-white/50">{on}</td>
                  <td className="px-4 py-3 text-white/35 text-xs">{off}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Real hashes ── */}
        <H2>Real on-chain example</H2>
        <P>
          The following transactions were produced by the e2e test suite running against 0G Galileo
          testnet. They show exactly what an observer sees, and exactly what they cannot see.
        </P>

        <div className="space-y-4 my-6">
          <div className="border border-white/[0.08] p-5">
            <p className="text-xs font-mono text-white/25 uppercase tracking-widest mb-3">Shield tx</p>
            <div className="space-y-2 text-sm">
              <div className="flex gap-3"><span className="text-white/35 w-28 shrink-0">tx hash</span><code className="font-mono text-white/60 break-all">0x9d3270efb0a458a062a84773db68ae3e8980e748f0348b415f7211d8bfeac265</code></div>
              <div className="flex gap-3"><span className="text-white/35 w-28 shrink-0">from</span><code className="font-mono text-white/60">0xD91D61bd2841839eA8c37581F033C9a91Be6a5A6</code></div>
              <div className="flex gap-3"><span className="text-white/35 w-28 shrink-0">to</span><code className="font-mono text-white/60">0x87fECd1AfA436490e3230C8B0B5aD49dcC1283F1</code><span className="text-white/25 ml-2">(pool)</span></div>
              <div className="flex gap-3"><span className="text-white/35 w-28 shrink-0">commitment</span><code className="font-mono text-[#eca8d6]/70 break-all">0x298e3a81cdffa15ffb2de45c46b92b99f7c3e26a4b5bc0ebcdced1e89b095ee5</code></div>
              <div className="flex gap-3"><span className="text-white/35 w-28 shrink-0">leaf index</span><code className="font-mono text-white/60">5</code></div>
              <div className="flex gap-3"><span className="text-white/35 w-28 shrink-0">visible amount</span><span className="text-white/35 text-xs italic">none (hidden in commitment)</span></div>
            </div>
          </div>
          <div className="border border-white/[0.08] p-5">
            <p className="text-xs font-mono text-white/25 uppercase tracking-widest mb-3">Unshield tx (spend)</p>
            <div className="space-y-2 text-sm">
              <div className="flex gap-3"><span className="text-white/35 w-28 shrink-0">tx hash</span><code className="font-mono text-white/60 break-all">0xca0bdd72866cc172740563e6dea957e2fff3fc1194632295adbedaff659cc061</code></div>
              <div className="flex gap-3"><span className="text-white/35 w-28 shrink-0">caller</span><code className="font-mono text-white/60">0xD91D61bd2841839eA8c37581F033C9a91Be6a5A6</code></div>
              <div className="flex gap-3"><span className="text-white/35 w-28 shrink-0">recipient</span><code className="font-mono text-white/60">0xe088622BC9c8082f9A250bDC91D0CF64577FFDb9</code></div>
              <div className="flex gap-3"><span className="text-white/35 w-28 shrink-0">released</span><code className="font-mono text-white/60">49.95 USDC</code><span className="text-white/25 ml-2">(after 0.1% fee)</span></div>
              <div className="flex gap-3"><span className="text-white/35 w-28 shrink-0">nullifier</span><code className="font-mono text-[#eca8d6]/70 break-all">published on-chain, prevents double spend</code></div>
              <div className="flex gap-3"><span className="text-white/35 w-28 shrink-0">link to shield</span><span className="text-white/35 text-xs italic">none (ZK proof reveals no connection)</span></div>
            </div>
          </div>
        </div>

        <Callout type="tip">
          An on-chain observer sees two unrelated events: a deposit into the pool and a withdrawal from
          the pool. The ZK proof mathematically guarantees no link can be derived between them.
        </Callout>

        {/* ── Payroll ── */}
        <H2>Use case 1: Private payroll</H2>
        <P>
          A company pays 50 employees every month. With public transfers, anyone can see every salary.
          With Stealth <span className="text-[#eca8d6]">Pay</span>, the company shields the total
          payroll once, then privately distributes to each employee's spending pubkey. Employees
          unshield to their own wallets at any time.
        </P>
        <Code lang="ts">{`// Company (run once per cycle)
await sdk.shield(USDC, totalPayroll);  // one public deposit

// Per employee, company stores { amount, salt } in its HR DB
for (const employee of employees) {
  await sdk.privateSend(USDC, employee.salary, employee.spendingPubkey);
  // commitment hash → store in HR system against employee record
}

// Employee (self-serve, any time)
await sdk.sync(provider);
await sdk.unshield(USDC, mySalary, myWallet);`}</Code>
        <P>
          <strong className="text-white/75">What the company stores privately:</strong> a mapping of{" "}
          <code className="font-mono text-white/60">{`{ employeeId → { commitment, amount, salt } }`}</code>.
          This is standard HR data. Store it in your existing payroll database. The chain only sees
          commitment hashes and nullifiers, not names or amounts.
        </P>
        <P>
          <strong className="text-white/75">What goes on-chain:</strong> one shield tx (total pool
          deposit) and N spend txs (one per employee), each revealing nothing about individual amounts.
        </P>

        {/* ── B2B ── */}
        <H2>Use case 2: Confidential B2B payments</H2>
        <P>
          Two businesses settling invoices. Neither wants competitors to see payment amounts,
          frequency, or counterparty relationships.
        </P>
        <Code lang="ts">{`// Business A paying an invoice
const result = await sdk.privateSend(USDC, invoiceAmount, businessB_pubkey);

// A stores privately (e.g. in their accounting system):
// { invoiceId, commitment: result.receiverCommitment, amount, salt }

// A sends to B over a private channel (Signal, encrypted email, API):
// { commitment, amount, salt }  ← "here is your payment note"

// Business B after receiving the note details
await sdk.noteManager.trackNote(commitment, USDC, amount, salt, leafIndex);
await sdk.unshield(USDC, amount, businessB_wallet);`}</Code>
        <P>
          <strong className="text-white/75">The "hint" is yours to design.</strong> How A communicates{" "}
          <code className="font-mono text-white/60">{`{ amount, salt }`}</code> to B is not a protocol
          concern, it is a product concern. Use your existing secure channel: an encrypted API
          webhook, a Signal message, an in-app notification. Stealth{" "}
          <span className="text-[#eca8d6]">Pay</span> provides the cryptographic guarantee; you
          provide the delivery mechanism.
        </P>

        {/* ── Treasury ── */}
        <H2>Use case 3: DAO treasury distribution</H2>
        <P>
          A DAO grants funding to builders. Public grants reveal grant sizes to competitors and create
          tax/regulatory exposure for recipients before they are ready to disclose.
        </P>
        <Code lang="ts">{`// DAO multisig shields the grants pool
await sdk.shield(USDC, grantsPool);

// Per grantee, DAO stores commitment in governance record
for (const grantee of approvedGrants) {
  const result = await sdk.privateSend(
    USDC,
    grantee.amount,
    grantee.spendingPubkey,
  );
  // record result.receiverCommitment in governance snapshot
}

// Grantee claims when ready (their timeline, not the DAO's)
await sdk.unshield(USDC, grantAmount, granteeWallet);`}</Code>
        <P>
          The DAO's governance vote approves amounts and pubkeys. The on-chain execution reveals only
          that funds moved through the pool, not to whom or how much per recipient.
        </P>

        {/* ── Streaming ── */}
        <H2>Use case 4: Subscription &amp; streaming payments</H2>
        <P>
          A SaaS platform charges subscribers monthly without exposing customer wallet history.
          Each billing cycle the platform shields fees and sends to a per-customer commitment.
          Customers accumulate notes and withdraw in bulk.
        </P>
        <Code lang="ts">{`// Platform monthly billing job
for (const subscriber of activeSubscribers) {
  await sdk.privateSend(USDC, subscriber.monthlyFee, subscriber.pubkey);
  // store commitment → subscriber record in your DB
}

// Customer quarterly withdrawal
await sdk.sync(provider);
const balance = sdk.getPrivateBalance(USDC);
await sdk.unshield(USDC, balance.balance, customerWallet);`}</Code>

        {/* ── What builders own ── */}
        <H2>What builders are responsible for</H2>
        <P>
          The SDK handles all ZK proof generation, Merkle tree syncing, and on-chain interactions.
          Builders own everything off-chain:
        </P>
        <div className="overflow-x-auto my-6">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08]">
                <th className="text-left px-4 py-3 text-white/35 font-mono text-xs uppercase tracking-widest">Data</th>
                <th className="text-left px-4 py-3 text-white/35 font-mono text-xs uppercase tracking-widest">Who stores it</th>
                <th className="text-left px-4 py-3 text-white/35 font-mono text-xs uppercase tracking-widest">Suggested storage</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["commitment hash", "Sender", "Your DB (index by user/invoice ID)"],
                ["amount + salt", "Sender + Receiver", "Encrypted at rest; communicate over secure channel"],
                ["spending privkey", "End user only", "Client-side only, never send to your server"],
                ["spending pubkey", "Your platform", "Public, safe to store in DB, share openly"],
                ["nullifier", "Chain (public)", "Already on-chain, no action needed"],
                ["recipient address", "Receiver", "Off-chain, never revealed by the protocol"],
              ].map(([d, w, s]) => (
                <tr key={d} className="border-b border-white/[0.05] last:border-0 align-top">
                  <td className="px-4 py-3 font-mono text-[#eca8d6]/80 text-xs">{d}</td>
                  <td className="px-4 py-3 text-white/50">{w}</td>
                  <td className="px-4 py-3 text-white/35 text-xs">{s}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Callout type="warn">
          The spending private key must never leave the client. If your product is a custodial
          wallet, generate and store it server-side with HSM-level protection. If non-custodial,
          derive it client-side and never transmit it.
        </Callout>

        <H2>The builder's mental model</H2>
        <P>
          Think of Stealth <span className="text-[#eca8d6]">Pay</span> the same way you think of
          HTTPS. You do not implement TLS, you call it. The protocol guarantees the cryptographic
          property. Your product is built on top: the UI, the business logic, the data storage, the
          user experience. The privacy guarantee is not your code's responsibility. It is the
          protocol's.
        </P>
      </>
    ),
  },

  // ── Architecture ──────────────────────────────────────────────────────────
  architecture: {
    eyebrow: "Overview",
    title: "Architecture",
    prev: { href: "/docs/usecases", label: "Use Cases" },
    next: { href: "/docs/shield", label: "Shielding tokens" },
    content: (
      <>
        <P>
          Stealth <span className="text-[#eca8d6]">Pay</span> is built from four layers that never trust each other. Each layer can be verified
          independently. The security model does not rely on any single point of trust.
        </P>
        <div className="my-8 relative border border-white/[0.08] overflow-hidden">
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Upscaled%20Image%20%2812%29-ng3RrNnsPMJ5CrtOjcPTmhHg01W11q.png"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover object-center opacity-[0.07]"
          />
          <div className="relative z-10 p-8 space-y-0">
            {[
              { layer: "L4: App", desc: "TypeScript SDK. Runs in your browser. Your keys never leave your device." },
              { layer: "L3: Prover", desc: "Nargo + Barretenberg CLI. Proof generation is local. Nothing is sent to a server." },
              { layer: "L2: Contracts", desc: "PrivacyPool (UUPS proxy) + UltraHonk verifiers. Logic is immutable once deployed." },
              { layer: "L1: Chain", desc: "0G Galileo testnet. Sub-second finality, near-zero gas, EVM-compatible." },
            ].map((l, i) => (
              <div key={l.layer} className="flex items-start gap-5 py-5 border-b border-white/[0.05] last:border-0">
                <span className="shrink-0 w-6 h-6 flex items-center justify-center text-xs font-mono text-white/25 border border-white/[0.08] mt-0.5">{i + 1}</span>
                <div>
                  <span className="font-mono text-sm text-[#eca8d6]">{l.layer}</span>
                  <p className="text-sm text-white/45 mt-1">{l.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <H3>Trust model</H3>
        <P>
          The only trust assumption is that the ZK proof system (UltraHonk / Barretenberg) is sound, i.e., false proofs cannot be constructed. No admin key, oracle, or relayer is required at runtime.
          The contract owner can pause the pool and whitelist tokens, but cannot access user funds.
        </P>
      </>
    ),
  },

  // ── Shield ────────────────────────────────────────────────────────────────
  shield: {
    eyebrow: "How it works",
    title: "Shielding tokens",
    prev: { href: "/docs/architecture", label: "Architecture" },
    next: { href: "/docs/transfer", label: "Private transfers" },
    content: (
      <>
        <P>
          Shielding moves ERC-20 tokens from your wallet into the privacy pool. The contract takes
          custody of the tokens; you receive a private <em>note</em>, a commitment only you can spend.
        </P>
        <div className="my-8 flex justify-center p-6 border border-white/[0.08] bg-black/30">
          <ShieldFlowDiagram />
        </div>
        <H3>Step by step</H3>
        <ol className="space-y-3 my-6">
          {[
            "SDK computes commitment = Poseidon2(spendingPubkey, token, amount, salt).",
            "SDK generates a ZK proof that the commitment is honestly computed.",
            "SDK calls approve() on the token contract, then shield(params, proof) on PrivacyPool.",
            "Contract verifies the proof via ShieldVerifier, inserts the commitment into the Merkle tree, and transfers tokens in.",
            "A Shielded event is emitted. NoteManager picks it up and adds the note to your local tree.",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-white/55">
              <span className="shrink-0 w-5 h-5 flex items-center justify-center border border-[#eca8d6]/25 text-[#eca8d6]/70 text-xs mt-0.5 font-mono">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <H3>Circuit public inputs</H3>
        <P>The shield circuit has one public output: the commitment hash. Everything else is private.</P>
        <Code lang="noir">{`// Private inputs (never revealed)
spending_pubkey: Field
token:           Field  // address as field
amount:          Field
salt:            Field  // random 32-byte value

// Public output
commitment = poseidon2_hash4(spending_pubkey, token, amount, salt)`}</Code>
        <Callout type="tip">
          The salt is generated randomly by the SDK. It ensures two shields of the same amount
          produce different commitments, preventing correlation.
        </Callout>
      </>
    ),
  },

  // ── Transfer ──────────────────────────────────────────────────────────────
  transfer: {
    eyebrow: "How it works",
    title: "Private transfers",
    prev: { href: "/docs/shield", label: "Shielding tokens" },
    next: { href: "/docs/unshield", label: "Unshielding" },
    content: (
      <>
        <P>
          Inside the pool, you can transfer value to any other user via their spending pubkey.
          No on-chain data links sender to recipient. The spend circuit enforces conservation of value.
        </P>
        <div className="my-8 flex justify-center p-6 border border-white/[0.08] bg-black/30">
          <SpendFlowDiagram />
        </div>
        <H3>2-in / 2-out note model</H3>
        <P>
          Every spend takes exactly two input notes and produces exactly two output notes: one for the
          recipient and one as change back to the sender. If you only need one input, the circuit accepts
          a dummy zero note. If no change is needed, the change note carries zero value.
        </P>
        <Callout type="info">
          The spend circuit never reveals which notes are consumed. It only proves membership in
          the Merkle tree and that input value equals output value.
        </Callout>
        <H3>What gets recorded on-chain</H3>
        <ul className="space-y-2 my-4">
          {[
            "Two nullifiers (proving the input notes are consumed).",
            "Two new commitments (the output notes).",
            "The Merkle root used for the membership proof.",
            "No token address, amount, sender address, or recipient address.",
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-white/55">
              <span className="shrink-0 text-[#eca8d6]/50 mt-1">·</span>
              {item}
            </li>
          ))}
        </ul>
      </>
    ),
  },

  // ── Unshield ──────────────────────────────────────────────────────────────
  unshield: {
    eyebrow: "How it works",
    title: "Unshielding",
    prev: { href: "/docs/transfer", label: "Private transfers" },
    next: { href: "/docs/merkle", label: "Merkle note system" },
    content: (
      <>
        <P>
          Unshielding is a spend where one of the output notes is replaced by a public withdrawal.
          You specify a recipient address; the contract releases the tokens to that address. The
          nullifier is recorded on-chain, preventing double-spend.
        </P>
        <H3>Privacy guarantee</H3>
        <P>
          No on-chain data links the original deposit (shield transaction) to the withdrawal.
          The observable facts are: some tokens left the pool, a nullifier was consumed, and
          tokens arrived at a recipient address. That is all.
        </P>
        <Code>{`await sdk.unshield(
  "0xA0b8...eB48",   // ERC-20 token address
  500_000n,           // amount in base units (e.g. 0.5 USDC with 6 decimals)
  "0xRecipient..."   // any Ethereum address
);`}</Code>
        <Callout type="warn">
          The recipient address you supply is public. If you withdraw to an address tied to your
          real-world identity, that identity can be linked to the withdrawal (but not to the original deposit).
        </Callout>
      </>
    ),
  },

  // ── Merkle ────────────────────────────────────────────────────────────────
  merkle: {
    eyebrow: "How it works",
    title: "Merkle note system",
    prev: { href: "/docs/unshield", label: "Unshielding" },
    next: { href: "/docs/sdk-install", label: "Installation" },
    content: (
      <>
        <P>
          All commitments are stored in a depth-20 Poseidon2 Merkle tree on-chain. The tree supports
          up to 2²⁰ (≈ 1 million) commitments. The SDK mirrors this tree locally so you can generate
          membership proofs without a server.
        </P>
        <div className="my-8 flex justify-center p-6 border border-white/[0.08] bg-black/30">
          <MerkleTreeDiagram />
        </div>
        <H3>Local mirroring</H3>
        <P>
          The <code className="font-mono text-[#eca8d6]">NoteManager</code> class replays{" "}
          <code className="font-mono text-white/60">Shielded</code> and{" "}
          <code className="font-mono text-white/60">Spent</code> events from the contract, rebuilding
          the local tree leaf by leaf. After every insertion, it recomputes the sibling paths for all
          owned notes so they always have valid membership proofs.
        </P>
        <H3>Zero values</H3>
        <P>
          Empty positions in the tree use a pre-computed zeros chain:
          zeros[0] = 0, zeros[i] = Poseidon2(zeros[i-1], zeros[i-1]).
          This mirrors the Solidity implementation exactly, ensuring local and on-chain roots always match.
        </P>
        <Code>{`// Access the local tree via noteManager
const root     = sdk.noteManager.getCurrentRoot();
const notes    = sdk.noteManager.getUnspentNotes(tokenAddress);
const siblings = notes[0].siblings; // 20 sibling hashes for this note`}</Code>
      </>
    ),
  },

  // ── SDK Install ───────────────────────────────────────────────────────────
  "sdk-install": {
    eyebrow: "SDK Reference",
    title: "Installation",
    prev: { href: "/docs/merkle", label: "Merkle note system" },
    next: { href: "/docs/sdk-init", label: "Initialization" },
    content: (
      <>
        <P>The SDK is a Node.js / browser-compatible TypeScript package. It requires Node 18+.</P>
        <Code lang="bash">{`npm install stealthpay-sdk`}</Code>
        <H3>Noir toolchain</H3>
        <P>
          Proof generation requires the Noir compiler (<code className="font-mono text-white/60">nargo</code>) and
          the Barretenberg prover (<code className="font-mono text-white/60">bb</code>).
        </P>
        <Code lang="bash">{`# Install nargo (Noir compiler)
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
noirup

# Install bb (Barretenberg prover)
bbup`}</Code>
        <Callout type="info">
          Proofs are generated locally using the CLI tools above. No data is sent to any remote server during proof generation.
        </Callout>
        <H3>Peer dependencies</H3>
        <Code lang="bash">{`npm install ethers@^6`}</Code>
      </>
    ),
  },

  // ── SDK Init ──────────────────────────────────────────────────────────────
  "sdk-init": {
    eyebrow: "SDK Reference",
    title: "Initialization",
    prev: { href: "/docs/sdk-install", label: "Installation" },
    next: { href: "/docs/sdk-shield", label: "sdk.shield()" },
    content: (
      <>
        <Code>{`import { StealthPaySDK } from "stealthpay-sdk";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://evmrpc-testnet.0g.ai");
const signer   = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

const sdk = new StealthPaySDK({
  signer,
  privacyPoolAddress: "0x87fECd1AfA436490e3230C8B0B5aD49dcC1283F1",
  spendingPrivkey: mySpendingPrivkey, // bigint, kept locally

  // Optional: enable 0G Storage hint layer so privateSend() auto-posts
  // encrypted notes and sync() auto-discovers received notes.
  zeroGStorage: {
    indexerRpc: "https://indexer-storage-testnet-standard.0g.ai",
  },
});

// Sync Merkle tree + scan 0G Storage for received note hints
await sdk.sync(provider);`}</Code>
        <H3>Constructor options</H3>
        <div className="border border-white/[0.08] overflow-x-auto my-6">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <th className="text-left px-4 py-3 text-white/30 font-normal">Option</th>
                <th className="text-left px-4 py-3 text-white/30 font-normal">Type</th>
                <th className="text-left px-4 py-3 text-white/30 font-normal">Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["signer", "Signer", "ethers v6 Signer for sending transactions"],
                ["privacyPoolAddress", "string", "Proxy contract address"],
                ["spendingPrivkey", "bigint", "Your 32-byte spending key (never transmitted)"],
                ["zeroGStorage", "object (optional)", "Enable 0G Storage hint layer for auto note discovery"],
                ["confirmTimeoutMs", "number (optional)", "Tx confirmation timeout in ms. Default 120 000"],
              ].map(([opt, type, desc]) => (
                <tr key={opt} className="border-b border-white/[0.05] last:border-0">
                  <td className="px-4 py-3 text-[#eca8d6]/75">{opt}</td>
                  <td className="px-4 py-3 text-white/40">{type}</td>
                  <td className="px-4 py-3 text-white/40">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout type="warn">
          <code className="font-mono">spendingPrivkey</code> is a local secret. Do not log it, store it
          unencrypted, or pass it to any external service.
        </Callout>
      </>
    ),
  },

  // ── SDK shield() ─────────────────────────────────────────────────────────
  "sdk-shield": {
    eyebrow: "SDK Reference",
    title: "sdk.shield()",
    prev: { href: "/docs/sdk-init", label: "Initialization" },
    next: { href: "/docs/sdk-send", label: "sdk.privateSend()" },
    content: (
      <>
        <Code>{`const { commitment, txHash } = await sdk.shield(
  tokenAddress,   // string (ERC-20 contract address)
  amount          // bigint (amount in base units)
);`}</Code>
        <H3>What happens</H3>
        <ol className="space-y-2 my-4">
          {[
            "Derives your spending pubkey from the privkey.",
            "Generates a random salt and computes the commitment hash.",
            "Runs the shield circuit locally to generate a ZK proof.",
            "Calls approve() on the token, then shield() on the pool.",
            "Waits for the Shielded event and adds the note to NoteManager.",
          ].map((s, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-white/55">
              <span className="shrink-0 w-5 h-5 flex items-center justify-center border border-white/[0.1] text-white/25 text-xs mt-0.5 font-mono">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        <H3>Return value</H3>
        <Code>{`{
  commitment: bigint  // the commitment hash (leaf in the Merkle tree)
  txHash:     string  // on-chain transaction hash
}`}</Code>
      </>
    ),
  },

  // ── SDK privateSend() ─────────────────────────────────────────────────────
  "sdk-send": {
    eyebrow: "SDK Reference",
    title: "sdk.privateSend()",
    prev: { href: "/docs/sdk-shield", label: "sdk.shield()" },
    next: { href: "/docs/sdk-unshield", label: "sdk.unshield()" },
    content: (
      <>
        <Code>{`await sdk.privateSend(
  tokenAddress,        // string
  amount,              // bigint
  receiverPubkey       // bigint (recipient's spending pubkey)
);`}</Code>
        <P>
          Selects up to two unspent notes from NoteManager, generates a spend proof, and submits the
          transaction. Two new commitments are inserted on-chain: one for the recipient, one as change.
          No tokens move; no on-chain data links sender to recipient.
        </P>
        <P>
          If <code className="font-mono text-white/60">zeroGStorage</code> is configured, the SDK automatically
          encrypts the recipient's note hint (<code className="font-mono text-white/60">{`{ amount, salt, commitment }`}</code>)
          and uploads it to 0G Storage after the spend confirms. The recipient's next <code className="font-mono text-white/60">sync()</code> call
          discovers and decrypts it, no manual communication needed.
        </P>
        <Callout type="info">
          The recipient must share their <strong>spending pubkey</strong> with you once (e.g. via a QR code or
          a message). All future sends to that pubkey are then fully automatic via 0G Storage hints.
        </Callout>
        <H3>Deriving a spending pubkey</H3>
        <Code>{`import { deriveSpendingPubkey } from "stealthpay-sdk";

const pubkey = deriveSpendingPubkey(spendingPrivkey); // bigint → bigint`}</Code>
      </>
    ),
  },

  // ── SDK unshield() ────────────────────────────────────────────────────────
  "sdk-unshield": {
    eyebrow: "SDK Reference",
    title: "sdk.unshield()",
    prev: { href: "/docs/sdk-send", label: "sdk.privateSend()" },
    next: { href: "/docs/sdk-sync", label: "sdk.sync()" },
    content: (
      <>
        <Code>{`await sdk.unshield(
  tokenAddress,   // string
  amount,         // bigint
  recipient       // string (any Ethereum address)
);`}</Code>
        <P>
          Proves ownership of a note and withdraws tokens to <code className="font-mono text-white/60">recipient</code>.
          The nullifier is marked spent on-chain. The recipient address is visible on-chain but has no
          cryptographic connection to the original deposit.
        </P>
        <Callout type="warn">
          The recipient address is public. Use a fresh address if you want to minimize correlation.
        </Callout>
      </>
    ),
  },

  // ── SDK sync() ────────────────────────────────────────────────────────────
  "sdk-sync": {
    eyebrow: "SDK Reference",
    title: "sdk.sync()",
    prev: { href: "/docs/sdk-unshield", label: "sdk.unshield()" },
    next: { href: "/docs/contracts-overview", label: "Contracts overview" },
    content: (
      <>
        <Code>{`// Replay all past events and subscribe to new ones
await sdk.sync(provider, fromBlock?);

// Access NoteManager directly
const notes = sdk.noteManager.getUnspentNotes(tokenAddress);
const root  = sdk.noteManager.getCurrentRoot();
const spent = sdk.noteManager.isNullifierSpent(nullifier);`}</Code>
        <P>
          Replays all <code className="font-mono text-white/60">Shielded</code> and{" "}
          <code className="font-mono text-white/60">Spent</code> events to rebuild the local Merkle tree.
          After the historical replay, the SDK subscribes to new events in real time.
        </P>
        <P>
          Call once at startup. Subsequent shielding/spending operations automatically update the local tree.
        </P>
        <H3>Optional fromBlock</H3>
        <P>
          Pass a block number to skip re-processing older events. Useful if you persist the tree locally
          and only need to catch up on recent changes.
        </P>
      </>
    ),
  },

  // ── Contracts overview ────────────────────────────────────────────────────
  "contracts-overview": {
    eyebrow: "Contracts",
    title: "Overview",
    prev: { href: "/docs/sdk-sync", label: "sdk.sync()" },
    next: { href: "/docs/contracts-privacy-pool", label: "PrivacyPool" },
    content: (
      <>
        <P>
          Stealth <span className="text-[#eca8d6]">Pay</span> consists of three deployed contracts: a <strong className="text-white/75">PrivacyPool</strong>{" "}
          (upgradeable UUPS proxy), a <strong className="text-white/75">ShieldVerifier</strong>, and a{" "}
          <strong className="text-white/75">SpendVerifier</strong>. The verifiers are generated from compiled
          UltraHonk circuits by Barretenberg and are not upgradeable.
        </P>
        <div className="my-8 grid gap-4">
          {[
            { name: "PrivacyPool", desc: "Core logic: token custody, Merkle tree, nullifier registry. UUPS upgradeable.", link: "/docs/contracts-privacy-pool" },
            { name: "ShieldVerifier", desc: "Verifies ZK proofs for the shield circuit. Immutable.", link: "/docs/contracts-verifiers" },
            { name: "SpendVerifier", desc: "Verifies ZK proofs for the spend circuit. Immutable.", link: "/docs/contracts-verifiers" },
          ].map((c) => (
            <Link key={c.name} href={c.link} className="flex items-start gap-4 p-5 border border-white/[0.07] hover:border-white/20 transition-colors group">
              <div>
                <p className="font-mono text-sm text-[#eca8d6]/80 mb-1">{c.name}</p>
                <p className="text-sm text-white/45">{c.desc}</p>
              </div>
              <span className="ml-auto text-white/20 group-hover:text-white/45 transition-colors mt-1">→</span>
            </Link>
          ))}
        </div>
      </>
    ),
  },

  // ── Contracts PrivacyPool ─────────────────────────────────────────────────
  "contracts-privacy-pool": {
    eyebrow: "Contracts",
    title: "PrivacyPool",
    prev: { href: "/docs/contracts-overview", label: "Overview" },
    next: { href: "/docs/contracts-verifiers", label: "Verifiers" },
    content: (
      <>
        <H3>Core functions</H3>
        <Code lang="solidity">{`function shield(ShieldParams calldata params, bytes calldata proof) external;
function spend(SpendParams calldata params, bytes calldata proof) external;

// Owner only
function whitelistToken(address token, bool allowed) external;
function pause() external;
function unpause() external;`}</Code>
        <H3>ShieldParams</H3>
        <Code lang="solidity">{`struct ShieldParams {
  address token;
  uint256 amount;
  bytes32 commitment;
}`}</Code>
        <H3>SpendParams</H3>
        <Code lang="solidity">{`struct SpendParams {
  address   token;
  bytes32   merkleRoot;
  bytes32[2] nullifiers;
  bytes32[2] newCommitments;
  uint256   amount;
  address   recipient;   // address(0) for private transfers
}`}</Code>
        <H3>Events</H3>
        <Code lang="solidity">{`event Shielded(address indexed token, bytes32 commitment, uint256 leafIndex, uint256 amount);
event Spent(bytes32[2] nullifiers, bytes32[2] newCommitments, address recipient);`}</Code>
        <Callout type="info">
          When <code className="font-mono">recipient</code> is <code className="font-mono">address(0)</code>,
          the spend is a private transfer. No tokens leave the pool; two new commitments are inserted instead.
        </Callout>
      </>
    ),
  },

  // ── Contracts Verifiers ───────────────────────────────────────────────────
  "contracts-verifiers": {
    eyebrow: "Contracts",
    title: "Verifiers",
    prev: { href: "/docs/contracts-privacy-pool", label: "PrivacyPool" },
    next: { href: "/docs/contracts-deployments", label: "Deployments" },
    content: (
      <>
        <P>
          Verifier contracts are auto-generated by Barretenberg from compiled circuits. They expose
          a single function and have no state.
        </P>
        <Code lang="solidity">{`function verify(
  bytes calldata proof,
  bytes32[] calldata publicInputs
) external view returns (bool);`}</Code>
        <H3>ShieldVerifier public inputs</H3>
        <P>9 inputs: 8 aggregation object zeros followed by the commitment hash.</P>
        <Code lang="solidity">{`bytes32[9] memory inputs;
// inputs[0..7] = 0  (aggregation object)
inputs[8] = bytes32(commitment);`}</Code>
        <H3>SpendVerifier public inputs</H3>
        <P>16 inputs: 8 aggregation zeros, then token, merkleRoot, nullifiers[0], nullifiers[1], newCommitments[0], newCommitments[1], amount, recipient.</P>
        <Code lang="solidity">{`bytes32[16] memory inputs;
// inputs[0..7]  = 0  (aggregation object)
inputs[8]  = bytes32(uint256(uint160(token)));
inputs[9]  = merkleRoot;
inputs[10] = nullifiers[0];
inputs[11] = nullifiers[1];
inputs[12] = newCommitments[0];
inputs[13] = newCommitments[1];
inputs[14] = bytes32(amount);
inputs[15] = bytes32(uint256(uint160(recipient)));`}</Code>
      </>
    ),
  },

  // ── Contracts Deployments ─────────────────────────────────────────────────
  "contracts-deployments": {
    eyebrow: "Contracts",
    title: "Deployments",
    prev: { href: "/docs/contracts-verifiers", label: "Verifiers" },
    next: { href: "/docs/circuits-shield", label: "Shield circuit" },
    content: (
      <>
        <P>All contracts deployed on 0G Galileo testnet, chain ID 16602.</P>
        <div className="my-6 border border-white/[0.08] overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <th className="text-left px-5 py-3 text-white/30 font-normal">Contract</th>
                <th className="text-left px-5 py-3 text-white/30 font-normal">Address</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((d) => (
                <tr key={d.name} className="border-b border-white/[0.05] last:border-0">
                  <td className="px-5 py-3 text-[#eca8d6]/75">{d.name}</td>
                  <td className="px-5 py-3 text-white/45 break-all">{d.address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout type="tip">
          Pass the <strong>PrivacyPoolProxy</strong> address to <code className="font-mono">StealthPaySDK</code>.
          The implementation address is for verification only.
        </Callout>
        <H3>Network details</H3>
        <Code lang="json">{`{
  "network":  "0G Galileo Testnet",
  "chainId":  16602,
  "rpc":      "https://evmrpc-testnet.0g.ai",
  "explorer": "https://chainscan-galileo.0g.ai"
}`}</Code>
      </>
    ),
  },

  // ── Circuits Shield ───────────────────────────────────────────────────────
  "circuits-shield": {
    eyebrow: "Circuits",
    title: "Shield circuit",
    prev: { href: "/docs/contracts-deployments", label: "Deployments" },
    next: { href: "/docs/circuits-spend", label: "Spend circuit" },
    content: (
      <>
        <P>
          Written in Noir. Proves that a commitment is honestly computed from your spending key,
          token, amount, and salt, without revealing any of those values.
        </P>
        <Code lang="noir">{`// Private inputs (never revealed on-chain)
struct ShieldInputs {
  spending_pubkey: Field,
  token:           Field,
  amount:          Field,
  salt:            Field,
}

// Constraint: commitment is correctly derived
assert(commitment == poseidon2_hash4(
  spending_pubkey, token, amount, salt
));`}</Code>
        <P>
          The proof is verified by <code className="font-mono text-white/60">ShieldVerifier</code> on-chain.
          Only the commitment is public. It reveals nothing about the depositor.
        </P>
        <H3>Compiling</H3>
        <Code lang="bash">{`cd circuits/shield
nargo compile           # generates target/shield.json
bb write_vk -b target/shield.json -o target/vk
bb contract -k target/vk -o ../../contracts/contracts/ShieldVerifier.sol`}</Code>
      </>
    ),
  },

  // ── Circuits Spend ────────────────────────────────────────────────────────
  "circuits-spend": {
    eyebrow: "Circuits",
    title: "Spend circuit",
    prev: { href: "/docs/circuits-shield", label: "Shield circuit" },
    next: { href: "/docs/circuits-poseidon", label: "Poseidon2 hash" },
    content: (
      <>
        <P>
          The most complex circuit. Proves five things simultaneously, all in zero knowledge:
        </P>
        <ol className="space-y-3 my-6">
          {[
            "Both input notes belong to the caller: the spending key matches both commitments.",
            "Both input commitments are members of the current Merkle tree (membership proof).",
            "Nullifiers are correctly derived: nullifier = Poseidon2(privkey, commitment).",
            "Output commitments are correctly formed for the specified recipients.",
            "Conservation of value: sum(inputs) == sum(outputs).",
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-white/55">
              <span className="shrink-0 w-5 h-5 flex items-center justify-center border border-[#eca8d6]/20 text-[#eca8d6]/65 text-xs mt-0.5 font-mono">{i + 1}</span>
              {item}
            </li>
          ))}
        </ol>
        <H3>Public inputs</H3>
        <Code>{`token:            Field  // ERC-20 address as field
merkleRoot:       Field  // current on-chain root
nullifiers[2]:    Field  // consumed input notes
newCommitments[2]:Field  // output notes
amount:           Field  // total output to recipient
recipient:        Field  // address(0) for private transfers`}</Code>
      </>
    ),
  },

  // ── Circuits Poseidon ─────────────────────────────────────────────────────
  "circuits-poseidon": {
    eyebrow: "Circuits",
    title: "Poseidon2 hash",
    prev: { href: "/docs/circuits-spend", label: "Spend circuit" },
    next: undefined,
    content: (
      <>
        <P>
          All hashing in Stealth <span className="text-[#eca8d6]">Pay</span> uses Poseidon2 over BN254, covering commitments, nullifiers, and Merkle
          nodes. It is ZK-friendly (cheap to prove in a circuit) and algebraically native to the
          BN254 field used by UltraHonk.
        </P>
        <H3>Sponge construction</H3>
        <Code>{`// hash2: 2-input domain-separated hash
function hash2(a: bigint, b: bigint): bigint {
  const iv = mod(2n * TWO_POW_64);  // capacity = 2·2^64
  let state = [a, b, 0n, iv];
  state = permute(state);
  return state[0];
}

// hash4: used for commitments
function hash4(a: bigint, b: bigint, c: bigint, d: bigint): bigint {
  const iv = mod(4n * TWO_POW_64);  // capacity = 4·2^64
  let state = [a, b, c, iv];
  state = permute(state);
  state[0] = mod(state[0] + d);
  state = permute(state);
  return state[0];
}`}</Code>
        <H3>Usage in Stealth <span className="text-[#eca8d6]">Pay</span></H3>
        <div className="border border-white/[0.08] overflow-x-auto my-6">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <th className="text-left px-4 py-3 text-white/30 font-normal">Purpose</th>
                <th className="text-left px-4 py-3 text-white/30 font-normal">Call</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Commitment", "hash4(pubkey, token, amount, salt)"],
                ["Nullifier",  "hash2(privkey, commitment)"],
                ["Merkle node", "hash2(left, right)"],
                ["Spending pubkey", "hash2(privkey, privkey)"],
              ].map(([p, c]) => (
                <tr key={p} className="border-b border-white/[0.05] last:border-0">
                  <td className="px-4 py-3 text-white/45">{p}</td>
                  <td className="px-4 py-3 text-[#eca8d6]/70">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout type="tip">
          The TypeScript SDK uses <code className="font-mono">@zkpassport/poseidon2</code> which passes the
          official Barretenberg test vector:{" "}
          <code className="font-mono text-white/60">permute([0,1,2,3])[0] === 0x01bd538c...01737</code>.
        </Callout>
      </>
    ),
  },
};

// ── Route handler ─────────────────────────────────────────────────────────────

export default async function DocsSectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = pages[slug];
  if (!page) return notFound();

  return (
    <>
      <div className="mb-2">
        <span className="text-xs font-mono text-white/25 uppercase tracking-widest">{page.eyebrow}</span>
      </div>
      <h1 className="text-4xl lg:text-[48px] font-display tracking-tight leading-[0.92] mb-8 text-white">
        {page.title}
      </h1>
      {page.content}
      <PageFooter prev={page.prev} next={page.next} />
    </>
  );
}

export function generateStaticParams() {
  return Object.keys(pages).map((slug) => ({ slug }));
}
