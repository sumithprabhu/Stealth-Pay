"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const sections = [
  {
    group: "Overview",
    items: [
      { slug: "",             label: "What is Stealth Pay?" },
      { slug: "architecture", label: "Architecture" },
    ],
  },
  {
    group: "How It Works",
    items: [
      { slug: "shield",    label: "Shielding tokens" },
      { slug: "transfer",  label: "Private transfers" },
      { slug: "unshield",  label: "Unshielding" },
      { slug: "merkle",    label: "Merkle note system" },
    ],
  },
  {
    group: "SDK Reference",
    items: [
      { slug: "sdk-install",  label: "Installation" },
      { slug: "sdk-init",     label: "Initialization" },
      { slug: "sdk-shield",   label: "sdk.shield()" },
      { slug: "sdk-send",     label: "sdk.privateSend()" },
      { slug: "sdk-unshield", label: "sdk.unshield()" },
      { slug: "sdk-sync",     label: "sdk.sync()" },
    ],
  },
  {
    group: "Contracts",
    items: [
      { slug: "contracts-overview",      label: "Overview" },
      { slug: "contracts-privacy-pool",  label: "PrivacyPool" },
      { slug: "contracts-verifiers",     label: "Verifiers" },
      { slug: "contracts-deployments",   label: "Deployments" },
    ],
  },
  {
    group: "Circuits",
    items: [
      { slug: "circuits-shield",   label: "Shield circuit" },
      { slug: "circuits-spend",    label: "Spend circuit" },
      { slug: "circuits-poseidon", label: "Poseidon2 hash" },
    ],
  },
];

function Sidebar() {
  const pathname = usePathname();

  const isActive = (slug: string) => {
    if (slug === "") return pathname === "/docs";
    return pathname === `/docs/${slug}`;
  };

  return (
    <aside
      className="hidden lg:flex flex-col w-60 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] border-r border-white/[0.07]"
      style={{ background: "oklch(0.06 0.008 260)" }}
    >
      <nav
        className="docs-sidebar flex-1 overflow-y-auto py-8 px-4"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.07) transparent",
        }}
      >
        {sections.map((group) => (
          <div key={group.group} className="mb-7">
            <p className="text-[10px] font-mono text-white/25 uppercase tracking-[0.12em] mb-2 px-3">
              {group.group}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={item.slug === "" ? "/docs" : `/docs/${item.slug}`}
                    className={`block text-sm px-3 py-1.5 transition-colors rounded-sm ${
                      isActive(item.slug)
                        ? "text-[#eca8d6] bg-[#eca8d6]/[0.08]"
                        : "text-white/38 hover:text-white/65 hover:bg-white/[0.04]"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen text-white"
      style={{ background: "oklch(0.06 0.008 260)" }}
    >
      {/* Top nav */}
      <header
        className="sticky top-0 z-50 border-b border-white/[0.07] backdrop-blur-md"
        style={{ background: "oklch(0.06 0.008 260 / 0.95)" }}
      >
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-base font-display text-white/80 hover:text-white transition-colors"
            >
              Stealth Pay
            </Link>
            <span className="text-white/15">/</span>
            <span className="text-sm font-mono text-white/35">docs</span>
          </div>
          <div className="flex items-center gap-5">
            <a
              href="https://github.com"
              className="text-sm text-white/35 hover:text-white/70 transition-colors font-mono"
            >
              GitHub ↗
            </a>
            <a
              href="/app"
              className="text-sm font-mono border border-white/15 px-4 py-1.5 text-white/50 hover:text-white hover:border-white/30 transition-colors"
            >
              Launch app
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto flex">
        <Sidebar />
        <main className="flex-1 min-w-0 px-8 lg:px-14 py-12 lg:py-14 max-w-[820px]">
          {children}
        </main>
      </div>
    </div>
  );
}
