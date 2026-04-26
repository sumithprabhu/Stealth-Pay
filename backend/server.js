const express = require("express");
const cors    = require("cors");
const ethers  = require("ethers");
const { StealthPaySDK } = require("stealthpay-sdk");

const app = express();
app.use(cors());
app.use(express.json());

const RPC_URL        = "https://evmrpc-testnet.0g.ai";
const POOL_ADDRESS   = "0x87fECd1AfA436490e3230C8B0B5aD49dcC1283F1";
const DEMO_SPENDING  = BigInt("0xdeadbeefcafebabe12345678abcdef01");

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

// ── SSE helper ────────────────────────────────────────────────────────────────

function sse(res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  return (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
}

// ── Health ────────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", circuits: process.env.STEALTH_PAY_CIRCUITS_DIR });
});

// ── Execute ───────────────────────────────────────────────────────────────────

app.post("/execute", async (req, res) => {
  const send = sse(res);

  const { op, token, amount, receiverPubkey, recipient } = req.body;

  if (!op || !token || !amount) {
    send({ step: "error", msg: "Missing op, token, or amount" });
    return res.end();
  }

  const privkey = process.env.DEPLOYER_PRIVATE_KEY?.trim();
  if (!privkey) {
    send({ step: "error", msg: "DEPLOYER_PRIVATE_KEY not set on server" });
    return res.end();
  }

  try {
    send({ step: "connect", msg: "Connecting to 0G Galileo testnet…" });

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer   = new ethers.Wallet(privkey, provider);
    const address  = await signer.getAddress();
    const ogBal    = await provider.getBalance(address);

    send({
      step: "connect",
      msg: "Connected",
      detail: `wallet: ${address}  |  OG: ${ethers.formatEther(ogBal)} OG`,
    });

    const erc20    = new ethers.Contract(token, ERC20_ABI, provider);
    const decimals = await erc20.decimals();
    const tokenBal = await erc20.balanceOf(address);

    send({
      step: "connect",
      msg: `Token balance: ${ethers.formatUnits(tokenBal, decimals)} USDC`,
      detail: `token: ${token}`,
    });

    send({ step: "sdk", msg: "Initialising StealthPaySDK…" });

    const sdk = new StealthPaySDK({
      signer,
      privacyPoolAddress: POOL_ADDRESS,
      spendingPrivkey: DEMO_SPENDING,
      confirmTimeoutMs: 180_000,
    });

    send({ step: "sync", msg: "Syncing Merkle tree from chain…" });
    await sdk.sync(provider, 0);

    const notes = sdk.getNotes(token);
    send({
      step: "sync",
      msg: "Merkle tree synced",
      detail: `unspent notes for this key: ${notes.length}`,
    });

    // ── operations ────────────────────────────────────────────────────────────

    if (op === "shield") {
      const amt = BigInt(amount);
      send({
        step: "prove",
        msg: "Generating UltraHonk ZK proof for shield…",
        detail: `amount: ${ethers.formatUnits(amt, decimals)} USDC  (this takes 30–60 s)`,
      });

      const result = await sdk.shield(token, amt);
      const note   = sdk.getNotes(token).find(n => n.commitment === result.commitment);

      send({
        step: "done",
        op: "shield",
        txHash: result.txHash,
        explorer: `https://chainscan-galileo.0g.ai/tx/${result.txHash}`,
        commitment: "0x" + result.commitment.toString(16).padStart(64, "0"),
        amount: ethers.formatUnits(result.amount, decimals) + " USDC",
        token: result.token,
        leafIndex: note?.index ?? "?",
      });

    } else if (op === "privateSend") {
      if (!receiverPubkey) throw new Error("receiverPubkey required");
      const amt    = BigInt(amount);
      const pubkey = BigInt(receiverPubkey);

      send({
        step: "prove",
        msg: "Generating UltraHonk ZK proof for privateSend…",
        detail: `amount: ${ethers.formatUnits(amt, decimals)} USDC  (this takes 30–60 s)`,
      });

      const result = await sdk.privateSend(token, amt, pubkey);

      send({
        step: "done",
        op: "privateSend",
        txHash: result.txHash,
        explorer: `https://chainscan-galileo.0g.ai/tx/${result.txHash}`,
        receiverCommitment: "0x" + result.receiverCommitment.toString(16).padStart(64, "0"),
        changeCommitment: result.changeCommitment
          ? "0x" + result.changeCommitment.toString(16).padStart(64, "0")
          : "none",
        amount: ethers.formatUnits(result.amount, decimals) + " USDC",
      });

    } else if (op === "unshield") {
      if (!recipient) throw new Error("recipient required");
      const amt = BigInt(amount);

      send({
        step: "prove",
        msg: "Generating UltraHonk ZK proof for unshield…",
        detail: `amount: ${ethers.formatUnits(amt, decimals)} USDC → ${recipient}  (this takes 30–60 s)`,
      });

      const result    = await sdk.unshield(token, amt, recipient);
      const finalBal  = await erc20.balanceOf(recipient);

      send({
        step: "done",
        op: "unshield",
        txHash: result.txHash,
        explorer: `https://chainscan-galileo.0g.ai/tx/${result.txHash}`,
        recipient: result.recipient,
        amount: ethers.formatUnits(result.amount, decimals) + " USDC",
        recipientFinalBalance: ethers.formatUnits(finalBal, decimals) + " USDC",
      });

    } else {
      throw new Error(`Unknown op: ${op}`);
    }

  } catch (err) {
    send({ step: "error", msg: err?.message ?? String(err) });
  }

  res.end();
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`StealthPay backend listening on :${PORT}`));
