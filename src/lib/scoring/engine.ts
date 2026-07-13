import type {
  CategoryScore,
  CategoryWeights,
  CompanyRecord,
  CompanyScore,
  MetricScore,
  PeerScope,
} from "../types";
import { DEFAULT_WEIGHTS } from "../types";
import { computeRawMetrics, toMarginDetails, toSalesDetail, type RawMetrics } from "./metrics";
import { buildNarrative } from "./explain";

/**
 * Scoring methodology (shown to users on /methodology):
 *
 * 1. Every raw metric is winsorized at the 5th/95th percentile of its peer
 *    group, then converted to a 0-100 percentile rank within that group.
 * 2. Peer group: industry if >= MIN_PEERS companies have the metric,
 *    otherwise sector, otherwise the whole market. Users can force "market".
 * 3. Negative margins are capped at 30 points and negative growth at 35,
 *    regardless of peer rank.
 * 4. Margin score = 25% gross + 35% operating + 25% net + 15% FCF, where each
 *    margin's score = 60% level + 20% stability + 20% 3y trend.
 * 5. Growth score = 35% revenue + 20% op income + 25% EPS + 20% FCF, where
 *    each metric = 20% latest YoY + 40% 3y CAGR + 40% 5y CAGR; up to 10
 *    points are subtracted when revenue growth is highly volatile.
 * 6. Sales score = 20% relative revenue (half peer-relative size, half
 *    revenue/market-cap) + 25% revenue per employee + 25% 3y CAGR +
 *    20% 5y CAGR + 10% consistency.
 * 7. Missing metrics: weight is redistributed across available metrics when
 *    at least 50% of a category's weight has data; otherwise the category is
 *    unscored and its weight is redistributed across the other categories.
 * 8. Overall = 40% margins + 30% growth + 30% sales (user-adjustable).
 */

export const MIN_PEERS = 4;

// ---------- Percentile machinery ----------

export function winsorize(values: number[], pLow = 0.05, pHigh = 0.95): number[] {
  if (values.length === 0) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p: number) => {
    const idx = p * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  const lo = q(pLow);
  const hi = q(pHigh);
  return values.map((v) => Math.min(hi, Math.max(lo, v)));
}

/** Percentile rank (0-100) of `value` within `peerValues`, midrank for ties. */
export function percentileRank(value: number, peerValues: number[]): number {
  if (peerValues.length === 0) return 50;
  if (peerValues.length === 1) return 50;
  const capped = winsorize(peerValues);
  // winsorize the target value with the same caps
  const sorted = [...peerValues].sort((a, b) => a - b);
  const q = (p: number) => {
    const idx = p * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  const v = Math.min(q(0.95), Math.max(q(0.05), value));
  let below = 0;
  let equal = 0;
  for (const p of capped) {
    if (p < v) below++;
    else if (p === v) equal++;
  }
  return ((below + equal / 2) / capped.length) * 100;
}

// ---------- Peer groups ----------

type MetricExtractor = (r: RawMetrics) => number | null;

interface PeerContext {
  all: { rec: CompanyRecord; raw: RawMetrics }[];
  byIndustry: Map<string, { rec: CompanyRecord; raw: RawMetrics }[]>;
  bySector: Map<string, { rec: CompanyRecord; raw: RawMetrics }[]>;
}

function scoreMetric(
  ctx: PeerContext,
  company: { rec: CompanyRecord; raw: RawMetrics },
  extract: MetricExtractor,
  forceMarket: boolean
): { score: number | null; percentile: number | null; scope: PeerScope } {
  const value = extract(company.raw);
  if (value == null || !isFinite(value)) return { score: null, percentile: null, scope: "market" };

  const pools: [PeerScope, { rec: CompanyRecord; raw: RawMetrics }[]][] = forceMarket
    ? [["market", ctx.all]]
    : [
        ["industry", ctx.byIndustry.get(company.rec.profile.industry) ?? []],
        ["sector", ctx.bySector.get(company.rec.profile.sector) ?? []],
        ["market", ctx.all],
      ];

  for (const [scope, pool] of pools) {
    const values = pool.map((p) => extract(p.raw)).filter((v): v is number => v != null && isFinite(v));
    if (values.length >= MIN_PEERS || scope === "market") {
      const pct = percentileRank(value, values);
      return { score: pct, percentile: pct, scope };
    }
  }
  return { score: null, percentile: null, scope: "market" };
}

const capNegative = (value: number | null, score: number | null, cap: number): number | null =>
  score == null ? null : value != null && value < 0 ? Math.min(score, cap) : score;

/** Weighted average that redistributes weight across available components. */
function combine(parts: { score: number | null; weight: number }[], minWeight = 0.5): { score: number | null; availableWeight: number } {
  const avail = parts.filter((p) => p.score != null);
  const availableWeight = avail.reduce((a, p) => a + p.weight, 0);
  if (availableWeight < minWeight) return { score: null, availableWeight };
  const score = avail.reduce((a, p) => a + (p.score as number) * p.weight, 0) / availableWeight;
  return { score, availableWeight };
}

// ---------- Category scoring ----------

function marginCategory(ctx: PeerContext, c: { rec: CompanyRecord; raw: RawMetrics }, forceMarket: boolean): CategoryScore {
  const defs = [
    { key: "gross" as const, label: "Gross margin", weight: 0.25 },
    { key: "operating" as const, label: "Operating margin", weight: 0.35 },
    { key: "net" as const, label: "Net profit margin", weight: 0.25 },
    { key: "fcf" as const, label: "Free-cash-flow margin", weight: 0.15 },
  ];
  const metrics: MetricScore[] = defs.map((d) => {
    const level = scoreMetric(ctx, c, (r) => r.margins[d.key].current, forceMarket);
    const stability = scoreMetric(ctx, c, (r) => {
      const v = r.margins[d.key].volatility;
      return v == null ? null : -v; // lower volatility -> higher percentile
    }, forceMarket);
    const trend = scoreMetric(ctx, c, (r) => r.margins[d.key].change3y, forceMarket);
    const raw = c.raw.margins[d.key].current;
    const parts = [
      { score: capNegative(raw, level.score, 30), weight: 0.6 },
      { score: stability.score, weight: 0.2 },
      { score: trend.score, weight: 0.2 },
    ];
    const { score } = combine(parts, 0.6);
    return {
      key: `margin_${d.key}`,
      label: d.label,
      value: raw,
      score: score == null ? null : Math.round(score * 10) / 10,
      weight: d.weight,
      percentile: level.percentile == null ? null : Math.round(level.percentile),
      peerScope: level.scope,
    };
  });
  const { score, availableWeight } = combine(metrics.map((m) => ({ score: m.score, weight: m.weight })));
  return { score: score == null ? null : Math.round(score * 10) / 10, metrics, availableWeight };
}

function growthCategory(ctx: PeerContext, c: { rec: CompanyRecord; raw: RawMetrics }, forceMarket: boolean): { cat: CategoryScore; penalty: number } {
  const defs = [
    { key: "revenue" as const, label: "Revenue growth", weight: 0.35 },
    { key: "opIncome" as const, label: "Operating-income growth", weight: 0.2 },
    { key: "eps" as const, label: "EPS growth", weight: 0.25 },
    { key: "fcf" as const, label: "Free-cash-flow growth", weight: 0.2 },
  ];
  const metrics: MetricScore[] = defs.map((d) => {
    const yoy = scoreMetric(ctx, c, (r) => r.growth[d.key].yoy, forceMarket);
    const c3 = scoreMetric(ctx, c, (r) => r.growth[d.key].cagr3, forceMarket);
    const c5 = scoreMetric(ctx, c, (r) => r.growth[d.key].cagr5, forceMarket);
    const g = c.raw.growth[d.key];
    const parts = [
      { score: capNegative(g.yoy, yoy.score, 35), weight: 0.2 },
      { score: capNegative(g.cagr3, c3.score, 35), weight: 0.4 },
      { score: capNegative(g.cagr5, c5.score, 35), weight: 0.4 },
    ];
    const { score } = combine(parts, 0.4);
    return {
      key: `growth_${d.key}`,
      label: d.label,
      value: g.cagr3 ?? g.yoy,
      score: score == null ? null : Math.round(score * 10) / 10,
      weight: d.weight,
      percentile: c3.percentile == null ? null : Math.round(c3.percentile),
      peerScope: c3.scope,
    };
  });
  const combined = combine(metrics.map((m) => ({ score: m.score, weight: m.weight })));
  // volatility penalty: up to 10 points based on peer-relative growth volatility
  let penalty = 0;
  const volPct = scoreMetric(ctx, c, (r) => r.growthVolatility, forceMarket);
  if (combined.score != null && volPct.percentile != null) {
    penalty = Math.round(Math.max(0, (volPct.percentile - 50) / 50) * 10 * 10) / 10;
  }
  const score = combined.score == null ? null : Math.round(Math.max(0, combined.score - penalty) * 10) / 10;
  return { cat: { score, metrics, availableWeight: combined.availableWeight }, penalty };
}

function salesCategory(ctx: PeerContext, c: { rec: CompanyRecord; raw: RawMetrics }, forceMarket: boolean): CategoryScore {
  const relSize = (() => {
    const abs = scoreMetric(ctx, c, (r) => r.revenueTtmUsd, forceMarket);
    const rel = scoreMetric(ctx, c, (r) => r.revToMarketCap, forceMarket);
    if (abs.score == null && rel.score == null) return { score: null, percentile: null, scope: abs.scope };
    const score = ((abs.score ?? rel.score!) + (rel.score ?? abs.score!)) / 2;
    return { score, percentile: abs.percentile, scope: abs.scope };
  })();
  const rpe = scoreMetric(ctx, c, (r) => r.revenuePerEmployeeUsd, forceMarket);
  const c3 = scoreMetric(ctx, c, (r) => r.growth.revenue.cagr3, forceMarket);
  const c5 = scoreMetric(ctx, c, (r) => r.growth.revenue.cagr5, forceMarket);
  const cons = scoreMetric(ctx, c, (r) => r.revenueConsistency, forceMarket);
  const g = c.raw.growth.revenue;

  const metrics: MetricScore[] = [
    { key: "sales_relative", label: "Revenue vs industry peers", value: c.raw.revenueTtmUsd, score: r1(relSize.score), weight: 0.2, percentile: relSize.percentile, peerScope: relSize.scope },
    { key: "sales_rpe", label: "Revenue per employee", value: c.raw.revenuePerEmployeeUsd, score: r1(rpe.score), weight: 0.25, percentile: rInt(rpe.percentile), peerScope: rpe.scope },
    { key: "sales_cagr3", label: "3-yr revenue CAGR", value: g.cagr3, score: r1(capNegative(g.cagr3, c3.score, 35)), weight: 0.25, percentile: rInt(c3.percentile), peerScope: c3.scope },
    { key: "sales_cagr5", label: "5-yr revenue CAGR", value: g.cagr5, score: r1(capNegative(g.cagr5, c5.score, 35)), weight: 0.2, percentile: rInt(c5.percentile), peerScope: c5.scope },
    { key: "sales_consistency", label: "Revenue consistency", value: c.raw.revenueConsistency, score: r1(cons.score), weight: 0.1, percentile: rInt(cons.percentile), peerScope: cons.scope },
  ];
  const { score, availableWeight } = combine(metrics.map((m) => ({ score: m.score, weight: m.weight })));
  return { score: score == null ? null : Math.round(score * 10) / 10, metrics, availableWeight };
}

const r1 = (x: number | null) => (x == null ? null : Math.round(x * 10) / 10);
const rInt = (x: number | null) => (x == null ? null : Math.round(x));

// ---------- Public API ----------

export interface ScoreOptions {
  weights?: CategoryWeights;
  scope?: "auto" | "market"; // auto = industry->sector->market fallback
}

export function scoreUniverse(
  records: CompanyRecord[],
  fxToUsd: (c: CompanyRecord) => number,
  opts: ScoreOptions = {}
): CompanyScore[] {
  const weights = normalizeWeights(opts.weights ?? DEFAULT_WEIGHTS);
  const forceMarket = opts.scope === "market";

  const enriched = records.map((rec) => ({ rec, raw: computeRawMetrics(rec, fxToUsd(rec)) }));
  const ctx: PeerContext = {
    all: enriched,
    byIndustry: groupBy(enriched, (e) => e.rec.profile.industry),
    bySector: groupBy(enriched, (e) => e.rec.profile.sector),
  };

  const scores: CompanyScore[] = enriched.map((c) => {
    const margins = marginCategory(ctx, c, forceMarket);
    const { cat: growth, penalty } = growthCategory(ctx, c, forceMarket);
    const sales = salesCategory(ctx, c, forceMarket);

    // redistribute category weights across scored categories
    const cats = [
      { key: "margins" as const, score: margins.score, w: weights.margins },
      { key: "growth" as const, score: growth.score, w: weights.growth },
      { key: "sales" as const, score: sales.score, w: weights.sales },
    ];
    const availCats = cats.filter((x) => x.score != null);
    const wSum = availCats.reduce((a, x) => a + x.w, 0);
    const overall =
      wSum >= 0.5
        ? Math.round((availCats.reduce((a, x) => a + (x.score as number) * x.w, 0) / wSum) * 10) / 10
        : null;
    const effectiveWeights = {
      margins: cats[0].score != null && wSum > 0 ? weights.margins / wSum : 0,
      growth: cats[1].score != null && wSum > 0 ? weights.growth / wSum : 0,
      sales: cats[2].score != null && wSum > 0 ? weights.sales / wSum : 0,
    };

    // completeness: weighted share of metrics with data
    const completeness = Math.round(
      (margins.availableWeight * weights.margins +
        growth.availableWeight * weights.growth +
        sales.availableWeight * weights.sales) *
        100
    );

    const fx = fxToUsd(c.rec);
    const p = c.rec.profile;
    const base: CompanyScore = {
      ticker: p.ticker,
      name: p.name,
      sector: p.sector,
      industry: p.industry,
      country: p.country,
      exchange: p.exchange,
      currency: p.currency,
      marketCapUsd: p.marketCap * fx,
      sharePrice: p.sharePrice,
      peerScope: forceMarket ? "market" : "industry",
      peerCount: (ctx.byIndustry.get(p.industry) ?? []).length,
      overall,
      margins,
      growth,
      sales,
      effectiveWeights,
      completeness,
      industryRank: null,
      marginDetails: toMarginDetails(c.raw.margins),
      salesDetail: toSalesDetail(c.rec, c.raw, fx),
      growthVolatilityPenalty: penalty,
      explanation: "",
      strengths: [],
      weaknesses: [],
      risks: [],
    };
    return base;
  });

  // industry ranks
  const byInd = groupBy(scores, (s) => s.industry);
  for (const group of Array.from(byInd.values())) {
    const ranked = [...group].sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1));
    ranked.forEach((s, i) => {
      s.industryRank = { rank: i + 1, of: ranked.length };
    });
  }

  // narratives
  for (const s of scores) {
    const n = buildNarrative(s);
    s.explanation = n.explanation;
    s.strengths = n.strengths;
    s.weaknesses = n.weaknesses;
    s.risks = n.risks;
  }
  return scores;
}

export function normalizeWeights(w: CategoryWeights): CategoryWeights {
  const sum = w.margins + w.growth + w.sales;
  if (sum <= 0) return DEFAULT_WEIGHTS;
  return { margins: w.margins / sum, growth: w.growth / sum, sales: w.sales / sum };
}

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = key(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(x);
  }
  return m;
}
