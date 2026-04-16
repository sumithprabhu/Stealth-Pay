import { FastifyRequest, FastifyReply } from "fastify";

/**
 * Simple API key auth middleware.
 * In production, replace with enclave-attested mutual TLS or
 * a signed SDK request (ECDSA over the request body).
 */
export function createAuthMiddleware(apiKey: string) {
  return async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const provided = req.headers["x-api-key"];
    if (!provided || provided !== apiKey) {
      reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
      return;
    }
  };
}
