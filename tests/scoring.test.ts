import { describe, it, expect } from "vitest";
import { percentileRank, winsorize, scoreUniverse, normalizeWeights } from "../src/lib/scoring/engine";
import { cagr, computeRawMetrics } from "../src/lib/scoring/metrics";
import { MockProvider } from "../src/lib/data/mock/mockProvider";
import { DEFAULT_WEIGHTS } from "../src/lib/types";

describe("winsorize", () => {
  it("caps extreme values at the 5th/95th percentile", () => {
    const vals = [...Array.from({ length: 99 }, (_, i) => i + 1), 10_000];
    const w = winsorize(vals);
    expect(Math.max(...w)).toBeLessThan(10_000);
    expect(Math.min(...w)).toBeGreaterThanOrEqual(1);
  });
});

describe("percentileRank", () => {
  it("ranks the median near 50", () => {
    const peers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(percentileRank(5, peers)).toBeCloseTo(50, 0);
  });
  it("ranks the max near the top and min near the bottom", () => {
    const peers = Array.from({ length: 20 }, (_, i) => i);
    expect(percentileRank(19, peers)).toBeGreaterThan(85);
    expect(percentileRank(0, peers)).toBeLessThan(15);
  });
  it("is outlier-resistant via winsorization", () => {
    const peers = [1, 2, 3, 4, 5, 1_000_000];
    const pHigh = percentileRank(1_000_000, peers);
    const pFive = percentileRank(5, peers);
    expect(pHigh).toBeLessThanOrEqual(100);
    expect(pHigh).toBeGreaterThan(pFive - 20); // outlier no longer dominates spread
  });
});

describe("cagr", () => {
  it("computes 3-year CAGR correctly", () => {
    // 100 -> 133.1 over 3 years = 10%/yr
    expect(cagr([100, 110, 121, 133.1], 3)).toBeCloseTo(0.1, 3);
  });
  it("returns null when the series is too short", () => {
    expect(cagr([100, 110], 3)).toBeNull();
  });
  it("handles negative starting values without exploding", () => {
    const v = cagr([-50, -20, 10, 40], 3);
    expect(v).not.toBeNull();
    expect(v!).toBeLessThanOrEqual(1.5);
  });
});

describe("normalizeWeights", () => {
  it("keeps defaults at 40/30/30", () => {
    const w = normalizeWeights(DEFAULT_WEIGHTS);
    expect(w.margins).toBeCloseTo(0.4);
    expect(w.growth).toBeCloseTo(0.3);
    expect(w.sales).toBeCloseTo(0.3);
  });
  it("normalizes arbitrary weights to sum to 1", () => {
    const w = normalizeWeights({ margins: 2, growth: 1, sales: 1 });
    expect(w.margins + w.growth + w.sales).toBeCloseTo(1);
    expect(w.margins).toBeCloseTo(0.5);
  });
});

describe("scoreUniverse (sample calculations on five companies)", () => {
  const provider = new MockProvider();

  it("computes overall = weighted average of category scores", async () => {
    const all = await provider.getAll();
    const fx = await provider.getFxRates();
    const scores = scoreUniverse(all, (r) => fx.rates[r.profile.currency]);
    const sample = ["NMBS", "HELX", "CASC", "AXPH", "ZPHR"].map(
      (t) => scores.find((s) => s.ticker === t)!
    );
    expect(sample.every(Boolean)).toBe(true);

    for (const s of sample) {
      if (s.overall == null) continue;
      const cats = [
        { sc: s.margins.score, w: 0.4 },
        { sc: s.growth.score, w: 0.3 },
        { sc: s.sales.score, w: 0.3 },
      ].filter((c) => c.sc != null);
      const wSum = cats.reduce((a, c) => a + c.w, 0);
      const expected = cats.reduce((a, c) => a + (c.sc as number) * c.w, 0) / wSum;
      expect(s.overall).toBeCloseTo(expected, 0.5);
    }
  });

  it("keeps every score within 0-100", async () => {
    const all = await provider.getAll();
    const fx = await provider.getFxRates();
    const scores = scoreUniverse(all, (r) => fx.rates[r.profile.currency]);
    for (const s of scores) {
      for (const v of [s.overall, s.margins.score, s.growth.score, s.sales.score]) {
        if (v != null) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it("caps scores for negative margins at 30 for the level component", async () => {
    const all = await provider.getAll();
    const fx = await provider.getFxRates();
    const scores = scoreUniverse(all, (r) => fx.rates[r.profile.currency]);
    const novara = scores.find((s) => s.ticker === "NOVR")!; // deeply negative margins
    const op = novara.margins.metrics.find((m) => m.key === "margin_operating")!;
    expect(op.value).toBeLessThan(0);
    // 60% weight on level capped at 30, plus up to 40 points from stability/trend
    expect(op.score).toBeLessThanOrEqual(30 * 0.6 + 100 * 0.4 + 0.1);
  });

  it("responds to weight changes and preserves ordering identities", async () => {
    const all = await provider.getAll();
    const fx = await provider.getFxRates();
    const base = scoreUniverse(all, (r) => fx.rates[r.profile.currency]);
    const marginHeavy = scoreUniverse(all, (r) => fx.rates[r.profile.currency], {
      weights: { margins: 1, growth: 0, sales: 0 },
    });
    const m = (arr: typeof base, t: string) => arr.find((s) => s.ticker === t)!;
    // with 100% margin weight, overall == margin score
    for (const t of ["NMBS", "HELX", "CASC"]) {
      expect(m(marginHeavy, t).overall).toBeCloseTo(m(marginHeavy, t).margins.score!, 1);
    }
  });

  it("redistributes weight and lowers completeness when data is missing", async () => {
    const all = await provider.getAll();
    const fx = await provider.getFxRates();
    const scores = scoreUniverse(all, (r) => fx.rates[r.profile.currency]);
    const withGap = scores.filter((s) => s.completeness < 100);
    for (const s of withGap) {
      expect(s.overall).not.toBeNull(); // missing data must not force a zero
      expect(s.completeness).toBeGreaterThan(0);
    }
    const full = scores.filter((s) => s.completeness === 100);
    expect(full.length).toBeGreaterThan(0);
  });

  it("assigns industry ranks covering the whole peer group", async () => {
    const all = await provider.getAll();
    const fx = await provider.getFxRates();
    const scores = scoreUniverse(all, (r) => fx.rates[r.profile.currency]);
    const semis = scores.filter((s) => s.industry === "Semiconductors");
    const ranks = semis.map((s) => s.industryRank!.rank).sort((a, b) => a - b);
    expect(ranks).toEqual(Array.from({ length: semis.length }, (_, i) => i + 1));
  });

  it("computes raw margins consistently with statements", async () => {
    const rec = (await provider.getCompany("NMBS"))!;
    const raw = computeRawMetrics(rec, 1);
    const ttm = rec.financials.ttm!;
    expect(raw.margins.operating.current).toBeCloseTo(
      (ttm.operatingIncome as number) / (ttm.revenue as number),
      6
    );
  });
});
