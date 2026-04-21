"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

export function CtaSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <section ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div
          className={`relative border border-foreground transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
          onMouseMove={handleMouseMove}
        >
          {/* Spotlight */}
          <div
            className="absolute inset-0 opacity-[0.07] pointer-events-none"
            style={{
              background: `radial-gradient(500px circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(236,168,214,0.6), transparent 50%)`,
            }}
          />

          <div className="relative z-10 px-8 lg:px-16 py-16 lg:py-24">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
              {/* Left content */}
              <div className="flex-1">
                <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-8">
                  <span className="w-8 h-px bg-foreground/30" />
                  Get started
                </span>

                <h2 className="text-6xl md:text-7xl lg:text-[72px] font-display tracking-tight mb-8 leading-[0.95]">
                  Your privacy starts
                  <br />
                  <span className="text-muted-foreground">with one transaction.</span>
                </h2>

                <p className="text-xl text-muted-foreground mb-12 leading-relaxed max-w-xl">
                  Shield your tokens in seconds. No sign-up, no KYC, no trusted parties.
                  Just you, your keys, and a zero-knowledge proof.
                </p>

                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <a
                    href="/app"
                    className="inline-flex items-center gap-2 bg-foreground text-background px-8 py-4 text-base font-medium hover:bg-foreground/90 transition-colors group"
                  >
                    Launch app
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </a>
                  <a
                    href="/docs"
                    className="inline-flex items-center gap-2 border border-foreground/20 px-8 py-4 text-base font-mono hover:bg-foreground/5 transition-colors"
                  >
                    Read the docs →
                  </a>
                </div>

                <p className="text-sm text-muted-foreground mt-8 font-mono">
                  Deployed on 0G Galileo testnet · Open source · Non-custodial
                </p>
              </div>

              {/* Right image */}
              <div className="hidden lg:flex items-end justify-center w-[560px] h-[620px] -mr-16">
                <img
                  src="/images/bridge.png"
                  alt=""
                  aria-hidden="true"
                  className="w-full h-full object-contain object-bottom"
                />
              </div>
            </div>
          </div>

          <div className="absolute top-0 right-0 w-32 h-32 border-b border-l border-foreground/10" />
          <div className="absolute bottom-0 left-0 w-32 h-32 border-t border-r border-foreground/10" />
        </div>
      </div>
    </section>
  );
}
