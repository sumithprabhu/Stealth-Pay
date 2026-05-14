const express  = require("express");
const cors     = require("cors");
const ethers   = require("ethers");
const mongoose = require("mongoose");
const {
  StealthPaySDK,
  NoteManager,
  MerkleTree,
  generateShieldProof,
  generateSpendProof,
  deriveSpendingPubkey,
  postHint,
  deriveEncryptionKeypair,
  ZG_INDEXER_RPC,
  ZG_RPC,
} = require("stealthpay-sdk");

const app = express();
app.use(cors());
app.use(express.json());

const RPC_URL      = "https://evmrpc-testnet.0g.ai";
const POOL_ADDRESS = "0x87fECd1AfA436490e3230C8B0B5aD49dcC1283F1";
const MOCK_TOKEN   = "0xB4fd61544493a27a4793F161d6BE153d1A0f6092";
const BN254        = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");

// ── MongoDB ───────────────────────────────────────────────────────────────────
if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(e => console.error("MongoDB error:", e.message));
}

const PaymentSchema = new mongoose.Schema({
  to:        String,
  amount:    String,
  txHash:    String,
  timestamp: { type: Date, default: Date.now },
});
const Payment = mongoose.model("Payment", PaymentSchema);

// ── V1 Payroll — hardcoded org + employees ────────────────────────────────────
const ORG_PRIVKEY = BigInt(ethers.keccak256(ethers.toUtf8Bytes("stealthcorp-v1-2024"))) % BN254;
const ORG_PUBKEY  = deriveSpendingPubkey(ORG_PRIVKEY);

const EMPLOYEES = [
  { id: "alice", name: "Alice Chen",  role: "Engineering", color: "#a78bfa", salary: 100_000_000n },
  { id: "bob",   name: "Bob Kim",     role: "Design",      color: "#34d399", salary: 100_000_000n },
  { id: "carol", name: "Carol Patel", role: "Marketing",   color: "#fb923c", salary: 100_000_000n },
].map(e => {
  const privkey = BigInt(ethers.keccak256(ethers.toUtf8Bytes(`employee-${e.id}-v1-2024`))) % BN254;
  return { ...e, spendingPrivkey: privkey, spendingPubkey: deriveSpendingPubkey(privkey).toString() };
});

function injectLocalHints(sdk, privkey, token) {
  for (const h of getLocalHints(privkey)) {
    const commitment = BigInt(h.commitment);
    if (sdk.noteManager.getNote(commitment)) continue;
    const leafIndex = sdk.noteManager.findLeafIndex(commitment);
    if (leafIndex !== undefined) {
      sdk.noteManager.trackNote(commitment, h.token ?? token, BigInt(h.amount), BigInt(h.salt), leafIndex);
    }
  }
}

const ZG_STORAGE_CONFIG = { indexerRpc: ZG_INDEXER_RPC, rpc: ZG_RPC };

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const POOL_ABI = [
  "function shield(tuple(address token, uint256 amount, bytes32 commitment) params, bytes proof) external",
  "function spend(tuple(address token, bytes32 merkleRoot, bytes32[2] nullifiers, bytes32[2] newCommitments, uint256 publicAmount, address recipient) params, bytes proof) external",
  "function recordHint(bytes32 receiverPubkeyHash, bytes32 storageRoot) external",
  "event Shielded(address indexed token, address indexed depositor, uint256 netAmount, uint256 fee, bytes32 indexed commitment, bytes32 newRoot, uint256 leafIndex)",
  "event NoteHint(bytes32 indexed receiverPubkeyHash, bytes32 storageRoot)",
];

// Relay signer used to post hints in wallet mode (no user signer available server-side).
// Fund this address with OG testnet tokens so it can pay for recordHint txs.
const RELAY_PRIVATE_KEY = process.env.RELAY_PRIVATE_KEY;

// ── Local hint store (primary fallback when 0G Storage is unavailable) ────────
// Key: hex spending pubkey hash → Value: HintPayload[]
// In-memory; survives for the lifetime of this process (sufficient for demo sessions).
const localHintStore = new Map();

function localStoreKey(spendingPrivkey) {
  const { pubkey } = deriveEncryptionKeypair(spendingPrivkey);
  return ethers.keccak256(pubkey);
}

function saveHintLocally(spendingPrivkey, payload) {
  const key = localStoreKey(spendingPrivkey);
  const existing = localHintStore.get(key) ?? [];
  existing.push(payload);
  localHintStore.set(key, existing);
}

function getLocalHints(spendingPrivkey) {
  return localHintStore.get(localStoreKey(spendingPrivkey)) ?? [];
}

// ── Retry helper ──────────────────────────────────────────────────────────────
async function withRetry(fn, retries = 3, delayMs = 3000) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try { return await fn(); } catch (e) {
      lastErr = e;
      if (i < retries - 1) await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

// ── SSE helper ────────────────────────────────────────────────────────────────
function sse(res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  return (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function toCommitmentHex(commitment) {
  return "0x" + commitment.toString(16).padStart(64, "0");
}

// Post a note hint — saves locally (reliable) then tries 0G Storage (best-effort).
async function postShieldHint(signer, spendingPrivkey, { commitment, token, amount, salt }) {
  const payload = {
    commitment: toCommitmentHex(commitment),
    token,
    amount: amount.toString(),
    salt:   salt.toString(),
  };

  // Always save locally first — this is what sync will use if 0G Storage is down.
  saveHintLocally(spendingPrivkey, payload);

  // Best-effort: also push to 0G Storage so other nodes / future sessions can find it.
  if (signer) {
    const { pubkey: myEncPubkey } = deriveEncryptionKeypair(spendingPrivkey);
    const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, signer);
    await withRetry(() => postHint({
      signer,
      poolContract: pool,
      receiverEncPubkey: myEncPubkey,
      payload,
      indexerRpc: ZG_INDEXER_RPC,
      rpc:        ZG_RPC,
    }));
  }
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

      const salt = BigInt(ethers.hexlify(ethers.randomBytes(32))) % BN254;

      const { proof, commitment } = await generateShieldProof({
        spendingPrivkey: privkey,
        token,
        amount: amt,
        salt,
      });

      // Save note hint locally (always) + push to 0G Storage (best-effort via relay signer).
      send({ step: "hint", msg: "Saving note hint…" });
      try {
        const relaySigner = RELAY_PRIVATE_KEY
          ? new ethers.Wallet(RELAY_PRIVATE_KEY, new ethers.JsonRpcProvider(ZG_RPC))
          : null;
        await postShieldHint(relaySigner, privkey, { commitment, token, amount: amt, salt });
        send({ step: "hint", msg: "✓ Note hint saved — private send will find this note" });
      } catch (e) {
        // Local save already happened inside postShieldHint before the 0G upload attempt.
        send({ step: "hint", msg: `Note hint saved locally (0G Storage unavailable: ${e?.message ?? e})` });
      }

      send({
        step: "done",
        op: "shield",
        proof: ethers.hexlify(proof),
        commitment: toCommitmentHex(commitment),
        poolAddress: POOL_ADDRESS,
        params: {
          token,
          amount: amount.toString(),
          commitment: toCommitmentHex(commitment),
        },
      });

    } else if (op === "privateSend" || op === "unshield") {
      if (op === "privateSend" && !receiverPubkey) throw new Error("receiverPubkey required");
      if (op === "unshield" && !recipient) throw new Error("recipient required");

      const dummySigner = ethers.Wallet.createRandom().connect(provider);
      const sdk = new StealthPaySDK({
        signer: dummySigner,
        privacyPoolAddress: POOL_ADDRESS,
        spendingPrivkey: privkey,
        confirmTimeoutMs: 180_000,
        zeroGStorage: ZG_STORAGE_CONFIG,
      });

      send({ step: "sync", msg: "Syncing Merkle tree to find your notes…" });
      await sdk.sync(provider, 0);

      // Inject any locally-stored hints (covers the case where 0G Storage was unavailable during shield).
      for (const h of getLocalHints(privkey)) {
        const commitment = BigInt(h.commitment);
        if (sdk.noteManager.getNote(commitment)) continue;
        const leafIndex = sdk.noteManager.findLeafIndex(commitment);
        if (leafIndex !== undefined) {
          sdk.noteManager.trackNote(commitment, h.token, BigInt(h.amount), BigInt(h.salt), leafIndex);
        }
      }

      const notes = sdk.getNotes(token);
      send({
        step: "sync",
        msg: `Found ${notes.length} unspent note(s) for this spending key`,
      });

      if (notes.length === 0) throw new Error("No unspent notes found. Shield tokens first.");

      send({ step: "prove", msg: `Generating UltraHonk ZK proof for ${op}… (30–60 s)` });

      const unspent  = notes.sort((a, b) => (a.amount < b.amount ? -1 : 1));
      const selected = [];
      let total = 0n;
      for (const n of unspent) {
        if (total >= amt) break;
        selected.push(n);
        total += n.amount;
        if (selected.length === 2) break;
      }
      if (total < amt) throw new Error(`Insufficient balance: have ${total}, need ${amt}`);

      const change       = total - amt;
      const merkleRoot   = sdk.noteManager.getCurrentRoot();
      const changePubkey = deriveSpendingPubkey(privkey);
      const recvPubkey   = op === "privateSend" ? BigInt(receiverPubkey) : changePubkey;
      const randSalt     = () => BigInt(ethers.hexlify(ethers.randomBytes(32))) % BN254;

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
        recipient:    op === "unshield" ? recipient : ethers.ZeroAddress,
      });

      send({
        step: "done",
        op,
        proof: ethers.hexlify(proof),
        poolAddress: POOL_ADDRESS,
        params: {
          token,
          merkleRoot:     "0x" + merkleRoot.toString(16).padStart(64, "0"),
          nullifiers:     nullifiers.map(n => "0x" + n.toString(16).padStart(64, "0")),
          newCommitments: newCommitments.map(c => "0x" + c.toString(16).padStart(64, "0")),
          publicAmount:   op === "unshield" ? amount.toString() : "0",
          recipient:      op === "unshield" ? recipient : ethers.ZeroAddress,
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

    const amt     = BigInt(amount);
    const privkey = BigInt(spendingPrivkey);

    send({ step: "prove", msg: `Generating UltraHonk ZK proof… (30–60 s)` });

    if (op === "shield") {
      // Generate proof directly so we have the salt — needed to post the hint.
      const salt = BigInt(ethers.hexlify(ethers.randomBytes(32))) % BN254;
      const { proof, commitment } = await generateShieldProof({
        spendingPrivkey: privkey,
        token,
        amount: amt,
        salt,
      });

      // Approve token if needed
      const erc20Signer  = new ethers.Contract(token, ERC20_ABI, signer);
      const allowance    = await erc20Signer.allowance(address, POOL_ADDRESS);
      if (BigInt(allowance) < amt) {
        send({ step: "approve", msg: "Approving token spend…" });
        const approveTx = await erc20Signer.approve(POOL_ADDRESS, amt);
        await approveTx.wait();
      }

      // Submit shield tx
      const pool      = new ethers.Contract(POOL_ADDRESS, POOL_ABI, signer);
      const shieldTx  = await pool.shield(
        { token, amount: amt, commitment: toCommitmentHex(commitment) },
        ethers.hexlify(proof),
      );
      const receipt = await shieldTx.wait();

      // Save hint so future privateSend/unshield can find this note via 0G Storage sync
      send({ step: "hint", msg: "Saving note hint to 0G Storage…" });
      try {
        await postShieldHint(signer, privkey, { commitment, token, amount: amt, salt });
        send({ step: "hint", msg: "✓ Note hint saved" });
      } catch (e) {
        send({ step: "hint", msg: `Note hint skipped: ${e?.message ?? e}` });
      }

      send({
        step: "done", op: "shield",
        txHash:     receipt.hash,
        explorer:   `https://chainscan-galileo.0g.ai/tx/${receipt.hash}`,
        commitment: toCommitmentHex(commitment),
        amount:     ethers.formatUnits(amt, decimals) + " USDC",
        from:       address,
        to:         POOL_ADDRESS,
      });

    } else {
      // privateSend / unshield — sync with 0G Storage so shielded notes are found
      const sdk = new StealthPaySDK({
        signer,
        privacyPoolAddress: POOL_ADDRESS,
        spendingPrivkey:    privkey,
        confirmTimeoutMs:   180_000,
        zeroGStorage:       ZG_STORAGE_CONFIG,
      });

      send({ step: "sync", msg: "Syncing Merkle tree…" });
      await sdk.sync(provider, 0);

      for (const h of getLocalHints(privkey)) {
        const commitment = BigInt(h.commitment);
        if (sdk.noteManager.getNote(commitment)) continue;
        const leafIndex = sdk.noteManager.findLeafIndex(commitment);
        if (leafIndex !== undefined) {
          sdk.noteManager.trackNote(commitment, h.token, BigInt(h.amount), BigInt(h.salt), leafIndex);
        }
      }

      const notes = sdk.getNotes(token);
      send({ step: "sync", msg: `Tree synced — ${notes.length} unspent note(s)` });

      let result;
      if (op === "privateSend") {
        if (!receiverPubkey) throw new Error("receiverPubkey required");
        result = await sdk.privateSend(token, amt, BigInt(receiverPubkey));
        send({
          step: "done", op: "privateSend",
          txHash:             result.txHash,
          explorer:           `https://chainscan-galileo.0g.ai/tx/${result.txHash}`,
          receiverCommitment: "0x" + result.receiverCommitment.toString(16).padStart(64, "0"),
          changeCommitment:   result.changeCommitment ? "0x" + result.changeCommitment.toString(16).padStart(64, "0") : "none",
          amount:             ethers.formatUnits(result.amount, decimals) + " USDC",
          from:               address,
        });
      } else if (op === "unshield") {
        if (!recipient) throw new Error("recipient required");
        result = await sdk.unshield(token, amt, recipient);
        const finalBal = await erc20.balanceOf(recipient);
        send({
          step: "done", op: "unshield",
          txHash:                result.txHash,
          explorer:              `https://chainscan-galileo.0g.ai/tx/${result.txHash}`,
          from:                  address,
          to:                    recipient,
          amount:                ethers.formatUnits(result.amount, decimals) + " USDC",
          recipientFinalBalance: ethers.formatUnits(finalBal, decimals) + " USDC",
        });
      }
    }
  } catch (err) {
    send({ step: "error", msg: err?.message ?? String(err) });
  }

  res.end();
});

// ─────────────────────────────────────────────────────────────────────────────
// V1 Payroll Demo Routes
// ─────────────────────────────────────────────────────────────────────────────

// GET /v1/employees — return employee list + recent payments
app.get("/v1/employees", async (_req, res) => {
  try {
    const payments = process.env.MONGO_URI
      ? await Payment.find().sort({ timestamp: -1 }).limit(20).lean()
      : [];
    res.json({
      employees: EMPLOYEES.map(e => ({
        id: e.id, name: e.name, role: e.role,
        color: e.color, salary: e.salary.toString(),
        spendingPubkey: e.spendingPubkey,
      })),
      payments,
    });
  } catch (err) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// POST /v1/org/shield — org shields USDC into the private pool (SSE)
app.post("/v1/org/shield", async (req, res) => {
  const send = sse(res);
  const { amount } = req.body;
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    send({ step: "error", msg: "DEPLOYER_PRIVATE_KEY not set on server" });
    return res.end();
  }
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer   = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
    const amt      = BigInt(amount || "300000000");

    send({ step: "prove", msg: "Generating ZK proof for shield… (30–60 s)" });
    const salt = BigInt(ethers.hexlify(ethers.randomBytes(32))) % BN254;
    const { proof, commitment } = await generateShieldProof({
      spendingPrivkey: ORG_PRIVKEY, token: MOCK_TOKEN, amount: amt, salt,
    });

    const erc20   = new ethers.Contract(MOCK_TOKEN, ERC20_ABI, signer);
    const addr    = await signer.getAddress();
    const allow   = await erc20.allowance(addr, POOL_ADDRESS);
    if (BigInt(allow) < amt) {
      send({ step: "approve", msg: "Approving token spend…" });
      await (await erc20.approve(POOL_ADDRESS, amt)).wait();
    }

    send({ step: "submit", msg: "Submitting shield transaction…" });
    const pool    = new ethers.Contract(POOL_ADDRESS, POOL_ABI, signer);
    const receipt = await (await pool.shield(
      { token: MOCK_TOKEN, amount: amt, commitment: toCommitmentHex(commitment) },
      ethers.hexlify(proof),
    )).wait();

    saveHintLocally(ORG_PRIVKEY, {
      commitment: toCommitmentHex(commitment),
      token: MOCK_TOKEN, amount: amt.toString(), salt: salt.toString(),
    });

    send({
      step: "done", txHash: receipt.hash,
      explorer: `https://chainscan-galileo.0g.ai/tx/${receipt.hash}`,
      amount: ethers.formatUnits(amt, 6) + " USDC shielded into pool",
    });
  } catch (err) {
    send({ step: "error", msg: err?.message ?? String(err) });
  }
  res.end();
});

// POST /v1/org/balance — get org's current shielded pool balance
app.post("/v1/org/balance", async (_req, res) => {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const dummy    = ethers.Wallet.createRandom().connect(provider);
    const sdk      = new StealthPaySDK({
      signer: dummy, privacyPoolAddress: POOL_ADDRESS,
      spendingPrivkey: ORG_PRIVKEY, confirmTimeoutMs: 60_000,
      zeroGStorage: ZG_STORAGE_CONFIG,
    });
    await sdk.sync(provider, 0);
    injectLocalHints(sdk, ORG_PRIVKEY, MOCK_TOKEN);
    const notes   = sdk.getNotes(MOCK_TOKEN);
    const balance = notes.reduce((a, n) => a + n.amount, 0n);
    res.json({ balance: ethers.formatUnits(balance, 6), noteCount: notes.length });
  } catch (err) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// POST /v1/pay — org pays an employee via privateSend (SSE)
app.post("/v1/pay", async (req, res) => {
  const send = sse(res);
  const { employeeId, amount } = req.body;
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    send({ step: "error", msg: "DEPLOYER_PRIVATE_KEY not set on server" });
    return res.end();
  }
  const employee = EMPLOYEES.find(e => e.id === employeeId);
  if (!employee) { send({ step: "error", msg: "Employee not found" }); return res.end(); }

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer   = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
    const amt      = BigInt(amount ?? employee.salary);

    const sdk = new StealthPaySDK({
      signer, privacyPoolAddress: POOL_ADDRESS,
      spendingPrivkey: ORG_PRIVKEY, confirmTimeoutMs: 180_000,
      zeroGStorage: ZG_STORAGE_CONFIG,
    });

    send({ step: "sync", msg: "Syncing org pool balance…" });
    await sdk.sync(provider, 0);
    injectLocalHints(sdk, ORG_PRIVKEY, MOCK_TOKEN);

    const notes   = sdk.getNotes(MOCK_TOKEN);
    const balance = notes.reduce((a, n) => a + n.amount, 0n);
    send({ step: "sync", msg: `Pool balance: ${ethers.formatUnits(balance, 6)} USDC` });

    send({ step: "prove", msg: `Generating ZK proof for payment to ${employee.name}… (30–60 s)` });
    const result = await sdk.privateSend(MOCK_TOKEN, amt, BigInt(employee.spendingPubkey));

    if (process.env.MONGO_URI) {
      await Payment.create({ to: employee.name, amount: ethers.formatUnits(amt, 6) + " USDC", txHash: result.txHash });
    }

    send({
      step: "done", to: employee.name,
      txHash: result.txHash,
      explorer: `https://chainscan-galileo.0g.ai/tx/${result.txHash}`,
      amount: ethers.formatUnits(amt, 6) + " USDC",
    });
  } catch (err) {
    send({ step: "error", msg: err?.message ?? String(err) });
  }
  res.end();
});

// POST /v1/balance — get an employee's private balance (password gated)
app.post("/v1/balance", async (req, res) => {
  const { employeeId, password } = req.body;
  if (password !== "123456") return res.status(401).json({ error: "Wrong password" });
  const employee = EMPLOYEES.find(e => e.id === employeeId);
  if (!employee) return res.status(404).json({ error: "Employee not found" });

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const dummy    = ethers.Wallet.createRandom().connect(provider);
    const sdk      = new StealthPaySDK({
      signer: dummy, privacyPoolAddress: POOL_ADDRESS,
      spendingPrivkey: employee.spendingPrivkey, confirmTimeoutMs: 60_000,
      zeroGStorage: ZG_STORAGE_CONFIG,
    });
    await sdk.sync(provider, 0);
    injectLocalHints(sdk, employee.spendingPrivkey, MOCK_TOKEN);
    const notes   = sdk.getNotes(MOCK_TOKEN);
    const balance = notes.reduce((a, n) => a + n.amount, 0n);
    res.json({ balance: ethers.formatUnits(balance, 6), noteCount: notes.length });
  } catch (err) {
    res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// POST /v1/withdraw — employee withdraws to a wallet address (SSE, password gated)
app.post("/v1/withdraw", async (req, res) => {
  const send = sse(res);
  const { employeeId, password, recipient, amount } = req.body;
  if (password !== "123456") { send({ step: "error", msg: "Wrong password" }); return res.end(); }
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    send({ step: "error", msg: "DEPLOYER_PRIVATE_KEY not set on server" });
    return res.end();
  }
  const employee = EMPLOYEES.find(e => e.id === employeeId);
  if (!employee) { send({ step: "error", msg: "Employee not found" }); return res.end(); }

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer   = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

    const sdk = new StealthPaySDK({
      signer, privacyPoolAddress: POOL_ADDRESS,
      spendingPrivkey: employee.spendingPrivkey, confirmTimeoutMs: 180_000,
      zeroGStorage: ZG_STORAGE_CONFIG,
    });

    send({ step: "sync", msg: `Syncing ${employee.name}'s private balance…` });
    await sdk.sync(provider, 0);
    injectLocalHints(sdk, employee.spendingPrivkey, MOCK_TOKEN);

    const notes   = sdk.getNotes(MOCK_TOKEN);
    const balance = notes.reduce((a, n) => a + n.amount, 0n);
    const amt     = amount ? BigInt(amount) : balance;
    send({ step: "sync", msg: `Private balance: ${ethers.formatUnits(balance, 6)} USDC` });

    if (balance === 0n) throw new Error("No balance to withdraw");

    send({ step: "prove", msg: "Generating ZK proof for withdrawal… (30–60 s)" });
    const result = await sdk.unshield(MOCK_TOKEN, amt, recipient);

    send({
      step: "done", txHash: result.txHash,
      explorer: `https://chainscan-galileo.0g.ai/tx/${result.txHash}`,
      amount: ethers.formatUnits(amt, 6) + " USDC",
      recipient,
    });
  } catch (err) {
    send({ step: "error", msg: err?.message ?? String(err) });
  }
  res.end();
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`StealthPay backend :${PORT}`));
