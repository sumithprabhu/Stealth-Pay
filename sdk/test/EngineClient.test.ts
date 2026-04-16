import { expect } from "chai";
import sinon from "sinon";
import { ethers } from "ethers";
import { EngineClient } from "../src/EngineClient";
import { StealthPayError } from "../src/types";

const BASE_URL   = "http://engine.test";
const API_KEY    = "test-key";
const OWNER      = ethers.Wallet.createRandom().address;
const TOKEN      = ethers.Wallet.createRandom().address;
const COMMITMENT = ethers.hexlify(ethers.randomBytes(32));
const RECIPIENT  = ethers.Wallet.createRandom().address;
const TEE_SIG    = ethers.hexlify(ethers.randomBytes(65));

function makeClient() {
  return new EngineClient(BASE_URL, API_KEY);
}

describe("EngineClient", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => { sandbox = sinon.createSandbox(); });
  afterEach(() => sandbox.restore());

  /** Create a fake fetch that returns the given JSON with the given status. */
  function fakeFetch(body: unknown, status = 200): sinon.SinonStub {
    return sandbox.stub(globalThis, "fetch" as keyof typeof globalThis).resolves({
      ok:   status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response);
  }

  describe("notifyShield", () => {
    it("posts to /shield and returns the response", async () => {
      const body = { commitment: COMMITMENT, message: "ok" };
      fakeFetch(body);
      const res = await makeClient().notifyShield(OWNER, TOKEN, 1000n, COMMITMENT);
      expect(res.commitment).to.equal(COMMITMENT);
    });

    it("throws StealthPayError on non-2xx", async () => {
      fakeFetch({ error: "bad request" }, 400);
      try {
        await makeClient().notifyShield(OWNER, TOKEN, 1000n, COMMITMENT);
        expect.fail("should have thrown");
      } catch (err: unknown) {
        expect(err).to.be.instanceOf(StealthPayError);
        expect((err as StealthPayError).message).to.equal("bad request");
      }
    });
  });

  describe("requestUnshield", () => {
    it("posts to /unshield and returns teeSignature + onChainParams", async () => {
      const body = {
        teeSignature: TEE_SIG,
        onChainParams: {
          token:     TOKEN,
          amount:    "1000",
          recipient: RECIPIENT,
          nullifier: ethers.hexlify(ethers.randomBytes(32)),
          newRoot:   ethers.hexlify(ethers.randomBytes(32)),
          deadline:  "9999999999",
          nonce:     "1",
        },
      };
      fakeFetch(body);
      const res = await makeClient().requestUnshield(COMMITMENT, RECIPIENT);
      expect(res.teeSignature).to.equal(TEE_SIG);
      expect(res.onChainParams.amount).to.equal("1000");
    });
  });

  describe("requestPrivateTransfer", () => {
    it("posts to /private-transfer and returns the response", async () => {
      const body = {
        teeSignature: TEE_SIG,
        onChainParams: {
          nullifiers:     [ethers.hexlify(ethers.randomBytes(32))],
          newCommitments: [ethers.hexlify(ethers.randomBytes(32))],
          newRoot:        ethers.hexlify(ethers.randomBytes(32)),
          deadline:       "9999999999",
          nonce:          "1",
        },
        receiverCommitment: COMMITMENT,
        changeCommitment:   null,
      };
      fakeFetch(body);
      const res = await makeClient().requestPrivateTransfer(
        COMMITMENT, RECIPIENT, TOKEN, 500n,
      );
      expect(res.receiverCommitment).to.equal(COMMITMENT);
      expect(res.changeCommitment).to.be.null;
    });
  });

  describe("getBalance", () => {
    it("GETs /balance/:owner/:token and returns balance data", async () => {
      const body = { owner: OWNER, token: TOKEN, balance: "5000000", noteCount: 2 };
      fakeFetch(body);
      const res = await makeClient().getBalance(OWNER, TOKEN);
      expect(res.balance).to.equal("5000000");
      expect(res.noteCount).to.equal(2);
    });
  });
});
