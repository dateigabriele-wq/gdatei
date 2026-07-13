-- Quantile — PostgreSQL schema
-- The app runs against the in-memory mock provider by default; point
-- DATABASE_URL at Postgres and run this file to persist live-API data.

CREATE TABLE companies (
  ticker            TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  description       TEXT,
  sector            TEXT NOT NULL,
  industry          TEXT NOT NULL,
  country           TEXT NOT NULL,
  exchange          TEXT NOT NULL,
  currency          CHAR(3) NOT NULL,
  employees         INTEGER,
  share_price       NUMERIC(18,4),
  market_cap        NUMERIC(20,2),
  fiscal_year_end   TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_companies_sector   ON companies (sector);
CREATE INDEX idx_companies_industry ON companies (industry);
CREATE INDEX idx_companies_country  ON companies (country);
CREATE INDEX idx_companies_search   ON companies USING gin (to_tsvector('simple', name || ' ' || ticker));

CREATE TABLE financial_periods (
  id                BIGSERIAL PRIMARY KEY,
  ticker            TEXT NOT NULL REFERENCES companies (ticker) ON DELETE CASCADE,
  fiscal_year       SMALLINT NOT NULL,
  period            TEXT NOT NULL CHECK (period IN ('FY','Q1','Q2','Q3','Q4','TTM')),
  end_date          DATE NOT NULL,
  currency          CHAR(3) NOT NULL,
  revenue           NUMERIC(20,2),
  gross_profit      NUMERIC(20,2),
  operating_income  NUMERIC(20,2),
  net_income        NUMERIC(20,2),
  eps               NUMERIC(12,4),
  free_cash_flow    NUMERIC(20,2),
  source            TEXT NOT NULL,
  fetched_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ticker, fiscal_year, period)
);
CREATE INDEX idx_periods_ticker ON financial_periods (ticker, fiscal_year);

-- Materialized scores (recomputed after each data refresh; default weights)
CREATE TABLE company_scores (
  ticker            TEXT PRIMARY KEY REFERENCES companies (ticker) ON DELETE CASCADE,
  scope             TEXT NOT NULL DEFAULT 'industry',
  overall           NUMERIC(5,1),
  margin_score      NUMERIC(5,1),
  growth_score      NUMERIC(5,1),
  sales_score       NUMERIC(5,1),
  completeness      SMALLINT NOT NULL,
  detail            JSONB NOT NULL, -- full CompanyScore payload
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FX rates snapshot
CREATE TABLE fx_rates (
  currency   CHAR(3) PRIMARY KEY,
  to_usd     NUMERIC(18,8) NOT NULL,
  as_of      DATE NOT NULL
);

-- Server-side cache of raw provider responses (rate-limit protection)
CREATE TABLE api_cache (
  cache_key   TEXT PRIMARY KEY,
  payload     JSONB NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_api_cache_expiry ON api_cache (expires_at);
