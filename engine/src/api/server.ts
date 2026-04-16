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
  }
) {
  const app = Fastify({
    logger: {
      level: config.server.logLevel,
      transport: process.env["NODE_ENV"] !== "production"
        ? { target: "pino-pretty" }
        : undefined,
    },
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

  const authenticate = createAuthMiddleware(config.server.apiKey);
  app.addHook("onRequest", authenticate);

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
