import { FastifyInstance } from "fastify";
import { z } from "zod";
import { NoteManager } from "../../core/NoteManager";
import { PrivacyPoolClient } from "../../chain/PrivacyPoolClient";
import { EngineError } from "../../types/index";

const ShieldSchema = z.object({
  owner:        z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid owner address"),
  token:        z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid token address"),
  amount:       z.string().regex(/^\d+$/, "Amount must be a positive integer string"),
  commitment:   z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid commitment hash"),
  shieldTxHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid tx hash"),
});

/**
 * POST /shield
 *
 * Called by the SDK after submitting a shield tx on-chain.
 * The engine:
 *   1. Waits for the Shielded event to confirm on-chain (verifies funds landed)
 *   2. Creates and encrypts a private note for the owner
 *   3. Stores the encrypted note in 0G Storage
 *
 * No TEE signature is returned — shield is a purely storage-side operation.
 */
export async function shieldRoutes(
  app: FastifyInstance,
  opts: { noteManager: NoteManager; chainClient: PrivacyPoolClient }
): Promise<void> {
  app.post<{ Body: z.infer<typeof ShieldSchema> }>("/shield", {
    schema: {
      body: {
        type: "object",
        required: ["owner", "token", "amount", "commitment", "shieldTxHash"],
        properties: {
          owner:        { type: "string" },
          token:        { type: "string" },
          amount:       { type: "string" },
          commitment:   { type: "string" },
          shieldTxHash: { type: "string" },
        },
      },
    },
    handler: async (req, reply) => {
      const body = ShieldSchema.parse(req.body);

      try {
        // Verify token is whitelisted on-chain
        const whitelisted = await opts.chainClient.isTokenWhitelisted(body.token);
        if (!whitelisted) {
          return reply.code(400).send({ error: "Token not whitelisted", code: "TOKEN_NOT_WHITELISTED" });
        }

        // Wait for the on-chain Shielded event to confirm the deposit
        const onChainEvent = await opts.chainClient.waitForShieldEvent(body.commitment);

        // Verify amount matches what landed on-chain
        const claimed = BigInt(body.amount);
        if (onChainEvent.amount !== claimed) {
          return reply.code(400).send({
            error: `Amount mismatch: on-chain=${onChainEvent.amount}, claimed=${claimed}`,
            code:  "AMOUNT_MISMATCH",
          });
        }

        // Create and store the private note
        const note = await opts.noteManager.createNote(
          body.owner,
          body.token,
          BigInt(body.amount),
          body.commitment,
        );

        return reply.code(201).send({
          commitment: note.commitment,
          message:    "Note created successfully",
        });
      } catch (err) {
        if (err instanceof EngineError) {
          return reply.code(400).send({ error: err.message, code: err.code });
        }
        req.log.error({ err }, "Shield handler error");
        return reply.code(500).send({ error: "Internal engine error" });
      }
    },
  });
}
