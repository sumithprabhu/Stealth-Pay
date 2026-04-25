"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────────

type Op = "shield" | "privateSend" | "unshield";

interface ShieldParams  { token: string; amount: string; spendingPrivkey: string; }
interface SendParams    { token: string; amount: string; spendingPrivkey: string; receiverPubkey: string; }
interface UnshieldParams { token: string; amount: string; spendingPrivkey: string; recipient: string; }

const DEFAULT_TOKEN    = "0xB4fd61544493a27a4793F161d6BE153d1A0f6092";
const DEFAULT_POOL     = "0x87fECd1AfA436490e3230C8B0B5aD49dcC1283F1";
const DEFAULT_PRIVKEY  = "0xdeadbeefcafebabe12345678abcdef01...";
const DEFAULT_PUBKEY   = "0x1a2b3c4d5e6f...";
const DEFAULT_RECIP    = "0xRecipientAddress...";

// ─── Code generators ──────────────────────────────────────────────────────────

function shieldCode(p: ShieldParams) {
  return `import { StealthPaySDK } from "stealthpay-sdk";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://evmrpc-testnet.0g.ai");
const signer   = new ethers.Wallet(
  "${p.spendingPrivkey || DEFAULT_PRIVKEY}",
  provider
);

const sdk = new StealthPaySDK({
  signer,
  privacyPoolAddress: "${DEFAULT_POOL}",
  spendingPrivkey: ${p.spendingPrivkey ? `BigInt("${p.spendingPrivkey}")` : "YOUR_SPENDING_PRIVKEY"},
});

// Sync Merkle tree before any operation
await sdk.sync(provider);

// ── Shield ────────────────────────────────────────────────────────────────────
const result = await sdk.shield(
  "${p.token || DEFAULT_TOKEN}",   // ERC-20 token address
  ${p.amount ? `${p.amount}n` : "100_000_000n"}ULL,              // amount in token decimals
);

console.log("✓ Shielded");
console.log("  tx hash   :", result.txHash);
console.log("  commitment:", result.commitment.toString(16));
console.log("  token     :", result.token);
console.log("  amount    :", result.amount.toString());

// Store commitment privately — only you can spend this note
// { commitment: result.commitment, token: result.token, amount: result.amount }`;
}

function sendCode(p: SendParams) {
  return `import { StealthPaySDK } from "stealthpay-sdk";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://evmrpc-testnet.0g.ai");
const signer   = new ethers.Wallet(
  "${p.spendingPrivkey || DEFAULT_PRIVKEY}",
  provider
);

const sdk = new StealthPaySDK({
  signer,
  privacyPoolAddress: "${DEFAULT_POOL}",
  spendingPrivkey: ${p.spendingPrivkey ? `BigInt("${p.spendingPrivkey}")` : "YOUR_SPENDING_PRIVKEY"},
});

await sdk.sync(provider);

// ── Private Send ──────────────────────────────────────────────────────────────
const result = await sdk.privateSend(
  "${p.token || DEFAULT_TOKEN}",        // ERC-20 token address
  ${p.amount ? `${p.amount}n` : "50_000_000n"},              // amount in token decimals
  BigInt("${p.receiverPubkey || DEFAULT_PUBKEY}"), // receiver's spending pubkey
);

console.log("✓ Private send complete");
console.log("  tx hash          :", result.txHash);
console.log("  receiver commit  :", result.receiverCommitment.toString(16));
console.log("  change commit    :", result.changeCommitment?.toString(16) ?? "none");

// Send { amount, salt } to receiver over a secure channel
// so they can claim their note with sdk.unshield()`;
}

function unshieldCode(p: UnshieldParams) {
  return `import { StealthPaySDK } from "stealthpay-sdk";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://evmrpc-testnet.0g.ai");
const signer   = new ethers.Wallet(
  "${p.spendingPrivkey || DEFAULT_PRIVKEY}",
  provider
);

const sdk = new StealthPaySDK({
  signer,
  privacyPoolAddress: "${DEFAULT_POOL}",
  spendingPrivkey: ${p.spendingPrivkey ? `BigInt("${p.spendingPrivkey}")` : "YOUR_SPENDING_PRIVKEY"},
});

// Sync replays all on-chain events — discovers your unspent notes
await sdk.sync(provider);

const balance = sdk.getPrivateBalance("${p.token || DEFAULT_TOKEN}");
console.log("Private balance:", balance.balance.toString(), "(" + balance.noteCount + " notes)");

// ── Unshield ──────────────────────────────────────────────────────────────────
const result = await sdk.unshield(
  "${p.token || DEFAULT_TOKEN}",    // ERC-20 token address
  ${p.amount ? `${p.amount}n` : "50_000_000n"},          // amount to withdraw
  "${p.recipient || DEFAULT_RECIP}", // recipient wallet address
);

console.log("✓ Unshielded");
console.log("  tx hash  :", result.txHash);
console.log("  amount   :", result.amount.toString());
console.log("  recipient:", result.recipient);
// Tokens are now in recipient's wallet — no on-chain link to original deposit`;
}

// ─── Inline SDK call (right panel, compact) ───────────────────────────────────

function shieldCall(p: ShieldParams) {
  return `await sdk.shield(
  "${p.token || DEFAULT_TOKEN}",
  ${p.amount ? `${p.amount}n` : "100_000_000n"},
)`;
}

function sendCall(p: SendParams) {
  return `await sdk.privateSend(
  "${p.token || DEFAULT_TOKEN}",
  ${p.amount ? `${p.amount}n` : "50_000_000n"},
  BigInt("${p.receiverPubkey || DEFAULT_PUBKEY}"),
)`;
}

function unshieldCall(p: UnshieldParams) {
  return `await sdk.unshield(
  "${p.token || DEFAULT_TOKEN}",
  ${p.amount ? `${p.amount}n` : "50_000_000n"},
  "${p.recipient || DEFAULT_RECIP}",
)`;
}

// ─── Return type cards ────────────────────────────────────────────────────────

const RETURN_TYPES: Record<Op, { type: string; fields: [string, string, string][] }> = {
  shield: {
    type: "ShieldResult",
    fields: [
      ["txHash",     "string",  "transaction hash"],
      ["commitment", "bigint",  "note commitment — store privately"],
      ["amount",     "bigint",  "shielded amount"],
      ["token",      "string",  "token address"],
    ],
  },
  privateSend: {
    type: "PrivateSendResult",
    fields: [
      ["txHash",            "string",         "transaction hash"],
      ["receiverCommitment","bigint",          "receiver's note — relay to them"],
      ["changeCommitment",  "bigint | null",   "your change note"],
      ["amount",            "bigint",          "sent amount"],
      ["token",             "string",          "token address"],
    ],
  },
  unshield: {
    type: "UnshieldResult",
    fields: [
      ["txHash",    "string", "transaction hash"],
      ["amount",    "bigint", "withdrawn amount"],
      ["token",     "string", "token address"],
      ["recipient", "string", "recipient address"],
    ],
  },
};

// ─── Field component ──────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, mono = true, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; mono?: boolean; hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-white/40 font-mono uppercase tracking-widest">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-sm text-white/80 placeholder-white/20 outline-none focus:border-[#eca8d6]/40 transition-colors ${mono ? "font-mono" : ""}`}
      />
      {hint && <p className="text-xs text-white/25">{hint}</p>}
    </div>
  );
}

// ─── Code block ───────────────────────────────────────────────────────────────

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="relative group">
      {label && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-white/[0.02]">
          <span className="text-xs font-mono text-white/30">{label}</span>
          <button
            onClick={copy}
            className="text-xs font-mono text-white/25 hover:text-white/60 transition-colors"
          >
            {copied ? "copied ✓" : "copy"}
          </button>
        </div>
      )}
      {!label && (
        <button
          onClick={copy}
          className="absolute top-3 right-3 text-xs font-mono text-white/20 hover:text-white/50 transition-colors z-10"
        >
          {copied ? "copied ✓" : "copy"}
        </button>
      )}
      <pre className="overflow-x-auto p-4 text-xs font-mono text-white/65 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ─── Op metadata ──────────────────────────────────────────────────────────────

const OPS: { id: Op; label: string; desc: string; badge: string; badgeColor: string }[] = [
  {
    id: "shield",
    label: "shield()",
    desc: "Deposit ERC-20 tokens into the private pool. Generates a commitment note only you can spend.",
    badge: "public → private",
    badgeColor: "text-emerald-400/70 border-emerald-400/20",
  },
  {
    id: "privateSend",
    label: "privateSend()",
    desc: "Transfer privately to any spending pubkey. No on-chain link between sender and receiver.",
    badge: "private → private",
    badgeColor: "text-[#eca8d6]/70 border-[#eca8d6]/20",
  },
  {
    id: "unshield",
    label: "unshield()",
    desc: "Withdraw tokens to any public address. ZK proof nullifies your note — zero double-spend risk.",
    badge: "private → public",
    badgeColor: "text-sky-400/70 border-sky-400/20",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlaygroundPage() {
  const [op, setOp] = useState<Op>("shield");

  const [shield,   setShield]   = useState<ShieldParams>({ token: "", amount: "", spendingPrivkey: "" });
  const [send,     setSend]     = useState<SendParams>({ token: "", amount: "", spendingPrivkey: "", receiverPubkey: "" });
  const [unshield, setUnshield] = useState<UnshieldParams>({ token: "", amount: "", spendingPrivkey: "", recipient: "" });

  const activeOp = OPS.find(o => o.id === op)!;

  const callSnippet =
    op === "shield"      ? shieldCall(shield) :
    op === "privateSend" ? sendCall(send) :
                           unshieldCall(unshield);

  const fullCode =
    op === "shield"      ? shieldCode(shield) :
    op === "privateSend" ? sendCode(send) :
                           unshieldCode(unshield);

  const returnType = RETURN_TYPES[op];

  return (
    <div className="min-h-screen text-white" style={{ background: "oklch(0.06 0.008 260)" }}>

      {/* Nav */}
      <header
        className="sticky top-0 z-50 border-b border-white/[0.07] backdrop-blur-md"
        style={{ background: "oklch(0.06 0.008 260 / 0.95)" }}
      >
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 text-base font-display text-white/80 hover:text-white transition-colors">
              <Image src="/logo.png" alt="Stealth Pay" width={22} height={22} className="opacity-80" />
              Stealth <span className="text-[#eca8d6]">Pay</span>
            </Link>
            <span className="text-white/15">/</span>
            <span className="text-sm font-mono text-white/35">playground</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/docs" className="text-sm text-white/35 hover:text-white/70 transition-colors font-mono">
              Docs ↗
            </Link>
            <a
              href="https://github.com"
              className="text-sm text-white/35 hover:text-white/70 transition-colors font-mono"
            >
              GitHub ↗
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12">

        {/* Header */}
        <div className="mb-10">
          <span className="text-xs font-mono text-white/30 uppercase tracking-widest">SDK Playground</span>
          <h1 className="text-4xl lg:text-5xl font-display tracking-tight leading-tight mt-2 mb-3 text-white">
            Try before you build.
          </h1>
          <p className="text-white/45 max-w-xl">
            Pick an operation, fill in your parameters, and see the exact SDK call and full
            integration code update live. Copy and run it in your project.
          </p>
        </div>

        {/* Op tabs */}
        <div className="flex gap-3 mb-8 flex-wrap">
          {OPS.map(o => (
            <button
              key={o.id}
              onClick={() => setOp(o.id)}
              className={`flex items-center gap-3 px-5 py-3 border text-sm transition-all ${
                op === o.id
                  ? "border-[#eca8d6]/40 bg-[#eca8d6]/[0.06] text-white"
                  : "border-white/[0.08] text-white/45 hover:border-white/20 hover:text-white/70"
              }`}
            >
              <span className="font-mono">{o.label}</span>
              <span className={`text-xs border px-2 py-0.5 rounded-full font-mono ${op === o.id ? o.badgeColor : "text-white/20 border-white/10"}`}>
                {o.badge}
              </span>
            </button>
          ))}
        </div>

        {/* Op description */}
        <p className="text-white/50 mb-8 text-sm max-w-xl">{activeOp.desc}</p>

        {/* Main grid: form | live call | return type */}
        <div className="grid lg:grid-cols-12 gap-6 mb-6">

          {/* Left — form */}
          <div className="lg:col-span-4 space-y-5">
            <div className="border border-white/[0.08] p-5 space-y-5">
              <p className="text-xs font-mono text-white/30 uppercase tracking-widest">Parameters</p>

              <Field
                label="Token address"
                value={op === "shield" ? shield.token : op === "privateSend" ? send.token : unshield.token}
                onChange={v => {
                  if (op === "shield")      setShield(p => ({ ...p, token: v }));
                  if (op === "privateSend") setSend(p => ({ ...p, token: v }));
                  if (op === "unshield")    setUnshield(p => ({ ...p, token: v }));
                }}
                placeholder={DEFAULT_TOKEN}
                hint="ERC-20 contract address on 0G Chain"
              />

              <Field
                label="Amount (raw units)"
                value={op === "shield" ? shield.amount : op === "privateSend" ? send.amount : unshield.amount}
                onChange={v => {
                  if (op === "shield")      setShield(p => ({ ...p, amount: v }));
                  if (op === "privateSend") setSend(p => ({ ...p, amount: v }));
                  if (op === "unshield")    setUnshield(p => ({ ...p, amount: v }));
                }}
                placeholder="100000000"
                hint="6 decimals → 100000000 = 100 USDC"
              />

              <Field
                label="Spending private key"
                value={op === "shield" ? shield.spendingPrivkey : op === "privateSend" ? send.spendingPrivkey : unshield.spendingPrivkey}
                onChange={v => {
                  if (op === "shield")      setShield(p => ({ ...p, spendingPrivkey: v }));
                  if (op === "privateSend") setSend(p => ({ ...p, spendingPrivkey: v }));
                  if (op === "unshield")    setUnshield(p => ({ ...p, spendingPrivkey: v }));
                }}
                placeholder="0xdeadbeef..."
                hint="Never leaves your client — used only to generate ZK proof"
              />

              {op === "privateSend" && (
                <Field
                  label="Receiver spending pubkey"
                  value={send.receiverPubkey}
                  onChange={v => setSend(p => ({ ...p, receiverPubkey: v }))}
                  placeholder="0x1a2b3c..."
                  hint="Derive with deriveSpendingPubkey(privkey)"
                />
              )}

              {op === "unshield" && (
                <Field
                  label="Recipient address"
                  value={unshield.recipient}
                  onChange={v => setUnshield(p => ({ ...p, recipient: v }))}
                  placeholder="0xRecipient..."
                  hint="Public wallet that receives the tokens"
                />
              )}
            </div>

            {/* Install callout */}
            <div className="border border-white/[0.06] p-4 bg-white/[0.02]">
              <p className="text-xs font-mono text-white/30 mb-2">install</p>
              <code className="text-sm font-mono text-[#eca8d6]/80">npm install stealthpay-sdk</code>
            </div>
          </div>

          {/* Middle — live SDK call */}
          <div className="lg:col-span-4">
            <div className="border border-[#eca8d6]/20 bg-[#eca8d6]/[0.02] h-full">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#eca8d6]/10">
                <span className="text-xs font-mono text-[#eca8d6]/60 uppercase tracking-widest">Live SDK call</span>
                <span className="text-xs font-mono text-white/20">updates as you type</span>
              </div>
              <div className="p-4">
                <pre className="text-sm font-mono text-white/80 leading-relaxed whitespace-pre-wrap break-all">
                  <code>{callSnippet}</code>
                </pre>
              </div>
            </div>
          </div>

          {/* Right — return type */}
          <div className="lg:col-span-4">
            <div className="border border-white/[0.08] h-full">
              <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                <span className="text-xs font-mono text-white/30 uppercase tracking-widest">Returns </span>
                <span className="text-xs font-mono text-[#eca8d6]/60">{returnType.type}</span>
              </div>
              <div className="p-4 space-y-3">
                {returnType.fields.map(([name, type, desc]) => (
                  <div key={name} className="flex flex-col gap-0.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-mono text-white/75">{name}</span>
                      <span className="text-xs font-mono text-[#eca8d6]/50">{type}</span>
                    </div>
                    <span className="text-xs text-white/30">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Full code */}
        <div className="border border-white/[0.08]">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]">
            <span className="text-xs font-mono text-white/35 uppercase tracking-widest">Full integration code</span>
            <span className="text-xs font-mono text-white/20">copy → paste → run</span>
          </div>
          <CodeBlock code={fullCode} />
        </div>

        {/* Footer links */}
        <div className="mt-10 pt-6 border-t border-white/[0.06] flex flex-wrap gap-6 text-xs font-mono text-white/25">
          <Link href="/docs/sdk-install"  className="hover:text-white/50 transition-colors">Installation →</Link>
          <Link href="/docs/sdk-init"     className="hover:text-white/50 transition-colors">Initialization →</Link>
          <Link href="/docs/usecases"     className="hover:text-white/50 transition-colors">Use Cases →</Link>
          <Link href="/docs/sdk-shield"   className="hover:text-white/50 transition-colors">sdk.shield() →</Link>
          <Link href="/docs/sdk-send"     className="hover:text-white/50 transition-colors">sdk.privateSend() →</Link>
          <Link href="/docs/sdk-unshield" className="hover:text-white/50 transition-colors">sdk.unshield() →</Link>
        </div>
      </div>
    </div>
  );
}
