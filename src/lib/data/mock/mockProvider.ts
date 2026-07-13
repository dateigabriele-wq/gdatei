import type {
  CompanyProfile,
  CompanyRecord,
  FinancialDataProvider,
  FinancialPeriod,
  FxRates,
  SearchFilters,
} from "../../types";
import { UNIVERSE, type UniverseEntry } from "./universe";
import { capBucketUsd } from "../capBucket";

/** Deterministic PRNG (mulberry32) so mock data is stable across requests. */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFromString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
/** Approximate standard normal via sum of uniforms. */
function gauss(rand: () => number) {
  return rand() + rand() + rand() + rand() + rand() + rand() - 3;
}

const CURRENT_FY = 2025;
const YEARS = 6; // FY2020..FY2025

function generateFinancials(e: UniverseEntry): CompanyRecord {
  const rand = mulberry32(seedFromString(e.ticker));
  const annual: FinancialPeriod[] = [];
  let revenue = e.baseRevenue * 1_000_000;
  // margins evolve with drift + noise
  let gm = e.grossMargin * 100;
  let om = e.opMargin * 100;
  let nm = e.netMargin * 100;
  let fm = e.fcfMargin * 100;
  const sharesOut = Math.max(20, e.baseRevenue / e.sharePrice) * 2_000_000;

  for (let i = 0; i < YEARS; i++) {
    const fy = CURRENT_FY - (YEARS - 1) + i;
    if (i > 0) {
      const g = e.revGrowth + gauss(rand) * e.revVol;
      revenue = revenue * (1 + g);
      gm += e.marginDrift * 0.6 + gauss(rand) * e.marginVol * 0.6;
      om += e.marginDrift + gauss(rand) * e.marginVol;
      nm += e.marginDrift + gauss(rand) * e.marginVol;
      fm += e.marginDrift * 0.9 + gauss(rand) * e.marginVol * 1.2;
    }
    const netIncome = revenue * (nm / 100);
    annual.push({
      fiscalYear: fy,
      period: "FY",
      endDate: `${fy}-12-31`,
      currency: e.currency,
      revenue: Math.round(revenue),
      grossProfit: Math.round(revenue * (gm / 100)),
      operatingIncome: Math.round(revenue * (om / 100)),
      netIncome: Math.round(netIncome),
      eps: +(netIncome / sharesOut).toFixed(2),
      freeCashFlow: Math.round(revenue * (fm / 100)),
    });
  }

  // TTM: latest FY plus a partial step in the same direction
  const last = annual[annual.length - 1];
  const ttmRev = (last.revenue as number) * (1 + e.revGrowth * 0.5 + gauss(rand) * e.revVol * 0.3);
  const bump = e.marginDrift * 0.4;
  const ttmNm = nm + bump;
  const ttmNet = ttmRev * (ttmNm / 100);
  const ttm: FinancialPeriod = {
    fiscalYear: CURRENT_FY + 1,
    period: "TTM",
    endDate: "2026-06-30",
    currency: e.currency,
    revenue: Math.round(ttmRev),
    grossProfit: Math.round(ttmRev * ((gm + bump * 0.6) / 100)),
    operatingIncome: Math.round(ttmRev * ((om + bump) / 100)),
    netIncome: Math.round(ttmNet),
    eps: +(ttmNet / sharesOut).toFixed(2),
    freeCashFlow: Math.round(ttmRev * ((fm + bump) / 100)),
  };

  // Simulate a couple of gaps in the data (missing employees / FCF) so the
  // completeness logic is exercised. Deterministic per ticker.
  const gapRoll = mulberry32(seedFromString(e.ticker + ":gaps"))();
  let employees: number | null = Math.round((ttmRev / 1_000_000) * e.employeesPerRevM);
  if (gapRoll < 0.08) employees = null;
  if (gapRoll > 0.92) {
    ttm.freeCashFlow = null;
    annual.forEach((p) => (p.freeCashFlow = null));
  }

  const marketCap = ttmRev * e.psRatio;
  const profile: CompanyProfile = {
    ticker: e.ticker,
    name: e.name,
    description: e.description,
    sector: e.sector,
    industry: e.industry,
    country: e.country,
    exchange: e.exchange,
    currency: e.currency,
    employees,
    sharePrice: e.sharePrice,
    marketCap: Math.round(marketCap),
    fiscalYearEnd: "December",
  };

  return {
    profile,
    financials: {
      ticker: e.ticker,
      annual,
      ttm,
      source: "Mock data (deterministic simulation)",
      lastUpdated: new Date().toISOString(),
    },
  };
}

const FX: FxRates = {
  base: "USD",
  rates: { USD: 1, EUR: 1.09, GBP: 1.28, JPY: 0.0066, CHF: 1.13 },
  asOf: new Date().toISOString().slice(0, 10),
};

export class MockProvider implements FinancialDataProvider {
  readonly sourceName = "Mock data (deterministic simulation)";
  private cache: CompanyRecord[] | null = null;

  private universe(): CompanyRecord[] {
    if (!this.cache) this.cache = UNIVERSE.map(generateFinancials);
    return this.cache;
  }

  async getAll(): Promise<CompanyRecord[]> {
    return this.universe();
  }

  async getCompany(ticker: string): Promise<CompanyRecord | null> {
    return this.universe().find((c) => c.profile.ticker === ticker.toUpperCase()) ?? null;
  }

  async listCompanies(filters?: SearchFilters): Promise<CompanyProfile[]> {
    let list = this.universe().map((c) => c.profile);
    if (!filters) return list;
    const q = filters.query?.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) => p.ticker.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
      );
    }
    if (filters.sector) list = list.filter((p) => p.sector === filters.sector);
    if (filters.industry) list = list.filter((p) => p.industry === filters.industry);
    if (filters.country) list = list.filter((p) => p.country === filters.country);
    if (filters.exchange) list = list.filter((p) => p.exchange === filters.exchange);
    if (filters.capBucket) {
      list = list.filter((p) => capBucketUsd(p.marketCap * FX.rates[p.currency]) === filters.capBucket);
    }
    return list;
  }

  async getFxRates(): Promise<FxRates> {
    return FX;
  }
}

export { capBucketUsd } from "../capBucket";
