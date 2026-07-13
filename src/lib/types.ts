// ---------- Domain types (provider-agnostic) ----------

export type Currency = "USD" | "EUR" | "JPY" | "GBP" | "CHF";

export interface CompanyProfile {
  ticker: string;
  name: string;
  description: string;
  sector: string;
  industry: string;
  country: string;
  exchange: string;
  currency: Currency; // reporting currency
  employees: number | null;
  sharePrice: number; // in reporting currency
  marketCap: number; // in reporting currency
  fiscalYearEnd: string; // e.g. "December"
}

/** One reporting period (annual or TTM) of the figures the app needs. */
export interface FinancialPeriod {
  fiscalYear: number; // e.g. 2025; TTM uses the latest year label
  period: "FY" | "TTM";
  endDate: string; // ISO date
  currency: Currency;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  eps: number | null;
  freeCashFlow: number | null;
}

export interface CompanyFinancials {
  ticker: string;
  annual: FinancialPeriod[]; // oldest -> newest
  ttm: FinancialPeriod | null;
  source: string; // data source name
  lastUpdated: string; // ISO date-time
}

export interface CompanyRecord {
  profile: CompanyProfile;
  financials: CompanyFinancials;
}

export interface SearchFilters {
  query?: string;
  sector?: string;
  industry?: string;
  country?: string;
  exchange?: string;
  capBucket?: "large" | "mid" | "small";
}

export interface FxRates {
  base: "USD";
  rates: Record<Currency, number>; // 1 unit of currency -> USD
  asOf: string;
}

/** Swappable data-provider contract. Implement this to plug in a live API. */
export interface FinancialDataProvider {
  readonly sourceName: string;
  listCompanies(filters?: SearchFilters): Promise<CompanyProfile[]>;
  getCompany(ticker: string): Promise<CompanyRecord | null>;
  getAll(): Promise<CompanyRecord[]>;
  getFxRates(): Promise<FxRates>;
}

// ---------- Scoring types ----------

export type PeerScope = "industry" | "sector" | "market";

export interface CategoryWeights {
  margins: number; // default 0.40
  growth: number; // default 0.30
  sales: number; // default 0.30
}

export const DEFAULT_WEIGHTS: CategoryWeights = {
  margins: 0.4,
  growth: 0.3,
  sales: 0.3,
};

export interface MetricScore {
  key: string;
  label: string;
  value: number | null; // raw metric value (ratio or growth rate)
  score: number | null; // 0-100 percentile-based score, null if unavailable
  weight: number; // weight within its category
  percentile: number | null;
  peerScope: PeerScope;
}

export interface MarginDetail {
  key: "gross" | "operating" | "net" | "fcf";
  label: string;
  current: number | null; // TTM
  avg3y: number | null;
  avg5y: number | null;
  change3y: number | null; // pp change
  change5y: number | null;
  volatility: number | null; // stddev of annual values
  trend: "improving" | "declining" | "stable" | null;
}

export interface SalesDetail {
  annualRevenue: number | null;
  ttmRevenue: number | null;
  revenuePerEmployee: number | null;
  revYoY: number | null;
  revCagr3: number | null;
  revCagr5: number | null;
  consistency: number | null; // 0-1, higher = steadier
  revToMarketCap: number | null;
}

export interface CategoryScore {
  score: number | null;
  metrics: MetricScore[];
  availableWeight: number; // fraction of category weight with data (0-1)
}

export interface CompanyScore {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  country: string;
  exchange: string;
  currency: Currency;
  marketCapUsd: number;
  sharePrice: number;
  peerScope: PeerScope;
  peerCount: number;
  overall: number | null;
  margins: CategoryScore;
  growth: CategoryScore;
  sales: CategoryScore;
  effectiveWeights: CategoryWeights; // after redistribution for missing categories
  completeness: number; // 0-100
  industryRank: { rank: number; of: number } | null;
  marginDetails: MarginDetail[];
  salesDetail: SalesDetail;
  growthVolatilityPenalty: number; // points subtracted, for transparency
  explanation: string;
  strengths: string[];
  weaknesses: string[];
  risks: string[];
}
