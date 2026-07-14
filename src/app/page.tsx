"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useFetch } from "@/lib/useFetch";
import type { CompanyProfile, CompanyScore } from "@/lib/types";
import { fmtMoney, fmtScore, scoreTone } from "@/lib/format";
import { capBucketUsd } from "@/lib/data/capBucket";
import { CompletenessBadge, Empty, ErrorBox, Loading, Tip, WeightBar, toneText } from "@/components/ui";

interface CompaniesResp {
  companies: (CompanyProfile & { marketCapUsd: number })[];
  options: { sectors: string[]; industries: string[]; countries: string[]; exchanges: string[] };
  source: string;
}
interface ScoresResp {
  scores: CompanyScore[];
  source: string;
  lastUpdated: string;
}

interface Row {
  ticker: string;
  name: string;
  industry: string;
  sector: string;
  country: string;
  exchange: string;
  marketCapUsd: number;
  score: CompanyScore | null;
}

const CAPS = [
  { v: "", label: "Any cap" },
  { v: "large", label: "Large cap (≥$10B)" },
  { v: "mid", label: "Mid cap ($2–10B)" },
  { v: "small", label: "Small cap (<$2B)" },
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");
  const [exchange, setExchange] = useState("");
  const [cap, setCap] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  // Single data source for the default view: /api/scores already contains
  // every field the screener shows. Only an actual search query needs the
  // separate /api/companies lookup — this keeps a cold page load down to ONE
  // universe fetch on the server instead of two racing ones (which doubles
  // upstream API usage and can trip provider burst limits on serverless).
  const isSearching = query.trim().length > 0;
  const searchUrl = isSearching ? `/api/companies?query=${encodeURIComponent(query.trim())}` : null;
  const search = useFetch<CompaniesResp>(searchUrl);
  const scores = useFetch<ScoresResp>("/api/scores");

  const scoreMap = useMemo(() => {
    const m = new Map<string, CompanyScore>();
    scores.data?.scores.forEach((s) => m.set(s.ticker, s));
    return m;
  }, [scores.data]);

  const options = useMemo(() => {
    const ss = scores.data?.scores ?? [];
    const uniq = (xs: string[]) => Array.from(new Set(xs)).sort();
    return {
      sectors: uniq(ss.map((s) => s.sector)),
      industries: uniq(ss.filter((s) => !sector || s.sector === sector).map((s) => s.industry)),
      countries: uniq(ss.map((s) => s.country)),
      exchanges: uniq(ss.map((s) => s.exchange)),
    };
  }, [scores.data, sector]);

  const rows = useMemo<Row[]>(() => {
    let base: Row[];
    if (isSearching) {
      base = (search.data?.companies ?? []).map((c) => ({
        ticker: c.ticker,
        name: c.name,
        industry: c.industry,
        sector: c.sector,
        country: c.country,
        exchange: c.exchange,
        marketCapUsd: c.marketCapUsd,
        score: scoreMap.get(c.ticker) ?? null,
      }));
    } else {
      base = (scores.data?.scores ?? []).map((s) => ({
        ticker: s.ticker,
        name: s.name,
        industry: s.industry,
        sector: s.sector,
        country: s.country,
        exchange: s.exchange,
        marketCapUsd: s.marketCapUsd,
        score: s,
      }));
    }
    let list = base;
    if (sector) list = list.filter((r) => r.sector === sector);
    if (industry) list = list.filter((r) => r.industry === industry);
    if (country) list = list.filter((r) => r.country === country);
    if (exchange) list = list.filter((r) => r.exchange === exchange);
    if (cap) list = list.filter((r) => capBucketUsd(r.marketCapUsd) === cap);
    return [...list].sort((a, b) => (b.score?.overall ?? -1) - (a.score?.overall ?? -1));
  }, [isSearching, search.data, scores.data, scoreMap, sector, industry, country, exchange, cap]);

  const loading = scores.loading || (isSearching && search.loading);
  const error = isSearching ? search.error ?? scores.error : scores.error;
  const retry = isSearching && search.error ? search.retry : scores.retry;

  const toggle = (t: string) =>
    setSelected((s) => (s.includes(t) ? s.filter((x) => x !== t) : s.length >= 5 ? s : [...s, t]));

  return (
    <div>
      {/* hero */}
      <section className="pb-8 pt-6">
        <p className="eyebrow">Peer-relative equity scoring</p>
        <h1 className="mt-1 max-w-2xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
          Every company, ranked against the peers that actually matter.
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted">
          Quantile scores companies 0–100 on <span className="text-ink">margins (40%)</span>,{" "}
          <span className="text-ink">growth (30%)</span> and <span className="text-ink">sales performance (30%)</span>{" "}
          using percentile ranks within each industry.{" "}
          <Link href="/methodology" className="text-accent underline-offset-2 hover:underline">
            See the full formula
          </Link>
          .
        </p>
      </section>

      {/* search + filters */}
      <section className="card p-4">
        <label className="sr-only" htmlFor="q">
          Search companies
        </label>
        <input
          id="q"
          value={query}
          onChange={(e) => setQuery(e.target.value.slice(0, 80))}
          placeholder="Search by company name or ticker…"
          className="w-full rounded-lg border border-line bg-panel2 px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-accent"
        />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(
            [
              ["Sector", sector, setSector, options.sectors],
              ["Industry", industry, setIndustry, options.industries],
              ["Country", country, setCountry, options.countries],
              ["Exchange", exchange, setExchange, options.exchanges],
            ] as const
          ).map(([label, value, set, opts]) => (
            <select
              key={label}
              value={value}
              onChange={(e) => set(e.target.value)}
              aria-label={label}
              className="rounded-lg border border-line bg-panel2 px-2.5 py-2 text-sm text-ink"
            >
              <option value="">{`Any ${label.toLowerCase()}`}</option>
              {opts.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ))}
          <select
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            aria-label="Market cap"
            className="rounded-lg border border-line bg-panel2 px-2.5 py-2 text-sm"
          >
            {CAPS.map((c) => (
              <option key={c.v} value={c.v}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* compare tray */}
      {selected.length > 0 && (
        <div className="sticky top-14 z-30 mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-accent/50 bg-panel p-3">
          <span className="text-sm text-muted">Compare ({selected.length}/5):</span>
          {selected.map((t) => (
            <button key={t} onClick={() => toggle(t)} className="num rounded-md bg-panel2 px-2 py-1 text-xs hover:text-bad">
              {t} ✕
            </button>
          ))}
          <Link
            href={`/compare?tickers=${selected.join(",")}`}
            aria-disabled={selected.length < 2}
            className={`ml-auto rounded-lg px-4 py-1.5 text-sm font-medium ${
              selected.length >= 2 ? "bg-accent text-white" : "pointer-events-none bg-panel2 text-muted"
            }`}
          >
            {selected.length >= 2 ? "Compare →" : "Pick at least 2"}
          </Link>
        </div>
      )}

      {/* results */}
      <section className="mt-4 space-y-2">
        {loading && <Loading label="Scoring companies…" />}
        {error && !loading && <ErrorBox message={error} retry={retry} />}
        {!loading && !error && rows.length === 0 && (
          <Empty title="No companies match" hint="Try clearing a filter or searching a different name or ticker." />
        )}
        {!loading &&
          rows.map((c) => {
            const s = c.score;
            return (
              <div key={c.ticker} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <input
                  type="checkbox"
                  checked={selected.includes(c.ticker)}
                  onChange={() => toggle(c.ticker)}
                  aria-label={`Select ${c.name} for comparison`}
                  className="h-4 w-4 accent-[rgb(var(--accent))]"
                />
                <div className="min-w-0 sm:w-72">
                  <Link href={`/company/${c.ticker}`} className="font-medium hover:text-accent">
                    {c.name} <span className="num text-xs text-muted">{c.ticker}</span>
                  </Link>
                  <p className="truncate text-xs text-muted">
                    {c.industry} · {c.country} · {c.exchange} · {fmtMoney(c.marketCapUsd)} cap
                  </p>
                </div>
                <div className="flex-1">
                  {s ? (
                    <WeightBar score={s} height={7} />
                  ) : (
                    <span className="text-xs text-muted">
                      Not in the scored universe — open the company page for details.
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 sm:w-44 sm:justify-end">
                  {s && <CompletenessBadge value={s.completeness} />}
                  <div className="text-right">
                    <span className="eyebrow block">
                      <Tip text="Weighted average of the three category scores: margins 40%, growth 30%, sales 30%. Percentile-ranked within the company's industry.">
                        Overall
                      </Tip>
                    </span>
                    <span className={`num text-2xl font-semibold ${toneText[scoreTone(s?.overall)]}`}>
                      {fmtScore(s?.overall)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
      </section>

      {scores.data && (
        <p className="mt-6 text-xs text-muted">
          Source: {scores.data.source} · figures shown in USD (converted) · scores use TTM data where available.
        </p>
      )}
    </div>
  );
}
