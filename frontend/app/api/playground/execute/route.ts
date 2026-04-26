import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { StealthPaySDK } from "stealthpay-sdk";

export const maxDuration = 300; // 5 min for ZK proof generation

// Resolve circuits dir — supports both local (../circuits) and absolute paths
const CIRCUITS_DIR_RAW = process.env.STEALTH_PAY_CIRCUITS_DIR ?? path.resolve(__dirname, "../../../../circuits");
const CIRCUITS_ABS     = path.resolve(process.cwd(), CIRCUITS_DIR_RAW);

const RPC_URL      = "https://evmrpc-testnet.0g.ai";
const POOL_ADDRESS = "0x87fECd1AfA436490e3230C8B0B5aD49dcC1283F1";
const DEMO_SPENDING_PRIVKEY = BigInt("0xdeadbeefcafebabe12345678abcdef01");

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

function enc(data: object) {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(req: NextRequest) {
  // ZK proof generation requires nargo + bb — only works on a local dev server
  if (!fs.existsSync(CIRCUITS_ABS)) {
    return NextResponse.json({
      error: "ZK proving not available in this environment. Clone the repo and run `npm run dev` locally — nargo and bb must be installed.",
      docs: "https://github.com/noir-lang/noir",
    }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const { op, token, amount, receiverPubkey, recipient } = body;

  if (!op || !token || !amount) {
    return NextResponse.json({ error: "Missing op, token, or amount" }, { status: 400 });
  }

  const privkey = process.env.DEPLOYER_PRIVATE_KEY?.trim();
  if (!privkey) {
    return NextResponse.json({ error: "Server not configured (DEPLOYER_PRIVATE_KEY missing)" }, { status: 503 });
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const send = (data: object) => writer.write(enc(data)).catch(() => {});

  (async () => {
    try {
      await send({ step: "connect", msg: "Connecting to 0G Galileo testnet…" });

      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const signer   = new ethers.Wallet(privkey, provider);
      const address  = await signer.getAddress();
      const ogBal    = await provider.getBalance(address);

      await send({
        step: "connect",
        msg: `Connected`,
        detail: `wallet: ${address}  |  OG: ${ethers.formatEther(ogBal)} OG`,
      });

      const erc20    = new ethers.Contract(token, ERC20_ABI, provider);
      const decimals = await erc20.decimals() as bigint;
      const tokenBal = await erc20.balanceOf(address) as bigint;
      await send({
        step: "connect",
        msg: `Token balance: ${ethers.formatUnits(tokenBal, decimals)} USDC`,
        detail: `token: ${token}`,
      });

      await send({ step: "sdk", msg: "Initialising StealthPaySDK…" });

      const sdk = new StealthPaySDK({
        signer,
        privacyPoolAddress: POOL_ADDRESS,
        spendingPrivkey: DEMO_SPENDING_PRIVKEY,
        confirmTimeoutMs: 180_000,
      });

      await send({ step: "sync", msg: "Syncing Merkle tree from chain…" });
      await sdk.sync(provider, 0);
      const notes = sdk.getNotes(token);
      await send({
        step: "sync",
        msg: `Merkle tree synced`,
        detail: `unspent notes for this key: ${notes.length}`,
      });

      // ── Execute operation ────────────────────────────────────────────────────

      if (op === "shield") {
        const amt = BigInt(amount);
        await send({ step: "prove", msg: `Generating UltraHonk ZK proof for shield…`, detail: `amount: ${ethers.formatUnits(amt, decimals)} USDC` });

        const result = await sdk.shield(token, amt);

        await send({
          step: "done",
          op: "shield",
          txHash: result.txHash,
          explorer: `https://chainscan-galileo.0g.ai/tx/${result.txHash}`,
          commitment: "0x" + result.commitment.toString(16).padStart(64, "0"),
          amount: ethers.formatUnits(result.amount, decimals) + " USDC",
          token: result.token,
          leafIndex: sdk.getNotes(token).find(n => n.commitment === result.commitment)?.index ?? "?",
        });

      } else if (op === "privateSend") {
        if (!receiverPubkey) throw new Error("receiverPubkey is required for privateSend");
        const amt    = BigInt(amount);
        const pubkey = BigInt(receiverPubkey);
        await send({ step: "prove", msg: `Generating UltraHonk ZK proof for privateSend…`, detail: `amount: ${ethers.formatUnits(amt, decimals)} USDC` });

        const result = await sdk.privateSend(token, amt, pubkey);

        await send({
          step: "done",
          op: "privateSend",
          txHash: result.txHash,
          explorer: `https://chainscan-galileo.0g.ai/tx/${result.txHash}`,
          receiverCommitment: "0x" + result.receiverCommitment.toString(16).padStart(64, "0"),
          changeCommitment: result.changeCommitment
            ? "0x" + result.changeCommitment.toString(16).padStart(64, "0")
            : null,
          amount: ethers.formatUnits(result.amount, decimals) + " USDC",
        });

      } else if (op === "unshield") {
        if (!recipient) throw new Error("recipient is required for unshield");
        const amt = BigInt(amount);
        await send({ step: "prove", msg: `Generating UltraHonk ZK proof for unshield…`, detail: `amount: ${ethers.formatUnits(amt, decimals)} USDC → ${recipient}` });

        const result = await sdk.unshield(token, amt, recipient);

        const finalBal = await erc20.balanceOf(recipient) as bigint;
        await send({
          step: "done",
          op: "unshield",
          txHash: result.txHash,
          explorer: `https://chainscan-galileo.0g.ai/tx/${result.txHash}`,
          recipient: result.recipient,
          amount: ethers.formatUnits(result.amount, decimals) + " USDC",
          recipientBalance: ethers.formatUnits(finalBal, decimals) + " USDC",
        });
      } else {
        throw new Error(`Unknown op: ${op}`);
      }

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await send({ step: "error", msg });
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
