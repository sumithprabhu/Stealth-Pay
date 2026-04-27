"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useWalletClient } from "wagmi";
import { createWalletClient, custom, createPublicClient, http, parseAbi } from "viem";
import { zeroGGalileo } from "./providers";

// ─── Constants ────────────────────────────────────────────────────────────────

const MOCK_TOKEN   = "0xB4fd61544493a27a4793F161d6BE153d1A0f6092";
const POOL_ADDRESS = "0x87fECd1AfA436490e3230C8B0B5aD49dcC1283F1";
const RPC_URL      = "https://evmrpc-testnet.0g.ai";
const EXPLORER     = "https://chainscan-galileo.0g.ai";

export const dynamic = "force-dynamic";

const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

const POOL_ABI = parseAbi([
  "function shield((address token, uint256 amount, bytes32 commitment) params, bytes proof) external",
  "function spend((address token, bytes32 merkleRoot, bytes32[2] nullifiers, bytes32[2] newCommitments, uint256 publicAmount, address recipient) params, bytes proof) external",
]);

type Op         = "shield" | "privateSend" | "unshield";
type SignerMode = "wallet" | "privkey";

// ─── Code generators ──────────────────────────────────────────────────────────

const signerSnippet = (mode: SignerMode, pk: string) =>
  mode === "wallet"
    ? `const provider = new ethers.BrowserProvider(window.ethereum);\nconst signer   = await provider.getSigner();`
    : `const provider = new ethers.JsonRpcProvider("${RPC_URL}");\nconst signer   = new ethers.Wallet(\n  "${pk || "YOUR_PRIVATE_KEY"}",\n  provider,\n);`;

function liveCall(op: Op, p: Params) {
  const t = p.token || MOCK_TOKEN;
  const a = p.amount || "100000000";
  if (op === "shield")
    return `await sdk.shield(\n  "${t}",\n  ${a}n,\n)`;
  if (op === "privateSend")
    return `await sdk.privateSend(\n  "${t}",\n  ${a}n,\n  BigInt("${p.receiverPubkey || "RECEIVER_SPENDING_PUBKEY"}"),\n)`;
  return `await sdk.unshield(\n  "${t}",\n  ${a}n,\n  "${p.recipient || "RECIPIENT_ADDRESS"}",\n)`;
}

function fullCode(op: Op, mode: SignerMode, p: Params) {
  const t = p.token || MOCK_TOKEN;
  const a = p.amount || "100000000";

  const opBlock =
    op === "shield"
      ? `const result = await sdk.shield(\n  "${t}",\n  ${a}n,\n);\nconsole.log("tx hash   :", result.txHash);\nconsole.log("commitment:", "0x" + result.commitment.toString(16));`
      : op === "privateSend"
      ? `const result = await sdk.privateSend(\n  "${t}",\n  ${a}n,\n  BigInt("${p.receiverPubkey || "RECEIVER_SPENDING_PUBKEY"}"),\n);\nconsole.log("tx hash          :", result.txHash);\nconsole.log("receiver commit  :", "0x" + result.receiverCommitment.toString(16));`
      : `await sdk.sync(provider);\n\nconst result = await sdk.unshield(\n  "${t}",\n  ${a}n,\n  "${p.recipient || "RECIPIENT_ADDRESS"}",\n);\nconsole.log("tx hash  :", result.txHash);\nconsole.log("recipient:", result.recipient);`;

  return `import { StealthPaySDK } from "stealthpay-sdk";\nimport { ethers } from "ethers";\n\n// Signer\n${signerSnippet(mode, p.pk)}\n\n// SDK\nconst sdk = new StealthPaySDK({\n  signer,\n  privacyPoolAddress: "${POOL_ADDRESS}",\n  spendingPrivkey: YOUR_SPENDING_PRIVKEY,\n});\nawait sdk.sync(provider);\n\n// ${op === "shield" ? "Shield" : op === "privateSend" ? "Private send" : "Unshield"}\n${opBlock}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Params {
  token: string; amount: string; pk: string; spendingPrivkey: string;
  receiverPubkey: string; recipient: string;
}

const RETURNS: Record<Op, { type: string; fields: [string, string, string][] }> = {
  shield: {
    type: "ShieldResult",
    fields: [
      ["txHash",     "string", "transaction hash"],
      ["commitment", "bigint", "your note — store privately"],
      ["amount",     "bigint", "shielded amount"],
      ["token",      "string", "token address"],
    ],
  },
  privateSend: {
    type: "PrivateSendResult",
    fields: [
      ["txHash",             "string",       "transaction hash"],
      ["receiverCommitment", "bigint",        "relay this to receiver"],
      ["changeCommitment",   "bigint | null", "your change note"],
      ["amount",             "bigint",        "sent amount"],
      ["token",              "string",        "token address"],
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

const OPS: { id: Op; label: string; badge: string; badgeColor: string; desc: string }[] = [
  {
    id: "shield",
    label: "sdk.shield()",
    badge: "public → private",
    badgeColor: "text-emerald-400 border-emerald-400/40",
    desc: "Deposit ERC-20 tokens into the private pool. Generates a ZK commitment only you can spend.",
  },
  {
    id: "privateSend",
    label: "sdk.privateSend()",
    badge: "private → private",
    badgeColor: "text-[#eca8d6] border-[#eca8d6]/40",
    desc: "Transfer privately to any spending pubkey. No on-chain link between sender and receiver.",
  },
  {
    id: "unshield",
    label: "sdk.unshield()",
    badge: "private → public",
    badgeColor: "text-sky-400 border-sky-400/40",
    desc: "Withdraw tokens to any public address. ZK proof nullifies your note — zero double-spend risk.",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-white/60 font-mono uppercase tracking-widest">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-white/[0.05] border border-white/25 px-3 py-2 text-sm text-white font-mono placeholder-white/30 outline-none focus:border-[#eca8d6]/70 transition-colors"
      />
      {hint && <p className="text-xs text-white/45">{hint}</p>}
    </div>
  );
}

function CopyButton({ text, label = "copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-xs font-mono text-white/45 hover:text-white/80 transition-colors px-2 py-1 border border-white/15 hover:border-white/30"
    >
      {copied ? "✓ copied" : label}
    </button>
  );
}

// ─── Faucet button ────────────────────────────────────────────────────────────

function FaucetButton({ address }: { address?: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "err">("idle");
  const [txHash, setTxHash] = useState("");

  async function mint() {
    if (!address) return;
    setState("loading");
    try {
      const res  = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTxHash(data.txHash);
      setState("done");
    } catch { setState("err"); }
  }

  if (state === "done") return (
    <div className="border border-emerald-400/30 bg-emerald-400/[0.05] p-3 space-y-1.5">
      <p className="text-sm text-emerald-400 font-mono">✓ 1 000 USDC sent</p>
      <a
        href={`${EXPLORER}/tx/${txHash}`}
        target="_blank" rel="noopener noreferrer"
        className="text-xs font-mono text-white/50 hover:text-white/75 transition-colors break-all block"
      >
        {txHash} ↗
      </a>
    </div>
  );

  return (
    <button
      onClick={mint}
      disabled={!address || state === "loading"}
      className="w-full border border-white/25 py-2.5 text-sm font-mono text-white/80 hover:border-[#eca8d6]/60 hover:text-white hover:bg-[#eca8d6]/[0.06] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {state === "loading" ? "Sending…" : state === "err" ? "Failed — retry" : "✦  Get 1 000 test USDC"}
    </button>
  );
}

// ─── Real streaming Run panel ─────────────────────────────────────────────────

type StreamMsg = { step: string; msg?: string; detail?: string; [key: string]: unknown };

function RunPanel({ op, params, signerMode }: { op: Op; params: Params; signerMode: SignerMode }) {
  const [state,  setState]  = useState<"idle" | "running" | "done" | "error">("idle");
  const [lines,  setLines]  = useState<{ text: string; dim?: boolean }[]>([]);
  const [result, setResult] = useState<StreamMsg | null>(null);
  const { data: walletClient } = useWalletClient();

  function addLine(text: string, dim = false) {
    setLines(prev => [...prev, { text, dim }]);
  }

  // ── Wallet mode: /prove → MetaMask signs ────────────────────────────────────
  async function runWithWallet() {
    if (!walletClient) throw new Error("Wallet not connected");

    const publicClient = createPublicClient({ chain: zeroGGalileo, transport: http(RPC_URL) });
    const backendUrl   = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";
    const token  = params.token  || MOCK_TOKEN;
    const amount = params.amount || "100000000";

    // Stream the proof generation
    addLine("Requesting ZK proof from backend…");
    const resp = await fetch(`${backendUrl}/prove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op, token, amount, spendingPrivkey: params.spendingPrivkey || "0xdeadbeefcafebabe12345678abcdef01", receiverPubkey: params.receiverPubkey, recipient: params.recipient }),
    });
    if (!resp.body) throw new Error("No response from backend");

    let proveResult: StreamMsg | null = null;
    const reader  = resp.body.getReader();
    const decoder = new TextDecoder();
    let   buf     = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.replace(/^data: /, "").trim();
        if (!line) continue;
        let msg: StreamMsg;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.step === "error") throw new Error(String(msg.msg));
        if (msg.step === "done") { proveResult = msg; break; }
        addLine(String(msg.msg ?? ""), msg.step !== "done");
        if (msg.detail) addLine(`  ${msg.detail}`, true);
      }
      if (proveResult) break;
    }

    if (!proveResult) throw new Error("Proof generation failed");
    addLine("✓ ZK proof generated");

    const userAddress = walletClient.account.address;

    // ── shield ──────────────────────────────────────────────────────────────
    if (op === "shield") {
      const { proof, params: p } = proveResult as unknown as { proof: string; params: { token: string; amount: string; commitment: string } };
      const amtBig = BigInt(p.amount);

      addLine("Checking token allowance…", true);
      const allowance = await publicClient.readContract({ address: p.token as `0x${string}`, abi: ERC20_ABI, functionName: "allowance", args: [userAddress, POOL_ADDRESS as `0x${string}`] });

      if ((allowance as bigint) < amtBig) {
        addLine("→ MetaMask: approve token spend");
        const approveTx = await walletClient.writeContract({ address: p.token as `0x${string}`, abi: ERC20_ABI, functionName: "approve", args: [POOL_ADDRESS as `0x${string}`, amtBig] });
        addLine(`  approve tx: ${approveTx}`, true);
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
        addLine("✓ Approved");
      }

      addLine("→ MetaMask: submit shield transaction");
      const shieldTx = await walletClient.writeContract({
        address: POOL_ADDRESS as `0x${string}`,
        abi: POOL_ABI,
        functionName: "shield",
        args: [{ token: p.token as `0x${string}`, amount: amtBig, commitment: p.commitment as `0x${string}` }, proof as `0x${string}`],
      });
      addLine(`  shield tx: ${shieldTx}`, true);
      await publicClient.waitForTransactionReceipt({ hash: shieldTx });

      setResult({ step: "done", op: "shield", txHash: shieldTx, explorer: `${EXPLORER}/tx/${shieldTx}`, commitment: p.commitment, from: userAddress, to: POOL_ADDRESS });

    // ── spend (privateSend / unshield) ─────────────────────────────────────
    } else {
      const { proof, params: p } = proveResult as unknown as { proof: string; params: { token: string; merkleRoot: string; nullifiers: string[]; newCommitments: string[]; publicAmount: string; recipient: string } };

      addLine("→ MetaMask: submit spend transaction");
      const spendTx = await walletClient.writeContract({
        address: POOL_ADDRESS as `0x${string}`,
        abi: POOL_ABI,
        functionName: "spend",
        args: [{
          token: p.token as `0x${string}`,
          merkleRoot: p.merkleRoot as `0x${string}`,
          nullifiers: p.nullifiers as [`0x${string}`, `0x${string}`],
          newCommitments: p.newCommitments as [`0x${string}`, `0x${string}`],
          publicAmount: BigInt(p.publicAmount),
          recipient: p.recipient as `0x${string}`,
        }, proof as `0x${string}`],
      });
      addLine(`  spend tx: ${spendTx}`, true);
      await publicClient.waitForTransactionReceipt({ hash: spendTx });

      setResult({ step: "done", op, txHash: spendTx, explorer: `${EXPLORER}/tx/${spendTx}`, from: userAddress, recipient: p.recipient, publicAmount: p.publicAmount });
    }
  }

  // ── Private key mode: /execute (backend signs) ──────────────────────────────
  async function runWithPrivkey() {
    if (!params.pk) throw new Error("Enter your private key in the form");
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

    const resp = await fetch(`${backendUrl}/execute`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        op,
        token:         params.token  || MOCK_TOKEN,
        amount:        params.amount || "100000000",
        spendingPrivkey: params.spendingPrivkey || "0xdeadbeefcafebabe12345678abcdef01",
        signerPrivkey: params.pk,
        receiverPubkey: params.receiverPubkey || undefined,
        recipient:      params.recipient      || undefined,
      }),
    });

    if (!resp.body) throw new Error("No response body");
    const reader  = resp.body.getReader();
    const decoder = new TextDecoder();
    let   buf     = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.replace(/^data: /, "").trim();
        if (!line) continue;
        let msg: StreamMsg;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.step === "error") throw new Error(String(msg.msg));
        if (msg.step === "done") { setResult(msg); setState("done"); return; }
        addLine(String(msg.msg ?? ""), msg.step !== "done");
        if (msg.detail) addLine(`  ${msg.detail}`, true);
      }
    }
  }

  async function run() {
    setState("running");
    setLines([]);
    setResult(null);
    try {
      if (signerMode === "wallet") {
        await runWithWallet();
        setState("done");
      } else {
        await runWithPrivkey();
      }
    } catch (err: unknown) {
      addLine(`✗ ${err instanceof Error ? err.message : String(err)}`);
      setState("error");
    }
  }

  return (
    <div className="border border-white/20 mt-6">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/15 bg-white/[0.03]">
        <div>
          <span className="text-xs font-mono text-white/65 uppercase tracking-widest">Live execution</span>
          <span className="ml-3 text-xs text-white/35">real tx on 0G Galileo testnet</span>
        </div>
        <button
          onClick={run}
          disabled={state === "running"}
          className={`flex items-center gap-2 px-4 py-1.5 text-sm font-mono border transition-all ${
            state === "running"
              ? "border-white/20 text-white/30 cursor-not-allowed"
              : "border-[#eca8d6]/50 text-[#eca8d6] bg-[#eca8d6]/[0.08] hover:bg-[#eca8d6]/[0.18] hover:border-[#eca8d6]/80"
          }`}
        >
          {state === "running"
            ? <><span className="animate-pulse">●</span>&nbsp;Running…</>
            : state === "done" || state === "error"
            ? "▶  Run again"
            : "▶  Run"}
        </button>
      </div>

      {/* Log stream */}
      <div className="p-4 min-h-[100px] font-mono text-sm space-y-0.5">
        {lines.length === 0 && state === "idle" && (
          <p className="text-white/30 text-xs">Press Run — a real transaction will be submitted on-chain.</p>
        )}
        {lines.map((l, i) => (
          <p key={i} className={`leading-relaxed ${l.dim ? "text-white/45" : "text-white/85"}`}>{l.text}</p>
        ))}
        {state === "running" && <span className="inline-block w-1.5 h-4 bg-[#eca8d6]/70 animate-pulse" />}
      </div>

      {/* Result card */}
      {result && state === "done" && (
        <div className="border-t border-white/15 p-4 space-y-3 bg-white/[0.02]">
          <p className="text-xs font-mono text-emerald-400/80 uppercase tracking-widest">✓ Transaction confirmed</p>
          <div className="space-y-2 text-xs font-mono">
            {Object.entries(result)
              .filter(([k]) => !["step", "op", "explorer"].includes(k))
              .map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <span className="text-white/40 w-28 shrink-0">{k}</span>
                  <span className="text-white/85 break-all">{v !== null && v !== undefined ? String(v) : "—"}</span>
                </div>
              ))}
            {typeof result.explorer === "string" && (
              <div className="flex gap-3">
                <span className="text-white/40 w-28 shrink-0">explorer</span>
                <a
                  href={result.explorer}
                  target="_blank" rel="noopener noreferrer"
                  className="text-[#eca8d6]/80 hover:text-[#eca8d6] transition-colors break-all"
                >
                  {result.explorer} ↗
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlaygroundPage() {
  const [op,         setOp]         = useState<Op>("shield");
  const [signerMode, setSignerMode] = useState<SignerMode>("wallet");
  const [params, setParams]         = useState<Params>({
    token: MOCK_TOKEN, amount: "", pk: "", spendingPrivkey: "", receiverPubkey: "", recipient: "",
  });

  const { address: connectedAddress } = useAccount();
  const activeAddress = signerMode === "wallet" ? connectedAddress : undefined;

  const set = (k: keyof Params) => (v: string) => setParams(p => ({ ...p, [k]: v }));
  const activeOp   = OPS.find(o => o.id === op)!;
  const returnType = RETURNS[op];

  return (
    <div className="min-h-screen text-white" style={{ background: "oklch(0.06 0.008 260)" }}>

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/20 backdrop-blur-md"
        style={{ background: "oklch(0.06 0.008 260 / 0.95)" }}>
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 text-base font-display text-white/90 hover:text-white transition-colors">
              <Image src="/logo.png" alt="" width={22} height={22} />
              Stealth <span className="text-[#eca8d6]">Pay</span>
            </Link>
            <span className="text-white/25">/</span>
            <span className="text-sm font-mono text-white/55">playground</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/docs" className="text-sm text-white/55 hover:text-white/85 transition-colors font-mono">Docs</Link>
            <a href="https://github.com" className="text-sm text-white/55 hover:text-white/85 transition-colors font-mono">GitHub ↗</a>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12">

        {/* Header */}
        <div className="mb-10">
          <span className="text-xs font-mono text-white/50 uppercase tracking-widest">SDK Playground</span>
          <h1 className="text-4xl lg:text-5xl font-display tracking-tight mt-2 mb-3 text-white">
            Try before you build.
          </h1>
          <p className="text-white/65 max-w-xl">
            Pick an operation and signer mode. Fill in parameters — the live call and full
            integration code update instantly. Copy and run in your project.
          </p>
        </div>

        {/* Op tabs */}
        <div className="flex gap-3 mb-6 flex-wrap">
          {OPS.map(o => (
            <button key={o.id} onClick={() => setOp(o.id)}
              className={`flex items-center gap-3 px-5 py-3 border text-sm font-mono transition-all ${
                op === o.id
                  ? "border-[#eca8d6]/60 bg-[#eca8d6]/[0.08] text-white"
                  : "border-white/25 text-white/65 hover:border-white/45 hover:text-white/90"
              }`}
            >
              {o.label}
              <span className={`text-xs border px-2 py-0.5 ${op === o.id ? o.badgeColor : "text-white/35 border-white/20"}`}>
                {o.badge}
              </span>
            </button>
          ))}
        </div>

        <p className="text-white/60 mb-8 text-sm">{activeOp.desc}</p>

        {/* Main 3-col grid */}
        <div className="grid lg:grid-cols-12 gap-5 mb-5">

          {/* Left: controls */}
          <div className="lg:col-span-4 space-y-4">

            {/* Signer mode */}
            <div className="border border-white/20 p-4 space-y-4">
              <p className="text-xs font-mono text-white/65 uppercase tracking-widest">Signer mode</p>
              <div className="flex gap-2">
                {(["wallet", "privkey"] as SignerMode[]).map(m => (
                  <button key={m} onClick={() => setSignerMode(m)}
                    className={`flex-1 py-2 text-sm font-mono border transition-all ${
                      signerMode === m
                        ? "border-[#eca8d6]/60 bg-[#eca8d6]/[0.08] text-white"
                        : "border-white/20 text-white/55 hover:text-white/80 hover:border-white/35"
                    }`}
                  >
                    {m === "wallet" ? "🦊  Wallet" : "🔑  Private key"}
                  </button>
                ))}
              </div>

              {signerMode === "wallet" ? (
                <div className="space-y-3">
                  <ConnectButton chainStatus="icon" showBalance={false} />
                  {connectedAddress && (
                    <p className="text-xs font-mono text-white/55 break-all">
                      <span className="text-white/35">connected: </span>{connectedAddress}
                    </p>
                  )}
                </div>
              ) : (
                <Field label="Private key" value={params.pk} onChange={set("pk")}
                  placeholder="0xdeadbeef..." hint="Signs transactions locally — not sent anywhere" />
              )}
            </div>

            {/* Params */}
            <div className="border border-white/20 p-4 space-y-4">
              <p className="text-xs font-mono text-white/65 uppercase tracking-widest">Parameters</p>

              <Field label="Token address" value={params.token} onChange={set("token")}
                placeholder={MOCK_TOKEN} hint="Pre-filled: testnet MockUSDC" />
              <Field label="Amount (raw units)" value={params.amount} onChange={set("amount")}
                placeholder="100000000" hint="6 decimals — 100000000 = 100 USDC" />

              <Field label="Spending private key (ZK key)"
                value={params.spendingPrivkey} onChange={set("spendingPrivkey")}
                placeholder="0xdeadbeef… (leave blank for demo key)"
                hint="Used to generate ZK proof — separate from your wallet key" />

              {op === "privateSend" && (
                <Field label="Receiver spending pubkey" value={params.receiverPubkey}
                  onChange={set("receiverPubkey")} placeholder="0x1a2b3c..."
                  hint="deriveSpendingPubkey(privkey)" />
              )}
              {op === "unshield" && (
                <Field label="Recipient address" value={params.recipient}
                  onChange={set("recipient")} placeholder="0xRecipient..."
                  hint="Public wallet that receives the tokens" />
              )}
            </div>

            {/* Faucet */}
            <div className="border border-white/20 p-4 space-y-3">
              <div>
                <p className="text-xs font-mono text-white/65 uppercase tracking-widest mb-1">Test tokens</p>
                <p className="text-xs text-white/45">
                  {signerMode === "wallet" && !connectedAddress
                    ? "Connect your wallet to receive test USDC"
                    : "Drops 1 000 testnet USDC to your address"}
                </p>
              </div>
              <FaucetButton address={activeAddress} />
              <p className="text-xs font-mono text-white/40 break-all">
                <span className="text-white/30">token: </span>{MOCK_TOKEN}
              </p>
            </div>

            {/* Install */}
            <div className="border border-white/20 p-4 bg-white/[0.02]">
              <p className="text-xs font-mono text-white/55 mb-2">install</p>
              <code className="text-sm font-mono text-[#eca8d6]">npm install stealthpay-sdk</code>
            </div>
          </div>

          {/* Middle: live call */}
          <div className="lg:col-span-4 flex flex-col">
            <div className="border border-[#eca8d6]/40 bg-[#eca8d6]/[0.03] flex flex-col flex-1">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#eca8d6]/25">
                <span className="text-xs font-mono text-[#eca8d6]/70 uppercase tracking-widest">Live SDK call</span>
                <CopyButton text={liveCall(op, params)} />
              </div>
              <div className="p-5 flex-1">
                <pre className="text-sm font-mono text-white leading-relaxed whitespace-pre-wrap break-all">
                  {liveCall(op, params)}
                </pre>
              </div>
              <div className="px-4 py-2 border-t border-[#eca8d6]/15">
                <p className="text-xs text-white/40">Updates as you type</p>
              </div>
            </div>

            {/* Run panel lives under the live call on medium screens */}
            <RunPanel op={op} params={params} signerMode={signerMode} />
          </div>

          {/* Right: return type */}
          <div className="lg:col-span-4">
            <div className="border border-white/20 h-full">
              <div className="px-4 py-3 border-b border-white/15 bg-white/[0.03] flex items-center gap-3">
                <span className="text-xs font-mono text-white/60 uppercase tracking-widest">Returns</span>
                <span className="text-xs font-mono text-[#eca8d6]/80 border border-[#eca8d6]/30 px-2 py-0.5">{returnType.type}</span>
              </div>
              <div className="p-4 space-y-5">
                {returnType.fields.map(([name, type, desc]) => (
                  <div key={name} className="border-l-2 border-white/15 pl-3">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-sm font-mono text-white">{name}</span>
                      <span className="text-xs font-mono text-[#eca8d6]/65">{type}</span>
                    </div>
                    <span className="text-xs text-white/50">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Full code */}
        <div className="border border-white/20">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/15 bg-white/[0.03]">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-white/65 uppercase tracking-widest">Full integration code</span>
              <span className="text-xs font-mono text-white/40 border border-white/20 px-2 py-0.5">
                {signerMode === "wallet" ? "browser wallet" : "private key"}
              </span>
            </div>
            <CopyButton text={fullCode(op, signerMode, params)} label="copy all" />
          </div>
          <pre className="overflow-x-auto p-5 text-xs font-mono text-white/80 leading-relaxed">
            <code>{fullCode(op, signerMode, params)}</code>
          </pre>
        </div>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-white/15 flex flex-wrap gap-6 text-xs font-mono text-white/45">
          <Link href="/docs/sdk-install"  className="hover:text-white/75 transition-colors">Installation →</Link>
          <Link href="/docs/sdk-init"     className="hover:text-white/75 transition-colors">Initialization →</Link>
          <Link href="/docs/usecases"     className="hover:text-white/75 transition-colors">Use Cases →</Link>
          <Link href="/docs/sdk-shield"   className="hover:text-white/75 transition-colors">sdk.shield() →</Link>
          <Link href="/docs/sdk-send"     className="hover:text-white/75 transition-colors">sdk.privateSend() →</Link>
          <Link href="/docs/sdk-unshield" className="hover:text-white/75 transition-colors">sdk.unshield() →</Link>
        </div>
      </div>
    </div>
  );
}
