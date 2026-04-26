import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

const MOCK_TOKEN   = "0xB4fd61544493a27a4793F161d6BE153d1A0f6092";
const RPC_URL      = "https://evmrpc-testnet.0g.ai";
const FAUCET_AMOUNT = BigInt(1_000) * BigInt(10 ** 6); // 1 000 USDC

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();

    if (!ethers.isAddress(address)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    const privkey = process.env.DEPLOYER_PRIVATE_KEY?.trim();
    if (!privkey) {
      return NextResponse.json({ error: "Faucet not configured" }, { status: 500 });
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer   = new ethers.Wallet(privkey, provider);
    const token    = new ethers.Contract(MOCK_TOKEN, ERC20_ABI, signer);

    const faucetBal = await token.balanceOf(await signer.getAddress()) as bigint;
    if (faucetBal < FAUCET_AMOUNT) {
      return NextResponse.json({ error: "Faucet dry" }, { status: 503 });
    }

    const tx = await token.transfer(address, FAUCET_AMOUNT);
    await tx.wait();

    return NextResponse.json({
      txHash: tx.hash,
      amount: FAUCET_AMOUNT.toString(),
      token: MOCK_TOKEN,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
