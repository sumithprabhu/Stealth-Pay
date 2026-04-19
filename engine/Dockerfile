# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# Prune dev dependencies
RUN npm ci --omit=dev --ignore-scripts

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Non-root user for least privilege
RUN addgroup -S stealthpay && adduser -S engine -G stealthpay

WORKDIR /app

# Copy built output + production node_modules only
COPY --from=builder --chown=engine:stealthpay /app/dist      ./dist
COPY --from=builder --chown=engine:stealthpay /app/node_modules ./node_modules
COPY --from=builder --chown=engine:stealthpay /app/package.json ./package.json

USER engine

EXPOSE 3000

# Healthcheck — Docker will restart the container if /health stops responding
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
