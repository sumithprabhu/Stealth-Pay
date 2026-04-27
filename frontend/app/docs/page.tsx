import Link from "next/link";
import { Callout } from "./_components/shared";

export default function DocsIntroPage() {
  return (
    <>
      <div className="mb-2">
        <span className="text-xs font-mono text-white/25 uppercase tracking-widest">Overview</span>
      </div>
      <h1 className="text-5xl lg:text-[56px] font-display tracking-tight leading-[0.92] mb-8 text-white">
        What is Stealth <span className="text-[#eca8d6]">Pay</span>?
      </h1>

      <p className="text-white/55 leading-relaxed mb-4 text-lg">
        Stealth <span className="text-[#eca8d6]">Pay</span> is a zero-knowledge privacy protocol for ERC-20 tokens on 0G Chain. It lets users
        shield tokens into an on-chain pool, transact privately inside it, and withdraw to any address
        — with no observable link between deposit and withdrawal.
      </p>
      <p className="text-white/55 leading-relaxed mb-4">
        Every operation is backed by an <strong className="text-white/75">UltraHonk ZK proof</strong> verified
        by an immutable smart contract. There are no relayers, no trusted parties, and no off-chain state.
        Privacy is a protocol guarantee, not a policy.
      </p>

      <div className="grid md:grid-cols-3 gap-4 my-10">
        {[
          { title: "Shield", body: "Deposit any whitelisted ERC-20. Get a private note.", href: "/docs/shield" },
          { title: "Transfer", body: "Send tokens privately to any spending pubkey.", href: "/docs/transfer" },
          { title: "Unshield", body: "Withdraw to any address. Nullifier prevents double-spend.", href: "/docs/unshield" },
        ].map((c) => (
          <Link
            key={c.title}
            href={c.href}
            className="border border-white/[0.08] p-5 hover:border-[#eca8d6]/30 hover:bg-[#eca8d6]/[0.03] transition-colors group"
          >
            <h3 className="font-medium mb-2 text-white group-hover:text-[#eca8d6] transition-colors">{c.title}</h3>
            <p className="text-sm text-white/45 leading-relaxed">{c.body}</p>
          </Link>
        ))}
      </div>

      <Callout type="tip">
        Stealth <span className="text-[#eca8d6]">Pay</span> is deployed on 0G Galileo testnet (chain ID 16602). The proxy address is{" "}
        <code className="font-mono text-[#eca8d6]">0x87fECd1AfA436490e3230C8B0B5aD49dcC1283F1</code>.
      </Callout>

      <h2 className="text-2xl font-display tracking-tight mt-12 mb-5 text-white">Quick start</h2>
      <div className="space-y-3">
        {[
          { step: "01", label: "See use cases & payment patterns", href: "/docs/usecases" },
          { step: "02", label: "Install the SDK", href: "/docs/sdk-install" },
          { step: "03", label: "Initialize with your signer and spending key", href: "/docs/sdk-init" },
          { step: "04", label: "Sync the Merkle tree from chain", href: "/docs/sdk-sync" },
          { step: "05", label: "Shield your first tokens", href: "/docs/sdk-shield" },
        ].map((s) => (
          <Link
            key={s.step}
            href={s.href}
            className="flex items-center gap-4 p-4 border border-white/[0.07] hover:border-white/20 hover:bg-white/[0.02] transition-colors group"
          >
            <span className="font-mono text-sm text-[#eca8d6]/60 shrink-0">{s.step}</span>
            <span className="text-sm text-white/50 group-hover:text-white/75 transition-colors">{s.label}</span>
            <span className="ml-auto text-white/20 group-hover:text-white/45 transition-colors">→</span>
          </Link>
        ))}
      </div>

      <div className="mt-14 pt-8 border-t border-white/[0.07] flex items-center justify-between text-xs text-white/20 font-mono">
        <span>Stealth <span className="text-[#eca8d6]">Pay</span> · 0G Galileo testnet</span>
        <a href="https://github.com" className="hover:text-white/45 transition-colors">Edit on GitHub ↗</a>
      </div>
    </>
  );
}
