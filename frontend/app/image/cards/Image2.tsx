// Card 2 — The Flow. Tweet 3: shield → privateSend → unshield
export default function Image2() {
  const steps = [
    {
      label: "01 / SHIELD",
      title: "shield()",
      hash: "0x298e3a81...ee5",
      tag: "COMMITMENT",
      tagColor: "#eca8d6",
      sub: "tokens enter the pool",
      icon: "▣",
    },
    {
      label: "02 / PRIVATE SEND",
      title: "privateSend()",
      hash: "no link",
      tag: "NULLIFIED → NEW NOTE",
      tagColor: "#67e8f9",
      sub: "no on-chain connection",
      icon: "⇢",
      isCenter: true,
    },
    {
      label: "03 / UNSHIELD",
      title: "unshield()",
      hash: "0x9f2b7c4a...d3f",
      tag: "VERIFIED ✓",
      tagColor: "#86efac",
      sub: "tokens released",
      icon: "◎",
    },
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

      {/* Top label */}
      <div
        style={{
          position: "absolute",
          top: "40px",
          left: "60px",
          right: "60px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 20,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-instrument-serif), serif",
            fontSize: "22px",
            color: "rgba(255,255,255,0.9)",
          }}
        >
          Stealth<span style={{ color: "#eca8d6" }}>Pay</span>
        </span>
        <span
          style={{
            fontSize: "11px",
            color: "rgba(255,255,255,0.3)",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          Zero-Knowledge Privacy · 0G Chain
        </span>
      </div>

      {/* Three columns */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0px",
          padding: "80px 60px 80px",
          zIndex: 20,
        }}
      >
        {steps.map((step, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            {/* Card */}
            <div
              style={{
                flex: 1,
                background: step.isCenter ? "transparent" : "#0d0d14",
                border: step.isCenter ? "none" : "1px solid rgba(255,255,255,0.07)",
                borderRadius: "12px",
                padding: "28px 24px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                position: "relative",
              }}
            >
              {/* Step label */}
              <div
                style={{
                  fontSize: "10px",
                  color: "rgba(255,255,255,0.28)",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                }}
              >
                {step.label}
              </div>

              {/* Icon + function name */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "20px", color: step.tagColor, opacity: 0.8 }}>
                  {step.icon}
                </span>
                <span
                  style={{
                    fontSize: step.isCenter ? "20px" : "22px",
                    color: step.isCenter ? "#67e8f9" : "#eca8d6",
                    fontWeight: 400,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {step.title}
                </span>
              </div>

              {/* Hash / value */}
              <div
                style={{
                  fontSize: "12px",
                  color: step.isCenter ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.4)",
                  fontStyle: step.isCenter ? "italic" : "normal",
                  letterSpacing: "0.02em",
                }}
              >
                {step.hash}
              </div>

              {/* Tag */}
              <div
                style={{
                  display: "inline-flex",
                  alignSelf: "flex-start",
                  padding: "3px 10px",
                  borderRadius: "4px",
                  background: `${step.tagColor}14`,
                  border: `1px solid ${step.tagColor}30`,
                  fontSize: "10px",
                  color: step.tagColor,
                  letterSpacing: "0.1em",
                }}
              >
                {step.tag}
              </div>

              {/* Sub */}
              <div
                style={{
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.3)",
                }}
              >
                {step.sub}
              </div>

              {/* Glow for center */}
              {step.isCenter && (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "120px",
                    height: "120px",
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(103,232,249,0.06) 0%, transparent 70%)",
                    pointerEvents: "none",
                  }}
                />
              )}
            </div>

            {/* Arrow between cards */}
            {i < steps.length - 1 && (
              <div
                style={{
                  width: "52px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="44" height="16" viewBox="0 0 44 16" fill="none">
                  <line
                    x1="0"
                    y1="8"
                    x2="34"
                    y2="8"
                    stroke="rgba(103,232,249,0.45)"
                    strokeWidth="1.5"
                  />
                  <polygon
                    points="34,2 44,8 34,14"
                    fill="rgba(103,232,249,0.55)"
                  />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom label */}
      <div
        style={{
          position: "absolute",
          bottom: "36px",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          zIndex: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "7px 20px",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "999px",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              color: "rgba(255,255,255,0.3)",
              letterSpacing: "0.08em",
              fontStyle: "italic",
            }}
          >
            no on-chain link between deposit and withdrawal
          </span>
        </div>
      </div>
    </div>
  );
}
