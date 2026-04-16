import { expect } from "chai";
import sinon from "sinon";
import { ethers } from "ethers";
import { StealthPaySDK } from "../src/StealthPaySDK";
import { EngineClient } from "../src/EngineClient";
import { ChainClient } from "../src/ChainClient";
import { StealthPayConfig } from "../src/types";

const TOKEN      = ethers.Wallet.createRandom().address;
const OWNER      = ethers.Wallet.createRandom().address;
const RECIPIENT  = ethers.Wallet.createRandom().address;
const COMMITMENT = ethers.hexlify(ethers.randomBytes(32));
const NULL_HASH  = ethers.hexlify(ethers.randomBytes(32));
const ROOT_HASH  = ethers.hexlify(ethers.randomBytes(32));
const TEE_SIG    = ethers.hexlify(ethers.randomBytes(65));
const TX_HASH    = ethers.hexlify(ethers.randomBytes(32));

function fakeReceipt(): ethers.TransactionReceipt {
  return { hash: TX_HASH, status: 1 } as unknown as ethers.TransactionReceipt;
}

function makeSdk() {
  const signer = {
    getAddress: async () => OWNER,
  } as unknown as ethers.Signer;

  const config: StealthPayConfig = {
    signer,
    engineUrl:          "http://engine.test",
    privacyPoolAddress: ethers.Wallet.createRandom().address,
    apiKey:             "test-key",
  };

  const sdk = new StealthPaySDK(config);
  return { sdk, engine: (sdk as unknown as { engine: EngineClient }).engine, chain: (sdk as unknown as { chain: ChainClient }).chain };
}

describe("StealthPaySDK", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => { sandbox = sinon.createSandbox(); });
  afterEach(() => sandbox.restore());

  // ─────────────────────────────────────────────────────────────────────────

  describe("shield()", () => {
    it("approves, shields on-chain, notifies engine, returns ShieldResult", async () => {
      const { sdk, engine, chain } = makeSdk();

      sandbox.stub(chain, "approveIfNeeded").resolves();
      sandbox.stub(chain, "shield").resolves(fakeReceipt());
      sandbox.stub(engine, "notifyShield").resolves({ commitment: COMMITMENT, message: "ok" });

      const result = await sdk.shield(TOKEN, 1_000_000n);

      expect(result.txHash).to.equal(TX_HASH);
      expect(result.amount).to.equal(1_000_000n);
      expect(result.token).to.equal(TOKEN);
      expect(result.commitment).to.match(/^0x[0-9a-f]{64}$/i);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────

  describe("unshield()", () => {
    it("requests engine signature and submits on-chain", async () => {
      const { sdk, engine, chain } = makeSdk();

      sandbox.stub(engine, "requestUnshield").resolves({
        teeSignature: TEE_SIG,
        onChainParams: {
          token:     TOKEN,
          amount:    "1000000",
          recipient: RECIPIENT,
          nullifier: NULL_HASH,
          newRoot:   ROOT_HASH,
          deadline:  "9999999999",
          nonce:     "1",
        },
      });
      sandbox.stub(chain, "unshield").resolves(fakeReceipt());

      const result = await sdk.unshield(COMMITMENT, RECIPIENT);

      expect(result.txHash).to.equal(TX_HASH);
      expect(result.amount).to.equal(1_000_000n);
      expect(result.recipient).to.equal(RECIPIENT);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────

  describe("privateSend()", () => {
    it("requests private transfer from engine and submits on-chain", async () => {
      const { sdk, engine, chain } = makeSdk();

      const receiverCommitment = ethers.hexlify(ethers.randomBytes(32));
      sandbox.stub(engine, "requestPrivateTransfer").resolves({
        teeSignature: TEE_SIG,
        onChainParams: {
          nullifiers:     [NULL_HASH],
          newCommitments: [receiverCommitment],
          newRoot:        ROOT_HASH,
          deadline:       "9999999999",
          nonce:          "1",
        },
        receiverCommitment,
        changeCommitment: null,
      });
      sandbox.stub(chain, "privateAction").resolves(fakeReceipt());

      const result = await sdk.privateSend(COMMITMENT, RECIPIENT, TOKEN, 500_000n);

      expect(result.txHash).to.equal(TX_HASH);
      expect(result.receiverCommitment).to.equal(receiverCommitment);
      expect(result.changeCommitment).to.be.null;
    });
  });

  // ─────────────────────────────────────────────────────────────────────────

  describe("getPrivateBalance()", () => {
    it("returns parsed balance from engine", async () => {
      const { sdk, engine } = makeSdk();

      sandbox.stub(engine, "getBalance").resolves({
        owner:     OWNER,
        token:     TOKEN,
        balance:   "3000000",
        noteCount: 3,
      });

      const result = await sdk.getPrivateBalance(TOKEN);

      expect(result.balance).to.equal(3_000_000n);
      expect(result.noteCount).to.equal(3);
      expect(result.owner).to.equal(OWNER);
    });
  });
});
