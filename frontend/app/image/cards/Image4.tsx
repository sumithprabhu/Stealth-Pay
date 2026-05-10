// Card 4 — SDK. Tweet 5: npm install + three calls.
export default function Image4() {
  return (
    <div
      style={{
        width: "1200px",
        height: "628px",
        background: "#07070d",
        position: "relative",
        overflow: "hidden",
        fontFamily: "var(--font-jetbrains), 'JetBrains Mono', monospace",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
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

      {/* Glow behind editor */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "700px",
          height: "400px",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(236,168,214,0.05) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* Left — install + label */}
      <div
        style={{
          position: "absolute",
          left: "80px",
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          zIndex: 20,
          width: "300px",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-instrument-serif), serif",
            fontSize: "48px",
            fontWeight: 400,
            color: "rgba(255,255,255,0.9)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          Three calls.
          <br />
          <span style={{ color: "#eca8d6" }}>Full privacy.</span>
        </div>

        <div
          style={{
            background: "#0d0d14",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "8px",
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "12px" }}>$</span>
          <span style={{ fontSize: "13px", color: "#86efac" }}>npm install</span>
          <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>stealthpay-sdk</span>
        </div>

        <div
          style={{
            fontSize: "12px",
            color: "rgba(255,255,255,0.2)",
            lineHeight: 1.6,
          }}
        >
          Proof generation.
          <br />
          Merkle tree sync.
          <br />
          Nullifier tracking.
          <br />
          All handled.
        </div>
      </div>

      {/* Right — code editor */}
      <div
        style={{
          position: "absolute",
          right: "60px",
          top: "50%",
          transform: "translateY(-50%)",
          width: "620px",
          background: "#0d0d14",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "12px",
          overflow: "hidden",
          zIndex: 20,
        }}
      >
        {/* Editor title bar */}
        <div
          style={{
            background: "#111118",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444", opacity: 0.7 }} />
          <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#fbbf24", opacity: 0.7 }} />
          <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#22c55e", opacity: 0.7 }} />
          <span
            style={{
              marginLeft: "12px",
              fontSize: "11px",
              color: "rgba(255,255,255,0.2)",
              letterSpacing: "0.05em",
            }}
          >
            payments.ts
          </span>
        </div>

        {/* Code content */}
        <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: "6px" }}>
          {/* import line */}
          <div style={{ fontSize: "14px", lineHeight: 1.7, color: "rgba(255,255,255,0.25)" }}>
            <span style={{ color: "rgba(167,139,250,0.7)" }}>import</span>
            {" { StealthPay } "}
            <span style={{ color: "rgba(167,139,250,0.7)" }}>from</span>
            {" "}
            <span style={{ color: "rgba(134,239,172,0.6)" }}>&apos;stealthpay-sdk&apos;</span>
          </div>

          <div style={{ height: "12px" }} />

          {/* shield */}
          <div style={{ fontSize: "14px", lineHeight: 1.7 }}>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>await sdk.</span>
            <span style={{ color: "#eca8d6" }}>shield</span>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>(USDC, amount)</span>
          </div>
          <div
            style={{
              marginLeft: "16px",
              fontSize: "11px",
              color: "rgba(255,255,255,0.18)",
              fontStyle: "italic",
            }}
          >
            // tokens enter the pool · one commitment on-chain
          </div>

          <div style={{ height: "8px" }} />

          {/* privateSend */}
          <div style={{ fontSize: "14px", lineHeight: 1.7 }}>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>await sdk.</span>
            <span style={{ color: "#eca8d6" }}>privateSend</span>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>(USDC, amount, pubkey)</span>
          </div>
          <div
            style={{
              marginLeft: "16px",
              fontSize: "11px",
              color: "rgba(255,255,255,0.18)",
              fontStyle: "italic",
            }}
          >
            // no on-chain link between sender and receiver
          </div>

          <div style={{ height: "8px" }} />

          {/* unshield */}
          <div style={{ fontSize: "14px", lineHeight: 1.7 }}>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>await sdk.</span>
            <span style={{ color: "#eca8d6" }}>unshield</span>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>(USDC, amount, address)</span>
          </div>
          <div
            style={{
              marginLeft: "16px",
              fontSize: "11px",
              color: "rgba(255,255,255,0.18)",
              fontStyle: "italic",
            }}
          >
            // ZK proof verified on-chain · tokens released
          </div>

          <div style={{ height: "20px" }} />

          {/* Bottom bar */}
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.05)",
              paddingTop: "16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.15)" }}>
              stealthpay-sdk · npm
            </span>
            <span style={{ fontSize: "11px", color: "rgba(103,232,249,0.4)" }}>
              0G Chain ·{" "}
              <span style={{ color: "rgba(134,239,172,0.5)" }}>mainnet live</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
