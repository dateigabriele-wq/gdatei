import type { CompanyRecord, FinancialPeriod, MarginDetail, SalesDetail } from "../types";

/** All raw metrics the scoring engine consumes, in USD-comparable ratio form. */
export interface RawMetrics {
  ticker: string;
  // margins (fractions, e.g. 0.24)
  margins: Record<"gross" | "operating" | "net" | "fcf", {
    current: number | null;
    avg3y: number | null;
    avg5y: number | null;
    change3y: number | null; // percentage points
    change5y: number | null;
    volatility: number | null; // stddev in pp
  }>;
  // growth (fractions per year)
  growth: Record<"revenue" | "opIncome" | "eps" | "fcf", {
    yoy: number | null;
    cagr3: number | null;
    cagr5: number | null;
  }>;
  growthVolatility: number | null; // stddev of annual revenue growth
  // sales
  revenueTtmUsd: number | null;
  revenuePerEmployeeUsd: number | null;
  revToMarketCap: number | null;
  revenueConsistency: number | null; // 0..1
}

const safeDiv = (a: number | null, b: number | null): number | null =>
  a == null || b == null || b === 0 ? null : a / b;

function marginSeries(
  annual: FinancialPeriod[],
  ttm: FinancialPeriod | null,
  num: keyof FinancialPeriod
): { series: (number | null)[]; current: number | null } {
  const series = annual.map((p) => safeDiv(p[num] as number | null, p.revenue));
  const current = ttm ? safeDiv(ttm[num] as number | null, ttm.revenue) : series[series.length - 1] ?? null;
  return { series, current };
}

function mean(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
export function stddev(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x != null);
  if (v.length < 2) return null;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
}

/** CAGR over n years; falls back to null when endpoints are missing or start<=0. */
export function cagr(series: (number | null)[], years: number): number | null {
  if (series.length < years + 1) return null;
  const end = series[series.length - 1];
  const start = series[series.length - 1 - years];
  if (end == null || start == null) return null;
  if (start <= 0) {
    // negative/zero base: report simple annualized change vs |start| (bounded)
    if (end <= start) return -0.5;
    return Math.min(1.5, (end - start) / Math.abs(start) / years);
  }
  if (end <= 0) return -0.5;
  return Math.pow(end / start, 1 / years) - 1;
}

function yoy(series: (number | null)[]): number | null {
  if (series.length < 2) return null;
  const end = series[series.length - 1];
  const prev = series[series.length - 2];
  if (end == null || prev == null || prev === 0) return null;
  if (prev < 0) return end > prev ? Math.min(1.5, (end - prev) / Math.abs(prev)) : -0.5;
  return end / prev - 1;
}

function growthSeries(values: (number | null)[]): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 1; i < values.length; i++) {
    const a = values[i - 1];
    const b = values[i];
    out.push(a == null || b == null || a <= 0 ? null : b / a - 1);
  }
  return out;
}

export function computeRawMetrics(rec: CompanyRecord, fxToUsd: number): RawMetrics {
  const { annual, ttm } = rec.financials;
  const last3 = (xs: (number | null)[]) => xs.slice(-3);
  const last5 = (xs: (number | null)[]) => xs.slice(-5);

  const marginKeys = [
    ["gross", "grossProfit"],
    ["operating", "operatingIncome"],
    ["net", "netIncome"],
    ["fcf", "freeCashFlow"],
  ] as const;

  const margins = {} as RawMetrics["margins"];
  for (const [key, field] of marginKeys) {
    const { series, current } = marginSeries(annual, ttm, field);
    const nOldest3 = series.length >= 3 ? series[series.length - 3] : null;
    const nOldest5 = series.length >= 5 ? series[series.length - 5] : null;
    margins[key] = {
      current,
      avg3y: mean(last3(series)),
      avg5y: mean(last5(series)),
      change3y: current != null && nOldest3 != null ? (current - nOldest3) * 100 : null,
      change5y: current != null && nOldest5 != null ? (current - nOldest5) * 100 : null,
      volatility: stddev(series.map((s) => (s == null ? null : s * 100))),
    };
  }

  const revSeries = annual.map((p) => p.revenue);
  const withTtm = (xs: (number | null)[], t: number | null) => (t != null ? [...xs, t] : xs);
  const rev = withTtm(revSeries, ttm?.revenue ?? null);
  const opi = withTtm(annual.map((p) => p.operatingIncome), ttm?.operatingIncome ?? null);
  const eps = withTtm(annual.map((p) => p.eps), ttm?.eps ?? null);
  const fcf = withTtm(annual.map((p) => p.freeCashFlow), ttm?.freeCashFlow ?? null);

  const g = (xs: (number | null)[]) => ({ yoy: yoy(xs), cagr3: cagr(xs, 3), cagr5: cagr(xs, 5) });
  const growth = { revenue: g(rev), opIncome: g(opi), eps: g(eps), fcf: g(fcf) };

  const revGrowthSeries = growthSeries(revSeries);
  const growthVolatility = stddev(revGrowthSeries);
  const meanG = mean(revGrowthSeries);
  // consistency: 1 - normalized dispersion of yoy revenue growth, clamped 0..1
  const revenueConsistency =
    growthVolatility == null || meanG == null
      ? null
      : Math.max(0, Math.min(1, 1 - growthVolatility / Math.max(0.08, Math.abs(meanG) + 0.05)));

  const revenueTtm = ttm?.revenue ?? revSeries[revSeries.length - 1] ?? null;
  const revenueTtmUsd = revenueTtm != null ? revenueTtm * fxToUsd : null;
  const employees = rec.profile.employees;
  const mcapUsd = rec.profile.marketCap * fxToUsd;

  return {
    ticker: rec.profile.ticker,
    margins,
    growth,
    growthVolatility,
    revenueTtmUsd,
    revenuePerEmployeeUsd: employees ? (revenueTtmUsd ?? 0) / employees : null,
    revToMarketCap: revenueTtmUsd != null && mcapUsd > 0 ? revenueTtmUsd / mcapUsd : null,
    revenueConsistency,
  };
}

export function toMarginDetails(m: RawMetrics["margins"]): MarginDetail[] {
  const labels = { gross: "Gross margin", operating: "Operating margin", net: "Net profit margin", fcf: "Free-cash-flow margin" } as const;
  return (Object.keys(labels) as (keyof typeof labels)[]).map((key) => {
    const d = m[key];
    let trend: MarginDetail["trend"] = null;
    if (d.change3y != null) trend = d.change3y > 0.75 ? "improving" : d.change3y < -0.75 ? "declining" : "stable";
    return { key, label: labels[key], current: d.current, avg3y: d.avg3y, avg5y: d.avg5y, change3y: d.change3y, change5y: d.change5y, volatility: d.volatility, trend };
  });
}

export function toSalesDetail(rec: CompanyRecord, raw: RawMetrics, fxToUsd: number): SalesDetail {
  const lastAnnual = rec.financials.annual[rec.financials.annual.length - 1];
  return {
    annualRevenue: lastAnnual?.revenue != null ? lastAnnual.revenue * fxToUsd : null,
    ttmRevenue: raw.revenueTtmUsd,
    revenuePerEmployee: raw.revenuePerEmployeeUsd,
    revYoY: raw.growth.revenue.yoy,
    revCagr3: raw.growth.revenue.cagr3,
    revCagr5: raw.growth.revenue.cagr5,
    consistency: raw.revenueConsistency,
    revToMarketCap: raw.revToMarketCap,
  };
}
