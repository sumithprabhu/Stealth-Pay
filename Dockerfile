FROM node:20-slim

# ── System deps ───────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y curl bash git && rm -rf /var/lib/apt/lists/*

# ── nargo (Noir prover CLI) ───────────────────────────────────────────────────
RUN curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
ENV PATH="/root/.nargo/bin:${PATH}"
RUN noirup --version 1.0.0-beta.20

# ── bb (Barretenberg prover) ──────────────────────────────────────────────────
# bbup moved to the 'next' branch — install then pin exact version
RUN curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/refs/heads/next/barretenberg/bbup/install | bash
ENV PATH="/root/.bb:${PATH}"
RUN bbup -v 5.0.0-nightly.20260324

# ── App ───────────────────────────────────────────────────────────────────────
WORKDIR /app

# Copy compiled circuits (needed by SDK for ZK proof generation)
COPY circuits/ /circuits/

# Install backend dependencies
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev

COPY backend/server.js ./

# Tell the SDK where to find circuits and binaries
ENV STEALTH_PAY_CIRCUITS_DIR=/circuits
ENV STEALTH_PAY_BB_BIN=/root/.bb/bb
ENV STEALTH_PAY_NARGO_BIN=/root/.nargo/bin/nargo

EXPOSE 4000
CMD ["node", "server.js"]
