// Card 3 — Live on Mainnet. Tweet 4: what's deployed today.
export default function Image3() {
  const items = [
    "ZK circuits verified on-chain · Noir + UltraHonk",
    "Immutable verifiers · no admin key on proof logic",
    "TypeScript SDK on npm · stealthpay-sdk",
    "Live playground · connect wallet and try it",
    "Docs · architecture, circuits, SDK reference",
    "Open source",
  ];

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
      {/* Scanlines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.018) 2px, rgba(255,255,255,0.018) 4px)",
          pointerEvents: "none",
          zIndex: 10,
        }}
      />

      {/* Pink bloom behind LIVE */}
      <div
        style={{
          position: "absolute",
          top: "-80px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "600px",
          height: "400px",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(236,168,214,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)",
          pointerEvents: "none",
          zIndex: 10,
        }}
      />

      {/* Left side — LIVE + chain */}
      <div
        style={{
          position: "absolute",
          left: "80px",
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          zIndex: 20,
        }}
      >
        {/* Live dot + label */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#86efac",
              boxShadow: "0 0 8px rgba(134,239,172,0.8)",
            }}
          />
          <span
            style={{
              fontSize: "11px",
              color: "#86efac",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            Live · May 2026
          </span>
        </div>

        {/* LIVE */}
        <div
          style={{
            fontFamily: "var(--font-instrument-serif), serif",
            fontSize: "120px",
            fontWeight: 400,
            color: "#eca8d6",
            lineHeight: 0.9,
            letterSpacing: "-0.03em",
            textShadow: "0 0 80px rgba(236,168,214,0.25)",
          }}
        >
          LIVE
        </div>

        {/* Chain badge */}
        <div
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            padding: "6px 16px",
            borderRadius: "6px",
            background: "rgba(103,232,249,0.06)",
            border: "1px solid rgba(103,232,249,0.2)",
            gap: "8px",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: "12px", color: "#67e8f9" }}>0G Mainnet</span>
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)" }}>+</span>
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Galileo Testnet</span>
        </div>

        {/* Tagline */}
        <div
          style={{
            marginTop: "8px",
            fontSize: "13px",
            color: "rgba(255,255,255,0.25)",
            fontStyle: "italic",
            maxWidth: "340px",
            lineHeight: 1.5,
          }}
        >
          Privacy by math. Not policy.
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          position: "absolute",
          left: "500px",
          top: "60px",
          bottom: "60px",
          width: "1px",
          background: "rgba(255,255,255,0.06)",
          zIndex: 20,
        }}
      />

      {/* Right side — checklist */}
      <div
        style={{
          position: "absolute",
          left: "540px",
          right: "60px",
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          zIndex: 20,
        }}
      >
        <div
          style={{
            fontSize: "10px",
            color: "rgba(255,255,255,0.25)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginBottom: "4px",
          }}
        >
          What shipped
        </div>
        {items.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <span
              style={{
                fontSize: "12px",
                color: "#86efac",
                marginTop: "1px",
                flexShrink: 0,
              }}
            >
              ✓
            </span>
            <span
              style={{
                fontSize: "13px",
                color: "rgba(255,255,255,0.55)",
                lineHeight: 1.4,
              }}
            >
              {item}
            </span>
          </div>
        ))}
      </div>

      {/* Bottom right — logo */}
      <div
        style={{
          position: "absolute",
          bottom: "32px",
          right: "48px",
          zIndex: 20,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-instrument-serif), serif",
            fontSize: "16px",
            color: "rgba(255,255,255,0.2)",
          }}
        >
          Stealth<span style={{ color: "rgba(236,168,214,0.4)" }}>Pay</span>
        </span>
      </div>
    </div>
  );
}
