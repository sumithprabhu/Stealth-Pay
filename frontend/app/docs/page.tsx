"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Sidebar nav tree
// ---------------------------------------------------------------------------
const sections = [
  {
    group: "Overview",
    items: [
      { id: "intro", label: "What is StealthPay?" },
      { id: "architecture", label: "Architecture" },
    ],
  },
  {
    group: "How It Works",
    items: [
      { id: "shield", label: "Shielding tokens" },
      { id: "transfer", label: "Private transfers" },
      { id: "unshield", label: "Unshielding" },
      { id: "merkle", label: "Merkle note system" },
    ],
  },
  {
    group: "SDK Reference",
    items: [
      { id: "sdk-install", label: "Installation" },
      { id: "sdk-init", label: "Initialization" },
      { id: "sdk-shield", label: "sdk.shield()" },
      { id: "sdk-send", label: "sdk.privateSend()" },
      { id: "sdk-unshield", label: "sdk.unshield()" },
      { id: "sdk-sync", label: "sdk.sync()" },
    ],
  },
  {
    group: "Contracts",
    items: [
      { id: "contracts-overview", label: "Overview" },
      { id: "contracts-privacy-pool", label: "PrivacyPool" },
      { id: "contracts-verifiers", label: "Verifiers" },
      { id: "contracts-deployments", label: "Deployments" },
    ],
  },
  {
    group: "Circuits",
    items: [
      { id: "circuits-shield", label: "Shield circuit" },
      { id: "circuits-spend", label: "Spend circuit" },
      { id: "circuits-poseidon", label: "Poseidon2 hash" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Inline SVG diagrams
// ---------------------------------------------------------------------------

function ShieldFlowDiagram() {
  return (
    <svg viewBox="0 0 720 260" className="w-full max-w-2xl" aria-label="Shield flow diagram">
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="rgba(236,168,214,0.8)" />
        </marker>
      </defs>

      {/* User box */}
      <rect x="20" y="90" width="130" height="60" rx="4" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <text x="85" y="118" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="13" fontFamily="monospace">User</text>
      <text x="85" y="134" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="10" fontFamily="monospace">spending key</text>

      {/* Arrow: user → SDK */}
      <line x1="150" y1="120" x2="210" y2="120" stroke="rgba(236,168,214,0.6)" strokeWidth="1.5" markerEnd="url(#arrow)" />
      <text x="180" y="113" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">sdk.shield()</text>

      {/* SDK box */}
      <rect x="210" y="80" width="150" height="80" rx="4" fill="none" stroke="rgba(236,168,214,0.3)" strokeWidth="1" />
      <text x="285" y="112" textAnchor="middle" fill="rgba(236,168,214,0.9)" fontSize="13" fontFamily="monospace">SDK</text>
      <text x="285" y="128" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="9.5" fontFamily="monospace">generate ZK proof</text>
      <text x="285" y="143" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="9.5" fontFamily="monospace">compute commitment</text>

      {/* Arrow: SDK → Contract */}
      <line x1="360" y1="120" x2="420" y2="120" stroke="rgba(236,168,214,0.6)" strokeWidth="1.5" markerEnd="url(#arrow)" />
      <text x="390" y="113" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">shield(params, proof)</text>

      {/* Contract box */}
      <rect x="420" y="72" width="150" height="96" rx="4" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <text x="495" y="104" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="13" fontFamily="monospace">PrivacyPool</text>
      <text x="495" y="120" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="9.5" fontFamily="monospace">verify proof</text>
      <text x="495" y="136" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="9.5" fontFamily="monospace">insert Merkle leaf</text>
      <text x="495" y="152" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="9.5" fontFamily="monospace">take custody of tokens</text>

      {/* Arrow: Contract → Chain */}
      <line x1="570" y1="120" x2="630" y2="120" stroke="rgba(236,168,214,0.6)" strokeWidth="1.5" markerEnd="url(#arrow)" />

      {/* Chain box */}
      <rect x="630" y="90" width="70" height="60" rx="4" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <text x="665" y="118" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="12" fontFamily="monospace">0G</text>
      <text x="665" y="133" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">Chain</text>

      {/* Labels */}
      <text x="360" y="230" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="10" fontFamily="monospace">
        Commitment stored on-chain · token custody held by contract · ZK proof verified by verifier contract
      </text>
    </svg>
  );
}

function MerkleTreeDiagram() {
  const leaves = ["C₀", "C₁", "C₂", "C₃"];
  const l2 = ["H(C₀,C₁)", "H(C₂,C₃)"];
  const root = "Root";

  return (
    <svg viewBox="0 0 480 220" className="w-full max-w-lg" aria-label="Merkle tree diagram">
      {/* Leaves */}
      {leaves.map((l, i) => (
        <g key={l}>
          <rect x={30 + i * 108} y="160" width="80" height="36" rx="3" fill="none" stroke="rgba(236,168,214,0.35)" strokeWidth="1" />
          <text x={70 + i * 108} y="183" textAnchor="middle" fill="rgba(236,168,214,0.8)" fontSize="11" fontFamily="monospace">{l}</text>
        </g>
      ))}
      {/* L2 nodes */}
      {l2.map((n, i) => (
        <g key={n}>
          <rect x={84 + i * 216} y="90" width="112" height="36" rx="3" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <text x={140 + i * 216} y="113" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="10" fontFamily="monospace">{n}</text>
          {/* lines to leaves */}
          <line x1={140 + i * 216} y1="126" x2={70 + i * 216} y2="160" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <line x1={140 + i * 216} y1="126" x2={178 + i * 216} y2="160" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        </g>
      ))}
      {/* Root */}
      <rect x="176" y="20" width="128" height="36" rx="3" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
      <text x="240" y="43" textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize="12" fontFamily="monospace">{root}</text>
      <line x1="240" y1="56" x2="140" y2="90" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <line x1="240" y1="56" x2="356" y2="90" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

      <text x="240" y="210" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="9" fontFamily="monospace">Depth 20 · up to 2²⁰ commitments · Poseidon2 hash</text>
    </svg>
  );
}

function SpendFlowDiagram() {
  return (
    <svg viewBox="0 0 700 200" className="w-full max-w-2xl" aria-label="Spend flow diagram">
      <defs>
        <marker id="arrow2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="rgba(236,168,214,0.8)" />
        </marker>
      </defs>

      {/* Input notes */}
      <rect x="10" y="40" width="100" height="40" rx="3" fill="none" stroke="rgba(236,168,214,0.3)" strokeWidth="1" />
      <text x="60" y="62" textAnchor="middle" fill="rgba(236,168,214,0.7)" fontSize="10" fontFamily="monospace">Note A (input)</text>
      <rect x="10" y="100" width="100" height="40" rx="3" fill="none" stroke="rgba(236,168,214,0.3)" strokeWidth="1" />
      <text x="60" y="122" textAnchor="middle" fill="rgba(236,168,214,0.7)" fontSize="10" fontFamily="monospace">Note B (input)</text>

      {/* Arrow → circuit */}
      <line x1="110" y1="80" x2="165" y2="100" stroke="rgba(255,255,255,0.15)" strokeWidth="1" markerEnd="url(#arrow2)" />
      <line x1="110" y1="120" x2="165" y2="100" stroke="rgba(255,255,255,0.15)" strokeWidth="1" markerEnd="url(#arrow2)" />

      {/* Circuit */}
      <rect x="165" y="62" width="130" height="76" rx="4" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      <text x="230" y="92" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="12" fontFamily="monospace">Spend circuit</text>
      <text x="230" y="108" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">verify membership</text>
      <text x="230" y="122" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">conserve value</text>

      {/* Arrow → contract */}
      <line x1="295" y1="100" x2="355" y2="100" stroke="rgba(236,168,214,0.6)" strokeWidth="1.5" markerEnd="url(#arrow2)" />

      {/* Contract */}
      <rect x="355" y="62" width="130" height="76" rx="4" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <text x="420" y="92" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="12" fontFamily="monospace">PrivacyPool</text>
      <text x="420" y="108" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">mark nullifiers spent</text>
      <text x="420" y="122" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">insert output notes</text>

      {/* Arrow → outputs */}
      <line x1="485" y1="86" x2="540" y2="60" stroke="rgba(255,255,255,0.15)" strokeWidth="1" markerEnd="url(#arrow2)" />
      <line x1="485" y1="114" x2="540" y2="140" stroke="rgba(255,255,255,0.15)" strokeWidth="1" markerEnd="url(#arrow2)" />

      {/* Output notes */}
      <rect x="540" y="40" width="110" height="40" rx="3" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <text x="595" y="62" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="10" fontFamily="monospace">Note C (recipient)</text>
      <rect x="540" y="100" width="110" height="40" rx="3" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <text x="595" y="122" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="10" fontFamily="monospace">Note D (change)</text>

      <text x="350" y="185" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="9" fontFamily="monospace">
        Input nullifiers consumed · no on-chain link between sender and recipient
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Code block component
// ---------------------------------------------------------------------------
function Code({ children, lang = "typescript" }: { children: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(children.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group my-6 border border-white/10 bg-black/60">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10">
        <div className="w-2 h-2 rounded-full bg-red-500/50" />
        <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
        <div className="w-2 h-2 rounded-full bg-green-500/50" />
        <span className="ml-2 text-xs font-mono text-white/30">{lang}</span>
        <button
          onClick={copy}
          className="ml-auto text-xs font-mono text-white/30 hover:text-white/70 transition-colors"
        >
          {copied ? "copied!" : "copy"}
        </button>
      </div>
      <pre className="p-5 text-sm font-mono text-white/70 overflow-x-auto leading-relaxed whitespace-pre">
        {children.trim()}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Callout
// ---------------------------------------------------------------------------
function Callout({ type = "info", children }: { type?: "info" | "warn" | "tip"; children: React.ReactNode }) {
  const styles = {
    info: "border-blue-500/30 bg-blue-500/5 text-blue-300/80",
    warn: "border-yellow-500/30 bg-yellow-500/5 text-yellow-300/80",
    tip:  "border-[#eca8d6]/30 bg-[#eca8d6]/5 text-[#eca8d6]/80",
  };
  const icons = { info: "ℹ", warn: "⚠", tip: "✦" };
  return (
    <div className={`flex gap-3 p-4 border my-6 text-sm leading-relaxed ${styles[type]}`}>
      <span className="shrink-0 mt-0.5">{icons[type]}</span>
      <div>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section heading
// ---------------------------------------------------------------------------
function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-3xl font-display tracking-tight mt-16 mb-6 text-white">{children}</h2>
  );
}
function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xl font-medium mt-10 mb-4 text-white/90">{children}</h3>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-white/60 leading-relaxed mb-4">{children}</p>;
}

// ---------------------------------------------------------------------------
// Deployments table
// ---------------------------------------------------------------------------
const deployments = [
  { name: "ShieldVerifier",   address: "0x89CD2172470C1aC071117Fe2085780DAA6e9656a" },
  { name: "SpendVerifier",    address: "0xe1E73e47CcbDB78f70A84E8757B51807E1D42386" },
  { name: "PrivacyPoolImpl",  address: "0x39A300779FdB4D021Df02a112C4289565362610a" },
  { name: "PrivacyPoolProxy", address: "0x87fECd1AfA436490e3230C8B0B5aD49dcC1283F1" },
];

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("intro");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  // Track scroll position to highlight active sidebar item
  useEffect(() => {
    const onScroll = () => {
      const allIds = sections.flatMap((s) => s.items.map((i) => i.id));
      for (let i = allIds.length - 1; i >= 0; i--) {
        const el = document.getElementById(allIds[i]);
        if (el && el.getBoundingClientRect().top <= 120) {
          setActiveSection(allIds[i]);
          break;
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); }
    setActiveSection(id);
    setMobileNavOpen(false);
  };

  return (
    <div className="min-h-screen bg-[oklch(0.06_0.01_260)] text-white">
      {/* Top nav */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[oklch(0.06_0.01_260)]/95 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-lg font-display text-white hover:text-white/80 transition-colors">
              StealthPay
            </Link>
            <span className="hidden md:block text-white/20">/</span>
            <span className="hidden md:block text-sm font-mono text-white/40">docs</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="https://github.com" className="text-sm text-white/40 hover:text-white transition-colors font-mono">
              GitHub ↗
            </a>
            <a href="/app" className="text-sm font-mono border border-white/20 px-4 py-1.5 hover:bg-white/5 transition-colors">
              Launch app →
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto flex">
        {/* Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-10 px-6 border-r border-white/10">
          <nav>
            {sections.map((group) => (
              <div key={group.group} className="mb-8">
                <p className="text-xs font-mono text-white/30 uppercase tracking-widest mb-3">{group.group}</p>
                <ul className="space-y-1">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <button
                        onClick={() => scrollTo(item.id)}
                        className={`w-full text-left text-sm px-3 py-1.5 rounded transition-colors ${
                          activeSection === item.id
                            ? "text-[#eca8d6] bg-[#eca8d6]/10"
                            : "text-white/40 hover:text-white/70"
                        }`}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main ref={mainRef} className="flex-1 min-w-0 px-6 lg:px-16 py-12 lg:py-16 max-w-[900px]">

          {/* ── INTRO ── */}
          <section id="intro" className="scroll-mt-20">
            <div className="mb-3">
              <span className="text-xs font-mono text-white/30 uppercase tracking-widest">Overview</span>
            </div>
            <h1 className="text-5xl lg:text-6xl font-display tracking-tight leading-[0.9] mb-8">
              What is StealthPay?
            </h1>

            <P>
              StealthPay is a zero-knowledge privacy protocol for ERC-20 tokens on 0G Chain. It lets users
              shield tokens into an on-chain pool, transact privately inside it, and withdraw to any address
              — with no link between deposit and withdrawal observable on-chain.
            </P>
            <P>
              Every operation is backed by an <strong className="text-white/80">UltraHonk ZK proof</strong> verified
              by an immutable smart contract. There are no relayers, no trusted parties, and no off-chain state.
              Privacy is a protocol guarantee, not a policy.
            </P>

            <div className="grid md:grid-cols-3 gap-4 my-10">
              {[
                { title: "Shield", body: "Deposit any whitelisted ERC-20. Get a private note." },
                { title: "Transfer", body: "Send tokens privately using spending pubkeys." },
                { title: "Unshield", body: "Withdraw to any address. Nullifier prevents double-spend." },
              ].map((c) => (
                <div key={c.title} className="border border-white/10 p-5">
                  <h3 className="font-medium mb-2 text-white">{c.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{c.body}</p>
                </div>
              ))}
            </div>

            <Callout type="tip">
              StealthPay is deployed on 0G Galileo testnet (chain ID 16602). The proxy address is{" "}
              <code className="font-mono text-[#eca8d6]">0x87fECd1AfA436490e3230C8B0B5aD49dcC1283F1</code>.
            </Callout>
          </section>

          {/* ── ARCHITECTURE ── */}
          <section id="architecture" className="scroll-mt-20">
            <H2>Architecture</H2>
            <P>
              StealthPay is built from four layers that never trust each other — each can be verified independently.
            </P>

            <div className="my-8 relative border border-white/10 overflow-hidden">
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Upscaled%20Image%20%2812%29-ng3RrNnsPMJ5CrtOjcPTmhHg01W11q.png"
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover object-center opacity-10"
              />
              <div className="relative z-10 p-8">
                {[
                  { layer: "L4 — App", desc: "TypeScript SDK. Your browser, your keys. No backend." },
                  { layer: "L3 — Prover", desc: "Nargo + Barretenberg CLI. Runs locally. Proofs never leave your machine." },
                  { layer: "L2 — Contracts", desc: "PrivacyPool (UUPS proxy) + UltraHonk verifiers. Immutable logic." },
                  { layer: "L1 — Chain", desc: "0G Galileo. Sub-second finality, near-zero gas." },
                ].map((l, i) => (
                  <div key={l.layer} className="flex items-start gap-6 py-4 border-b border-white/5 last:border-0">
                    <span className="shrink-0 w-6 h-6 flex items-center justify-center text-xs font-mono text-white/30 border border-white/10 mt-0.5">{i + 1}</span>
                    <div>
                      <span className="font-mono text-sm text-[#eca8d6]">{l.layer}</span>
                      <p className="text-sm text-white/50 mt-1">{l.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── SHIELD ── */}
          <section id="shield" className="scroll-mt-20">
            <div className="mt-20 mb-3">
              <span className="text-xs font-mono text-white/30 uppercase tracking-widest">How it works</span>
            </div>
            <H2>Shielding tokens</H2>
            <P>
              Shielding moves ERC-20 tokens from your wallet into the privacy pool. The contract takes custody;
              you receive a private <em>note</em> — a commitment that only you can spend.
            </P>

            <div className="my-8 flex justify-center p-6 border border-white/10 bg-black/40">
              <ShieldFlowDiagram />
            </div>

            <H3>What the circuit proves</H3>
            <P>
              The shield circuit generates a proof that: (1) the commitment is correctly computed from your
              spending pubkey, the token address, amount, and a random salt; and (2) the commitment matches
              the value deposited. No information about your identity or the exact mechanism is revealed.
            </P>
            <P>
              Public inputs: the commitment hash. Private inputs: spending pubkey, token, amount, salt.
            </P>
          </section>

          {/* ── TRANSFER ── */}
          <section id="transfer" className="scroll-mt-20">
            <H2>Private transfers</H2>
            <P>
              Inside the pool, you can transfer value to any other user via their spending pubkey.
              The spend circuit enforces conservation of value: the sum of inputs always equals the sum of outputs.
              No on-chain information links sender to recipient.
            </P>

            <div className="my-8 flex justify-center p-6 border border-white/10 bg-black/40">
              <SpendFlowDiagram />
            </div>

            <H3>2-in / 2-out note model</H3>
            <P>
              Every spend takes exactly two input notes and produces exactly two output notes — one for the
              recipient and one as change back to the sender. If you only need one input, the circuit accepts
              a dummy zero note. If you don't need change, the change note has zero value.
            </P>

            <Callout type="info">
              The spend circuit never reveals which notes are being consumed. It only proves membership in
              the Merkle tree and that value is conserved.
            </Callout>
          </section>

          {/* ── UNSHIELD ── */}
          <section id="unshield" className="scroll-mt-20">
            <H2>Unshielding</H2>
            <P>
              Unshielding is a spend where one of the output notes is replaced by a public withdrawal.
              You specify a recipient address; the contract releases the tokens to that address.
              The nullifier for the spent note is recorded on-chain, preventing double-spend.
            </P>
            <P>
              No on-chain data links the original deposit (shield) to the withdrawal. The only
              observable facts are: some tokens left the pool, and a nullifier was consumed.
            </P>
          </section>

          {/* ── MERKLE ── */}
          <section id="merkle" className="scroll-mt-20">
            <H2>Merkle note system</H2>
            <P>
              All commitments are stored in a depth-20 Poseidon2 Merkle tree on-chain. The tree supports
              up to 2²⁰ (≈ 1 million) commitments. The SDK mirrors this tree locally so you can generate
              membership proofs without relying on any server.
            </P>

            <div className="my-8 flex justify-center p-6 border border-white/10 bg-black/40">
              <MerkleTreeDiagram />
            </div>

            <H3>NoteManager</H3>
            <P>
              The <code className="font-mono text-[#eca8d6]">NoteManager</code> class replays{" "}
              <code className="font-mono text-white/70">Shielded</code> and{" "}
              <code className="font-mono text-white/70">Spent</code> events from the contract to rebuild
              the tree locally. It automatically refreshes sibling paths after every insertion, so your notes
              always have valid membership proofs.
            </P>
            <P>
              Call <code className="font-mono text-[#eca8d6]">sdk.sync(provider)</code> at startup to replay
              all past events and subscribe to new ones in real time.
            </P>
          </section>

          {/* ── SDK INSTALL ── */}
          <section id="sdk-install" className="scroll-mt-20">
            <div className="mt-20 mb-3">
              <span className="text-xs font-mono text-white/30 uppercase tracking-widest">SDK Reference</span>
            </div>
            <H2>Installation</H2>
            <Code lang="bash">{`npm install @stealthpay/sdk`}</Code>
            <P>The SDK requires Node 18+ and depends on ethers v6. Proof generation requires the Noir toolchain:</P>
            <Code lang="bash">{`# Install Noir (nargo) and Barretenberg (bb)
curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
noirup
bbup`}</Code>
          </section>

          {/* ── SDK INIT ── */}
          <section id="sdk-init" className="scroll-mt-20">
            <H2>Initialization</H2>
            <Code>{`import { StealthPaySDK } from "@stealthpay/sdk";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://evmrpc-testnet.0g.ai");
const signer   = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

const sdk = new StealthPaySDK({
  signer,
  privacyPoolAddress: "0x87fECd1AfA436490e3230C8B0B5aD49dcC1283F1",
  spendingPrivkey: mySpendingPrivkey, // bigint, kept locally
});

// Sync Merkle tree from chain events
await sdk.sync(provider);`}</Code>
            <Callout type="warn">
              <code className="font-mono">spendingPrivkey</code> is a 32-byte BigInt. It never leaves your
              machine. Do not log it or pass it to any remote service.
            </Callout>
          </section>

          {/* ── SDK SHIELD ── */}
          <section id="sdk-shield" className="scroll-mt-20">
            <H2>sdk.shield()</H2>
            <Code>{`const { commitment, txHash } = await sdk.shield(
  tokenAddress,   // string — ERC-20 contract address
  amount          // bigint — token amount in base units
);

console.log("Commitment:", commitment.toString(16));`}</Code>
            <P>
              Generates a ZK proof locally, calls <code className="font-mono text-white/70">approve</code> on
              the token contract, then submits the <code className="font-mono text-white/70">shield</code> transaction.
              Returns the commitment hash and transaction hash. The note is automatically tracked by NoteManager.
            </P>
          </section>

          {/* ── SDK SEND ── */}
          <section id="sdk-send" className="scroll-mt-20">
            <H2>sdk.privateSend()</H2>
            <Code>{`await sdk.privateSend(
  tokenAddress,        // string
  amount,              // bigint
  receiverPubkey       // bigint — recipient's spending pubkey
);`}</Code>
            <P>
              Selects up to two unspent notes from NoteManager, generates a spend proof, and submits the
              transaction. Two new commitments are inserted on-chain — one for the recipient, one as change.
              No tokens move; no on-chain link connects sender and recipient.
            </P>
          </section>

          {/* ── SDK UNSHIELD ── */}
          <section id="sdk-unshield" className="scroll-mt-20">
            <H2>sdk.unshield()</H2>
            <Code>{`await sdk.unshield(
  tokenAddress,   // string
  amount,         // bigint
  recipient       // string — any Ethereum address
);`}</Code>
            <P>
              Proves ownership of a note and withdraws tokens to <code className="font-mono text-white/70">recipient</code>.
              The nullifier is marked spent on-chain. The recipient address has no connection to the original deposit.
            </P>
          </section>

          {/* ── SDK SYNC ── */}
          <section id="sdk-sync" className="scroll-mt-20">
            <H2>sdk.sync()</H2>
            <Code>{`// One-shot historical sync
await sdk.sync(provider, fromBlock);

// Or access NoteManager directly
const notes = sdk.noteManager.getUnspentNotes(tokenAddress);
const root  = sdk.noteManager.getCurrentRoot();`}</Code>
            <P>
              Replays all <code className="font-mono text-white/70">Shielded</code> and{" "}
              <code className="font-mono text-white/70">Spent</code> events and rebuilds the local Merkle tree.
              Call once at startup; the SDK then subscribes to new events automatically.
            </P>
          </section>

          {/* ── CONTRACTS OVERVIEW ── */}
          <section id="contracts-overview" className="scroll-mt-20">
            <div className="mt-20 mb-3">
              <span className="text-xs font-mono text-white/30 uppercase tracking-widest">Contracts</span>
            </div>
            <H2>Overview</H2>
            <P>
              StealthPay consists of three contracts: a{" "}
              <strong className="text-white/80">PrivacyPool</strong> (upgradeable UUPS proxy),
              a <strong className="text-white/80">ShieldVerifier</strong>, and a{" "}
              <strong className="text-white/80">SpendVerifier</strong> — both generated from the compiled
              UltraHonk circuits by Barretenberg.
            </P>
          </section>

          {/* ── CONTRACTS PRIVACY POOL ── */}
          <section id="contracts-privacy-pool" className="scroll-mt-20">
            <H2>PrivacyPool</H2>
            <Code lang="solidity">{`// Core interface
function shield(ShieldParams calldata params, bytes calldata proof) external;
function spend(SpendParams calldata params, bytes calldata proof) external;
function whitelistToken(address token, bool allowed) external; // owner only
function pause() / unpause()                                    // owner only`}</Code>
            <H3>ShieldParams</H3>
            <Code lang="solidity">{`struct ShieldParams {
  address token;
  uint256 amount;
  bytes32 commitment;
}`}</Code>
            <H3>SpendParams</H3>
            <Code lang="solidity">{`struct SpendParams {
  address token;
  bytes32 merkleRoot;
  bytes32[2] nullifiers;
  bytes32[2] newCommitments;
  uint256 amount;
  address recipient;      // address(0) for private transfers
}`}</Code>
          </section>

          {/* ── CONTRACTS VERIFIERS ── */}
          <section id="contracts-verifiers" className="scroll-mt-20">
            <H2>Verifiers</H2>
            <P>
              Verifier contracts are auto-generated by Barretenberg from the compiled circuits. They expose
              a single function:
            </P>
            <Code lang="solidity">{`function verify(
  bytes calldata proof,
  bytes32[] calldata publicInputs
) external view returns (bool);`}</Code>
            <P>
              <strong className="text-white/80">ShieldVerifier</strong> expects 9 public inputs: 8 aggregation
              object zeros followed by the commitment hash.
            </P>
            <P>
              <strong className="text-white/80">SpendVerifier</strong> expects 16 public inputs: 8 aggregation
              object zeros, then token, merkleRoot, nullifiers[0], nullifiers[1], newCommitments[0],
              newCommitments[1], amount, recipient (as field elements).
            </P>
          </section>

          {/* ── CONTRACTS DEPLOYMENTS ── */}
          <section id="contracts-deployments" className="scroll-mt-20">
            <H2>Deployments</H2>
            <P>All contracts deployed on 0G Galileo testnet (chain ID 16602).</P>

            <div className="my-6 border border-white/10 overflow-x-auto">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-5 py-3 text-white/40 font-normal">Contract</th>
                    <th className="text-left px-5 py-3 text-white/40 font-normal">Address</th>
                  </tr>
                </thead>
                <tbody>
                  {deployments.map((d) => (
                    <tr key={d.name} className="border-b border-white/5 last:border-0">
                      <td className="px-5 py-3 text-[#eca8d6]/80">{d.name}</td>
                      <td className="px-5 py-3 text-white/50 break-all">{d.address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Callout type="info">
              The proxy address is the one you pass to <code className="font-mono">StealthPaySDK</code>.
              The implementation address is for verification purposes only.
            </Callout>
          </section>

          {/* ── CIRCUITS SHIELD ── */}
          <section id="circuits-shield" className="scroll-mt-20">
            <div className="mt-20 mb-3">
              <span className="text-xs font-mono text-white/30 uppercase tracking-widest">Circuits</span>
            </div>
            <H2>Shield circuit</H2>
            <P>
              Written in Noir. Proves that a commitment is honestly computed without revealing the inputs.
            </P>
            <Code lang="noir">{`// Private inputs
struct ShieldInputs {
  spending_pubkey: Field,
  token:           Field,
  amount:          Field,
  salt:            Field,
}

// Public output
commitment == poseidon2([pubkey, token, amount, salt])`}</Code>
            <P>
              The proof is verified by <code className="font-mono text-white/70">ShieldVerifier</code> on-chain.
              Only the commitment is public — it reveals nothing about the depositor.
            </P>
          </section>

          {/* ── CIRCUITS SPEND ── */}
          <section id="circuits-spend" className="scroll-mt-20">
            <H2>Spend circuit</H2>
            <P>
              The most complex circuit. Proves five things simultaneously, all in zero knowledge:
            </P>
            <ul className="list-none space-y-3 my-6">
              {[
                "Both input notes belong to the caller (spending key knowledge).",
                "Both input commitments are members of the current Merkle tree (membership proof).",
                "Nullifiers are correctly derived from the spending key and commitments.",
                "Output commitments are correctly formed for the specified recipients.",
                "Sum of input amounts equals sum of output amounts (conservation of value).",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-white/60">
                  <span className="shrink-0 w-5 h-5 flex items-center justify-center border border-[#eca8d6]/30 text-[#eca8d6] text-xs mt-0.5">{i + 1}</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* ── CIRCUITS POSEIDON ── */}
          <section id="circuits-poseidon" className="scroll-mt-20">
            <H2>Poseidon2 hash</H2>
            <P>
              All hashing in StealthPay — commitments, nullifiers, Merkle nodes — uses Poseidon2 over BN254.
              It is ZK-friendly (cheap to prove) and algebraically sound over the same field as the UltraHonk
              proving system.
            </P>
            <H3>Sponge construction</H3>
            <Code>{`// hash2: domain-separated 2-input hash
function hash2(a: bigint, b: bigint): bigint {
  const iv = mod(2n * TWO_POW_64); // capacity = 2·2^64
  let state = [a, b, 0n, iv];
  state = permute(state);
  return state[0];
}

// Commitment = hash4(pubkey, token, amount, salt)
function hash4(a: bigint, b: bigint, c: bigint, d: bigint): bigint {
  const iv = mod(4n * TWO_POW_64); // capacity = 4·2^64
  let state = [a, b, c, iv];
  state = permute(state);
  state[0] = mod(state[0] + d);
  state = permute(state);
  return state[0];
}`}</Code>
            <Callout type="tip">
              The TypeScript implementation uses <code className="font-mono">@zkpassport/poseidon2</code> which
              passes the official Barretenberg test vector:{" "}
              <code className="font-mono text-white/60">permute([0,1,2,3])[0] === 0x01bd538c...01737</code>.
            </Callout>

            <div className="mt-16 pt-12 border-t border-white/10 flex items-center justify-between text-sm text-white/30">
              <span className="font-mono">StealthPay Docs · 0G Galileo testnet</span>
              <a href="https://github.com" className="hover:text-white/60 transition-colors">Edit on GitHub ↗</a>
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}
