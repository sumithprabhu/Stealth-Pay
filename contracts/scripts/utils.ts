import fs from "fs";
import path from "path";

export interface DeploymentRecord {
  network:            string;
  chainId:            number;
  deployedAt:         string;
  deployer:           string;
  ShieldVerifier:     string;
  SpendVerifier:      string;
  PrivacyPoolImpl:    string;
  PrivacyPoolProxy:   string;
}

const DEPLOYMENTS_DIR = path.join(__dirname, "..", "deployments");

export function saveDeployment(record: DeploymentRecord): string {
  if (!fs.existsSync(DEPLOYMENTS_DIR)) fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  const file = path.join(DEPLOYMENTS_DIR, `${record.network}.json`);
  fs.writeFileSync(file, JSON.stringify(record, null, 2));
  return file;
}

export function loadDeployment(network: string): DeploymentRecord {
  const file = path.join(DEPLOYMENTS_DIR, `${network}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`No deployment found for network "${network}". Run deploy.ts first.`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as DeploymentRecord;
}

export function mustEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export function optionalEnv(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}
