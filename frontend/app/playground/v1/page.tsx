"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";
const EXPLORER = "https://chainscan-galileo.0g.ai";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  name: string;
  role: string;
  color: string;
  salary: string;
  spendingPubkey: string;
}

interface Payment {
  to: string;
  amount: string;
  txHash: string;
  timestamp: string;
}

interface LogLine {
  text: string;
  type: "info" | "success" | "error" | "dim";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortHash(h: string) {
  return h.slice(0, 10) + "…" + h.slice(-6);
}

async function streamSSE(
  url: string,
  body: object,
  onLine: (line: LogLine) => void,
): Promise<{ step: string; [k: string]: unknown }> {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.body) throw new Error("No response body");

  const reader  = resp.body.getReader();
  const decoder = new TextDecoder();
  let   buf     = "";
  let   last: { step: string; [k: string]: unknown } = { step: "" };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.replace(/^data: /, "").trim();
      if (!line) continue;
      let msg: { step: string; msg?: string; [k: string]: unknown };
      try { msg = JSON.parse(line); } catch { continue; }
      if (msg.step === "error") throw new Error(String(msg.msg ?? "Unknown error"));
      if (msg.msg) {
        onLine({
          text: String(msg.msg),
          type: msg.step === "done" ? "success" : msg.step === "hint" && String(msg.msg).startsWith("✓") ? "success" : "info",
        });
      }
      last = msg as { step: string; [k: string]: unknown };
    }
  }
  return last;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LogPanel({ lines, running }: { lines: LogLine[]; running: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollTo(0, ref.current.scrollHeight); }, [lines]);

  return (
    <div ref={ref} className="h-44 overflow-y-auto p-4 font-mono text-xs space-y-0.5 bg-black/20">
      {lines.length === 0 && !running && (
        <p className="text-white/30">Run an action — logs will appear here.</p>
      )}
      {lines.map((l, i) => (
        <p key={i} className={
          l.type === "success" ? "text-emerald-400" :
          l.type === "error"   ? "text-red-400" :
          l.type === "dim"     ? "text-white/40" :
          "text-white/75"
        }>{l.text}</p>
      ))}
      {running && <span className="inline-block w-1.5 h-3.5 bg-[#eca8d6]/70 animate-pulse" />}
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span className="text-xs font-mono px-2 py-0.5 border" style={{ color, borderColor: color + "55" }}>
      {text}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PayrollDemo() {
  const [employees,   setEmployees]   = useState<Employee[]>([]);
  const [payments,    setPayments]    = useState<Payment[]>([]);
  const [orgBalance,  setOrgBalance]  = useState<string | null>(null);
  const [selected,    setSelected]    = useState<Employee | null>(null);
  const [password,    setPassword]    = useState("");
  const [empBalance,  setEmpBalance]  = useState<string | null>(null);
  const [recipient,   setRecipient]   = useState("");
  const [shieldAmt,   setShieldAmt]   = useState("300000000");
  const [running,     setRunning]     = useState(false);
  const [logs,        setLogs]        = useState<LogLine[]>([]);
  const [activePanel, setActivePanel] = useState<"org" | "emp">("org");

  const addLog  = (line: LogLine) => setLogs(p => [...p, line]);
  const clearLogs = () => setLogs([]);

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

  // ── Org: Shield ──────────────────────────────────────────────────────────────
  async function doShield() {
    if (running) return;
    setRunning(true); clearLogs(); setActivePanel("org");
    addLog({ text: `Shielding ${(Number(shieldAmt) / 1e6).toFixed(0)} USDC into StealthCorp pool…`, type: "info" });
    try {
      const result = await streamSSE(`${BACKEND}/v1/org/shield`, { amount: shieldAmt }, addLog);
      if (result.txHash) {
        addLog({ text: `✓ Pool funded — tx: ${shortHash(String(result.txHash))}`, type: "success" });
        await fetchOrgBalance();
      }
    } catch (e: unknown) {
      addLog({ text: `✗ ${e instanceof Error ? e.message : String(e)}`, type: "error" });
    }
    setRunning(false);
  }

  // ── Org: Pay employee ─────────────────────────────────────────────────────
  async function doPay(employee: Employee) {
    if (running) return;
    setRunning(true); clearLogs(); setActivePanel("org");
    addLog({ text: `Paying ${employee.name} ${(Number(employee.salary) / 1e6).toFixed(0)} USDC privately…`, type: "info" });
    try {
      const result = await streamSSE(`${BACKEND}/v1/pay`, { employeeId: employee.id }, addLog);
      if (result.txHash) {
        addLog({ text: `✓ ${employee.name} paid — tx: ${shortHash(String(result.txHash))}`, type: "success" });
        await fetchData();
        await fetchOrgBalance();
      }
    } catch (e: unknown) {
      addLog({ text: `✗ ${e instanceof Error ? e.message : String(e)}`, type: "error" });
    }
    setRunning(false);
  }

  // ── Employee: Check balance ───────────────────────────────────────────────
  async function checkBalance() {
    if (!selected || !password) return;
    setRunning(true); clearLogs(); setActivePanel("emp");
    setEmpBalance(null);
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

  // ── Employee: Withdraw ────────────────────────────────────────────────────
  async function doWithdraw() {
    if (!selected || !password || !recipient) return;
    setRunning(true); clearLogs(); setActivePanel("emp");
    addLog({ text: `${selected.name} withdrawing to ${recipient.slice(0, 8)}…`, type: "info" });
    try {
      const result = await streamSSE(`${BACKEND}/v1/withdraw`, {
        employeeId: selected.id, password, recipient,
      }, addLog);
      if (result.txHash) {
        addLog({ text: `✓ Withdrawn — tx: ${shortHash(String(result.txHash))}`, type: "success" });
        setEmpBalance(null);
      }
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
          <div className="flex items-center gap-5">
            <Link href="/playground" className="text-sm font-mono text-white/45 hover:text-white/75">SDK Playground →</Link>
            <Link href="/docs" className="text-sm font-mono text-white/45 hover:text-white/75">Docs</Link>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 py-10">

        {/* Hero */}
        <div className="mb-10">
          <span className="text-xs font-mono text-white/45 uppercase tracking-widest">Live Demo · 0G Galileo Testnet</span>
          <h1 className="text-4xl font-display tracking-tight mt-2 mb-2">Private Payroll with ZK Proofs</h1>
          <p className="text-white/55 max-w-xl text-sm">
            StealthCorp pays employees privately via the SDK. On-chain, nobody sees who paid whom or how much —
            only that a valid private transfer happened.
          </p>
        </div>

        {/* Main grid */}
        <div className="grid lg:grid-cols-2 gap-5 mb-5">

          {/* ── Left: Org Panel ───────────────────────────────────────────── */}
          <div className="border border-white/20 flex flex-col">
            <div className="px-5 py-4 border-b border-white/15 flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-white/45 uppercase tracking-widest mb-0.5">Organisation</p>
                <h2 className="text-lg font-display text-white">StealthCorp</h2>
              </div>
              <div className="text-right">
                <p className="text-xs font-mono text-white/40 mb-1">Pool balance</p>
                {orgBalance !== null
                  ? <p className="text-xl font-mono text-emerald-400">{orgBalance} <span className="text-sm text-white/50">USDC</span></p>
                  : <button onClick={fetchOrgBalance} className="text-xs font-mono text-white/40 hover:text-white/70 border border-white/20 px-3 py-1">Check balance</button>
                }
              </div>
            </div>

            {/* Shield panel */}
            <div className="px-5 py-4 border-b border-white/10 bg-white/[0.02]">
              <p className="text-xs font-mono text-white/45 uppercase tracking-widest mb-3">Fund pool</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    value={shieldAmt}
                    onChange={e => setShieldAmt(e.target.value)}
                    className="w-full bg-white/[0.05] border border-white/20 px-3 py-2 text-sm font-mono text-white placeholder-white/30 outline-none focus:border-[#eca8d6]/50"
                    placeholder="Amount (raw units)"
                  />
                  <p className="text-xs text-white/35 mt-1">6 decimals — 300000000 = 300 USDC</p>
                </div>
                <button
                  onClick={doShield}
                  disabled={running}
                  className="px-4 py-2 text-sm font-mono border border-emerald-400/40 text-emerald-400 hover:bg-emerald-400/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                >
                  Shield USDC
                </button>
              </div>
            </div>

            {/* Employee list */}
            <div className="flex-1 divide-y divide-white/[0.07]">
              <p className="px-5 py-3 text-xs font-mono text-white/40 uppercase tracking-widest">Payroll</p>
              {employees.map(emp => (
                <div key={emp.id} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{ background: emp.color + "22", color: emp.color }}>
                      {emp.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-white font-mono">{emp.name}</p>
                      <p className="text-xs text-white/40">{emp.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge text={(Number(emp.salary) / 1e6).toFixed(0) + " USDC"} color={emp.color} />
                    <button
                      onClick={() => doPay(emp)}
                      disabled={running}
                      className="text-xs font-mono px-3 py-1.5 border border-[#eca8d6]/40 text-[#eca8d6] hover:bg-[#eca8d6]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      Pay →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Employee Portal ────────────────────────────────────── */}
          <div className="border border-white/20 flex flex-col">
            <div className="px-5 py-4 border-b border-white/15">
              <p className="text-xs font-mono text-white/45 uppercase tracking-widest mb-1">Employee Portal</p>
              <p className="text-xs text-white/35">Select an employee and enter password to check balance or withdraw</p>
            </div>

            {/* Employee selector */}
            <div className="px-5 py-4 border-b border-white/10 space-y-4">
              <div>
                <p className="text-xs font-mono text-white/45 uppercase tracking-widest mb-2">Select employee</p>
                <div className="flex gap-2 flex-wrap">
                  {employees.map(emp => (
                    <button key={emp.id} onClick={() => { setSelected(emp); setEmpBalance(null); }}
                      className={`flex items-center gap-2 px-3 py-2 text-sm font-mono border transition-all ${
                        selected?.id === emp.id
                          ? "border-[#eca8d6]/60 bg-[#eca8d6]/[0.08] text-white"
                          : "border-white/20 text-white/60 hover:border-white/40 hover:text-white/85"
                      }`}>
                      <span className="w-4 h-4 rounded-full inline-block shrink-0"
                        style={{ background: emp.color }} />
                      {emp.name.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-mono text-white/45 uppercase tracking-widest mb-2">Password</p>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="123456"
                  className="w-full bg-white/[0.05] border border-white/20 px-3 py-2 text-sm font-mono text-white placeholder-white/25 outline-none focus:border-[#eca8d6]/50"
                />
                <p className="text-xs text-white/30 mt-1">Demo password: 123456</p>
              </div>

              <button
                onClick={checkBalance}
                disabled={running || !selected || !password}
                className="w-full py-2.5 text-sm font-mono border border-white/25 text-white/70 hover:border-[#eca8d6]/50 hover:text-white hover:bg-[#eca8d6]/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Check private balance
              </button>
            </div>

            {/* Balance display */}
            {empBalance !== null && (
              <div className="px-5 py-4 border-b border-white/10 bg-emerald-400/[0.03]">
                <p className="text-xs font-mono text-white/45 uppercase tracking-widest mb-1">Private balance</p>
                <p className="text-3xl font-mono text-emerald-400">{empBalance} <span className="text-base text-white/40">USDC</span></p>
              </div>
            )}

            {/* Withdraw */}
            <div className="px-5 py-4 space-y-4 flex-1">
              <p className="text-xs font-mono text-white/45 uppercase tracking-widest">Withdraw to wallet</p>
              <div>
                <input
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                  placeholder="0x recipient address"
                  className="w-full bg-white/[0.05] border border-white/20 px-3 py-2 text-sm font-mono text-white placeholder-white/25 outline-none focus:border-[#eca8d6]/50"
                />
                <p className="text-xs text-white/30 mt-1">Tokens land here. ZK proof ensures no on-chain link to payer.</p>
              </div>
              <button
                onClick={doWithdraw}
                disabled={running || !selected || !password || !recipient}
                className="w-full py-2.5 text-sm font-mono border border-[#eca8d6]/40 text-[#eca8d6] bg-[#eca8d6]/[0.05] hover:bg-[#eca8d6]/[0.12] hover:border-[#eca8d6]/70 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Withdraw all →
              </button>
            </div>

            {/* Privacy note */}
            <div className="px-5 py-3 border-t border-white/10 bg-white/[0.02]">
              <p className="text-xs text-white/35 font-mono">
                Chain sees: <span className="text-white/55">PrivacyPool → recipient</span> · No link to employer or salary amount
              </p>
            </div>
          </div>
        </div>

        {/* ── Log panel ─────────────────────────────────────────────────────── */}
        <div className="border border-white/20">
          <div className="px-5 py-3 border-b border-white/15 flex items-center justify-between bg-white/[0.02]">
            <span className="text-xs font-mono text-white/50 uppercase tracking-widest">Live execution log</span>
            {running && <span className="text-xs font-mono text-[#eca8d6]/70 animate-pulse">● running</span>}
          </div>
          <LogPanel lines={logs} running={running} />
        </div>

        {/* ── Payment history ───────────────────────────────────────────────── */}
        {payments.length > 0 && (
          <div className="border border-white/20 mt-5">
            <div className="px-5 py-3 border-b border-white/15 bg-white/[0.02]">
              <span className="text-xs font-mono text-white/50 uppercase tracking-widest">Payment history</span>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {payments.map((p, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between gap-4 text-xs font-mono">
                  <div className="flex items-center gap-3">
                    <span className="text-white/35">StealthCorp</span>
                    <span className="text-white/25">→</span>
                    <span className="text-white/80">{p.to}</span>
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

        {/* Footer */}
        <div className="mt-8 pt-5 border-t border-white/10 flex flex-wrap gap-5 text-xs font-mono text-white/35">
          <Link href="/playground" className="hover:text-white/60">SDK Playground →</Link>
          <Link href="/docs/sdk-send" className="hover:text-white/60">sdk.privateSend() docs →</Link>
          <Link href="/docs/sdk-unshield" className="hover:text-white/60">sdk.unshield() docs →</Link>
        </div>
      </div>
    </div>
  );
}
