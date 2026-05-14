"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useWalletClient, useAccount } from "wagmi";
import { createPublicClient, http, parseAbi } from "viem";
import { zeroGGalileo } from "../providers";

const BACKEND  = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";
const EXPLORER = "https://chainscan-galileo.0g.ai";
const RPC_URL  = "https://evmrpc-testnet.0g.ai";

const POOL_ADDRESS = "0x87fECd1AfA436490e3230C8B0B5aD49dcC1283F1";
const MOCK_TOKEN   = "0xB4fd61544493a27a4793F161d6BE153d1A0f6092";

const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

const POOL_ABI = parseAbi([
  "function shield((address token, uint256 amount, bytes32 commitment) params, bytes proof) external",
  "function spend((address token, bytes32 merkleRoot, bytes32[2] nullifiers, bytes32[2] newCommitments, uint256 publicAmount, address recipient) params, bytes proof) external",
]);

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "org" | "employee";

interface Employee {
  id: string; name: string; role: string;
  color: string; salary: string; spendingPubkey: string;
}
interface Payment { to: string; amount: string; txHash: string; timestamp: string; }
interface LogLine { text: string; type: "info" | "success" | "error" | "dim"; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortHash(h: string) { return h.slice(0, 10) + "…" + h.slice(-6); }

async function streamSSE(
  url: string, body: object,
  onLine: (l: LogLine) => void,
): Promise<{ step: string; [k: string]: unknown }> {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.body) throw new Error("No response body");
  const reader = resp.body.getReader();
  const dec    = new TextDecoder();
  let buf = "";
  let last: { step: string; [k: string]: unknown } = { step: "" };
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n"); buf = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.replace(/^data: /, "").trim();
      if (!line) continue;
      let msg: { step: string; msg?: string; [k: string]: unknown };
      try { msg = JSON.parse(line); } catch { continue; }
      if (msg.step === "error") throw new Error(String(msg.msg ?? "Unknown error"));
      if (msg.msg) onLine({ text: String(msg.msg), type: msg.step === "done" ? "success" : "info" });
      last = msg as { step: string; [k: string]: unknown };
    }
  }
  return last;
}

// ─── Log Panel ────────────────────────────────────────────────────────────────

function LogPanel({ lines, running }: { lines: LogLine[]; running: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollTo(0, ref.current.scrollHeight); }, [lines]);
  return (
    <div ref={ref} className="h-48 overflow-y-auto p-4 font-mono text-xs space-y-0.5 bg-black/20">
      {lines.length === 0 && !running && <p className="text-white/30">Run an action — logs appear here.</p>}
      {lines.map((l, i) => (
        <p key={i} className={
          l.type === "success" ? "text-emerald-400" :
          l.type === "error"   ? "text-red-400" :
          l.type === "dim"     ? "text-white/40" : "text-white/75"
        }>{l.text}</p>
      ))}
      {running && <span className="inline-block w-1.5 h-3.5 bg-[#eca8d6]/70 animate-pulse" />}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PayrollDemo() {
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();

  const [role,       setRole]       = useState<Role>("org");
  const [employees,  setEmployees]  = useState<Employee[]>([]);
  const [payments,   setPayments]   = useState<Payment[]>([]);
  const [orgBalance, setOrgBalance] = useState<string | null>(null);
  const [selected,   setSelected]   = useState<Employee | null>(null);
  const [password,   setPassword]   = useState("");
  const [empBalance, setEmpBalance] = useState<string | null>(null);
  const [recipient,  setRecipient]  = useState("");
  const [shieldAmt,  setShieldAmt]  = useState("300000000");
  const [running,    setRunning]    = useState(false);
  const [logs,       setLogs]       = useState<LogLine[]>([]);

  const addLog    = (l: LogLine) => setLogs(p => [...p, l]);
  const clearLogs = () => setLogs([]);

  const publicClient = createPublicClient({ chain: zeroGGalileo, transport: http(RPC_URL) });

  async function fetchData() {
    const data = await fetch(`${BACKEND}/v1/employees`).then(r => r.json());
    setEmployees(data.employees ?? []);
    setPayments(data.payments ?? []);
  }

  async function fetchOrgBalance() {
    const data = await fetch(`${BACKEND}/v1/org/balance`, { method: "POST" }).then(r => r.json());
    setOrgBalance(data.balance ?? "0");
  }

  useEffect(() => { fetchData(); }, []);

  // ── Shield ────────────────────────────────────────────────────────────────
  async function doShield() {
    if (running || !walletClient || !address) return;
    setRunning(true); clearLogs();
    addLog({ text: `Shielding ${(Number(shieldAmt) / 1e6).toFixed(0)} USDC into StealthCorp pool…`, type: "info" });
    try {
      const result = await streamSSE(`${BACKEND}/v1/prove/shield`, { amount: shieldAmt }, addLog);
      if (result.step !== "done") throw new Error("Proof generation failed");

      const { proof, params } = result as unknown as {
        proof: string;
        params: { token: string; amount: string; commitment: `0x${string}` };
      };
      const amt = BigInt(params.amount);

      // Approve if needed
      addLog({ text: "Checking token allowance…", type: "dim" });
      const allowance = await publicClient.readContract({
        address: MOCK_TOKEN as `0x${string}`, abi: ERC20_ABI,
        functionName: "allowance", args: [address, POOL_ADDRESS as `0x${string}`],
      });
      if ((allowance as bigint) < amt) {
        addLog({ text: "→ MetaMask: approve token spend", type: "info" });
        const approveTx = await walletClient.writeContract({
          address: MOCK_TOKEN as `0x${string}`, abi: ERC20_ABI,
          functionName: "approve", args: [POOL_ADDRESS as `0x${string}`, amt],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
        addLog({ text: "✓ Approved", type: "success" });
      }

      addLog({ text: "→ MetaMask: submit shield transaction", type: "info" });
      const shieldTx = await walletClient.writeContract({
        address: POOL_ADDRESS as `0x${string}`, abi: POOL_ABI,
        functionName: "shield",
        args: [{ token: MOCK_TOKEN as `0x${string}`, amount: amt, commitment: params.commitment }, proof as `0x${string}`],
      });
      await publicClient.waitForTransactionReceipt({ hash: shieldTx });
      addLog({ text: `✓ Pool funded! tx: ${shortHash(shieldTx)}`, type: "success" });
      addLog({ text: `${EXPLORER}/tx/${shieldTx}`, type: "dim" });
      await fetchOrgBalance();
      await fetchData();
    } catch (e: unknown) {
      addLog({ text: `✗ ${e instanceof Error ? e.message : String(e)}`, type: "error" });
    }
    setRunning(false);
  }

  // ── Pay employee ──────────────────────────────────────────────────────────
  async function doPay(employee: Employee) {
    if (running || !walletClient) return;
    setRunning(true); clearLogs();
    addLog({ text: `Paying ${employee.name} ${(Number(employee.salary) / 1e6).toFixed(0)} USDC privately…`, type: "info" });
    try {
      const result = await streamSSE(`${BACKEND}/v1/prove/pay`, { employeeId: employee.id }, addLog);
      if (result.step !== "done") throw new Error("Proof generation failed");

      const { proof, params } = result as unknown as {
        proof: string;
        params: {
          token: string; merkleRoot: `0x${string}`;
          nullifiers: [`0x${string}`, `0x${string}`];
          newCommitments: [`0x${string}`, `0x${string}`];
          publicAmount: string; recipient: `0x${string}`;
        };
      };

      addLog({ text: "→ MetaMask: submit payment transaction", type: "info" });
      const spendTx = await walletClient.writeContract({
        address: POOL_ADDRESS as `0x${string}`, abi: POOL_ABI,
        functionName: "spend",
        args: [{
          token: params.token as `0x${string}`,
          merkleRoot: params.merkleRoot,
          nullifiers: params.nullifiers,
          newCommitments: params.newCommitments,
          publicAmount: BigInt(params.publicAmount),
          recipient: params.recipient,
        }, proof as `0x${string}`],
      });
      await publicClient.waitForTransactionReceipt({ hash: spendTx });
      addLog({ text: `✓ ${employee.name} paid! tx: ${shortHash(spendTx)}`, type: "success" });
      addLog({ text: `${EXPLORER}/tx/${spendTx}`, type: "dim" });
      addLog({ text: "On-chain record shows: PrivacyPool → PrivacyPool · No amounts, no addresses visible", type: "dim" });
      await fetchData();
      await fetchOrgBalance();
    } catch (e: unknown) {
      addLog({ text: `✗ ${e instanceof Error ? e.message : String(e)}`, type: "error" });
    }
    setRunning(false);
  }

  // ── Employee: check balance ───────────────────────────────────────────────
  async function checkBalance() {
    if (!selected || !password || running) return;
    setRunning(true); clearLogs(); setEmpBalance(null);
    addLog({ text: `Checking ${selected.name}'s private balance…`, type: "info" });
    try {
      const data = await fetch(`${BACKEND}/v1/balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selected.id, password }),
      }).then(r => r.json());
      if (data.error) throw new Error(data.error);
      setEmpBalance(data.balance);
      addLog({ text: `✓ Private balance: ${data.balance} USDC (${data.noteCount} note${data.noteCount !== 1 ? "s" : ""})`, type: "success" });
    } catch (e: unknown) {
      addLog({ text: `✗ ${e instanceof Error ? e.message : String(e)}`, type: "error" });
    }
    setRunning(false);
  }

  // ── Employee: withdraw ────────────────────────────────────────────────────
  async function doWithdraw() {
    if (!selected || !password || !recipient || !walletClient || running) return;
    setRunning(true); clearLogs();
    addLog({ text: `${selected.name} withdrawing to ${recipient.slice(0, 10)}…`, type: "info" });
    try {
      const result = await streamSSE(`${BACKEND}/v1/prove/withdraw`, {
        employeeId: selected.id, password, recipient,
      }, addLog);
      if (result.step !== "done") throw new Error("Proof generation failed");

      const { proof, params } = result as unknown as {
        proof: string;
        params: {
          token: string; merkleRoot: `0x${string}`;
          nullifiers: [`0x${string}`, `0x${string}`];
          newCommitments: [`0x${string}`, `0x${string}`];
          publicAmount: string; recipient: `0x${string}`;
        };
      };

      addLog({ text: "→ MetaMask: submit withdrawal transaction", type: "info" });
      const spendTx = await walletClient.writeContract({
        address: POOL_ADDRESS as `0x${string}`, abi: POOL_ABI,
        functionName: "spend",
        args: [{
          token: params.token as `0x${string}`,
          merkleRoot: params.merkleRoot,
          nullifiers: params.nullifiers,
          newCommitments: params.newCommitments,
          publicAmount: BigInt(params.publicAmount),
          recipient: params.recipient,
        }, proof as `0x${string}`],
      });
      await publicClient.waitForTransactionReceipt({ hash: spendTx });
      addLog({ text: `✓ Withdrawn! tx: ${shortHash(spendTx)}`, type: "success" });
      addLog({ text: `${EXPLORER}/tx/${spendTx}`, type: "dim" });
      addLog({ text: "On-chain record shows: PrivacyPool → your wallet · No link to StealthCorp", type: "dim" });
      setEmpBalance(null);
      await fetchData();
    } catch (e: unknown) {
      addLog({ text: `✗ ${e instanceof Error ? e.message : String(e)}`, type: "error" });
    }
    setRunning(false);
  }

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: "oklch(0.06 0.008 260)" }}>

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/20 backdrop-blur-md"
        style={{ background: "oklch(0.06 0.008 260 / 0.95)" }}>
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 text-base font-display text-white/90 hover:text-white">
              <Image src="/logo.png" alt="" width={22} height={22} />
              Stealth <span className="text-[#eca8d6]">Pay</span>
            </Link>
            <span className="text-white/25">/</span>
            <Link href="/playground" className="text-sm font-mono text-white/45 hover:text-white/70">playground</Link>
            <span className="text-white/25">/</span>
            <span className="text-sm font-mono text-white/70">payroll demo</span>
          </div>
          <div className="flex items-center gap-4">
            <ConnectButton chainStatus="icon" showBalance={false} />
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 py-10">

        {/* Hero */}
        <div className="mb-8">
          <span className="text-xs font-mono text-white/45 uppercase tracking-widest">Live Demo · 0G Galileo Testnet</span>
          <h1 className="text-4xl font-display tracking-tight mt-2 mb-2">Private Payroll</h1>
          <p className="text-white/50 max-w-xl text-sm">
            StealthCorp pays employees via ZK proofs. Your MetaMask signs the transactions.
            Spending keys stay on the backend — on-chain, no amounts or addresses are visible.
          </p>
        </div>

        {/* Role switcher */}
        <div className="flex gap-2 mb-8">
          {(["org", "employee"] as Role[]).map(r => (
            <button key={r} onClick={() => setRole(r)}
              className={`px-5 py-2.5 text-sm font-mono border transition-all ${
                role === r
                  ? "border-[#eca8d6]/60 bg-[#eca8d6]/[0.08] text-white"
                  : "border-white/20 text-white/55 hover:border-white/40 hover:text-white/80"
              }`}>
              {r === "org" ? "🏢  I'm StealthCorp (Org)" : "👤  I'm an Employee"}
            </button>
          ))}
        </div>

        {/* ── ORG PANEL ─────────────────────────────────────────────────────── */}
        {role === "org" && (
          <div className="grid lg:grid-cols-2 gap-5 mb-5">
            <div className="border border-white/20 flex flex-col">
              <div className="px-5 py-4 border-b border-white/15 flex items-center justify-between">
                <div>
                  <p className="text-xs font-mono text-white/40 uppercase tracking-widest mb-0.5">Organisation</p>
                  <h2 className="text-lg font-display">StealthCorp</h2>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono text-white/35 mb-1">Pool balance</p>
                  {orgBalance !== null
                    ? <p className="text-xl font-mono text-emerald-400">{orgBalance} <span className="text-sm text-white/40">USDC</span></p>
                    : <button onClick={fetchOrgBalance} className="text-xs font-mono text-white/40 hover:text-white/70 border border-white/20 px-3 py-1">Refresh</button>
                  }
                </div>
              </div>

              {/* Shield */}
              <div className="px-5 py-4 border-b border-white/10 bg-white/[0.02] space-y-3">
                <p className="text-xs font-mono text-white/40 uppercase tracking-widest">Step 1 — Fund pool</p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input value={shieldAmt} onChange={e => setShieldAmt(e.target.value)}
                      className="w-full bg-white/[0.05] border border-white/20 px-3 py-2 text-sm font-mono text-white placeholder-white/25 outline-none focus:border-[#eca8d6]/50"
                      placeholder="Amount (raw)" />
                    <p className="text-xs text-white/30 mt-1">300000000 = 300 USDC · debits from your connected wallet</p>
                  </div>
                  <button onClick={doShield} disabled={running || !address}
                    className="px-4 py-2 text-sm font-mono border border-emerald-400/40 text-emerald-400 hover:bg-emerald-400/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all whitespace-nowrap">
                    Shield →
                  </button>
                </div>
                {!address && <p className="text-xs text-amber-400/80 font-mono">Connect wallet first</p>}
              </div>

              {/* Pay */}
              <div className="flex-1">
                <p className="px-5 py-3 text-xs font-mono text-white/40 uppercase tracking-widest">Step 2 — Pay employees</p>
                <div className="divide-y divide-white/[0.06]">
                  {employees.map(emp => (
                    <div key={emp.id} className="px-5 py-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                          style={{ background: emp.color + "22", color: emp.color }}>
                          {emp.name[0]}
                        </div>
                        <div>
                          <p className="text-sm text-white font-mono">{emp.name}</p>
                          <p className="text-xs text-white/35">{emp.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-mono px-2 py-0.5 border"
                          style={{ color: emp.color, borderColor: emp.color + "44" }}>
                          {(Number(emp.salary) / 1e6).toFixed(0)} USDC
                        </span>
                        <button onClick={() => doPay(emp)} disabled={running || !address}
                          className="text-xs font-mono px-3 py-1.5 border border-[#eca8d6]/40 text-[#eca8d6] hover:bg-[#eca8d6]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                          Pay →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-5 py-3 border-t border-white/10 bg-white/[0.02]">
                <p className="text-xs text-white/30 font-mono">
                  Chain sees: <span className="text-white/50">PrivacyPool → PrivacyPool</span> · No amounts · No recipient addresses
                </p>
              </div>
            </div>

            {/* How it works (org side) */}
            <div className="border border-white/20 p-6 space-y-6">
              <p className="text-xs font-mono text-white/40 uppercase tracking-widest">How this works</p>
              {[
                { step: "01", title: "Shield USDC", desc: "Your wallet deposits USDC into the PrivacyPool contract. A ZK commitment is recorded on-chain — no amount visible.", color: "#34d399" },
                { step: "02", title: "Private Pay", desc: "Backend generates a spend proof using the org's private spending key. Your wallet signs the tx. On-chain: one generic event, no names or amounts.", color: "#eca8d6" },
                { step: "03", title: "Employee Withdraws", desc: "Employee's wallet signs the unshield tx. ZK proof proves note ownership without revealing the payer. Tokens land in their wallet.", color: "#a78bfa" },
              ].map(item => (
                <div key={item.step} className="flex gap-4">
                  <span className="text-xs font-mono shrink-0 mt-0.5" style={{ color: item.color }}>{item.step}</span>
                  <div>
                    <p className="text-sm text-white font-mono mb-1">{item.title}</p>
                    <p className="text-xs text-white/45 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
              <div className="border border-white/10 p-4 bg-white/[0.02] space-y-2">
                <p className="text-xs font-mono text-white/40 uppercase tracking-widest">Privacy model</p>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex gap-2"><span className="text-white/35 w-36">Spending keys</span><span className="text-white/70">Backend only — never on-chain</span></div>
                  <div className="flex gap-2"><span className="text-white/35 w-36">Signing keys</span><span className="text-white/70">Your MetaMask wallet</span></div>
                  <div className="flex gap-2"><span className="text-white/35 w-36">Chain sees</span><span className="text-white/70">ZK proof + nullifier hash only</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── EMPLOYEE PANEL ────────────────────────────────────────────────── */}
        {role === "employee" && (
          <div className="grid lg:grid-cols-2 gap-5 mb-5">
            <div className="border border-white/20 flex flex-col">
              <div className="px-5 py-4 border-b border-white/15">
                <p className="text-xs font-mono text-white/40 uppercase tracking-widest mb-1">Employee Portal</p>
                <p className="text-xs text-white/35">Select your profile, enter password to check balance or withdraw</p>
              </div>

              {/* Select employee */}
              <div className="px-5 py-4 border-b border-white/10 space-y-4">
                <p className="text-xs font-mono text-white/40 uppercase tracking-widest">Select employee</p>
                <div className="flex gap-2 flex-wrap">
                  {employees.map(emp => (
                    <button key={emp.id} onClick={() => { setSelected(emp); setEmpBalance(null); }}
                      className={`flex items-center gap-2 px-3 py-2 text-sm font-mono border transition-all ${
                        selected?.id === emp.id
                          ? "border-[#eca8d6]/60 bg-[#eca8d6]/[0.08] text-white"
                          : "border-white/20 text-white/55 hover:border-white/40 hover:text-white/80"
                      }`}>
                      <span className="w-3.5 h-3.5 rounded-full inline-block shrink-0" style={{ background: emp.color }} />
                      {emp.name.split(" ")[0]}
                    </button>
                  ))}
                </div>
                <div>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Password (demo: 123456)"
                    className="w-full bg-white/[0.05] border border-white/20 px-3 py-2 text-sm font-mono text-white placeholder-white/25 outline-none focus:border-[#eca8d6]/50" />
                </div>
                <button onClick={checkBalance} disabled={running || !selected || !password}
                  className="w-full py-2.5 text-sm font-mono border border-white/25 text-white/65 hover:border-[#eca8d6]/50 hover:text-white hover:bg-[#eca8d6]/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  Check private balance
                </button>
              </div>

              {/* Balance */}
              {empBalance !== null && (
                <div className="px-5 py-4 border-b border-white/10 bg-emerald-400/[0.03]">
                  <p className="text-xs font-mono text-white/40 uppercase tracking-widest mb-1">Private balance</p>
                  <p className="text-3xl font-mono text-emerald-400">{empBalance} <span className="text-base text-white/35">USDC</span></p>
                  <p className="text-xs text-white/30 font-mono mt-1">Only you can see this — derived from your spending key</p>
                </div>
              )}

              {/* Withdraw */}
              <div className="px-5 py-4 flex-1 space-y-4">
                <p className="text-xs font-mono text-white/40 uppercase tracking-widest">Withdraw to wallet</p>
                <div>
                  <input value={recipient} onChange={e => setRecipient(e.target.value)}
                    placeholder="0x recipient address"
                    className="w-full bg-white/[0.05] border border-white/20 px-3 py-2 text-sm font-mono text-white placeholder-white/25 outline-none focus:border-[#eca8d6]/50" />
                  <p className="text-xs text-white/30 mt-1">Your MetaMask signs the tx · no on-chain link to StealthCorp</p>
                </div>
                <button onClick={doWithdraw} disabled={running || !selected || !password || !recipient || !address}
                  className="w-full py-2.5 text-sm font-mono border border-[#eca8d6]/40 text-[#eca8d6] bg-[#eca8d6]/[0.05] hover:bg-[#eca8d6]/[0.12] hover:border-[#eca8d6]/70 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  Withdraw all →
                </button>
                {!address && <p className="text-xs text-amber-400/80 font-mono">Connect wallet to sign the withdrawal tx</p>}
              </div>
            </div>

            {/* Privacy breakdown (employee side) */}
            <div className="border border-white/20 p-6 space-y-6">
              <p className="text-xs font-mono text-white/40 uppercase tracking-widest">What the chain sees</p>
              <div className="space-y-4 font-mono text-sm">
                {[
                  { label: "Shield tx",   from: "StealthCorp wallet", to: "PrivacyPool", note: "amount hidden in ZK commitment" },
                  { label: "Payment tx",  from: "StealthCorp wallet", to: "PrivacyPool", note: "no recipient address, no amount on-chain" },
                  { label: "Withdraw tx", from: "Your wallet",        to: "Your wallet", note: "no link back to StealthCorp or salary amount" },
                ].map((row, i) => (
                  <div key={i} className="border border-white/10 p-4 space-y-2">
                    <p className="text-xs text-white/35 uppercase tracking-widest">{row.label}</p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-white/60">{row.from}</span>
                      <span className="text-white/25">→</span>
                      <span className="text-white/60">{row.to}</span>
                    </div>
                    <p className="text-xs text-[#eca8d6]/70">{row.note}</p>
                  </div>
                ))}
              </div>
              <div className="border border-white/10 p-4 bg-white/[0.02]">
                <p className="text-xs font-mono text-white/35 mb-2 uppercase tracking-widest">Your keys</p>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex gap-2"><span className="text-white/35 w-32">Spending key</span><span className="text-white/55">Backend — generates ZK proof</span></div>
                  <div className="flex gap-2"><span className="text-white/35 w-32">Signing key</span><span className="text-white/55">Your MetaMask — pays gas, signs tx</span></div>
                  <div className="flex gap-2"><span className="text-white/35 w-32">Password</span><span className="text-white/55">Gates access to spending key</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Log panel ─────────────────────────────────────────────────────── */}
        <div className="border border-white/20">
          <div className="px-5 py-3 border-b border-white/15 flex items-center justify-between bg-white/[0.02]">
            <span className="text-xs font-mono text-white/45 uppercase tracking-widest">Live execution log</span>
            {running && <span className="text-xs font-mono text-[#eca8d6]/70 animate-pulse">● running</span>}
          </div>
          <LogPanel lines={logs} running={running} />
        </div>

        {/* ── Payment history ───────────────────────────────────────────────── */}
        {payments.length > 0 && (
          <div className="border border-white/20 mt-5">
            <div className="px-5 py-3 border-b border-white/15 bg-white/[0.02]">
              <span className="text-xs font-mono text-white/45 uppercase tracking-widest">Payment history</span>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {payments.map((p, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between gap-4 text-xs font-mono">
                  <div className="flex items-center gap-3">
                    <span className="text-white/30">StealthCorp</span>
                    <span className="text-white/20">→</span>
                    <span className="text-white/75">{p.to}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-emerald-400">{p.amount}</span>
                    <a href={`${EXPLORER}/tx/${p.txHash}`} target="_blank" rel="noopener noreferrer"
                      className="text-white/30 hover:text-white/60 transition-colors">
                      {shortHash(p.txHash)} ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 pt-5 border-t border-white/10 flex flex-wrap gap-5 text-xs font-mono text-white/30">
          <Link href="/playground" className="hover:text-white/55">SDK Playground →</Link>
          <Link href="/docs/sdk-send" className="hover:text-white/55">sdk.privateSend() →</Link>
          <Link href="/docs/sdk-unshield" className="hover:text-white/55">sdk.unshield() →</Link>
        </div>
      </div>
    </div>
  );
}
