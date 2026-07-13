"use client";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useFetch } from "@/lib/useFetch";
import { fmtMoney, fmtScore } from "@/lib/format";
import type { CompanyScore } from "@/lib/types";
import { capBucketUsd } from "@/lib/data/capBucket";
import { WeightBar, ScoreChip, CompletenessBadge, Tip, Loading, ErrorBox, Empty } from "@/components/ui";

interface ScoresResp {
  scores: CompanyScore[];
  source: string;
  lastUpdated: string;
}

type SortKey = "overall" | "margins" | "growth" | "sales" | "mcap" | "completeness";
type CapBucket = "all" | "large" | "mid" | "small";

const CATEGORY_TABS: { key: SortKey; label: string; tip: string }[] = [
  { key: "overall", label: "Best overall", tip: "Weighted blend: Margins 40%, Growth 30%, Sales Performance 30%." },
  { key: "margins", label: "Best margins", tip: "Gross 25%, operating 35%, net 25%, FCF 15% — level, stability and trend." },
  { key: "growth", label: "Fastest growing", tip: "Revenue, operating income, EPS and FCF growth (YoY + 3y and 5y CAGR)." },
  { key: "sales", label: "Best sales performers", tip: "Revenue vs peers, revenue per employee, revenue CAGR and consistency." },
];

export default function RankingsPage() {
  return (
    <Suspense fallback={<Loading label="Loading rankings…" />}>
      <RankingsInner />
    </Suspense>
  );
}

function RankingsInner() {
  const [scope, setScope] = useState<"auto" | "market">("auto");
  const { data, error, loading, retry } = useFetch<ScoresResp>(`/api/scores?scope=${scope}`);

  const [tab, setTab] = useState<SortKey>("overall");
  const [sector, setSector] = useState("");
  const [industry, setIndustry] = useState("");
  const [cap, setCap] = useState<CapBucket>("all");
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [desc, setDesc] = useState(true);

  const all = data?.scores ?? [];
  const sectors = useMemo(() => uniq(all.map((s) => s.sector)), [all]);
  const industries = useMemo(
    () => uniq(all.filter((s) => !sector || s.sector === sector).map((s) => s.industry)),
    [all, sector]
  );

  const rows = useMemo(() => {
    let list = all.slice();
    if (sector) list = list.filter((s) => s.sector === sector);
    if (industry) list = list.filter((s) => s.industry === industry);
    if (cap !== "all") list = list.filter((s) => capBucketUsd(s.marketCapUsd) === cap);
    const get = (s: CompanyScore): number => {
      switch (sortKey) {
        case "overall": return s.overall ?? -1;
        case "margins": return s.margins.score ?? -1;
        case "growth": return s.growth.score ?? -1;
        case "sales": return s.sales.score ?? -1;
        case "mcap": return s.marketCapUsd;
        case "completeness": return s.completeness;
      }
    };
    list.sort((a, b) => (desc ? get(b) - get(a) : get(a) - get(b)));
    return list;
  }, [all, sector, industry, cap, sortKey, desc]);

  const pickTab = (k: SortKey) => {
    setTab(k);
    setSortKey(k);
    setDesc(true);
  };

  const th = (key: SortKey, label: string) => (
    <th className="px-3 py-3 font-normal">
      <button
        onClick={() => {
          if (sortKey === key) setDesc((d) => !d);
          else {
            setSortKey(key);
            setDesc(true);
          }
        }}
        className={`hover:text-ink ${sortKey === key ? "text-ink" : ""}`}
      >
        {label} {sortKey === key ? (desc ? "↓" : "↑") : ""}
      </button>
    </th>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="eyebrow">Rankings</p>
      <h1 className="font-display text-3xl font-semibold">Company leaderboards</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Companies ranked by percentile-based scores. Use the tabs for a category, then narrow by sector, industry or
        market-cap bucket. Click any column header to re-sort.
      </p>

      {/* Category tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {CATEGORY_TABS.map((t) => (
          <Tip key={t.key} text={t.tip}>
            <button
              onClick={() => pickTab(t.key)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                tab === t.key
                  ? "border-accent bg-accent/15 text-ink"
                  : "border-line text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          </Tip>
        ))}
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <select value={sector} onChange={(e) => { setSector(e.target.value); setIndustry(""); }} className="rounded-md border border-line bg-panel px-2 py-1.5" aria-label="Sector filter">
          <option value="">All sectors</option>
          {sectors.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="rounded-md border border-line bg-panel px-2 py-1.5" aria-label="Industry filter">
          <option value="">All industries</option>
          {industries.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={cap} onChange={(e) => setCap(e.target.value as CapBucket)} className="rounded-md border border-line bg-panel px-2 py-1.5" aria-label="Market-cap filter">
          <option value="all">All caps</option>
          <option value="large">Large cap (≥ $10B)</option>
          <option value="mid">Mid cap ($2–10B)</option>
          <option value="small">Small cap (&lt; $2B)</option>
        </select>
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
        <Tip text="Auto scores each company against its own industry peers (falling back to sector, then market, when the group is too small). Market scores everyone against the full universe.">
          <span className="text-xs text-muted">Peer scope</span>
        </Tip>
        <select value={scope} onChange={(e) => setScope(e.target.value as "auto" | "market")} className="rounded-md border border-line bg-panel px-2 py-1.5" aria-label="Peer scope">
          <option value="auto">Industry (default)</option>
          <option value="market">Entire market</option>
        </select>
        <span className="ml-auto text-xs text-muted">{rows.length} companies</span>
      </div>

      {loading && <Loading label="Scoring universe…" />}
      {error && <ErrorBox message={error} retry={retry} />}
      {!loading && !error && rows.length === 0 && (
        <Empty title="No companies match these filters" hint="Try clearing the sector, industry or cap filter." />
      )}

      {!loading && !error && rows.length > 0 && (
        <section className="card mt-4 overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-3 py-3 font-normal">#</th>
                <th className="px-3 py-3 font-normal">Company</th>
                {th("overall", "Overall")}
                {th("margins", "Margins")}
                {th("growth", "Growth")}
                {th("sales", "Sales")}
                {th("mcap", "Mkt cap")}
                {th("completeness", "Data")}
                <th className="px-3 py-3 font-normal">Score mix</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => (
                <tr key={s.ticker} className="border-b border-line/60 last:border-0 hover:bg-panel2/50">
                  <td className="num px-3 py-2.5 text-muted">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <Link href={`/company/${s.ticker}`} className="font-medium hover:text-accent">
                      {s.name}
                    </Link>
                    <p className="text-xs text-muted">
                      {s.ticker} · {s.industry} · {s.country}
                    </p>
                  </td>
                  <td className="px-3 py-2.5"><ScoreChip value={s.overall} /></td>
                  <td className="num px-3 py-2.5">{fmtScore(s.margins.score)}</td>
                  <td className="num px-3 py-2.5">{fmtScore(s.growth.score)}</td>
                  <td className="num px-3 py-2.5">{fmtScore(s.sales.score)}</td>
                  <td className="num px-3 py-2.5">{fmtMoney(s.marketCapUsd)}</td>
                  <td className="px-3 py-2.5"><CompletenessBadge value={s.completeness} /></td>
                  <td className="min-w-[160px] px-3 py-2.5"><WeightBar score={s} height={6} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {data && (
        <p className="mt-4 text-xs text-muted">
          Source: {data.source} · Default weights 40 / 30 / 30 ·{" "}
          <Link href="/methodology" className="text-accent hover:underline">
            How scores are calculated →
          </Link>
        </p>
      )}
    </div>
  );
}

function uniq(a: string[]): string[] {
  return Array.from(new Set(a)).sort();
}
