import { FastifyInstance } from "fastify";
import { z } from "zod";
import { ethers } from "ethers";
import { NoteManager } from "../../core/NoteManager";
import { AttestationSigner } from "../../core/AttestationSigner";
import { PrivacyPoolClient } from "../../chain/PrivacyPoolClient";
import { EngineError, UnshieldParams } from "../../types/index";

const UnshieldSchema = z.object({
  owner:      z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  commitment: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  recipient:  z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  amount:     z.string().regex(/^\d+$/),
});

/**
 * POST /unshield
 *
 * The SDK requests an unshield:
 *   1. Engine loads and verifies the private note from 0G Storage
 *   2. Verifies ownership and amount
 *   3. Marks the note's nullifier as spent (in 0G Storage)
 *   4. Produces a TEE-signed attestation with the UnshieldParams
 *   5. Returns the signature + params for the SDK to submit on-chain
 *
 * The actual token release happens when the SDK submits the attestation
 * to PrivacyPool.unshield() on 0G Chain.
 */
export async function unshieldRoutes(
  app: FastifyInstance,
  opts: {
    noteManager:   NoteManager;
    signer:        AttestationSigner;
    chainClient:   PrivacyPoolClient;
    deadlineSeconds: number;
  }
): Promise<void> {
  app.post<{ Body: z.infer<typeof UnshieldSchema> }>("/unshield", {
    schema: {
      body: {
        type: "object",
        required: ["owner", "commitment", "recipient", "amount"],
        properties: {
          owner:      { type: "string" },
          commitment: { type: "string" },
          recipient:  { type: "string" },
          amount:     { type: "string" },
        },
      },
    },
    handler: async (req, reply) => {
      const body = UnshieldSchema.parse(req.body);

      try {
        // Load and verify the note
        const note = await opts.noteManager.loadNote(body.commitment);

        // Ownership check
        if (note.owner.toLowerCase() !== body.owner.toLowerCase()) {
          return reply.code(403).send({ error: "Not the note owner", code: "INVALID_OWNER" });
        }

        // Amount check
        const requestedAmount = BigInt(body.amount);
        if (requestedAmount > note.amount) {
          return reply.code(400).send({
            error: `Requested ${requestedAmount} but note contains ${note.amount}`,
            code:  "INSUFFICIENT_BALANCE",
          });
        }

        // Double-spend guard (engine-side)
        if (await opts.noteManager.isSpent(note)) {
          return reply.code(409).send({ error: "Note already spent", code: "NULLIFIER_SPENT" });
        }

        // Cross-check with on-chain nullifier (belt-and-suspenders)
        const spentOnChain = await opts.chainClient.isNullifierSpent(note.nullifier);
        if (spentOnChain) {
          // Sync engine state with chain
          await opts.noteManager.spendNote(note);
          return reply.code(409).send({ error: "Nullifier already spent on-chain", code: "NULLIFIER_SPENT" });
        }

        // Build the current Merkle root (engine uses the on-chain root)
        const currentRoot = await opts.chainClient.getRoot();
        const blockTs     = await opts.chainClient.getBlockTimestamp();
        const deadline    = BigInt(blockTs + opts.deadlineSeconds);
        const nonce       = BigInt(ethers.hexlify(ethers.randomBytes(8)));

        const params: UnshieldParams = {
          token:     note.token,
          amount:    requestedAmount,
          recipient: body.recipient,
          nullifier: note.nullifier,
          newRoot:   currentRoot,     // Root doesn't change on unshield (no new commitment)
          deadline,
          nonce,
        };

        // Mark spent in engine storage BEFORE signing
        // (if signing fails, the note is conservatively locked until
        //  an admin recovery process clears it — prevents double-sign)
        await opts.noteManager.spendNote(note);

        // Sign the attestation
        const teeSignature = opts.signer.signUnshield(params);

        req.log.info({
          nullifier: note.nullifier,
          recipient: body.recipient,
          amount:    requestedAmount.toString(),
        }, "Unshield signed");

        return reply.send({
          teeSignature,
          onChainParams: {
            token:     params.token,
            amount:    params.amount.toString(),
            recipient: params.recipient,
            nullifier: params.nullifier,
            newRoot:   params.newRoot,
            deadline:  params.deadline.toString(),
            nonce:     params.nonce.toString(),
          },
        });
      } catch (err) {
        if (err instanceof EngineError) {
          return reply.code(400).send({ error: err.message, code: err.code });
        }
        req.log.error({ err }, "Unshield handler error");
        return reply.code(500).send({ error: "Internal engine error" });
      }
    },
  });
}
