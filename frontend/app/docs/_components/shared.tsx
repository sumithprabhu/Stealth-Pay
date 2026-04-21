"use client";

import { useState } from "react";

// ── Code block ──────────────────────────────────────────────────────────────
export function Code({ children, lang = "typescript" }: { children: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(children.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative my-6 border border-white/10 bg-[#0a0a0f]">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10">
        <div className="w-2 h-2 rounded-full bg-red-500/40" />
        <div className="w-2 h-2 rounded-full bg-yellow-500/40" />
        <div className="w-2 h-2 rounded-full bg-green-500/40" />
        <span className="ml-2 text-xs font-mono text-white/25">{lang}</span>
        <button
          onClick={copy}
          className="ml-auto text-xs font-mono text-white/25 hover:text-white/60 transition-colors px-2 py-0.5"
        >
          {copied ? "copied!" : "copy"}
        </button>
      </div>
      <pre className="p-5 text-sm font-mono text-white/65 overflow-x-auto leading-relaxed whitespace-pre">
        {children.trim()}
      </pre>
    </div>
  );
}

// ── Callout ─────────────────────────────────────────────────────────────────
export function Callout({
  type = "info",
  children,
}: {
  type?: "info" | "warn" | "tip";
  children: React.ReactNode;
}) {
  const styles = {
    info: "border-blue-500/20 bg-blue-500/5 text-blue-300/70",
    warn: "border-yellow-500/20 bg-yellow-500/5 text-yellow-300/70",
    tip:  "border-[#eca8d6]/20 bg-[#eca8d6]/5 text-[#eca8d6]/75",
  };
  const icons = { info: "ℹ", warn: "⚠", tip: "✦" };
  return (
    <div className={`flex gap-3 p-4 border my-6 text-sm leading-relaxed ${styles[type]}`}>
      <span className="shrink-0 mt-0.5">{icons[type]}</span>
      <div>{children}</div>
    </div>
  );
}

// ── Typography ───────────────────────────────────────────────────────────────
export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-3xl font-display tracking-tight mt-12 mb-5 text-white">{children}</h2>;
}
export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-medium mt-8 mb-3 text-white/85">{children}</h3>;
}
export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-white/55 leading-relaxed mb-4">{children}</p>;
}

// ── Diagrams ─────────────────────────────────────────────────────────────────
export function ShieldFlowDiagram() {
  return (
    <svg viewBox="0 0 720 220" className="w-full max-w-2xl" aria-label="Shield flow">
      <defs>
        <marker id="arr" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L7,3 z" fill="rgba(236,168,214,0.7)" />
        </marker>
      </defs>
      <rect x="16" y="85" width="120" height="50" rx="3" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <text x="76" y="108" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="12" fontFamily="monospace">User</text>
      <text x="76" y="124" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">spending key</text>
      <line x1="136" y1="110" x2="196" y2="110" stroke="rgba(236,168,214,0.5)" strokeWidth="1.5" markerEnd="url(#arr)" />
      <text x="166" y="104" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="8.5" fontFamily="monospace">sdk.shield()</text>
      <rect x="196" y="72" width="148" height="76" rx="3" fill="none" stroke="rgba(236,168,214,0.25)" strokeWidth="1" />
      <text x="270" y="102" textAnchor="middle" fill="rgba(236,168,214,0.85)" fontSize="12" fontFamily="monospace">SDK</text>
      <text x="270" y="118" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">generate ZK proof</text>
      <text x="270" y="132" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">compute commitment</text>
      <line x1="344" y1="110" x2="404" y2="110" stroke="rgba(236,168,214,0.5)" strokeWidth="1.5" markerEnd="url(#arr)" />
      <text x="374" y="104" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="8.5" fontFamily="monospace">shield(params, proof)</text>
      <rect x="404" y="64" width="148" height="92" rx="3" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <text x="478" y="94" textAnchor="middle" fill="rgba(255,255,255,0.65)" fontSize="12" fontFamily="monospace">PrivacyPool</text>
      <text x="478" y="110" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">verify proof</text>
      <text x="478" y="124" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">insert Merkle leaf</text>
      <text x="478" y="138" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">take token custody</text>
      <line x1="552" y1="110" x2="610" y2="110" stroke="rgba(236,168,214,0.5)" strokeWidth="1.5" markerEnd="url(#arr)" />
      <rect x="610" y="85" width="92" height="50" rx="3" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <text x="656" y="108" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="12" fontFamily="monospace">0G Chain</text>
      <text x="656" y="123" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="9" fontFamily="monospace">finalized</text>
    </svg>
  );
}

export function MerkleTreeDiagram() {
  const leaves = ["C₀", "C₁", "C₂", "C₃"];
  return (
    <svg viewBox="0 0 480 200" className="w-full max-w-lg" aria-label="Merkle tree">
      {leaves.map((l, i) => (
        <g key={l}>
          <rect x={28 + i * 108} y="148" width="80" height="34" rx="3" fill="none" stroke="rgba(236,168,214,0.3)" strokeWidth="1" />
          <text x={68 + i * 108} y="170" textAnchor="middle" fill="rgba(236,168,214,0.75)" fontSize="11" fontFamily="monospace">{l}</text>
        </g>
      ))}
      {[["H(C₀,C₁)", 82], ["H(C₂,C₃)", 298]].map(([label, x]) => (
        <g key={String(label)}>
          <rect x={Number(x)} y="84" width="112" height="34" rx="3" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
          <text x={Number(x) + 56} y="106" textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="10" fontFamily="monospace">{label}</text>
          <line x1={Number(x) + 56} y1="118" x2={Number(x) === 82 ? 68 : 68 + 216} y2="148" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          <line x1={Number(x) + 56} y1="118" x2={Number(x) === 82 ? 176 : 176 + 216} y2="148" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        </g>
      ))}
      <rect x="172" y="16" width="136" height="34" rx="3" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      <text x="240" y="38" textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize="12" fontFamily="monospace">Root</text>
      <line x1="240" y1="50" x2="138" y2="84" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <line x1="240" y1="50" x2="354" y2="84" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <text x="240" y="194" textAnchor="middle" fill="rgba(255,255,255,0.18)" fontSize="9" fontFamily="monospace">Depth 20 · 2²⁰ commitments · Poseidon2</text>
    </svg>
  );
}

export function SpendFlowDiagram() {
  return (
    <svg viewBox="0 0 680 180" className="w-full max-w-2xl" aria-label="Spend flow">
      <defs>
        <marker id="arr2" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L7,3 z" fill="rgba(236,168,214,0.7)" />
        </marker>
      </defs>
      <rect x="8" y="32" width="100" height="36" rx="3" fill="none" stroke="rgba(236,168,214,0.25)" strokeWidth="1" />
      <text x="58" y="52" textAnchor="middle" fill="rgba(236,168,214,0.65)" fontSize="10" fontFamily="monospace">Note A (in)</text>
      <rect x="8" y="90" width="100" height="36" rx="3" fill="none" stroke="rgba(236,168,214,0.25)" strokeWidth="1" />
      <text x="58" y="110" textAnchor="middle" fill="rgba(236,168,214,0.65)" fontSize="10" fontFamily="monospace">Note B (in)</text>
      <line x1="108" y1="68" x2="160" y2="90" stroke="rgba(255,255,255,0.12)" strokeWidth="1" markerEnd="url(#arr2)" />
      <line x1="108" y1="108" x2="160" y2="90" stroke="rgba(255,255,255,0.12)" strokeWidth="1" markerEnd="url(#arr2)" />
      <rect x="160" y="55" width="130" height="72" rx="3" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
      <text x="225" y="82" textAnchor="middle" fill="rgba(255,255,255,0.65)" fontSize="11" fontFamily="monospace">Spend circuit</text>
      <text x="225" y="97" textAnchor="middle" fill="rgba(255,255,255,0.28)" fontSize="8.5" fontFamily="monospace">verify membership</text>
      <text x="225" y="111" textAnchor="middle" fill="rgba(255,255,255,0.28)" fontSize="8.5" fontFamily="monospace">conserve value</text>
      <line x1="290" y1="91" x2="350" y2="91" stroke="rgba(236,168,214,0.5)" strokeWidth="1.5" markerEnd="url(#arr2)" />
      <rect x="350" y="55" width="130" height="72" rx="3" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <text x="415" y="82" textAnchor="middle" fill="rgba(255,255,255,0.65)" fontSize="11" fontFamily="monospace">PrivacyPool</text>
      <text x="415" y="97" textAnchor="middle" fill="rgba(255,255,255,0.28)" fontSize="8.5" fontFamily="monospace">mark nullifiers</text>
      <text x="415" y="111" textAnchor="middle" fill="rgba(255,255,255,0.28)" fontSize="8.5" fontFamily="monospace">insert outputs</text>
      <line x1="480" y1="78" x2="534" y2="52" stroke="rgba(255,255,255,0.12)" strokeWidth="1" markerEnd="url(#arr2)" />
      <line x1="480" y1="104" x2="534" y2="130" stroke="rgba(255,255,255,0.12)" strokeWidth="1" markerEnd="url(#arr2)" />
      <rect x="534" y="32" width="110" height="36" rx="3" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <text x="589" y="52" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="10" fontFamily="monospace">Note C (recipient)</text>
      <rect x="534" y="110" width="110" height="36" rx="3" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <text x="589" y="130" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="10" fontFamily="monospace">Note D (change)</text>
    </svg>
  );
}
