import Link from "next/link";

export const metadata = { title: "Security Disclosure — Stealth Pay" };

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-24">
        <Link href="/" className="text-sm text-white/40 hover:text-white transition-colors mb-12 inline-block">
          ← Back to home
        </Link>

        <h1 className="text-4xl font-display mb-2">Security <span className="text-[#eca8d6]">Disclosure</span></h1>
        <p className="text-white/40 text-sm mb-12">Responsible disclosure policy</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-10 text-white/70 leading-relaxed">
          <section>
            <h2 className="text-lg font-medium text-white mb-3">Reporting a vulnerability</h2>
            <p>
              If you discover a security vulnerability in the Stealth Pay smart contracts, circuits, or frontend,
              please report it responsibly. Do not open a public GitHub issue for security-sensitive bugs.
            </p>
            <p className="mt-3">
              Open a private security advisory on{" "}
              <a
                href="https://github.com/sumithprabhu/Stealth-Pay/security/advisories/new"
                className="text-[#eca8d6] hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub Security Advisories
              </a>
              . We aim to respond within 48 hours.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">Scope</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Smart contracts (PrivacyPool, verifiers)</li>
              <li>ZK circuits (shield, spend, Poseidon)</li>
              <li>TypeScript SDK</li>
              <li>Frontend application</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">Out of scope</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Issues in third-party dependencies (report upstream)</li>
              <li>Theoretical attacks with no practical exploit path</li>
              <li>UI/UX bugs with no security impact</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">Our commitment</h2>
            <p>
              We will acknowledge your report, investigate promptly, and credit you in the fix announcement (unless
              you prefer to remain anonymous). We ask that you give us reasonable time to patch before public
              disclosure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-medium text-white mb-3">Audit reports</h2>
            <p>
              See the{" "}
              <a href="/docs/ai-security-report" className="text-[#eca8d6] hover:underline">
                AI security report
              </a>{" "}
              in the documentation for a full analysis of the protocol's security properties.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
