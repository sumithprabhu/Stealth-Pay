const express = require("express");
const cors    = require("cors");
const ethers  = require("ethers");
const {
  StealthPaySDK,
  NoteManager,
  MerkleTree,
  generateShieldProof,
  generateSpendProof,
  deriveSpendingPubkey,
} = require("stealthpay-sdk");

const app = express();
app.use(cors());
app.use(express.json());

const RPC_URL      = "https://evmrpc-testnet.0g.ai";
const POOL_ADDRESS = "0x87fECd1AfA436490e3230C8B0B5aD49dcC1283F1";

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
  return (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ─────────────────────────────────────────────────────────────────────────────
// POST /prove
// Generates ZK proof only — does NOT sign or submit anything.
// Frontend uses the returned proof to sign the tx itself (wallet mode).
//
// Body: { op, token, amount, spendingPrivkey, receiverPubkey?, recipient? }
// Returns (SSE stream): progress events + final { step:"done", proof, ...pubOutputs }
// ─────────────────────────────────────────────────────────────────────────────
app.post("/prove", async (req, res) => {
  const send = sse(res);
  const { op, token, amount, spendingPrivkey, receiverPubkey, recipient } = req.body;

  if (!op || !token || !amount || !spendingPrivkey) {
    send({ step: "error", msg: "Missing op, token, amount, or spendingPrivkey" });
    return res.end();
  }

  try {
    const amt     = BigInt(amount);
    const privkey = BigInt(spendingPrivkey);

    send({ step: "sync", msg: "Syncing Merkle tree from 0G Galileo…" });

    const provider = new ethers.JsonRpcProvider(RPC_URL);

    if (op === "shield") {
      send({ step: "prove", msg: "Generating UltraHonk ZK proof for shield… (30–60 s)" });

      const { proof, commitment } = await generateShieldProof({
        spendingPrivkey: privkey,
        token,
        amount: amt,
        salt: BigInt(ethers.hexlify(ethers.randomBytes(32))) % BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617"),
      });

      send({
        step: "done",
        op: "shield",
        proof: ethers.hexlify(proof),
        commitment: "0x" + commitment.toString(16).padStart(64, "0"),
        // frontend uses these to call pool.shield()
        poolAddress: POOL_ADDRESS,
        params: {
          token,
          amount: amount.toString(),
          commitment: "0x" + commitment.toString(16).padStart(64, "0"),
        },
      });

    } else if (op === "privateSend" || op === "unshield") {
      if (op === "privateSend" && !receiverPubkey) throw new Error("receiverPubkey required");
      if (op === "unshield" && !recipient) throw new Error("recipient required");

      // Need to sync tree to get Merkle proof for input notes
      const dummySigner = ethers.Wallet.createRandom().connect(provider);
      const sdk = new StealthPaySDK({
        signer: dummySigner,
        privacyPoolAddress: POOL_ADDRESS,
        spendingPrivkey: privkey,
        confirmTimeoutMs: 180_000,
      });

      send({ step: "sync", msg: "Syncing Merkle tree to find your notes…" });
      await sdk.sync(provider, 0);

      const notes = sdk.getNotes(token);
      send({
        step: "sync",
        msg: `Found ${notes.length} unspent note(s) for this spending key`,
      });

      if (notes.length === 0) throw new Error("No unspent notes found. Shield tokens first.");

      send({ step: "prove", msg: `Generating UltraHonk ZK proof for ${op}… (30–60 s)` });

      // Use the SDK internals to select notes + build proof inputs
      // We call the SDK's private operations but intercept before signing
      const unspent = notes.sort((a, b) => (a.amount < b.amount ? -1 : 1));
      const selected = [];
      let total = 0n;
      for (const n of unspent) {
        if (total >= amt) break;
        selected.push(n);
        total += n.amount;
        if (selected.length === 2) break;
      }
      if (total < amt) throw new Error(`Insufficient balance: have ${total}, need ${amt}`);

      const change     = total - amt;
      const merkleRoot = sdk.noteManager.getCurrentRoot();
      const changePubkey = deriveSpendingPubkey(privkey);
      const recvPubkey   = op === "privateSend" ? BigInt(receiverPubkey) : changePubkey;
      const BN254 = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
      const randSalt = () => BigInt(ethers.hexlify(ethers.randomBytes(32))) % BN254;

      const outputNotes = op === "privateSend"
        ? [
            { receiverPubkey: recvPubkey, amount: amt, salt: randSalt() },
            change > 0n ? { receiverPubkey: changePubkey, amount: change, salt: randSalt() } : null,
          ]
        : [
            change > 0n ? { receiverPubkey: changePubkey, amount: change, salt: randSalt() } : null,
            null,
          ];

      const { proof, nullifiers, newCommitments } = await generateSpendProof({
        spendingPrivkey: privkey,
        token,
        merkleRoot,
        inputNotes: [
          selected[0] ? { amount: selected[0].amount, salt: selected[0].salt, index: selected[0].index, siblings: selected[0].siblings } : null,
          selected[1] ? { amount: selected[1].amount, salt: selected[1].salt, index: selected[1].index, siblings: selected[1].siblings } : null,
        ],
        outputNotes,
        publicAmount: op === "unshield" ? amt : 0n,
        recipient: op === "unshield" ? recipient : ethers.ZeroAddress,
      });

      send({
        step: "done",
        op,
        proof: ethers.hexlify(proof),
        poolAddress: POOL_ADDRESS,
        // frontend uses these to call pool.spend()
        params: {
          token,
          merkleRoot: "0x" + merkleRoot.toString(16).padStart(64, "0"),
          nullifiers: nullifiers.map(n => "0x" + n.toString(16).padStart(64, "0")),
          newCommitments: newCommitments.map(c => "0x" + c.toString(16).padStart(64, "0")),
          publicAmount: op === "unshield" ? amount.toString() : "0",
          recipient: op === "unshield" ? recipient : ethers.ZeroAddress,
        },
      });
    }
  } catch (err) {
    send({ step: "error", msg: err?.message ?? String(err) });
  }

  res.end();
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /execute
// Generates ZK proof AND signs + submits the tx.
// Used for private key mode — signer key provided by caller.
//
// Body: { op, token, amount, spendingPrivkey, signerPrivkey, receiverPubkey?, recipient? }
// ─────────────────────────────────────────────────────────────────────────────
app.post("/execute", async (req, res) => {
  const send = sse(res);
  const { op, token, amount, spendingPrivkey, signerPrivkey, receiverPubkey, recipient } = req.body;

  if (!op || !token || !amount || !spendingPrivkey || !signerPrivkey) {
    send({ step: "error", msg: "Missing op, token, amount, spendingPrivkey, or signerPrivkey" });
    return res.end();
  }

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer   = new ethers.Wallet(signerPrivkey.trim(), provider);
    const address  = await signer.getAddress();
    const ogBal    = await provider.getBalance(address);

    send({ step: "connect", msg: "Connected", detail: `wallet: ${address}  |  OG: ${ethers.formatEther(ogBal)} OG` });

    const erc20    = new ethers.Contract(token, ERC20_ABI, provider);
    const decimals = await erc20.decimals();
    const tokenBal = await erc20.balanceOf(address);
    send({ step: "connect", msg: `Token balance: ${ethers.formatUnits(tokenBal, decimals)} USDC` });

    const sdk = new StealthPaySDK({
      signer,
      privacyPoolAddress: POOL_ADDRESS,
      spendingPrivkey: BigInt(spendingPrivkey),
      confirmTimeoutMs: 180_000,
    });

    send({ step: "sync", msg: "Syncing Merkle tree…" });
    await sdk.sync(provider, 0);
    const notes = sdk.getNotes(token);
    send({ step: "sync", msg: `Tree synced — ${notes.length} unspent note(s)` });

    const amt = BigInt(amount);
    send({ step: "prove", msg: `Generating UltraHonk ZK proof… (30–60 s)` });

    let result;
    if (op === "shield") {
      result = await sdk.shield(token, amt);
      send({
        step: "done", op: "shield",
        txHash: result.txHash,
        explorer: `https://chainscan-galileo.0g.ai/tx/${result.txHash}`,
        commitment: "0x" + result.commitment.toString(16).padStart(64, "0"),
        amount: ethers.formatUnits(result.amount, decimals) + " USDC",
        from: address,
        to: POOL_ADDRESS,
      });
    } else if (op === "privateSend") {
      if (!receiverPubkey) throw new Error("receiverPubkey required");
      result = await sdk.privateSend(token, amt, BigInt(receiverPubkey));
      send({
        step: "done", op: "privateSend",
        txHash: result.txHash,
        explorer: `https://chainscan-galileo.0g.ai/tx/${result.txHash}`,
        receiverCommitment: "0x" + result.receiverCommitment.toString(16).padStart(64, "0"),
        changeCommitment: result.changeCommitment ? "0x" + result.changeCommitment.toString(16).padStart(64, "0") : "none",
        amount: ethers.formatUnits(result.amount, decimals) + " USDC",
        from: address,
      });
    } else if (op === "unshield") {
      if (!recipient) throw new Error("recipient required");
      result = await sdk.unshield(token, amt, recipient);
      const finalBal = await erc20.balanceOf(recipient);
      send({
        step: "done", op: "unshield",
        txHash: result.txHash,
        explorer: `https://chainscan-galileo.0g.ai/tx/${result.txHash}`,
        from: address,
        to: recipient,
        amount: ethers.formatUnits(result.amount, decimals) + " USDC",
        recipientFinalBalance: ethers.formatUnits(finalBal, decimals) + " USDC",
      });
    }
  } catch (err) {
    send({ step: "error", msg: err?.message ?? String(err) });
  }

  res.end();
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`StealthPay backend :${PORT}`));
