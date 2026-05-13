import Link from "next/link";

export const metadata = { title: "Terms of Service — Stealth Pay" };

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-24">
        <Link href="/" className="text-sm text-white/40 hover:text-white transition-colors mb-12 inline-block">
          ← Back to home
        </Link>

        <h1 className="text-4xl font-display mb-2">Terms of <span className="text-[#eca8d6]">Service</span></h1>
        <p className="text-white/40 text-sm mb-12">Last updated: May 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-10 text-white/70 leading-relaxed">
          <section>
            <h2 className="text-lg font-medium text-white mb-3">1. Protocol access</h2>
            <p>
              Stealth Pay is an open-source, permissionless protocol deployed on 0G Chain. Access to the smart
              contracts is available to anyone with a compatible wallet. The frontend interface is provided as a
              convenience and may be modified or taken offline at any time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">2. No warranties</h2>
            <p>
              The protocol and interface are provided "as is" without warranty of any kind. Smart contracts are
              audited but no system is completely risk-free. Use at your own risk. You are solely responsible for
              the security of your private keys and wallet.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">3. Prohibited use</h2>
            <p>
              You may not use Stealth Pay to violate applicable laws, including sanctions regulations in your
              jurisdiction. The protocol is designed for lawful financial privacy, not for evading legal obligations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">4. Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, the contributors of Stealth Pay shall not be liable for any
              direct, indirect, incidental, or consequential damages arising from use of the protocol.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">5. Open source</h2>
            <p>
              All source code is released under the MIT License. You are free to fork, modify, and deploy your own
              instance. See the{" "}
              <a href="https://github.com/sumithprabhu/Stealth-Pay" className="text-[#eca8d6] hover:underline" target="_blank" rel="noopener noreferrer">
                GitHub repository
              </a>{" "}
              for details.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">6. Governing law</h2>
            <p>
              These terms are governed by the laws of the jurisdiction in which the primary contributors are located,
              without regard to conflict-of-law principles.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
