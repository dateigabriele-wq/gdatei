/**
 * Curated seed universe for the live provider.
 *
 * FMP's free tier has no full market screener endpoint, so there is no way
 * to "list every public company" without a paid plan. Instead we seed the
 * screener/rankings/peer-scoring with a fixed, diverse list of real tickers
 * spanning sectors, industries, countries and market-cap bands. All figures
 * shown for these tickers are fetched live from FMP — only the *list of
 * tickers* is hard-coded here, never their financials.
 *
 * Swap or extend this list freely; a paid FMP plan (or another provider with
 * a screener endpoint) can replace it with a dynamic, full-market list
 * without touching any other file — see listCompanies() in fmpProvider.ts.
 */
export const SEED_TICKERS: string[] = [
  "AAPL", "MSFT", "NVDA", "AMD",
  "AMZN", "TSLA", "HD",
  "KO", "WMT",
  "JNJ", "PFE",
  "JPM",
];
