"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

const PINK = "#eca8d6";

const HERO_VIDEO = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/bg-hero-0BnFGdr81Ifnj3WbBZoNt1KE4D5DMT.mp4";

// ─── Layout: full-bleed media bg + text overlay ───────────────────────────────
// Image/video sits on the right, never cropped (object-contain on black).
// A left-to-right gradient creates a readable zone for the text.

function MediaSlide({
  eyebrow, heading, children,
  media, mediaType = "image",
  textSide = "left",
  headingSize = "clamp(2.5rem, 3.8vw, 4rem)",
}: {
  eyebrow?: string;
  heading: React.ReactNode;
  children: React.ReactNode;
  media: string;
  mediaType?: "image" | "video";
  textSide?: "left" | "right";
  headingSize?: string;
}) {
  const gradientDir = textSide === "left"
    ? "to right, #000 45%, rgba(0,0,0,0.5) 70%, transparent 100%"
    : "to left,  #000 45%, rgba(0,0,0,0.5) 70%, transparent 100%";

  const textAlign = textSide === "left" ? "left" : "right";
  const textPad   = textSide === "left" ? "pl-16 lg:pl-24 pr-8" : "pr-16 lg:pr-24 pl-8";

  return (
    <div className="relative flex h-full w-full overflow-hidden" style={{ background: "#000" }}>

      {/* Media — object-contain so nothing is cropped */}
      <div className={`absolute inset-0 flex items-center ${textSide === "left" ? "justify-end" : "justify-start"}`}>
        {mediaType === "video" ? (
          <video
            className="h-full w-auto max-w-[65%] object-contain"
            autoPlay loop muted playsInline
            style={{ opacity: 0.75 }}
          >
            <source src={media} type="video/mp4" />
          </video>
        ) : (
          <div className="relative h-full" style={{ width: "55%" }}>
            <Image src={media} alt="" fill className="object-contain" style={{ opacity: 0.85 }} />
          </div>
        )}
      </div>

      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0" style={{ background: `linear-gradient(${gradientDir})` }} />

      {/* Text */}
      <div className={`relative z-10 flex flex-col justify-center h-full ${textPad} max-w-[55%] ${textSide === "right" ? "ml-auto" : ""}`}>
        {eyebrow && (
          <p className={`text-2xl font-mono uppercase tracking-widest mb-5 text-${textAlign}`} style={{ color: PINK }}>
            {eyebrow}
          </p>
        )}
        <div className={`font-display tracking-tight text-white mb-8 leading-tight text-${textAlign}`}
          style={{ fontSize: headingSize }}>
          {heading}
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Slides ───────────────────────────────────────────────────────────────────

function Slide1() {
  return (
    <div className="relative flex h-full w-full overflow-hidden" style={{ background: "#000" }}>

      {/* Full-bleed video */}
      <video
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay loop muted playsInline
        style={{ opacity: 0.45 }}
      >
        <source src={HERO_VIDEO} type="video/mp4" />
      </video>

      {/* Dark overlay so text pops */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.50) 60%, rgba(0,0,0,0.30) 100%)" }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-center h-full pl-16 lg:pl-24 max-w-[60%]">

        {/* Logo + name */}
        <div className="flex items-center gap-4 mb-6">
          <img src="/logo.png" alt="StealthPay" className="w-12 h-12" />
          <h1 className="text-5xl lg:text-6xl font-display tracking-tight text-white">
            Stealth <span style={{ color: PINK }}>Pay</span>
          </h1>
        </div>

        <p className="text-lg text-white/60 font-mono mb-10 leading-relaxed">
          Private token transfers on 0G Chain.<br />
          Enforced by Zero-Knowledge proofs.
        </p>

      </div>
    </div>
  );
}

function Slide2() {
  return (
    <MediaSlide
      eyebrow="The Problem"
      heading={<>Every blockchain transaction<br />is public.</>}
      media="/images/audit.jpg"
      textSide="left"
      headingSize="clamp(2.5rem, 3.8vw, 4rem)"
    >
      <div className="space-y-3">
        {[
          { title: "Salaries are visible", body: "Anyone can see what your employer pays you and when." },
          { title: "Deals are exposed", body: "Competitors track treasury moves, partnerships, and spending." },
          { title: "Users are tracked", body: "Wallet addresses become permanent public identities." },
        ].map(item => (
          <div key={item.title} className="flex gap-4 border border-white/25 p-4">
            <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: PINK }} />
            <div>
              <p className="text-white font-mono text-sm mb-0.5">{item.title}</p>
              <p className="text-white/55 text-sm leading-relaxed">{item.body}</p>
            </div>
          </div>
        ))}
      </div>
    </MediaSlide>
  );
}

function Slide3() {
  return (
    <MediaSlide
      eyebrow="The Solution"
      heading={<>What is Stealth <span style={{ color: PINK }}>Pay</span>?</>}
      headingSize="clamp(2.5rem, 3.8vw, 4rem)"
      media="/images/encrypted.jpg"
      textSide="right"
    >
      <p className="text-white/60 text-base mb-6 leading-relaxed text-right">
        A privacy layer for 0G Chain. Shield, transfer privately,
        and withdraw with no observable link between deposit and withdrawal.
      </p>
      <div className="space-y-3">
        {[
          { step: "01", label: "Shield", desc: "public → private", color: "#34d399" },
          { step: "02", label: "Private Transfer", desc: "private → private", color: PINK },
          { step: "03", label: "Unshield", desc: "private → public", color: "#60a5fa" },
        ].map(s => (
          <div key={s.step} className="flex items-center gap-4 border border-white/25 px-5 py-3">
            <span className="text-xs font-mono" style={{ color: s.color }}>{s.step}</span>
            <span className="text-white font-mono text-sm flex-1">{s.label}</span>
            <span className="text-xs font-mono px-3 py-1 border"
              style={{ color: s.color, borderColor: s.color + "44" }}>{s.desc}</span>
          </div>
        ))}
      </div>
    </MediaSlide>
  );
}

function Slide4() {
  return (
    <MediaSlide
      eyebrow="Why Now"
      heading={<>The timing is right.</>}
      headingSize="clamp(2.5rem, 3.8vw, 4rem)"
      media="/images/bridge.png"
      textSide="left"
    >
      <div className="space-y-3">
        {[
          { title: "0G Chain is live", body: "Fast finality, low fees, native decentralised storage." },
          { title: "ZK is fast enough", body: "UltraHonk proofs under 60 seconds. A year ago this took minutes." },
          { title: "Enterprises need privacy", body: "On-chain payroll, treasury, B2B. No production-grade solution existed." },
          { title: "Developers need primitives", body: "Three function calls. No ZK expertise required." },
        ].map(item => (
          <div key={item.title} className="flex gap-4 border border-white/25 p-4">
            <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: PINK }} />
            <div>
              <p className="text-white font-mono text-sm mb-0.5">{item.title}</p>
              <p className="text-white/55 text-sm">{item.body}</p>
            </div>
          </div>
        ))}
      </div>
    </MediaSlide>
  );
}

function Slide5() {
  return (
    <MediaSlide
      eyebrow="Product"
      heading={<>Built for devs. Invisible to users.</>}
      headingSize="clamp(2.5rem, 3.8vw, 4rem)"
      media="/images/isolated.jpg"
      textSide="right"
    >
      <div className="mb-5 border border-white/25 p-5" style={{ background: "rgba(0,0,0,0.6)" }}>
        <p className="text-xs font-mono text-white/40 mb-3 uppercase tracking-widest">SDK · 3 calls</p>
        <div className="font-mono text-sm space-y-2">
          <p><span style={{ color: PINK }}>sdk</span><span className="text-white/40">.shield(</span><span className="text-white/80">token, amount</span><span className="text-white/40">)</span></p>
          <p><span style={{ color: PINK }}>sdk</span><span className="text-white/40">.privateSend(</span><span className="text-white/80">token, amount, pubkey</span><span className="text-white/40">)</span></p>
          <p><span style={{ color: PINK }}>sdk</span><span className="text-white/40">.unshield(</span><span className="text-white/80">token, amount, address</span><span className="text-white/40">)</span></p>
        </div>
      </div>
      <div className="space-y-2">
        {[
          "UltraHonk ZK circuits via Noir + Barretenberg",
          "Poseidon2 incremental Merkle tree",
          "ECIES-encrypted note hints on 0G Storage",
          "Live on 0G Mainnet + Galileo testnet",
        ].map(item => (
          <div key={item} className="flex gap-3 text-sm text-white/60 justify-end">
            <span>{item}</span>
            <span style={{ color: PINK + "80" }}>→</span>
          </div>
        ))}
      </div>
    </MediaSlide>
  );
}

function Slide6() {
  return (
    <MediaSlide
      eyebrow="Business Model"
      heading={<>Simple pricing. Scalable revenue.</>}
      headingSize="clamp(2.5rem, 3.8vw, 4rem)"
      media="/images/permissions.jpg"
      textSide="left"
    >
      <div className="mb-5 border p-5" style={{ borderColor: PINK + "55", background: "rgba(0,0,0,0.7)" }}>
        <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: PINK + "99" }}>Protocol fee</p>
        <p className="text-6xl font-display text-white">0.1<span className="text-3xl text-white/40">%</span></p>
        <p className="text-sm text-white/50 mt-2">On every shield, transfer, and unshield.</p>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-mono text-white/35 uppercase tracking-widest mb-3">Developer tiers · upcoming</p>
        {[
          { tier: "Free",       desc: "Build on the shared pool. 0% additional fee.", color: "#34d399" },
          { tier: "Pro",        desc: "Custom fee on your volume. Revenue share.",     color: PINK },
          { tier: "Enterprise", desc: "Dedicated pool, SLA, custom token whitelist.",  color: "#a78bfa" },
        ].map(item => (
          <div key={item.tier} className="flex items-center gap-4 border border-white/25 px-4 py-3"
            style={{ background: "rgba(0,0,0,0.5)" }}>
            <span className="text-xs font-mono px-2 py-1 border shrink-0"
              style={{ color: item.color, borderColor: item.color + "55" }}>{item.tier}</span>
            <p className="text-sm text-white/60">{item.desc}</p>
          </div>
        ))}
      </div>
    </MediaSlide>
  );
}

function Slide7() {
  return (
    <MediaSlide
      eyebrow="Roadmap"
      heading={<>Moving fast.</>}
      media="/images/whale.png"
      textSide="right"
    >
      <div className="space-y-5">
        {[
          { date: "Apr 2026",     label: "Testnet Live",    done: true,  upcoming: false, items: ["ZK circuits", "SDK on npm", "Playground"] },
          { date: "May 2026",     label: "Mainnet Alpha",   done: true,  upcoming: false, items: ["PrivacyPool on 0G Mainnet", "Full ZK proof flow", "0G Storage hints"] },
          { date: "30 May 2026",  label: "Mainnet Beta",    done: false, upcoming: true,  items: ["Developer fee tiers", "Multi-token support", "Relayer network"] },
          { date: "Q3 2026+",     label: "Scale",           done: false, upcoming: false, items: ["DeFi integrations", "zkKYC module", "Enterprise pools"] },
        ].map((row, i) => (
          <div key={row.label} className="flex gap-4 items-start">
            <div className="flex flex-col items-center shrink-0 pt-1">
              <div className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
                style={{
                  borderColor: row.done ? "#34d399" : row.upcoming ? PINK : "rgba(255,255,255,0.25)",
                  background:  row.done ? "#34d399" : "transparent",
                }}>
                {row.done && <span className="text-[8px] text-black font-bold leading-none">✓</span>}
              </div>
              {i < 3 && <div className="w-px h-4 mt-1" style={{ background: "rgba(255,255,255,0.12)" }} />}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <p className="text-sm font-mono text-white">{row.label}</p>
                <span className="text-xs font-mono text-white/35">{row.date}</span>
                {row.upcoming && (
                  <span className="text-xs font-mono px-2 py-0.5 border"
                    style={{ color: PINK, borderColor: PINK + "44" }}>upcoming</span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-3">
                {row.items.map(item => (
                  <span key={item} className="text-xs text-white/45">{item}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </MediaSlide>
  );
}

function Slide8() {
  return (
    <div className="relative flex h-full w-full overflow-hidden" style={{ background: "#000" }}>
      {/* Shield image — full height, right side, uncropped */}
      <div className="absolute right-0 top-0 h-full flex items-center">
        <div className="relative h-full" style={{ width: "50vw" }}>
          <Image src="/images/shield.png" alt="" fill className="object-contain object-right" style={{ opacity: 0.9 }} />
        </div>
      </div>

      {/* Left-to-right gradient */}
      <div className="absolute inset-0"
        style={{ background: "linear-gradient(to right, #000 50%, rgba(0,0,0,0.4) 75%, transparent 100%)" }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-center h-full px-16 lg:px-24 max-w-[55%]">
        <p className="text-xs font-mono uppercase tracking-widest mb-6" style={{ color: PINK }}>Vision</p>
        <h2 className="text-6xl lg:text-7xl font-display tracking-tight text-white mb-8 leading-tight">
          The privacy layer<br />for all of Web3.
        </h2>
        <div className="space-y-3 mb-10">
          {[
            "Every protocol deserves private payments",
            "Every user deserves financial privacy",
            "Every developer deserves simple ZK primitives",
          ].map(item => (
            <div key={item} className="flex items-center gap-3 text-white/65 text-sm">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: PINK }} />
              {item}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-5 text-sm font-mono text-white/35 border-t border-white/15 pt-6">
          <a href="https://trystealth.xyz" target="_blank" rel="noopener noreferrer"
            className="hover:text-white/65 transition-colors">trystealth.xyz ↗</a>
          <span className="text-white/10">·</span>
          <span>0G Mainnet live</span>
        </div>
      </div>
    </div>
  );
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const SLIDES = [
  { component: Slide1, label: "Title" },
  { component: Slide2, label: "Problem" },
  { component: Slide3, label: "Solution" },
  { component: Slide4, label: "Why Now" },
  { component: Slide5, label: "Product" },
  { component: Slide6, label: "Business" },
  { component: Slide7, label: "Roadmap" },
  { component: Slide8, label: "Vision" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Presentation() {
  const [current, setCurrent] = useState(0);
  const total = SLIDES.length;

  const go = (n: number) => { if (n >= 0 && n < total) setCurrent(n); };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") go(current + 1);
      if (e.key === "ArrowLeft"  || e.key === "ArrowUp")   go(current - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col" style={{ background: "#000" }}>

      {/* Viewport */}
      <div className="flex-1 relative overflow-hidden">
        <div
          className="flex h-full"
          style={{
            width: `${total * 100}%`,
            transform: `translateX(-${(current / total) * 100}%)`,
            transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {SLIDES.map(({ component: SlideComp }, i) => (
            <div key={i} className="h-full" style={{ width: `${100 / total}%` }}>
              <SlideComp />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="h-14 border-t border-white/10 flex items-center justify-between px-8 shrink-0"
        style={{ background: "#000" }}>

        <span className="text-xs font-mono text-white/30 w-32">
          {String(current + 1).padStart(2, "0")} / {String(total).padStart(2, "0")} — {SLIDES[current].label}
        </span>

        <div className="flex items-center gap-2">
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => go(i)} className="transition-all duration-300"
              style={{
                width:      i === current ? "24px" : "6px",
                height:     "6px",
                borderRadius: "3px",
                background: i === current ? PINK : "rgba(255,255,255,0.25)",
              }}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 w-32 justify-end">
          <button onClick={() => go(current - 1)} disabled={current === 0}
            className="w-9 h-9 border border-white/25 flex items-center justify-center text-white/60 hover:text-white hover:border-white/50 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-sm">
            ←
          </button>
          <button onClick={() => go(current + 1)} disabled={current === total - 1}
            className="w-9 h-9 border border-white/25 flex items-center justify-center text-white/60 hover:text-white hover:border-white/50 disabled:opacity-20 disabled:cursor-not-allowed transition-all text-sm">
            →
          </button>
        </div>
      </div>
    </div>
  );
}
