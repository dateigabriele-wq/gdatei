# Quantile — peer-relative equity scoring

A financial-analysis web app that searches, scores and compares publicly traded companies on **Margins (40%)**, **Growth (30%)** and **Sales Performance (30%)** using transparent, percentile-based scoring.

Built with **Next.js 14 (App Router) · TypeScript · React · Tailwind CSS · Recharts · PostgreSQL (schema included) · Vitest**.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 16 scoring-engine tests
npm run build && npm start   # production
```

The app ships with a deterministic **mock data provider** (29 fictional companies across 6 industries, 5 reporting currencies, 6 fiscal years + TTM each) so everything works with zero configuration. No real-company financials are hard-coded anywhere — the mock provider generates statements from parameters, exactly the shape a live API returns.

## Pages

| Route | What it does |
|---|---|
| `/` | Screener: search by name/ticker, filter by sector, industry, country, exchange, cap bucket; select 2–5 companies into a compare tray |
| `/company/[ticker]` | Full profile: scores, industry rank, strengths/weaknesses/risks, auto-generated explanation, margin & sales detail tables, "Why this score" metric breakdown, history charts, USD ↔ reported-currency toggle |
| `/compare?tickers=A,B` | Side-by-side cards, comparison table with strongest-per-metric highlighting, adjustable category weights (default 40/30/30, instant recalculation), score/margin/growth bar charts, radar, historical revenue & margin lines |
| `/rankings` | Leaderboards: best overall / margins / growth / sales; filter by sector, industry, cap bucket; sortable columns |
| `/methodology` | The full scoring formula, documented for users |

## Scoring engine (`src/lib/scoring/`)

- Every metric → winsorized (5th/95th pct) → **percentile rank within industry** (fallback sector → market when <4 peers; user can force market scope)
- Negative margins capped at 30 pts, negative growth at 35 pts
- Margin metric = 60% level + 20% stability + 20% 3-year trend
- Growth metric = 20% YoY + 40% 3y CAGR + 40% 5y CAGR, minus up to 10 pts volatility penalty
- Sales = relative size (vs peers **and** vs market cap) + revenue/employee + CAGRs + consistency
- Missing data → weight redistribution (never an automatic zero) + a visible data-completeness score
- `tests/scoring.test.ts` verifies winsorization, percentile math, CAGR, weight normalization, the overall formula on 5 sample companies, bounds, negative caps, redistribution and rank coverage

## Swapping in a live data provider (Financial Modeling Prep — already wired up)

The app talks to data only through the `FinancialDataProvider` interface (`src/lib/types.ts`), and a working implementation for **Financial Modeling Prep** is already built in `src/lib/data/fmpProvider.ts`.

1. Get a free API key at [financialmodelingprep.com](https://site.financialmodelingprep.com/) (no card required, 250 requests/day, ~5 years of annual statements, mostly US-listed companies on the free tier).
2. Copy `.env.local.example` to `.env.local` and fill in:
   ```
   DATA_PROVIDER=fmp
   FINANCIAL_API_KEY=your_fmp_api_key_here
   ```
3. Restart the dev server (`npm run dev`). You're now searching and scoring **real, live companies** — Apple, Microsoft, Nvidia, and everything else in the seed list below (plus anything you search for by name/ticker).

**How search & rankings work on the free tier:** FMP's free plan has no full-market screener endpoint, so "browse without typing a search query" is powered by a curated list of ~55 real tickers across sectors (`src/lib/data/fmp/seedTickers.ts`) — only the *ticker symbols* are hard-coded there, every financial figure is fetched live and cached. Typing a company name or ticker into search hits FMP's search endpoints directly and isn't limited to that list. Add more tickers to the seed file any time, or upgrade to a paid FMP plan and swap `listCompanies()`/`getAll()` to call FMP's stock-screener/bulk endpoints instead — nothing else in the app needs to change.

**Caching:** every provider call is wrapped in a 1-hour in-memory TTL cache (`cached()` in `src/lib/data/index.ts`) to stay within free-tier request limits; back this with the `api_cache` Postgres table (`db/schema.sql`) for a persistent, multi-instance cache.

To go further with a different provider entirely:
1. Implement `FinancialDataProvider` in a new file (income/cash-flow statements, profile, price, employees, sector/industry — same shape FMP returns).
2. Point `DATA_PROVIDER` at it in `src/lib/data/index.ts`.
3. Nothing else changes — scoring, UI and API routes are provider-agnostic.


## Security & robustness

API keys server-side only · input validation on every route (ticker regex, bounded query lengths, weight sanitation) · 429 backoff in the live provider stub · loading/error/empty states on every page · dark + light modes · mobile navigation · tooltips on every metric.

> Scores are percentile ranks of historical financial data — not investment advice.
