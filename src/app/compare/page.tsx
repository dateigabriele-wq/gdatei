"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useFetch } from "@/lib/useFetch";
import { fmtMoney, fmtPct, fmtScore } from "@/lib/format";
import type { CompanyScore, CompanyFinancials, CompanyProfile, Currency } from "@/lib/types";
import { ScoreBars, HistoryLines, CategoryRadar, SERIES_COLORS } from "@/components/charts";
import { WeightBar, ScoreChip, CompletenessBadge, Tip, Loading, ErrorBox, Empty } from "@/components/ui";

interface ScoresResp {
  scores: CompanyScore[];
  source: string;
  lastUpdated: string;
}
interface CompanyResp {
  profile: CompanyProfile;
  financials: CompanyFinancials;
  fx: { base: string; rates: Record<Currency, number> };
}
interface SearchResp {
  companies: (CompanyProfile & { marketCapUsd: number })[];
}

export default function ComparePage() {
  return (
    <Suspense fallback={<Loading label="Loading comparison…" />}>
      <CompareInner />
    </Suspense>
  );
}

function CompareInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const tickers = useMemo(
    () =>
      (sp.get("tickers") ?? "")
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter((t) => /^[A-Z0-9.\-]{1,10}$/.test(t))
        .slice(0, 5),
    [sp]
  );

  // Adjustable weights (percent, default 40/30/30)
  const [wm, setWm] = useState(40);
  const [wg, setWg] = useState(30);
  const [ws, setWs] = useState(30);
  const [scope, setScope] = useState<"auto" | "market">("auto");
  const wTotal = wm + wg + ws;

  const scoresUrl =
    tickers.length >= 2
      ? `/api/scores?tickers=${tickers.join(",")}&weights=${wm},${wg},${ws}&scope=${scope}`
      : null;
  const { data, error, loading, retry } = useFetch<ScoresResp>(scoresUrl);

  // Financial history (per ticker, fetched once — independent of weights)
  const [hist, setHist] = useState<Record<string, CompanyResp>>({});
  useEffect(() => {
    let alive = true;
    tickers.forEach((t) => {
      if (hist[t]) return;
      fetch(`/api/companies/${t}`)
        .then((r) => r.json())
        .then((d) => {
          if (alive && d?.financials) setHist((h) => ({ ...h, [t]: d }));
        })
        .catch(() => {});
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers]);

  const setTickers = (next: string[]) =>
    router.replace(`/compare?tickers=${next.join(",")}`, { scroll: false });

  const scores = useMemo(() => {
    const map = new Map((data?.scores ?? []).map((s) => [s.ticker, s]));
    return tickers.map((t) => map.get(t)).filter(Boolean) as CompanyScore[];
  }, [data, tickers]);

  if (tickers.length < 2) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Empty
          title="Pick at least two companies to compare"
          hint="Use the screener to select 2–5 companies, or add them below."
        />
        <div className="card mt-6 p-4">
          <AddCompany current={tickers} onAdd={(t) => setTickers([...tickers, t])} />
        </div>
        <p className="mt-4 text-sm text-muted">
          <Link className="text-accent hover:underline" href="/">
            ← Back to screener
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Comparison</p>
          <h1 className="font-display text-3xl font-semibold">
            {tickers.join(" · ")}
          </h1>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Tip text="Percentile peer group. Auto ranks each company inside its own industry (falling back to sector, then market, if the peer group is too small). Market ranks everyone against the full universe.">
            <span className="text-muted">Peer scope</span>
          </Tip>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as "auto" | "market")}
            className="rounded-md border border-line bg-panel px-2 py-1"
            aria-label="Peer scope"
          >
            <option value="auto">Industry (default)</option>
            <option value="market">Entire market</option>
          </select>
        </div>
      </div>

      {/* Weight controls */}
      <section className="card mt-6 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold">
            Category weights{" "}
            <Tip text="Overall Score = Margin Score × margins weight + Growth Score × growth weight + Sales Performance Score × sales weight. Weights are normalized to 100%. Defaults: 40 / 30 / 30.">
              <span className="cursor-help text-muted">ⓘ</span>
            </Tip>
          </h2>
          <div className="flex items-center gap-3 text-xs">
            <span className={wTotal === 100 ? "text-muted" : "text-brass"}>
              Total {wTotal}%{wTotal !== 100 && " (normalized to 100%)"}
            </span>
            <button
              onClick={() => {
                setWm(40);
                setWg(30);
                setWs(30);
              }}
              className="rounded-md border border-line px-2 py-1 text-muted hover:text-ink"
            >
              Reset to 40 / 30 / 30
            </button>
          </div>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <WeightSlider label="Margins" value={wm} onChange={setWm} color="bg-accent" />
          <WeightSlider label="Growth" value={wg} onChange={setWg} color="bg-good" />
          <WeightSlider label="Sales performance" value={ws} onChange={setWs} color="bg-brass" />
        </div>
      </section>

      {loading && <Loading label="Recalculating scores…" />}
      {error && <ErrorBox message={error} retry={retry} />}

      {!loading && !error && scores.length >= 2 && (
        <>
          {/* Side-by-side cards */}
          <section className="mt-6 grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(240px, 1fr))` }}>
            {scores.map((s, i) => (
              <article key={s.ticker} className="card relative p-4">
                <span
                  className="absolute left-0 top-0 h-1 w-full rounded-t-xl"
                  style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }}
                />
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/company/${s.ticker}`} className="font-display text-lg font-semibold hover:text-accent">
                      {s.name}
                    </Link>
                    <p className="text-xs text-muted">
                      {s.ticker} · {s.industry} · {s.country}
                    </p>
                  </div>
                  {tickers.length > 2 && (
                    <button
                      onClick={() => setTickers(tickers.filter((t) => t !== s.ticker))}
                      className="rounded-md border border-line px-1.5 text-xs text-muted hover:text-bad"
                      aria-label={`Remove ${s.ticker} from comparison`}
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <ScoreChip value={s.overall} label="Overall" big />
                  <div className="text-right text-xs text-muted">
                    <p className="num">{fmtMoney(s.marketCapUsd)} mcap</p>
                    <p className="num">{fmtMoney(s.sharePrice, s.currency)} / share</p>
                  </div>
                </div>
                <div className="mt-3">
                  <WeightBar score={s} />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-muted">
                    {s.industryRank ? `#${s.industryRank.rank} of ${s.industryRank.of} in industry` : "—"}
                  </span>
                  <CompletenessBadge value={s.completeness} />
                </div>
              </article>
            ))}
            {tickers.length < 5 && (
              <div className="card flex items-center justify-center border-dashed p-4">
                <AddCompany current={tickers} onAdd={(t) => setTickers([...tickers, t])} compact />
              </div>
            )}
          </section>

          {/* Comparison table */}
          <ComparisonTable scores={scores} hist={hist} />

          {/* Charts */}
          <section className="mt-8 grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Overall & category scores"
              tip="Scores are 0–100 percentile ranks against the peer scope selected above, combined with the weights you set."
            >
              <ScoreBars
                data={scores.map((s) => ({
                  label: s.ticker,
                  Overall: r1(s.overall),
                  Margins: r1(s.margins.score),
                  Growth: r1(s.growth.score),
                  Sales: r1(s.sales.score),
                }))}
                bars={[
                  { key: "Overall", name: "Overall" },
                  { key: "Margins", name: "Margins" },
                  { key: "Growth", name: "Growth" },
                  { key: "Sales", name: "Sales" },
                ]}
              />
            </ChartCard>

            <ChartCard title="Current margins (TTM)" tip="Gross, operating, net and free-cash-flow margins from trailing-twelve-month figures.">
              <ScoreBars
                data={scores.map((s) => {
                  const md = Object.fromEntries(s.marginDetails.map((m) => [m.key, m.current]));
                  return {
                    label: s.ticker,
                    Gross: pct(md.gross),
                    Operating: pct(md.operating),
                    Net: pct(md.net),
                    FCF: pct(md.fcf),
                  };
                })}
                bars={[
                  { key: "Gross", name: "Gross" },
                  { key: "Operating", name: "Operating" },
                  { key: "Net", name: "Net" },
                  { key: "FCF", name: "FCF" },
                ]}
                unit="%"
              />
            </ChartCard>

            <ChartCard title="Revenue growth" tip="Latest year-over-year growth alongside 3-year and 5-year compound annual growth rates.">
              <ScoreBars
                data={scores.map((s) => ({
                  label: s.ticker,
                  "YoY": pct(s.salesDetail.revYoY),
                  "3y CAGR": pct(s.salesDetail.revCagr3),
                  "5y CAGR": pct(s.salesDetail.revCagr5),
                }))}
                bars={[
                  { key: "YoY", name: "YoY" },
                  { key: "3y CAGR", name: "3y CAGR" },
                  { key: "5y CAGR", name: "5y CAGR" },
                ]}
                unit="%"
              />
            </ChartCard>

            <ChartCard title="Category radar" tip="Margins, Growth and Sales Performance category scores on a 0–100 scale.">
              <CategoryRadar
                companies={scores.map((s) => ({
                  name: s.ticker,
                  margins: r1(s.margins.score),
                  growth: r1(s.growth.score),
                  sales: r1(s.sales.score),
                }))}
              />
            </ChartCard>

            <ChartCard title="Historical revenue (USD)" tip="Fiscal-year revenue converted to USD at current rates so different reporting currencies are comparable.">
              <HistoryChart tickers={tickers} hist={hist} kind="revenue" />
            </ChartCard>

            <ChartCard title="Historical operating margin" tip="Operating income divided by revenue for each fiscal year.">
              <HistoryChart tickers={tickers} hist={hist} kind="opMargin" />
            </ChartCard>
          </section>

          <p className="mt-6 text-xs text-muted">
            Source: {data?.source} · Percentiles computed against the full universe · Scores recalculate automatically when
            you change weights. Green marks the strongest company on each row.
          </p>
        </>
      )}
    </div>
  );
}

/* ---------- weight slider ---------- */
function WeightSlider({
  label,
  value,
  onChange,
  color,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  return (
    <label className="block text-xs">
      <span className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-muted">
          <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
          {label}
        </span>
        <span className="num font-semibold">{value}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[#6E8BFF]"
        aria-label={`${label} weight`}
      />
    </label>
  );
}

/* ---------- comparison table ---------- */
function ComparisonTable({ scores, hist }: { scores: CompanyScore[]; hist: Record<string, CompanyResp> }) {
  type Row = {
    label: string;
    tip: string;
    kind: "score" | "pct" | "money" | "moneyPerEmp";
    higherIsBetter?: boolean;
    get: (s: CompanyScore) => number | null;
  };
  const rows: Row[] = [
    { label: "Overall score", tip: "Weighted blend of the three category scores using your weights above.", kind: "score", get: (s) => s.overall },
    { label: "Margin score", tip: "Percentile rank of gross (25%), operating (35%), net (25%) and FCF (15%) margins, including stability and 3-year trend.", kind: "score", get: (s) => s.margins.score },
    { label: "Growth score", tip: "Revenue (35%), operating income (20%), EPS (25%) and FCF (20%) growth: 20% YoY, 40% 3y CAGR, 40% 5y CAGR, minus a volatility penalty.", kind: "score", get: (s) => s.growth.score },
    { label: "Sales performance score", tip: "Revenue vs peers (20%), revenue per employee (25%), 3y CAGR (25%), 5y CAGR (20%), consistency (10%). Size is judged relative to peers and market cap.", kind: "score", get: (s) => s.sales.score },
    { label: "Data completeness", tip: "Share of scoring inputs available. Missing metrics are labeled and their weight is redistributed.", kind: "score", get: (s) => s.completeness },
    { label: "Gross margin (TTM)", tip: "Gross profit ÷ revenue, trailing twelve months.", kind: "pct", get: (s) => md(s, "gross") },
    { label: "Operating margin (TTM)", tip: "Operating income ÷ revenue, trailing twelve months.", kind: "pct", get: (s) => md(s, "operating") },
    { label: "Net margin (TTM)", tip: "Net income ÷ revenue, trailing twelve months.", kind: "pct", get: (s) => md(s, "net") },
    { label: "FCF margin (TTM)", tip: "Free cash flow ÷ revenue, trailing twelve months.", kind: "pct", get: (s) => md(s, "fcf") },
    { label: "Revenue YoY", tip: "Latest fiscal-year revenue growth.", kind: "pct", get: (s) => s.salesDetail.revYoY },
    { label: "Revenue 3y CAGR", tip: "Three-year compound annual revenue growth rate.", kind: "pct", get: (s) => s.salesDetail.revCagr3 },
    { label: "Revenue 5y CAGR", tip: "Five-year compound annual revenue growth rate.", kind: "pct", get: (s) => s.salesDetail.revCagr5 },
    { label: "TTM revenue (USD)", tip: "Trailing-twelve-month revenue converted to USD.", kind: "money", get: (s) => s.salesDetail.ttmRevenue },
    { label: "Revenue / employee (USD)", tip: "TTM revenue divided by employee count — a sales-productivity measure.", kind: "moneyPerEmp", get: (s) => s.salesDetail.revenuePerEmployee },
    { label: "Revenue / market cap", tip: "TTM revenue divided by market capitalization. Higher means more revenue per dollar of valuation.", kind: "pct", get: (s) => s.salesDetail.revToMarketCap },
    { label: "Market cap (USD)", tip: "Share price × shares outstanding, converted to USD.", kind: "money", higherIsBetter: false, get: (s) => s.marketCapUsd },
  ];

  return (
    <section className="card mt-8 overflow-x-auto p-0">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="px-4 py-3 font-normal">Metric</th>
            {scores.map((s, i) => (
              <th key={s.ticker} className="px-4 py-3 font-normal">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                <Link href={`/company/${s.ticker}`} className="num font-semibold text-ink hover:text-accent">
                  {s.ticker}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const vals = scores.map(row.get);
            const defined = vals.filter((v): v is number => v != null && isFinite(v));
            const best =
              row.higherIsBetter === false || defined.length < 2 ? null : Math.max(...defined);
            return (
              <tr key={row.label} className="border-b border-line/60 last:border-0">
                <td className="px-4 py-2.5 text-muted">
                  <Tip text={row.tip}>
                    <span className="cursor-help underline decoration-dotted decoration-line underline-offset-4">{row.label}</span>
                  </Tip>
                </td>
                {scores.map((s, i) => {
                  const v = vals[i];
                  const isBest = best != null && v === best;
                  return (
                    <td
                      key={s.ticker}
                      className={`num px-4 py-2.5 ${isBest ? "font-semibold text-good" : ""}`}
                    >
                      {fmtCell(v, row.kind)}
                      {isBest && <span className="ml-1 text-[10px] align-middle" aria-label="strongest">◆</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          <tr>
            <td className="px-4 py-2.5 text-muted">
              <Tip text="Reporting currency and latest fiscal year of the underlying statements.">
                <span className="cursor-help underline decoration-dotted decoration-line underline-offset-4">Reported in</span>
              </Tip>
            </td>
            {scores.map((s) => {
              const h = hist[s.ticker];
              const fy = h?.financials.annual.at(-1)?.fiscalYear;
              return (
                <td key={s.ticker} className="px-4 py-2.5 text-xs text-muted">
                  {s.currency}
                  {fy ? ` · FY${fy}` : ""} · TTM
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function md(s: CompanyScore, key: string): number | null {
  return s.marginDetails.find((m) => m.key === key)?.current ?? null;
}
function fmtCell(v: number | null, kind: "score" | "pct" | "money" | "moneyPerEmp"): string {
  if (v == null || !isFinite(v)) return "—";
  if (kind === "score") return fmtScore(v);
  if (kind === "pct") return fmtPct(v);
  if (kind === "moneyPerEmp") return fmtMoney(v);
  return fmtMoney(v);
}
function r1(v: number | null): number | null {
  return v == null ? null : Math.round(v * 10) / 10;
}
function pct(v: number | null | undefined): number | null {
  return v == null || !isFinite(v) ? null : Math.round(v * 1000) / 10;
}

/* ---------- history charts ---------- */
function HistoryChart({
  tickers,
  hist,
  kind,
}: {
  tickers: string[];
  hist: Record<string, CompanyResp>;
  kind: "revenue" | "opMargin";
}) {
  const loaded = tickers.filter((t) => hist[t]);
  if (loaded.length === 0) return <Loading label="Loading history…" />;

  const years = Array.from(
    new Set(loaded.flatMap((t) => hist[t].financials.annual.map((p) => p.fiscalYear)))
  ).sort();

  const data = years.map((y) => {
    const row: Record<string, unknown> = { label: `FY${y}` };
    for (const t of loaded) {
      const c = hist[t];
      const p = c.financials.annual.find((a) => a.fiscalYear === y);
      if (!p) continue;
      if (kind === "revenue") {
        const rate = c.fx.rates[p.currency] ?? 1;
        row[t] = p.revenue == null ? null : Math.round((p.revenue * rate) / 1e6) / 1e3; // $B
      } else {
        row[t] =
          p.operatingIncome == null || !p.revenue
            ? null
            : Math.round((p.operatingIncome / p.revenue) * 1000) / 10; // %
      }
    }
    return row;
  });

  return (
    <HistoryLines
      data={data}
      lines={loaded.map((t) => ({ key: t, name: t }))}
      unit={kind === "revenue" ? "B" : "%"}
    />
  );
}

/* ---------- add-company search ---------- */
function AddCompany({
  current,
  onAdd,
  compact,
}: {
  current: string[];
  onAdd: (ticker: string) => void;
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const url = q.trim().length >= 1 ? `/api/companies?query=${encodeURIComponent(q.trim())}` : null;
  const { data } = useFetch<SearchResp>(url);
  const results = (data?.companies ?? []).filter((c) => !current.includes(c.ticker)).slice(0, 6);

  return (
    <div className={compact ? "w-full" : ""}>
      <label className="block text-xs text-muted" htmlFor="add-company">
        Add a company ({current.length}/5)
      </label>
      <input
        id="add-company"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name or ticker…"
        maxLength={80}
        className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-accent"
      />
      {q && results.length > 0 && (
        <ul className="mt-2 max-h-48 overflow-y-auto rounded-md border border-line bg-panel text-sm">
          {results.map((c) => (
            <li key={c.ticker}>
              <button
                onClick={() => {
                  onAdd(c.ticker);
                  setQ("");
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-panel2"
              >
                <span>{c.name}</span>
                <span className="num text-xs text-muted">{c.ticker}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q && data && results.length === 0 && <p className="mt-2 text-xs text-muted">No matches.</p>}
    </div>
  );
}

/* ---------- chart card ---------- */
function ChartCard({ title, tip, children }: { title: string; tip: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <h3 className="mb-3 font-display text-sm font-semibold">
        {title}{" "}
        <Tip text={tip}>
          <span className="cursor-help text-muted">ⓘ</span>
        </Tip>
      </h3>
      {children}
    </div>
  );
}
