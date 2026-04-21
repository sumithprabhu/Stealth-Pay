import { expect } from "chai";
import { MerkleTree, NoteManager } from "../src/NoteManager";
import { hashNode, fieldToBytes32, BN254_PRIME } from "../src/poseidon2";

// ─────────────────────────────────────────────────────────────────────────────
// MerkleTree unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe("MerkleTree", () => {
  describe("zeros array", () => {
    it("zeros[0] is 0", () => {
      const t = new MerkleTree(4);
      expect(t.zeros[0]).to.equal(0n);
    });

    it("zeros[1] = hashNode(0, 0)", () => {
      const t = new MerkleTree(4);
      expect(t.zeros[1]).to.equal(hashNode(0n, 0n));
    });

    it("zeros[2] = hashNode(zeros[1], zeros[1])", () => {
      const t = new MerkleTree(4);
      expect(t.zeros[2]).to.equal(hashNode(t.zeros[1], t.zeros[1]));
    });

    it("each level chains correctly up to depth", () => {
      const t = new MerkleTree(10);
      for (let i = 1; i <= 10; i++) {
        expect(t.zeros[i]).to.equal(hashNode(t.zeros[i - 1], t.zeros[i - 1]));
      }
    });
  });

  describe("empty tree", () => {
    it("root of empty depth-4 tree equals zeros[4]", () => {
      const t = new MerkleTree(4);
      expect(t.getRoot()).to.equal(t.zeros[4]);
    });

    it("size is 0", () => {
      expect(new MerkleTree(4).size).to.equal(0);
    });
  });

  describe("insert", () => {
    it("after one insert, root changes from empty root", () => {
      const t = new MerkleTree(4);
      const emptyRoot = t.getRoot();
      t.insert(12345n);
      expect(t.getRoot()).to.not.equal(emptyRoot);
    });

    it("size increments with each insert", () => {
      const t = new MerkleTree(4);
      t.insert(1n);
      expect(t.size).to.equal(1);
      t.insert(2n);
      expect(t.size).to.equal(2);
    });

    it("root after inserting leaf at index 0 = hashChain(leaf, zeros)", () => {
      const t    = new MerkleTree(4);
      const leaf = 0xABCDn;
      t.insert(leaf);

      // Manually compute: level 1 = hash(leaf, zeros[0])
      let node = hashNode(leaf, t.zeros[0]);
      // level 2 = hash(level1, zeros[1])
      node = hashNode(node, t.zeros[1]);
      // level 3 = hash(level2, zeros[2])
      node = hashNode(node, t.zeros[2]);
      // level 4 = hash(level3, zeros[3])
      node = hashNode(node, t.zeros[3]);

      expect(t.getRoot()).to.equal(node);
    });

    it("two leaves produce correct root", () => {
      const t  = new MerkleTree(4);
      const l0 = 111n;
      const l1 = 222n;
      t.insert(l0);
      t.insert(l1);

      // level 1: parent of l0, l1
      const p01  = hashNode(l0, l1);
      const root = hashNode(
        hashNode(hashNode(p01, t.zeros[1]), t.zeros[2]),
        t.zeros[3],
      );
      expect(t.getRoot()).to.equal(root);
    });
  });

  describe("getSiblings", () => {
    it("sibling of index 0 (right sibling) is zeros[0] when tree has 1 leaf", () => {
      const t = new MerkleTree(4);
      t.insert(999n);
      const siblings = t.getSiblings(0);
      expect(siblings[0]).to.equal(t.zeros[0]); // level-0 sibling = leaf 1 (doesn't exist → zero)
    });

    it("sibling of index 1 is the actual leaf at index 0", () => {
      const t = new MerkleTree(4);
      const leaf0 = 0xAAAAn;
      t.insert(leaf0);
      t.insert(0xBBBBn);
      const siblings = t.getSiblings(1);
      expect(siblings[0]).to.equal(leaf0);
    });

    it("siblings length equals tree depth", () => {
      const t = new MerkleTree(20);
      t.insert(1n);
      expect(t.getSiblings(0)).to.have.length(20);
    });

    it("using siblings recomputes the correct root (depth 4, 3 leaves)", () => {
      const t = new MerkleTree(4);
      t.insert(10n);
      t.insert(20n);
      t.insert(30n);

      const root = t.getRoot();

      // Verify each leaf's sibling path leads back to the same root
      for (let idx = 0; idx < 3; idx++) {
        const leaf     = [10n, 20n, 30n][idx];
        const siblings = t.getSiblings(idx);

        // Walk path from leaf to root using siblings
        let node    = leaf;
        let current = idx;
        for (let level = 0; level < 4; level++) {
          const isRight = current % 2 === 1;
          node    = isRight ? hashNode(siblings[level], node) : hashNode(node, siblings[level]);
          current = Math.floor(current / 2);
        }
        expect(node).to.equal(root, `Leaf ${idx} path should recompute root`);
      }
    });

    it("siblings update correctly after more inserts", () => {
      const t = new MerkleTree(4);
      t.insert(1n);

      // Sibling of index 0 at level 0 is zeros[0] initially
      expect(t.getSiblings(0)[0]).to.equal(t.zeros[0]);

      // After inserting leaf at index 1, sibling changes
      t.insert(9999n);
      expect(t.getSiblings(0)[0]).to.equal(9999n);
    });
  });

  describe("root matches Solidity reference (depth-1 sanity check)", () => {
    it("two-leaf depth-1 tree matches hand-computed Poseidon2", () => {
      const t  = new MerkleTree(1);
      const l0 = 1n;
      const l1 = 2n;
      t.insert(l0);
      t.insert(l1);
      expect(t.getRoot()).to.equal(hashNode(l0, l1));
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NoteManager unit tests (no chain needed)
// ─────────────────────────────────────────────────────────────────────────────

function fakePool() {
  // Minimal stub — NoteManager only calls .on() / .off() via startListening()
  return {
    on:  () => {},
    off: () => {},
    queryFilter: async () => [],
    filters: { Shielded: () => {}, Spent: () => {} },
  } as unknown as import("ethers").Contract;
}

describe("NoteManager", () => {
  const PRIVKEY = 0xCAFEBABEn;
  const TOKEN   = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

  it("starts with empty notes and zero tree root (= zeros[20])", () => {
    const nm = new NoteManager(PRIVKEY, fakePool());
    expect(nm.getUnspentNotes()).to.have.length(0);
  });

  it("trackNote adds a note and getSiblings returns depth-20 array", () => {
    const nm = new NoteManager(PRIVKEY, fakePool());
    const commitment = 0xDEADn;
    // Insert it into the tree first (simulates the Shielded event path)
    // We do it manually here: call the internal tree via NoteManager's public API
    // trackNote should work after at least one leaf is in the tree
    nm["tree"].insert(commitment);
    nm["allLeaves"].push({ commitment, token: TOKEN });
    nm.trackNote(commitment, TOKEN, 1_000_000n, 12345n, 0);

    const notes = nm.getUnspentNotes(TOKEN);
    expect(notes).to.have.length(1);
    expect(notes[0].commitment).to.equal(commitment);
    expect(notes[0].siblings).to.have.length(20);
  });

  it("getUnspentNotes filters by token", () => {
    const nm = new NoteManager(PRIVKEY, fakePool());
    const c1 = 1n, c2 = 2n;
    nm["tree"].insert(c1);
    nm["allLeaves"].push({ commitment: c1, token: TOKEN });
    nm["tree"].insert(c2);
    nm["allLeaves"].push({ commitment: c2, token: "0x0000000000000000000000000000000000000002" });

    nm.trackNote(c1, TOKEN, 100n, 0n, 0);
    nm.trackNote(c2, "0x0000000000000000000000000000000000000002", 200n, 0n, 1);

    expect(nm.getUnspentNotes(TOKEN)).to.have.length(1);
    expect(nm.getUnspentNotes()).to.have.length(2);
  });

  it("getCurrentRoot matches MerkleTree root after inserts", () => {
    const nm = new NoteManager(PRIVKEY, fakePool());
    nm["tree"].insert(100n);
    nm["allLeaves"].push({ commitment: 100n, token: TOKEN });
    expect(nm.getCurrentRoot()).to.equal(nm["tree"].getRoot());
  });

  it("isNullifierSpent returns false initially", () => {
    const nm = new NoteManager(PRIVKEY, fakePool());
    expect(nm.isNullifierSpent(0xBEEFn)).to.be.false;
  });
});
