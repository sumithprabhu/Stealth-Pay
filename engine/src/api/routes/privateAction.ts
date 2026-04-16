import { FastifyInstance } from "fastify";
import { z } from "zod";
import { ethers } from "ethers";
import { NoteManager } from "../../core/NoteManager";
import { CryptoEngine } from "../../core/CryptoEngine";
import { AttestationSigner } from "../../core/AttestationSigner";
import { PrivacyPoolClient } from "../../chain/PrivacyPoolClient";
import { EngineError, PrivateNote, PrivateActionParams } from "../../types/index";

const PrivateTransferSchema = z.object({
  from:   z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  to:     z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  token:  z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  amount: z.string().regex(/^\d+$/),
});

const PrivateBalanceSchema = z.object({
  owner: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  token: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

/**
 * POST /private-transfer
 *
 * Execute a private peer-to-peer transfer:
 *   1. Engine selects unspent notes covering the amount (coin selection)
 *   2. Spends selected notes (marks nullifiers)
 *   3. Creates new notes: one for the receiver, one change note for sender
 *   4. Signs the PrivateActionParams attestation
 *   5. Returns signature + params for the SDK to submit on-chain
 *
 * No tokens move publicly — only the commitment root updates on-chain.
 */
export async function privateActionRoutes(
  app: FastifyInstance,
  opts: {
    noteManager:     NoteManager;
    crypto:          CryptoEngine;
    signer:          AttestationSigner;
    chainClient:     PrivacyPoolClient;
    deadlineSeconds: number;
    enclaveAddress:  string;
  }
): Promise<void> {

  // ── Private transfer ──────────────────────────────────────────────────────

  app.post<{ Body: z.infer<typeof PrivateTransferSchema> }>("/private-transfer", {
    schema: {
      body: {
        type: "object",
        required: ["from", "to", "token", "amount"],
        properties: {
          from:   { type: "string" },
          to:     { type: "string" },
          token:  { type: "string" },
          amount: { type: "string" },
        },
      },
    },
    handler: async (req, reply) => {
      const body = PrivateTransferSchema.parse(req.body);
      const transferAmount = BigInt(body.amount);

      try {
        // 1. Select notes covering the amount
        const { selected, total } = await opts.noteManager.selectNotes(
          body.from,
          body.token,
          transferAmount,
        );

        // 2. Guard: verify none are spent on-chain
        for (const note of selected) {
          const onChainSpent = await opts.chainClient.isNullifierSpent(note.nullifier);
          if (onChainSpent) {
            await opts.noteManager.spendNote(note); // sync local state
            return reply.code(409).send({ error: `Note ${note.commitment} already spent on-chain`, code: "NULLIFIER_SPENT" });
          }
        }

        // 3. Create receiver note
        const receiverNote = opts.crypto.buildNote(body.to, body.token, transferAmount, opts.enclaveAddress);

        // 4. Create change note (if overpaid)
        const change      = total - transferAmount;
        let changeNote: PrivateNote | undefined;
        if (change > 0n) {
          changeNote = opts.crypto.buildNote(body.from, body.token, change, opts.enclaveAddress);
        }

        // 5. Spend selected notes (engine-side)
        for (const note of selected) {
          await opts.noteManager.spendNote(note);
        }

        // 6. Persist new notes to 0G Storage
        const newNotes = changeNote ? [receiverNote, changeNote] : [receiverNote];
        for (const note of newNotes) {
          const blob = opts.crypto.encryptNote(note);
          // Store via NoteManager internals — access storage directly
          await opts.noteManager.createNote(note.owner, note.token, note.amount, note.commitment);
        }

        // 7. Build on-chain params
        const currentRoot = await opts.chainClient.getRoot();
        const blockTs     = await opts.chainClient.getBlockTimestamp();
        const deadline    = BigInt(blockTs + opts.deadlineSeconds);
        const nonce       = BigInt(ethers.hexlify(ethers.randomBytes(8)));

        const params: PrivateActionParams = {
          nullifiers:     selected.map((n) => n.nullifier),
          newCommitments: newNotes.map((n) => n.commitment),
          newRoot:        currentRoot,
          deadline,
          nonce,
        };

        // 8. Sign
        const teeSignature = opts.signer.signPrivateAction(params);

        req.log.info({
          from:     body.from,
          to:       body.to,
          amount:   transferAmount.toString(),
          change:   change.toString(),
          nullifiers: params.nullifiers,
        }, "Private transfer signed");

        return reply.send({
          teeSignature,
          onChainParams: {
            nullifiers:     params.nullifiers,
            newCommitments: params.newCommitments,
            newRoot:        params.newRoot,
            deadline:       params.deadline.toString(),
            nonce:          params.nonce.toString(),
          },
          receiverCommitment: receiverNote.commitment,
          changeCommitment:   changeNote?.commitment ?? null,
        });
      } catch (err) {
        if (err instanceof EngineError) {
          return reply.code(400).send({ error: err.message, code: err.code });
        }
        req.log.error({ err }, "Private transfer handler error");
        return reply.code(500).send({ error: "Internal engine error" });
      }
    },
  });

  // ── Private balance query ─────────────────────────────────────────────────

  app.post<{ Body: z.infer<typeof PrivateBalanceSchema> }>("/balance", {
    schema: {
      body: {
        type: "object",
        required: ["owner", "token"],
        properties: {
          owner: { type: "string" },
          token: { type: "string" },
        },
      },
    },
    handler: async (req, reply) => {
      const body = PrivateBalanceSchema.parse(req.body);

      try {
        const result = await opts.noteManager.getBalance(body.owner, body.token);
        return reply.send({
          owner:   result.owner,
          token:   result.token,
          balance: result.balance,
          noteCount: result.notes.length,
          // Note details are not included in the response to minimise
          // data exposure over the wire — just the balance total
        });
      } catch (err) {
        if (err instanceof EngineError) {
          return reply.code(400).send({ error: err.message, code: err.code });
        }
        req.log.error({ err }, "Balance query error");
        return reply.code(500).send({ error: "Internal engine error" });
      }
    },
  });
}
