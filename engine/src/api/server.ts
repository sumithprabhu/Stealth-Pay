import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { pino } from "pino";

import { EngineConfig } from "../types/index";
import { createAuthMiddleware } from "./middleware/auth";
import { healthRoutes } from "./routes/health";
import { shieldRoutes } from "./routes/shield";
import { unshieldRoutes } from "./routes/unshield";
import { privateActionRoutes } from "./routes/privateAction";
import { attestationRoutes } from "./routes/attestation";
import { NoteManager } from "../core/NoteManager";
import { AttestationSigner } from "../core/AttestationSigner";
import { CryptoEngine } from "../core/CryptoEngine";
import { PrivacyPoolClient } from "../chain/PrivacyPoolClient";

const logger = pino({ name: "Server" });

export async function buildServer(
  config: EngineConfig,
  deps: {
    noteManager:  NoteManager;
    crypto:       CryptoEngine;
    signer:       AttestationSigner;
    chainClient:  PrivacyPoolClient;
    teeMode:      string;
  }
) {
  const isDev  = process.env["NODE_ENV"] !== "production";
  const app = Fastify({
    logger: isDev
      ? { level: config.server.logLevel, transport: { target: "pino-pretty" } }
      : { level: config.server.logLevel },
  });

  // ── Security plugins ────────────────────────────────────────────────────

  await app.register(helmet);

  await app.register(cors, {
    origin: config.server.allowedOrigins,
    methods: ["GET", "POST"],
  });

  await app.register(rateLimit, {
    max:         100,
    timeWindow:  "1 minute",
    errorResponseBuilder: () => ({
      error: "Too many requests",
      code:  "RATE_LIMITED",
    }),
  });

  // ── Auth ────────────────────────────────────────────────────────────────
  // /attestation is public (signing key is not secret); all other routes require API key

  const authenticate = createAuthMiddleware(config.server.apiKey);
  app.addHook("onRequest", async (req, reply) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((req.routeOptions?.config as any)?.skipAuth) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return authenticate(req as any, reply);
  });

  // ── Routes ──────────────────────────────────────────────────────────────

  const routeOpts = {
    noteManager:     deps.noteManager,
    crypto:          deps.crypto,
    signer:          deps.signer,
    chainClient:     deps.chainClient,
    deadlineSeconds: config.limits.attestationDeadlineSeconds,
    enclaveAddress:  deps.signer.address,
  };

  await app.register(healthRoutes, routeOpts);
  await app.register(attestationRoutes, { signer: deps.signer, teeMode: deps.teeMode });
  await app.register(shieldRoutes, routeOpts);
  await app.register(unshieldRoutes, routeOpts);
  await app.register(privateActionRoutes, routeOpts);

  // ── Global error handler ────────────────────────────────────────────────

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err, url: req.url }, "Unhandled error");
    reply.code(500).send({ error: "Internal engine error" });
  });

  return app;
}
