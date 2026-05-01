"use client";

import { useEffect, useState, useCallback } from "react";
import { ethers } from "ethers";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import Image from "next/image";

// ── Config ────────────────────────────────────────────────────────────────────
const NETWORKS = {
  testnet: {
    label:        "Testnet",
    rpc:          "https://evmrpc-testnet.0g.ai",
    poolAddress:  "0x87fECd1AfA436490e3230C8B0B5aD49dcC1283F1",
    explorer:     "https://chainscan-galileo.0g.ai",
    deployBlock:  28_000_000,
  },
  mainnet: {
    label: "Mainnet", rpc: "", poolAddress: "", explorer: "", deployBlock: 0,
  },
} as const;

const POOL_ABI = [
  "event Shielded(address indexed token, address indexed depositor, uint256 netAmount, uint256 fee, bytes32 commitment, bytes32 newRoot, uint256 leafIndex)",
  "event Spent(address indexed token, bytes32[2] nullifiers, bytes32[2] newCommitments, uint256 publicAmount, address indexed recipient, bytes32 newRoot)",
];

const BLOCKS_PER_DAY   = 196_000;
const BLOCKS_PER_WEEK  = 1_372_000;
const BLOCKS_PER_MONTH = 5_880_000;

type Network   = keyof typeof NETWORKS;
type TimeRange = "1D" | "1W" | "1M" | "ALL";

interface TimedEvent { type: "shield" | "spend"; blockNumber: number; txHash: string; ts: number; date: string; }
interface DayPoint   { date: string; shields: number; spends: number; }
interface Stats      { allEvents: TimedEvent[]; totalShields: number; totalSpends: number; merkleLeaves: number; currentBlock: number; }

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildDayChart(events: TimedEvent[]): DayPoint[] {
  const map = new Map<string, DayPoint>();
  for (const e of events) {
    if (!map.has(e.date)) map.set(e.date, { date: e.date, shields: 0, spends: 0 });
    const pt = map.get(e.date)!;
    e.type === "shield" ? pt.shields++ : pt.spends++;
  }
  return Array.from(map.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function filterByRange(events: TimedEvent[], range: TimeRange, currentBlock: number): TimedEvent[] {
  if (range === "ALL") return events;
  const min = range === "1D" ? currentBlock - BLOCKS_PER_DAY
            : range === "1W" ? currentBlock - BLOCKS_PER_WEEK
                              : currentBlock - BLOCKS_PER_MONTH;
  return events.filter(e => e.blockNumber >= min);
}

// ── Skeletons ─────────────────────────────────────────────────────────────────
function ChartSkeleton() {
  const bars = [40, 70, 30, 90, 55, 75, 45, 85, 60, 95, 50, 80];
  return (
    <div className="h-[220px] flex items-end gap-2 px-1 pb-6 relative">
      <div className="absolute bottom-0 left-0 right-0 h-px bg-foreground/5" />
      {bars.map((h, i) => (
        <div key={i} className="flex-1 flex flex-col gap-1 items-center justify-end">
          <div
            className="w-full bg-foreground/5 animate-pulse rounded-sm"
            style={{ height: `${h * 1.6}px`, animationDelay: `${i * 60}ms` }}
          />
        </div>
      ))}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-0">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="flex items-center justify-between py-3 border-b border-foreground/5 last:border-0">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-foreground/10 animate-pulse" />
            <div className="h-3 w-14 bg-foreground/8 animate-pulse rounded-sm" style={{ animationDelay: `${i * 80}ms` }} />
          </div>
          <div className="flex gap-4">
            <div className="h-3 w-16 bg-foreground/8 animate-pulse rounded-sm" style={{ animationDelay: `${i * 80 + 40}ms` }} />
            <div className="h-3 w-20 bg-foreground/8 animate-pulse rounded-sm" style={{ animationDelay: `${i * 80 + 80}ms` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0e0e1a] border border-white/10 px-4 py-3 text-xs font-mono">
      <p className="text-white/40 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ExplorerPage() {
  const [network, setNetwork]         = useState<Network>("testnet");
  const [range, setRange]             = useState<TimeRange>("1D");
  const [stats, setStats]             = useState<Stats | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    const cfg = NETWORKS[network];
    if (!cfg.rpc || !cfg.poolAddress) return;
    try {
      setError(null);
      const provider  = new ethers.JsonRpcProvider(cfg.rpc);
      const contract  = new ethers.Contract(cfg.poolAddress, POOL_ABI, provider);
      const currentBlock = await provider.getBlockNumber();

      const [shieldedLogs, spentLogs] = await Promise.all([
        contract.queryFilter(contract.filters.Shielded(), cfg.deployBlock, currentBlock),
        contract.queryFilter(contract.filters.Spent(),    cfg.deployBlock, currentBlock),
      ]);

      // Batch-fetch unique block timestamps
      const rawEvents = [
        ...shieldedLogs.map(l => ({ type: "shield" as const, blockNumber: l.blockNumber, txHash: l.transactionHash })),
        ...spentLogs.map(l    => ({ type: "spend"  as const, blockNumber: l.blockNumber, txHash: l.transactionHash })),
      ];
      const uniqueBlocks = [...new Set(rawEvents.map(e => e.blockNumber))];
      const blockResults = await Promise.allSettled(uniqueBlocks.map(n => provider.getBlock(n)));
      const tsMap = new Map(
        uniqueBlocks.map((n, i) => {
          const r = blockResults[i];
          return [n, r.status === "fulfilled" && r.value ? r.value.timestamp : 0];
        })
      );

      const allEvents: TimedEvent[] = rawEvents
        .map(e => ({ ...e, ts: tsMap.get(e.blockNumber) ?? 0, date: fmtDate(tsMap.get(e.blockNumber) ?? 0) }))
        .sort((a, b) => b.blockNumber - a.blockNumber);

      // Get merkle leaf count directly from args (no re-parsing)
      let merkleLeaves = 0;
      if (shieldedLogs.length > 0) {
        try {
          const last = shieldedLogs[shieldedLogs.length - 1] as ethers.EventLog;
          merkleLeaves = Number(last.args?.leafIndex ?? 0) + 1;
        } catch {}
      }

      const newStats = { allEvents, totalShields: shieldedLogs.length, totalSpends: spentLogs.length, merkleLeaves, currentBlock };
      setStats(newStats);
      setLastUpdated(new Date());

      // Auto-shift to nearest range that has data
      setRange(prev => {
        const ranges: TimeRange[] = ["1D", "1W", "1M", "ALL"];
        for (const r of ranges.slice(ranges.indexOf(prev))) {
          if (filterByRange(allEvents, r, currentBlock).length > 0) return r;
        }
        return "ALL";
      });
    } catch (e: any) {
      setError(e?.shortMessage ?? e?.message ?? "RPC error");
    } finally {
      setLoading(false);
    }
  }, [network]);

  useEffect(() => {
    setLoading(true);
    setStats(null);
    fetchData();
    const iv = setInterval(fetchData, 30_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const cfg          = NETWORKS[network];
  // Chart filtered by range; live feed always shows all-time
  const filtered     = stats ? filterByRange(stats.allEvents, range, stats.currentBlock) : [];
  const chartData    = buildDayChart(filtered);
  const rangeShields = filtered.filter(e => e.type === "shield").length;
  const rangeSpends  = filtered.filter(e => e.type === "spend").length;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">

      {/* Nav */}
      <header className="border-b border-foreground/8 px-6 lg:px-12 py-4 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="Stealth Pay" width={24} height={24} />
          <span className="font-display text-xl">Stealth <span className="text-[#eca8d6]">Pay</span></span>
        </a>
        <span className="text-xs font-mono text-muted-foreground tracking-widest uppercase">Explorer</span>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 lg:px-12 py-12">

        {/* Header + network toggle */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
          <div>
            <p className="text-xs font-mono text-muted-foreground tracking-widest uppercase mb-3">On-chain activity</p>
            <h1 className="text-4xl lg:text-5xl font-display leading-tight">
              Privacy pool<br /><span className="text-muted-foreground">by the numbers.</span>
            </h1>
            <p className="mt-3 text-sm text-muted-foreground font-mono max-w-md">
              Aggregate stats only. No addresses. No amounts. No traces.
            </p>
          </div>
          <div className="flex items-center gap-1 border border-foreground/10 p-1 self-start sm:self-auto">
            {(Object.keys(NETWORKS) as Network[]).map(n => {
              const disabled = n === "mainnet";
              return (
                <button key={n} onClick={() => !disabled && setNetwork(n)} disabled={disabled}
                  className={`px-4 py-1.5 text-xs font-mono tracking-wider uppercase transition-all relative ${
                    network === n ? "bg-foreground text-background"
                    : disabled   ? "text-foreground/20 cursor-not-allowed"
                                 : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {disabled && <span className="absolute -top-2 -right-1 text-[9px] font-mono text-[#eca8d6]">soon</span>}
                  {NETWORKS[n].label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs font-mono text-red-400 mb-8">
            {error}
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total transactions", value: stats ? stats.totalShields + stats.totalSpends : null, accent: false },
            { label: "Shields (all time)", value: stats?.totalShields,  accent: true  },
            { label: "Spends (all time)",  value: stats?.totalSpends,   accent: false },
            { label: "Merkle leaves",      value: stats?.merkleLeaves,  accent: false },
          ].map(({ label, value, accent }) => (
            <div key={label} className="border border-foreground/10 bg-foreground/[0.02] p-6">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">{label}</p>
              {loading
                ? <div className="h-10 w-20 bg-foreground/5 animate-pulse rounded-sm" />
                : <p className="text-4xl font-display leading-none" style={accent ? { color: "#eca8d6" } : {}}>{value ?? 0}</p>
              }
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="border border-foreground/10 bg-foreground/[0.02] p-6 lg:p-8 mb-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Daily activity</p>
              {!loading && (
                <p className="text-xs font-mono text-muted-foreground">
                  {rangeShields} shields · {rangeSpends} spends
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              {/* Time filter */}
              <div className="flex border border-foreground/10">
                {(["1D","1W","1M","ALL"] as TimeRange[]).map(r => (
                  <button key={r} onClick={() => setRange(r)}
                    className={`px-3 py-1.5 text-xs font-mono tracking-wider transition-all ${
                      range === r ? "bg-[#eca8d6] text-black" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >{r}</button>
                ))}
              </div>
              {/* Legend */}
              <div className="hidden sm:flex items-center gap-4 text-xs font-mono">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-px inline-block bg-[#eca8d6]" />
                  <span className="text-muted-foreground">shields</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-px inline-block bg-[#67e8f9]" />
                  <span className="text-muted-foreground">spends</span>
                </span>
              </div>
            </div>
          </div>

          {loading ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="shieldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#eca8d6" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#eca8d6" stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#67e8f9" stopOpacity={0.16} />
                    <stop offset="95%" stopColor="#67e8f9" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date"
                  tick={{ fontSize: 10, fontFamily: "var(--font-jetbrains)", fill: "rgba(255,255,255,0.25)" }}
                  axisLine={false} tickLine={false}
                />
                <YAxis allowDecimals={false}
                  tick={{ fontSize: 10, fontFamily: "var(--font-jetbrains)", fill: "rgba(255,255,255,0.25)" }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="shields" name="shields"
                  stroke="#eca8d6" strokeWidth={1.5} fill="url(#shieldGrad)" dot={false} />
                <Area type="monotone" dataKey="spends"  name="spends"
                  stroke="#67e8f9" strokeWidth={1.5} fill="url(#spendGrad)"  dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Live feed + pool info */}
        <div className="grid lg:grid-cols-2 gap-4">

          {/* Live feed — always shows all-time data */}
          <div className="border border-foreground/10 bg-foreground/[0.02] p-6">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-5">
              Recent anonymous transactions
            </p>
            {loading ? <FeedSkeleton /> : (
              <div className="space-y-0">
                {(stats?.allEvents ?? []).slice(0, 10).map((ev, i) => (
                  <div key={ev.txHash + i} className="flex items-center justify-between py-2.5 border-b border-foreground/5 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: ev.type === "shield" ? "#eca8d6" : "#67e8f9",
                                 boxShadow: `0 0 6px ${ev.type === "shield" ? "#eca8d6" : "#67e8f9"}` }}
                      />
                      <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                        {ev.type === "shield" ? "Shield" : "Spend"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                      <span>{ev.date}</span>
                      <span>#{ev.blockNumber.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pool info */}
          <div className="border border-foreground/10 bg-foreground/[0.02] p-6 flex flex-col gap-4">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Pool info</p>
            {[
              { label: "Network",         value: cfg.label },
              { label: "Contract",        value: cfg.poolAddress ? `${cfg.poolAddress.slice(0,10)}…${cfg.poolAddress.slice(-8)}` : "—" },
              { label: "Latest block",    value: stats?.currentBlock ? `#${stats.currentBlock.toLocaleString()}` : loading ? "—" : "—" },
              { label: "Tree capacity",   value: "2²⁰ leaves" },
              { label: "Tree fill",       value: stats ? `${stats.merkleLeaves} / 1,048,576` : "0 / 1,048,576" },
              { label: "ZK proof system", value: "UltraHonk (BN254)" },
              { label: "Hash function",   value: "Poseidon2" },
              { label: "Avg block time",  value: "~0.44s" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-4 text-xs font-mono">
                <span className="text-muted-foreground">{label}</span>
                <span className="text-right">{loading && label === "Latest block" ? <span className="inline-block w-16 h-3 bg-foreground/5 animate-pulse rounded-sm" /> : value}</span>
              </div>
            ))}
            {cfg.explorer && (
              <a href={cfg.explorer} target="_blank" rel="noopener noreferrer"
                className="mt-auto pt-4 border-t border-foreground/5 text-xs font-mono text-[#eca8d6] hover:opacity-70 transition-opacity">
                View on block explorer →
              </a>
            )}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between text-xs font-mono text-muted-foreground/40">
          <span>Auto-refreshes every 30s</span>
          {lastUpdated && <span>Last updated {lastUpdated.toLocaleTimeString()}</span>}
        </div>

      </main>
    </div>
  );
}
