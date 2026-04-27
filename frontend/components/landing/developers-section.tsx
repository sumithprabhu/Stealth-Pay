"use client";

import { useState } from "react";
import { useVisible } from "@/hooks/use-visible";

const features = [
  {
    title: "TypeScript SDK",
    description: "Full type safety. Shield, spend, and unshield with a single import.",
  },
  {
    title: "Local proof generation",
    description: "Nargo + Barretenberg CLI. No cloud, no leaks. Proofs stay on your machine.",
  },
  {
    title: "Auto Merkle sync",
    description: "NoteManager replays chain events and keeps siblings fresh automatically.",
  },
  {
    title: "0G Chain native",
    description: "Deployed on Galileo testnet. Sub-second finality, near-zero gas costs.",
  },
];

const codeSnippet = `import { StealthPaySDK } from "@stealthpay/sdk";
import { ethers } from "ethers";

const sdk = new StealthPaySDK({
  signer,
  privacyPoolAddress: "0x87fE...83F1",
  spendingPrivkey: myPrivkey,
});

// Sync Merkle tree from chain
await sdk.sync(provider);

// Shield 100 USDC
const { commitment } = await sdk.shield(USDC, 100_000_000n);

// Send privately
await sdk.privateSend(USDC, 50_000_000n, receiverPubkey);

// Withdraw
await sdk.unshield(USDC, 50_000_000n, recipient);`;

export function DevelopersSection() {
  const { ref: sectionRef, isVisible } = useVisible<HTMLElement>();

  return (
    <section id="developers" ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden">
      {/* Background image */}
      <div
        className={`absolute bottom-0 right-0 w-[55%] h-[85%] pointer-events-none transition-all duration-1000 delay-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <img
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Upscaled%20Image%20%2813%29-OQ2DiR3ElVsUg8kTvTL1kC5A3Q6maM.png"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover object-left-top"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-transparent" />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div
          className={`mb-16 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
            Developer SDK
          </span>
          <h2 className="text-6xl md:text-7xl lg:text-[128px] font-display tracking-tight leading-[0.9]">
            Build private
            <br />
            <span className="text-muted-foreground">apps in minutes.</span>
          </h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left: description + features */}
          <div
            className={`transition-all duration-700 delay-100 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <p className="text-xl text-muted-foreground mb-12 leading-relaxed max-w-md">
              One SDK. Three primitives: shield, spend, unshield. Everything else handled for you: proofs,
              Merkle siblings, nullifiers.
            </p>
            <div className="grid grid-cols-2 gap-6">
              {features.map((feature, index) => (
                <div
                  key={feature.title}
                  className={`transition-all duration-500 ${
                    isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  }`}
                  style={{ transitionDelay: `${index * 50 + 200}ms` }}
                >
                  <h3 className="font-medium mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex gap-4">
              <a
                href="/docs"
                className="inline-flex items-center gap-2 text-sm font-mono border border-foreground/20 px-5 py-2.5 hover:bg-foreground/5 transition-colors"
              >
                Read the docs →
              </a>
              <a
                href="https://github.com"
                className="inline-flex items-center gap-2 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors"
              >
                GitHub ↗
              </a>
            </div>
          </div>

          {/* Right: code block */}
          <div
            className={`transition-all duration-700 delay-200 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <div className="border border-foreground/10 bg-black/60 backdrop-blur-sm">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-foreground/10">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                <span className="ml-2 text-xs font-mono text-muted-foreground">example.ts</span>
              </div>
              <pre className="p-6 text-xs font-mono text-white/70 overflow-x-auto leading-relaxed whitespace-pre">
                {codeSnippet}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
