import { FastifyInstance } from "fastify";
import { PrivacyPoolClient } from "../../chain/PrivacyPoolClient";
import { AttestationSigner } from "../../core/AttestationSigner";

export async function healthRoutes(
  app: FastifyInstance,
  opts: { chainClient: PrivacyPoolClient; signer: AttestationSigner }
): Promise<void> {
  app.get("/health", async (_req, reply) => {
    return reply.send({ status: "ok", timestamp: Date.now() });
  });

  app.get("/health/enclave", async (_req, reply) => {
    try {
      const [isActive, root, treeSize] = await Promise.all([
        opts.chainClient.isEnclaveActive(opts.signer.address),
        opts.chainClient.getRoot(),
        opts.chainClient.getTreeSize(),
      ]);

      return reply.send({
        status:        isActive ? "active" : "inactive",
        enclaveAddress: opts.signer.address,
        chainRoot:     root,
        treeSize:      treeSize.toString(),
        timestamp:     Date.now(),
      });
    } catch (err) {
      return reply.code(503).send({
        status:    "degraded",
        error:     (err as Error).message,
        timestamp: Date.now(),
      });
    }
  });
}
