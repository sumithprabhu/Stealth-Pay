import "dotenv/config";
import { pino } from "pino";
import { EngineConfig } from "./types/index";
import { CryptoEngine } from "./core/CryptoEngine";
import { AttestationSigner } from "./core/AttestationSigner";
import { NoteManager } from "./core/NoteManager";
import { PrivacyPoolClient } from "./chain/PrivacyPoolClient";
import { LocalStorageAdapter, ZeroGStorageAdapter } from "./storage/ZeroGStorage";
import { buildServer } from "./api/server";

const logger = pino({ name: "StealthPayEngine" });

function loadConfig(): EngineConfig {
  const required = (key: string): string => {
    const val = process.env[key];
    if (!val) throw new Error(`Required env var ${key} is not set`);
    return val;
  };

  return {
    enclave: {
      privateKey: required("ENCLAVE_PRIVATE_KEY"),
    },
    chain: {
      rpc:                      process.env["ZERO_G_CHAIN_RPC"]          ?? "https://evmrpc-testnet.0g.ai",
      chainId:                  parseInt(process.env["ZERO_G_CHAIN_ID"]  ?? "16600"),
      privacyPoolAddress:       required("PRIVACY_POOL_ADDRESS"),
      attestationVerifierAddress: required("ATTESTATION_VERIFIER_ADDRESS"),
    },
    storage: {
      nodeUrl:    process.env["ZERO_G_STORAGE_NODE"]   ?? "",
      indexerUrl: process.env["ZERO_G_INDEXER_NODE"]   ?? "",
    },
    crypto: {
      noteEncryptionKey: required("NOTE_ENCRYPTION_KEY"),
    },
    server: {
      port:           parseInt(process.env["PORT"]        ?? "3000"),
      host:           process.env["HOST"]                 ?? "0.0.0.0",
      logLevel:       process.env["LOG_LEVEL"]            ?? "info",
      allowedOrigins: (process.env["ALLOWED_ORIGINS"]    ?? "").split(",").filter(Boolean),
      apiKey:         required("API_KEY"),
    },
    limits: {
      maxNullifiersPerAction:  parseInt(process.env["MAX_NULLIFIERS_PER_ACTION"]  ?? "10"),
      maxCommitmentsPerAction: parseInt(process.env["MAX_COMMITMENTS_PER_ACTION"] ?? "10"),
      attestationDeadlineSeconds: parseInt(process.env["ATTESTATION_DEADLINE_SECONDS"] ?? "3600"),
    },
  };
}

async function main() {
  logger.info("Starting StealthPay Engine");

  const config = loadConfig();

  // ── Initialise core services ────────────────────────────────────────────

  const crypto = new CryptoEngine(config.crypto.noteEncryptionKey);

  const chainClient = new PrivacyPoolClient(
    config.chain.rpc,
    config.chain.privacyPoolAddress,
    config.chain.attestationVerifierAddress,
  );

  // Fetch the AttestationVerifier's domain separator to sign against
  logger.info("Fetching AttestationVerifier domain separator from chain…");
  const domainSeparator = await chainClient.getDomainSeparator();
  logger.info({ domainSeparator }, "Domain separator fetched");

  const signer = new AttestationSigner(config.enclave.privateKey, domainSeparator);
  logger.info({ enclaveAddress: signer.address }, "Enclave signer initialised");

  // Verify this enclave is registered on-chain before accepting traffic
  const isActive = await chainClient.isEnclaveActive(signer.address);
  if (!isActive) {
    logger.warn(
      { enclaveAddress: signer.address },
      "Enclave key is NOT active on-chain. Register it via AttestationVerifier before processing requests."
    );
  }

  // Use 0G Storage in prod, in-memory adapter in dev/test
  const useLocalStorage = !config.storage.nodeUrl || process.env["NODE_ENV"] === "test";
  const storage = useLocalStorage
    ? new LocalStorageAdapter()
    : new ZeroGStorageAdapter(config.storage.nodeUrl, config.storage.indexerUrl);

  if (useLocalStorage) {
    logger.warn("Using in-memory storage — data will not persist across restarts");
  }

  const noteManager = new NoteManager(crypto, storage, signer.address);

  // ── Start HTTP server ───────────────────────────────────────────────────

  const app = await buildServer(config, { noteManager, crypto, signer, chainClient });

  await app.listen({ port: config.server.port, host: config.server.host });
  logger.info({ port: config.server.port, host: config.server.host }, "Engine listening");
}

main().catch((err) => {
  logger.error({ err }, "Fatal engine startup error");
  process.exit(1);
});
