"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useFetch } from "@/lib/useFetch";
import type { CompanyProfile, CompanyScore, FinancialPeriod, FxRates } from "@/lib/types";
import { fmtMoney, fmtPct, fmtScore, scoreTone } from "@/lib/format";
import { CompletenessBadge, Empty, ErrorBox, Loading, ScoreChip, Tip, Trend, WeightBar, toneText } from "@/components/ui";
import { HistoryLines } from "@/components/charts";

interface Resp {
  profile: CompanyProfile;
  financials: { annual: FinancialPeriod[]; ttm: FinancialPeriod | null; source: string; lastUpdated: string };
  score: CompanyScore | null;
  fx: FxRates;
  source: string;
}

export default function CompanyPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const { data, error, loading, retry } = useFetch<Resp>(ticker ? `/api/companies/${ticker}` : null);
  const [usd, setUsd] = useState(true);

  const fxRate = data ? data.fx.rates[data.profile.currency] : 1;
  const conv = usd ? fxRate : 1;
  const ccy = usd ? "USD" : data?.profile.currency ?? "USD";

  const history = useMemo(() => {
    if (!data) return [];
    const rows = data.financials.annual.map((p) => ({
      label: `FY${p.fiscalYear}`,
      Revenue: p.revenue == null ? null : +((p.revenue * conv) / 1e9).toFixed(2),
      "Operating income": p.operatingIncome == null ? null : +((p.operatingIncome * conv) / 1e9).toFixed(2),
      "Free cash flow": p.freeCashFlow == null ? null : +((p.freeCashFlow * conv) / 1e9).toFixed(2),
    }));
    const t = data.financials.ttm;
    if (t)
      rows.push({
        label: "TTM",
        Revenue: t.revenue == null ? null : +((t.revenue * conv) / 1e9).toFixed(2),
        "Operating income": t.operatingIncome == null ? null : +((t.operatingIncome * conv) / 1e9).toFixed(2),
        "Free cash flow": t.freeCashFlow == null ? null : +((t.freeCashFlow * conv) / 1e9).toFixed(2),
      });
    return rows;
  }, [data, conv]);

  const marginHistory = useMemo(() => {
    if (!data) return [];
    const pct = (n: number | null, d: number | null) => (n == null || d == null || d === 0 ? null : +((n / d) * 100).toFixed(1));
    const rows = data.financials.annual.map((p) => ({
      label: `FY${p.fiscalYear}`,
      Gross: pct(p.grossProfit, p.revenue),
      Operating: pct(p.operatingIncome, p.revenue),
      Net: pct(p.netIncome, p.revenue),
      FCF: pct(p.freeCashFlow, p.revenue),
    }));
    return rows;
  }, [data]);

  if (loading) return <Loading label="Loading company…" />;
  if (error) return <ErrorBox message={error} retry={retry} />;
  if (!data) return <Empty title="Company not found" hint="Check the ticker or go back to the screener." />;

  const { profile: p, score: s } = data;

  return (
    <div className="space-y-6">
      {/* header */}
      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow">
              {p.sector} · {p.industry}
            </p>
            <h1 className="mt-0.5 font-display text-3xl font-bold tracking-tight">
              {p.name} <span className="num text-lg text-muted">{p.ticker}</span>
            </h1>
            <p className="mt-1 text-xs text-muted">
              {p.country} · {p.exchange} · reports in {p.currency} · FY ends {p.fiscalYearEnd} ·{" "}
              {p.employees != null ? `${p.employees.toLocaleString()} employees` : "employee count unavailable"}
            </p>
            <p className="mt-3 max-w-2xl text-sm text-muted">{p.description}</p>
          </div>
          <div className="flex gap-6">
            <div>
              <span className="eyebrow block">Share price</span>
              <span className="num text-xl">{fmtMoney(p.sharePrice * conv, ccy as never)}</span>
            </div>
            <div>
              <span className="eyebrow block">Market cap</span>
              <span className="num text-xl">{fmtMoney(p.marketCap * conv, ccy as never)}</span>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3 text-xs text-muted">
          <span>Source: {data.financials.source}</span>
          <span>· Updated {new Date(data.financials.lastUpdated).toLocaleDateString()}</span>
          <span>· Annual FY figures + trailing twelve months (TTM)</span>
          <button
            onClick={() => setUsd(!usd)}
            className="ml-auto rounded-md border border-line px-2.5 py-1 hover:text-ink"
          >
            Showing {usd ? `USD (converted @ ${fxRate})` : `reported ${p.currency}`} — switch
          </button>
        </div>
      </section>

      {/* scores */}
      {s && (
        <section className="card p-5">
          <div className="flex flex-wrap items-start gap-8">
            <div>
              <span className="eyebrow">
                <Tip text="Overall = Margin Score × 40% + Growth Score × 30% + Sales Performance Score × 30%. Each category score is a weighted blend of percentile ranks within the industry peer group.">
                  Overall score
                </Tip>
              </span>
              <div className={`num text-6xl font-bold ${toneText[scoreTone(s.overall)]}`}>{fmtScore(s.overall)}</div>
              {s.industryRank && (
                <p className="mt-1 text-xs text-muted">
                  #{s.industryRank.rank} of {s.industryRank.of} in {s.industry}
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-6">
              <ScoreChip label="Margins · 40%" value={s.margins.score} />
              <ScoreChip label="Growth · 30%" value={s.growth.score} />
              <ScoreChip label="Sales · 30%" value={s.sales.score} />
            </div>
            <div className="ml-auto self-center">
              <CompletenessBadge value={s.completeness} />
            </div>
          </div>
          <div className="mt-4">
            <WeightBar score={s} />
          </div>
          <p className="mt-4 rounded-lg bg-panel2 p-3 text-sm leading-relaxed">{s.explanation}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <ListCard title="Strengths" items={s.strengths} tone="text-good" />
            <ListCard title="Weaknesses" items={s.weaknesses} tone="text-bad" />
            <ListCard title="Key financial risks" items={s.risks} tone="text-brass" />
          </div>
        </section>
      )}

      {/* metric breakdown */}
      {s && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <h2 className="font-display text-lg font-semibold">
              <Tip text="Each margin scores 60% on its TTM level, 20% on stability (low year-to-year volatility) and 20% on its 3-year trend, all as industry percentiles. Negative margins are capped at 30 for the level component.">
                Margin detail
              </Tip>
            </h2>
            <div className="scroll-x mt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="py-1.5 pr-2 font-normal">Margin</th>
                    <th className="num font-normal">TTM</th>
                    <th className="num font-normal">3y avg</th>
                    <th className="num font-normal">5y avg</th>
                    <th className="num font-normal">Δ3y</th>
                    <th className="num font-normal">Δ5y</th>
                    <th className="font-normal">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {s.marginDetails.map((d) => (
                    <tr key={d.key} className="border-t border-line">
                      <td className="py-2 pr-2">{d.label}</td>
                      <td className={`num ${d.current != null && d.current < 0 ? "text-bad" : ""}`}>{fmtPct(d.current)}</td>
                      <td className="num text-muted">{fmtPct(d.avg3y)}</td>
                      <td className="num text-muted">{fmtPct(d.avg5y)}</td>
                      <td><Trend value={d.change3y} /></td>
                      <td><Trend value={d.change5y} /></td>
                      <td className="text-xs capitalize text-muted">{d.trend ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-display text-lg font-semibold">
              <Tip text="Revenue metrics behind the Sales Performance Score. Revenue size is judged relative to industry peers and market cap, never in absolute terms alone.">
                Sales detail
              </Tip>
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Fact label="Annual revenue (last FY)" value={fmtMoney(s.salesDetail.annualRevenue)} />
              <Fact label="TTM revenue" value={fmtMoney(s.salesDetail.ttmRevenue)} />
              <Fact label="Revenue / employee" value={fmtMoney(s.salesDetail.revenuePerEmployee)} />
              <Fact label="Revenue / market cap" value={s.salesDetail.revToMarketCap == null ? "—" : s.salesDetail.revToMarketCap.toFixed(2) + "×"} />
              <Fact label="Revenue YoY" value={fmtPct(s.salesDetail.revYoY)} tone={(s.salesDetail.revYoY ?? 0) >= 0 ? "text-good" : "text-bad"} />
              <Fact label="3-yr revenue CAGR" value={fmtPct(s.salesDetail.revCagr3)} tone={(s.salesDetail.revCagr3 ?? 0) >= 0 ? "text-good" : "text-bad"} />
              <Fact label="5-yr revenue CAGR" value={fmtPct(s.salesDetail.revCagr5)} tone={(s.salesDetail.revCagr5 ?? 0) >= 0 ? "text-good" : "text-bad"} />
              <Fact label="Revenue consistency" value={s.salesDetail.consistency == null ? "—" : `${Math.round(s.salesDetail.consistency * 100)}/100`} />
            </dl>
          </div>
        </section>
      )}

      {/* metric scores table */}
      {s && (
        <section className="card p-5">
          <h2 className="font-display text-lg font-semibold">Why this score — every metric, every weight</h2>
          <div className="scroll-x mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1.5 pr-2 font-normal">Metric</th>
                  <th className="font-normal">Category</th>
                  <th className="num font-normal">Weight</th>
                  <th className="num font-normal">Value</th>
                  <th className="num font-normal">Peer percentile</th>
                  <th className="num font-normal">Score</th>
                  <th className="font-normal">Peer group</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ...s.margins.metrics.map((m) => ({ ...m, cat: "Margins" })),
                  ...s.growth.metrics.map((m) => ({ ...m, cat: "Growth" })),
                  ...s.sales.metrics.map((m) => ({ ...m, cat: "Sales" })),
                ].map((m) => (
                  <tr key={m.key} className="border-t border-line">
                    <td className="py-2 pr-2">{m.label}</td>
                    <td className="text-xs text-muted">{m.cat}</td>
                    <td className="num text-muted">{Math.round(m.weight * 100)}%</td>
                    <td className="num">
                      {m.value == null
                        ? <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-muted">no data</span>
                        : m.key.startsWith("sales_relative") || m.key === "sales_rpe"
                        ? fmtMoney(m.value)
                        : m.key === "sales_consistency"
                        ? (m.value * 100).toFixed(0)
                        : fmtPct(m.value)}
                    </td>
                    <td className="num text-muted">{m.percentile == null ? "—" : `p${m.percentile}`}</td>
                    <td className={`num font-medium ${toneText[scoreTone(m.score)]}`}>{fmtScore(m.score)}</td>
                    <td className="text-xs capitalize text-muted">{m.peerScope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {s.growthVolatilityPenalty > 0 && (
            <p className="mt-2 text-xs text-muted">
              Growth-volatility penalty applied: −{s.growthVolatilityPenalty} pts (revenue growth is volatile vs peers).
            </p>
          )}
        </section>
      )}

      {/* history charts */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-display text-lg font-semibold">Revenue, operating income & FCF ({ccy}B)</h2>
          <div className="mt-3">
            <HistoryLines data={history} lines={[{ key: "Revenue", name: "Revenue" }, { key: "Operating income", name: "Operating income" }, { key: "Free cash flow", name: "Free cash flow" }]} unit="B" />
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-display text-lg font-semibold">Margin history (%)</h2>
          <div className="mt-3">
            <HistoryLines data={marginHistory} lines={[{ key: "Gross", name: "Gross" }, { key: "Operating", name: "Operating" }, { key: "Net", name: "Net" }, { key: "FCF", name: "FCF" }]} unit="%" />
          </div>
        </div>
      </section>

      <div className="flex gap-3">
        <Link href={`/compare?tickers=${p.ticker}`} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white">
          Compare against peers →
        </Link>
        <Link href="/" className="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-ink">
          Back to screener
        </Link>
      </div>
    </div>
  );
}

function ListCard({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel2/50 p-3">
      <p className={`text-xs font-semibold uppercase tracking-wide ${tone}`}>{title}</p>
      <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted">
        {items.map((it, i) => (
          <li key={i}>· {it}</li>
        ))}
      </ul>
    </div>
  );
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`num mt-0.5 ${tone ?? ""}`}>{value}</dd>
    </div>
  );
}
