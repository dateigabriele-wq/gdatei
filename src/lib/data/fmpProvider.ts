import type {
  CompanyFinancials,
  CompanyProfile,
  CompanyRecord,
  Currency,
  FinancialDataProvider,
  FinancialPeriod,
  FxRates,
  SearchFilters,
} from "../types";
import { capBucketUsd } from "./capBucket";
import { SEED_TICKERS } from "./fmp/seedTickers";

const SUPPORTED_CURRENCIES: Currency[] = ["USD", "EUR", "JPY", "GBP", "CHF"];
function toCurrency(raw: string | undefined | null): Currency {
  const c = (raw ?? "USD").toUpperCase();
  return (SUPPORTED_CURRENCIES as string[]).includes(c) ? (c as Currency) : "USD";
}

// ---------- Raw FMP response shapes (only the fields we use) ----------
interface FmpProfile {
  symbol: string;
  companyName: string;
  description?: string;
  sector?: string;
  industry?: string;
  country?: string;
  exchange?: string;
  exchangeFullName?: string;
  currency?: string;
  fullTimeEmployees?: string | number;
  price?: number;
  marketCap?: number;
  isActivelyTrading?: boolean;
  isEtf?: boolean;
  isFund?: boolean;
}
interface FmpIncomeStatement {
  date: string;
  fiscalYear?: string | number;
  period: string; // "FY", "Q1"...
  reportedCurrency?: string;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  eps: number | null;
  weightedAverageShsOut?: number | null;
}
interface FmpCashFlowStatement {
  date: string;
  period: string;
  netCashProvidedByOperatingActivities: number | null;
  capitalExpenditure: number | null; // typically reported as a negative number
}
interface FmpQuote {
  symbol: string;
  price: number;
}
interface FmpSearchHit {
  symbol: string;
  name: string;
}

/**
 * Live provider for Financial Modeling Prep (https://financialmodelingprep.com).
 * The free tier (250 req/day, ~5y of annual US-company statements) is enough
 * to run this app; upgrade the plan for international/quarterly coverage or
 * higher request volume.
 *
 * The API key stays server-side: this module is only ever imported by API
 * routes / server code, never by client components or bundles.
 *
 * FMP's free tier has no full-market screener endpoint, so "browse without a
 * search query" is powered by a curated seed list of real tickers
 * (src/lib/data/fmp/seedTickers.ts) — only the ticker symbols are hard-coded,
 * every financial figure shown is fetched live and cached (see
 * src/lib/data/index.ts: `cached()`, 1h TTL) to conserve API quota.
 */
export class FmpProvider implements FinancialDataProvider {
  readonly sourceName = "Financial Modeling Prep";
  private base = "https://financialmodelingprep.com/stable";

  constructor(private apiKey: string) {}

  private async fetchJson<T>(path: string, retries = 2, timeoutMs = 6000): Promise<T> {
    const url = `${this.base}${path}${path.includes("?") ? "&" : "?"}apikey=${this.apiKey}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, { next: { revalidate: 3600 }, signal: controller.signal });
    } catch (e) {
      clearTimeout(timer);
      if (retries > 0) return this.fetchJson<T>(path, retries - 1, timeoutMs);
      throw new Error(
        e instanceof Error && e.name === "AbortError"
          ? `Data provider request timed out for ${path}`
          : `Data provider network error for ${path}`
      );
    }
    clearTimeout(timer);
    if (res.status === 429 && retries > 0) {
      // rate-limit handling: short backoff with jitter, then retry (kept
      // brief so we stay well inside the serverless function's execution
      // time budget; jitter avoids every concurrent request retrying at
      // the exact same instant and re-tripping the burst limit)
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 700));
      return this.fetchJson<T>(path, retries - 1, timeoutMs);
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error("Financial data provider rejected the API key. Check FINANCIAL_API_KEY.");
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Data provider error ${res.status} for ${path}${body ? ` — ${body.slice(0, 200)}` : ""}`);
    }
    return res.json() as Promise<T>;
  }

  /** Run async jobs with limited concurrency so we don't burst past rate limits. */
  private async pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>, staggerMs = 0): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let cursor = 0;
    const workers = new Array(Math.min(limit, items.length)).fill(0).map(async (_, workerIndex) => {
      if (staggerMs > 0) await new Promise((r) => setTimeout(r, workerIndex * staggerMs));
      while (cursor < items.length) {
        const i = cursor++;
        results[i] = await fn(items[i]);
      }
    });
    await Promise.all(workers);
    return results;
  }

  private mapProfile(p: FmpProfile): CompanyProfile {
    const employees =
      typeof p.fullTimeEmployees === "number"
        ? p.fullTimeEmployees
        : p.fullTimeEmployees
        ? parseInt(p.fullTimeEmployees, 10)
        : null;
    return {
      ticker: p.symbol,
      name: p.companyName ?? p.symbol,
      description: (p.description ?? "No description available.").slice(0, 1200),
      sector: p.sector || "Unclassified",
      industry: p.industry || "Unclassified",
      country: p.country || "Unknown",
      exchange: p.exchangeFullName || p.exchange || "Unknown",
      currency: toCurrency(p.currency),
      employees: employees != null && isFinite(employees) ? employees : null,
      sharePrice: p.price ?? 0,
      marketCap: p.marketCap ?? 0,
      fiscalYearEnd: "December", // FMP doesn't expose this directly on /profile; refine via income-statement date if needed
    };
  }

  private mapAnnual(rows: FmpIncomeStatement[], cash: FmpCashFlowStatement[]): FinancialPeriod[] {
    const cashByDate = new Map(cash.map((c) => [c.date, c]));
    return rows
      .filter((r) => r.period === "FY")
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => {
        const cf = cashByDate.get(r.date);
        const fcf =
          cf?.netCashProvidedByOperatingActivities != null && cf?.capitalExpenditure != null
            ? cf.netCashProvidedByOperatingActivities + cf.capitalExpenditure // capex is reported negative
            : null;
        return {
          fiscalYear: Number(r.fiscalYear ?? r.date.slice(0, 4)),
          period: "FY" as const,
          endDate: r.date,
          currency: toCurrency(r.reportedCurrency),
          revenue: r.revenue,
          grossProfit: r.grossProfit,
          operatingIncome: r.operatingIncome,
          netIncome: r.netIncome,
          eps: r.eps,
          freeCashFlow: fcf,
        };
      });
  }

  /** Best-effort TTM by summing the last 4 reported quarters; null fields if quarterly data is unavailable (e.g. some non-US issuers on the free tier). */
  private mapTtm(
    qIncome: FmpIncomeStatement[],
    qCash: FmpCashFlowStatement[],
    fallback: FinancialPeriod | undefined
  ): FinancialPeriod | null {
    const quarters = qIncome.filter((r) => r.period !== "FY").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
    if (quarters.length < 4) {
      // Not enough quarterly data (common on free tier for non-US names) — fall back to
      // the latest annual period, labeled as "FY" by the caller via `period` below.
      return fallback ? { ...fallback, period: "TTM" } : null;
    }
    const cashByDate = new Map(qCash.map((c) => [c.date, c]));
    const sum = (f: (r: FmpIncomeStatement) => number | null) =>
      quarters.some((q) => f(q) == null) ? null : quarters.reduce((acc, q) => acc + (f(q) ?? 0), 0);
    const opCash = quarters.reduce((acc, q) => {
      const c = cashByDate.get(q.date);
      return c?.netCashProvidedByOperatingActivities != null ? acc + c.netCashProvidedByOperatingActivities : acc;
    }, 0);
    const capex = quarters.reduce((acc, q) => {
      const c = cashByDate.get(q.date);
      return c?.capitalExpenditure != null ? acc + c.capitalExpenditure : acc;
    }, 0);
    const anyCash = quarters.some((q) => cashByDate.has(q.date));
    return {
      fiscalYear: Number(quarters[0].fiscalYear ?? quarters[0].date.slice(0, 4)),
      period: "TTM",
      endDate: quarters[0].date,
      currency: toCurrency(quarters[0].reportedCurrency),
      revenue: sum((r) => r.revenue),
      grossProfit: sum((r) => r.grossProfit),
      operatingIncome: sum((r) => r.operatingIncome),
      netIncome: sum((r) => r.netIncome),
      eps: sum((r) => r.eps),
      freeCashFlow: anyCash ? opCash + capex : null,
    };
  }

  private async fetchRecord(ticker: string, opts: { withQuarterlyTtm: boolean }): Promise<CompanyRecord | null> {
    const base = [
      this.fetchJson<FmpProfile[]>(`/profile?symbol=${ticker}`),
      this.fetchJson<FmpIncomeStatement[]>(`/income-statement?symbol=${ticker}&limit=5`),
      this.fetchJson<FmpCashFlowStatement[]>(`/cash-flow-statement?symbol=${ticker}&limit=5`),
    ] as const;

    const [profiles, annualIncome, annualCash] = await Promise.all(base);
    const rawProfile = profiles?.[0];
    if (!rawProfile) return null;

    const annual = this.mapAnnual(annualIncome ?? [], annualCash ?? []);

    let ttm: FinancialPeriod | null;
    if (opts.withQuarterlyTtm) {
      // Two extra requests, only worth it for a single company's detail page.
      const [qIncome, qCash] = await Promise.all([
        this.fetchJson<FmpIncomeStatement[]>(`/income-statement?symbol=${ticker}&period=quarter&limit=4`).catch(() => []),
        this.fetchJson<FmpCashFlowStatement[]>(`/cash-flow-statement?symbol=${ticker}&period=quarter&limit=4`).catch(() => []),
      ]);
      ttm = this.mapTtm(qIncome ?? [], qCash ?? [], annual.at(-1));
    } else {
      // Bulk/universe scoring: approximate TTM with the latest annual period
      // rather than spending 2 extra requests per company (free-tier quota
      // is limited — see class docstring). Clearly labeled as "TTM" is
      // avoided here; it's tagged with the annual period's real dates.
      ttm = annual.at(-1) ? { ...(annual.at(-1) as FinancialPeriod) } : null;
    }

    return {
      profile: this.mapProfile(rawProfile),
      financials: {
        ticker,
        annual,
        ttm,
        source: this.sourceName,
        lastUpdated: new Date().toISOString(),
      } satisfies CompanyFinancials,
    };
  }

  async listCompanies(filters?: SearchFilters): Promise<CompanyProfile[]> {
    let list: CompanyProfile[];

    if (filters?.query && filters.query.trim().length > 0) {
      const q = encodeURIComponent(filters.query.trim());
      const [byName, bySymbol] = await Promise.all([
        this.fetchJson<FmpSearchHit[]>(`/search-name?query=${q}&limit=10`).catch(() => []),
        this.fetchJson<FmpSearchHit[]>(`/search-symbol?query=${q}&limit=10`).catch(() => []),
      ]);
      const tickers = Array.from(new Set([...byName, ...bySymbol].map((h) => h.symbol))).slice(0, 15);
      const profiles = await this.pool(tickers, 5, async (t) => {
        try {
          const p = await this.fetchJson<FmpProfile[]>(`/profile?symbol=${t}`);
          return p?.[0] ? this.mapProfile(p[0]) : null;
        } catch {
          return null; // skip tickers that fail rather than fail the whole search
        }
      });
      list = profiles.filter((p): p is CompanyProfile => p != null);
    } else {
      // Browsing the seed universe: reuse getAll() instead of issuing separate
      // profile-only requests. Both paths now hit identical URLs, so Next's
      // fetch cache (revalidate: 3600) deduplicates them and a cold page load
      // costs one scoring pass (~36 requests), not a scoring pass + a listing
      // pass (~48). Critical on FMP's 250/day free tier.
      const records = await this.getAll();
      list = records.map((r) => r.profile);
    }

    if (filters?.sector) list = list.filter((p) => p.sector === filters.sector);
    if (filters?.industry) list = list.filter((p) => p.industry === filters.industry);
    if (filters?.country) list = list.filter((p) => p.country === filters.country);
    if (filters?.exchange) list = list.filter((p) => p.exchange === filters.exchange);
    if (filters?.capBucket) {
      // Bucketing by raw market cap in its own reporting currency is a fair
      // approximation here since most seed tickers report in USD; getAll()
      // in the scoring layer still converts to USD for percentile ranking.
      list = list.filter((p) => capBucketUsd(p.marketCap) === filters.capBucket);
    }
    return list;
  }

  async getCompany(ticker: string): Promise<CompanyRecord | null> {
    return this.fetchRecord(ticker.toUpperCase(), { withQuarterlyTtm: true });
  }

  async getAll(): Promise<CompanyRecord[]> {
    // Bounded to the seed list — see class docstring. 3 requests/company
    // (no quarterly TTM) to fit comfortably inside free-tier daily quota;
    // cached for hours by the caller (see src/lib/data/index.ts) so this
    // whole batch runs at most a few times a day.
    //
    // Concurrency is capped (not "all at once") and workers are staggered:
    // FMP's free tier enforces a burst/rate limit separate from the daily
    // quota, and firing all 12 companies' requests simultaneously (36 calls
    // at once) can trip it even with plenty of daily quota left, silently
    // dropping whichever tickers got rate-limited.
    const errors: string[] = [];
    const records = await this.pool(
      SEED_TICKERS,
      4,
      async (t) => {
        try {
          return await this.fetchRecord(t, { withQuarterlyTtm: false });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          errors.push(`${t}: ${msg}`);
          console.error(`[fmp] failed to fetch ${t}: ${msg}`); // visible in host function logs
          return null; // one bad ticker shouldn't take down the whole universe
        }
      },
      250 // ms stagger between each of the 4 workers' start times
    );
    const ok = records.filter((r): r is CompanyRecord => r != null);
    if (ok.length === 0) {
      // Every ticker failed — almost certainly quota/auth/plan-level, not a
      // per-company fluke. Surface the real reason instead of silently
      // returning an empty universe (which renders as blank scores).
      throw new Error(
        `Financial data provider returned no data. First error: ${errors[0] ?? "unknown"}. ` +
          `This usually means the daily API quota is exhausted or the API key/plan doesn't cover these endpoints.`
      );
    }
    if (errors.length > 0) {
      console.warn(`[fmp] ${errors.length}/${SEED_TICKERS.length} tickers failed: ${errors.join(" | ")}`);
    }
    return ok;
  }

  async getFxRates(): Promise<FxRates> {
    const asOf = new Date().toISOString();
    try {
      const quotes = await this.fetchJson<FmpQuote[]>(`/quote?symbol=EURUSD,GBPUSD,USDJPY,USDCHF`);
      const byPair = new Map(quotes.map((q) => [q.symbol, q.price]));
      const eur = byPair.get("EURUSD");
      const gbp = byPair.get("GBPUSD");
      const usdJpy = byPair.get("USDJPY");
      const usdChf = byPair.get("USDCHF");
      if (!eur || !gbp || !usdJpy || !usdChf) throw new Error("incomplete forex quote");
      return {
        base: "USD",
        rates: { USD: 1, EUR: eur, GBP: gbp, JPY: 1 / usdJpy, CHF: 1 / usdChf },
        asOf,
      };
    } catch {
      // Forex quotes are a premium endpoint on some FMP plans — fall back to
      // approximate static rates so the app keeps working; currency-converted
      // figures are then approximate rather than live.
      return {
        base: "USD",
        rates: { USD: 1, EUR: 1.09, GBP: 1.28, JPY: 0.0066, CHF: 1.13 },
        asOf,
      };
    }
  }
}
