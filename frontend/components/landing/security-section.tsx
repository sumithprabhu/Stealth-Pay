"use client";

import { useEffect, useState } from "react";
import { useVisible } from "@/hooks/use-visible";
import { Shield, Lock, Eye, GitBranch } from "lucide-react";

const securityFeatures = [
  {
    icon: Shield,
    title: "UltraHonk ZK proofs",
    description: "Every shield and spend is backed by a zero-knowledge proof. Mathematically impossible to fake.",
    image: "/images/shield.png",
  },
  {
    icon: Lock,
    title: "Nullifier system",
    description: "Spent notes are cryptographically invalidated. Double-spend is impossible by construction.",
    image: "/images/isolated.jpg",
  },
  {
    icon: Eye,
    title: "On-chain verification",
    description: "Proofs are verified by immutable smart contracts. No oracle, no relayer, no trust.",
    image: "/images/encrypted.jpg",
  },
  {
    icon: GitBranch,
    title: "No trusted setup",
    description: "Pure math. No ceremonies, no coordinator, no backdoors. Verify everything yourself.",
    image: "/images/audit.jpg",
  },
];

const properties = ["Soundness", "Completeness", "Zero-knowledge", "Non-interactive"];

export function SecuritySection() {
  const { ref: sectionRef, isVisible } = useVisible<HTMLElement>();
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % securityFeatures.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="security" ref={sectionRef} className="relative py-32 lg:py-40 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="mb-20">
          <span
            className={`inline-flex items-center gap-4 text-sm font-mono text-muted-foreground mb-8 transition-all duration-700 ${
              isVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            Security
          </span>

          <h2
            className={`text-6xl md:text-7xl lg:text-[128px] font-display tracking-tight leading-[0.9] mb-12 transition-all duration-1000 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            Trust math,
            <br />
            <span className="text-muted-foreground">not promises.</span>
          </h2>

          <div
            className={`transition-all duration-1000 delay-100 ${isVisible ? "opacity-100" : "opacity-0"}`}
          >
            <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
              Privacy should be a protocol guarantee, not a policy statement. Every claim Stealth{" "}
              <span className="text-[#eca8d6]">Pay</span>{" "}
              makes is backed by cryptographic proof, verifiable on-chain, forever.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          {/* Visual card */}
          <div
            className={`lg:col-span-7 relative p-8 lg:p-12 border border-foreground/10 min-h-[400px] overflow-hidden transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <div className="absolute inset-0 pointer-events-none items-center justify-end hidden lg:flex">
              {securityFeatures.map((feature, index) => (
                <img
                  key={feature.image}
                  src={feature.image}
                  alt={feature.title}
                  className="absolute h-3/4 w-3/4 object-contain object-right transition-opacity duration-500"
                  style={{ opacity: activeFeature === index ? 0.85 : 0 }}
                />
              ))}
            </div>

            <div className="relative z-10">
              <span className="font-mono text-sm text-muted-foreground">Proof properties</span>
              <div className="mt-8">
                <span className="text-7xl lg:text-8xl font-display">4</span>
                <span className="block text-muted-foreground mt-2">
                  cryptographic guarantees in every proof
                </span>
              </div>
            </div>

            <div className="absolute bottom-8 left-8 right-8 flex flex-wrap gap-2">
              {properties.map((prop, index) => (
                <span
                  key={prop}
                  className={`px-3 py-1 border border-foreground/10 text-xs font-mono text-muted-foreground transition-all duration-500 ${
                    isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  }`}
                  style={{ transitionDelay: `${index * 100 + 300}ms` }}
                >
                  {prop}
                </span>
              ))}
            </div>
          </div>

          {/* Feature list */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {securityFeatures.map((feature, index) => (
              <div
                key={feature.title}
                className={`p-6 border transition-all duration-500 cursor-default ${
                  activeFeature === index
                    ? "border-foreground/30 bg-foreground/[0.04]"
                    : "border-foreground/10"
                } ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}
                style={{ transitionDelay: `${index * 80}ms` }}
                onClick={() => setActiveFeature(index)}
                onMouseEnter={() => setActiveFeature(index)}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`shrink-0 w-10 h-10 flex items-center justify-center border transition-colors ${
                      activeFeature === index
                        ? "border-foreground bg-foreground text-background"
                        : "border-foreground/20"
                    }`}
                  >
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
