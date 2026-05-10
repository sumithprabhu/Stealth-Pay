// Card 1 — The Problem. Tweet 2. Uses whale.png from landing page.
export default function Image1() {
  return (
    <div
      style={{
        width: "1200px",
        height: "628px",
        background: "#07070d",
        position: "relative",
        overflow: "hidden",
        fontFamily: "var(--font-jetbrains), 'JetBrains Mono', monospace",
      }}
    >
      {/* Whale image — right side, full height */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/whale.png"
        alt=""
        aria-hidden="true"
        style={{
          position: "absolute",
          right: "-60px",
          top: "50%",
          transform: "translateY(-50%)",
          height: "110%",
          width: "auto",
          objectFit: "contain",
          objectPosition: "right center",
          opacity: 0.9,
        }}
      />

      {/* Left-to-right fade so whale blends into bg */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, #07070d 35%, rgba(7,7,13,0.85) 55%, rgba(7,7,13,0.1) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Scanlines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 4px)",
          pointerEvents: "none",
          zIndex: 5,
        }}
      />

      {/* Copy — left side */}
      <div
        style={{
          position: "absolute",
          left: "72px",
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          zIndex: 10,
          maxWidth: "480px",
        }}
      >
        {/* Label */}
        <span
          style={{
            fontSize: "11px",
            color: "rgba(255,255,255,0.28)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          The problem
        </span>

        {/* Headline */}
        <div
          style={{
            fontFamily: "var(--font-instrument-serif), 'Instrument Serif', serif",
            fontSize: "80px",
            fontWeight: 400,
            color: "rgba(255,255,255,0.95)",
            lineHeight: 0.95,
            letterSpacing: "-0.02em",
          }}
        >
          Your wallet
          <br />
          is <span style={{ color: "#eca8d6" }}>public.</span>
        </div>

        {/* Sub */}
        <div
          style={{
            fontSize: "15px",
            color: "rgba(255,255,255,0.4)",
            lineHeight: 1.6,
            letterSpacing: "0.01em",
          }}
        >
          Every transaction. Every counterparty.
          <br />
          Every amount. Indexed. Searchable. Forever.
        </div>

        {/* Bottom tag */}
        <div
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            marginTop: "8px",
            padding: "5px 14px",
            border: "1px solid rgba(239,68,68,0.25)",
            background: "rgba(239,68,68,0.05)",
            borderRadius: "4px",
          }}
        >
          <span style={{ fontSize: "11px", color: "rgba(239,68,68,0.7)", letterSpacing: "0.1em" }}>
            This was never supposed to be a feature
          </span>
        </div>
      </div>

      {/* Logo bottom left */}
      <div
        style={{
          position: "absolute",
          bottom: "32px",
          left: "72px",
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-instrument-serif), serif",
            fontSize: "15px",
            color: "rgba(255,255,255,0.2)",
          }}
        >
          Stealth<span style={{ color: "rgba(236,168,214,0.4)" }}>Pay</span>
        </span>
      </div>
    </div>
  );
}
