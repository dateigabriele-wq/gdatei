import type { Currency } from "../../types";

/**
 * Mock universe. Financial statements are NOT hard-coded: each company has
 * generation parameters, and the mock provider derives six fiscal years plus a
 * TTM period from a deterministic seeded generator. Replace the whole `mock`
 * folder with a live provider (see fmpProvider.ts) without touching the app.
 */
export interface UniverseEntry {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  country: string;
  exchange: string;
  currency: Currency;
  description: string;
  // generation parameters
  baseRevenue: number; // revenue ~6 years ago, reporting currency (millions)
  revGrowth: number; // average annual growth, e.g. 0.12
  revVol: number; // growth volatility (stddev)
  grossMargin: number;
  opMargin: number;
  netMargin: number;
  fcfMargin: number;
  marginDrift: number; // pp per year (+ improving, - declining)
  marginVol: number; // margin noise (pp stddev)
  employeesPerRevM: number; // employees per 1M revenue
  psRatio: number; // price/sales used to derive market cap
  sharePrice: number;
}

export const UNIVERSE: UniverseEntry[] = [
  // ---- Technology / Application Software ----
  { ticker: "NMBS", name: "Nimbus Systems", sector: "Technology", industry: "Application Software", country: "United States", exchange: "NASDAQ", currency: "USD", description: "Cloud workflow automation platform for mid-market enterprises.", baseRevenue: 1800, revGrowth: 0.22, revVol: 0.05, grossMargin: 0.74, opMargin: 0.21, netMargin: 0.17, fcfMargin: 0.24, marginDrift: 0.8, marginVol: 1.2, employeesPerRevM: 3.2, psRatio: 9, sharePrice: 142 },
  { ticker: "VLTA", name: "Voltaic Software", sector: "Technology", industry: "Application Software", country: "United States", exchange: "NYSE", currency: "USD", description: "Subscription billing and revenue-recognition software.", baseRevenue: 950, revGrowth: 0.16, revVol: 0.04, grossMargin: 0.71, opMargin: 0.12, netMargin: 0.08, fcfMargin: 0.15, marginDrift: 0.5, marginVol: 1.5, employeesPerRevM: 3.8, psRatio: 6, sharePrice: 58 },
  { ticker: "KITE", name: "Kitework Labs", sector: "Technology", industry: "Application Software", country: "United States", exchange: "NASDAQ", currency: "USD", description: "Collaborative design tooling; growth-stage, not yet profitable.", baseRevenue: 320, revGrowth: 0.38, revVol: 0.1, grossMargin: 0.68, opMargin: -0.12, netMargin: -0.14, fcfMargin: -0.04, marginDrift: 2.2, marginVol: 2.5, employeesPerRevM: 4.5, psRatio: 12, sharePrice: 31 },
  { ticker: "SAPH", name: "Sapphire ERP SE", sector: "Technology", industry: "Application Software", country: "Germany", exchange: "XETRA", currency: "EUR", description: "European enterprise-resource-planning suite.", baseRevenue: 5200, revGrowth: 0.08, revVol: 0.02, grossMargin: 0.7, opMargin: 0.24, netMargin: 0.18, fcfMargin: 0.22, marginDrift: 0.1, marginVol: 0.8, employeesPerRevM: 3.5, psRatio: 5.5, sharePrice: 118 },
  { ticker: "ORIG", name: "Origami Cloud KK", sector: "Technology", industry: "Application Software", country: "Japan", exchange: "TSE", currency: "JPY", description: "Japanese SMB accounting and payroll SaaS.", baseRevenue: 42000, revGrowth: 0.27, revVol: 0.07, grossMargin: 0.76, opMargin: 0.05, netMargin: 0.03, fcfMargin: 0.09, marginDrift: 1.6, marginVol: 1.8, employeesPerRevM: 0.03, psRatio: 8, sharePrice: 2450 },
  { ticker: "GRDL", name: "Gridline Analytics", sector: "Technology", industry: "Application Software", country: "United Kingdom", exchange: "LSE", currency: "GBP", description: "Data-observability platform; margins under pressure from competition.", baseRevenue: 610, revGrowth: 0.11, revVol: 0.06, grossMargin: 0.66, opMargin: 0.1, netMargin: 0.07, fcfMargin: 0.1, marginDrift: -1.1, marginVol: 1.6, employeesPerRevM: 3.6, psRatio: 4, sharePrice: 7.4 },

  // ---- Technology / Semiconductors ----
  { ticker: "HELX", name: "Helix Semiconductor", sector: "Technology", industry: "Semiconductors", country: "United States", exchange: "NASDAQ", currency: "USD", description: "Fabless designer of AI accelerator chips.", baseRevenue: 6400, revGrowth: 0.34, revVol: 0.12, grossMargin: 0.63, opMargin: 0.32, netMargin: 0.27, fcfMargin: 0.28, marginDrift: 1.2, marginVol: 2.2, employeesPerRevM: 1.4, psRatio: 14, sharePrice: 512 },
  { ticker: "QRTZ", name: "Quartzon Foundries", sector: "Technology", industry: "Semiconductors", country: "United States", exchange: "NYSE", currency: "USD", description: "Specialty analog and power-management chips; cyclical demand.", baseRevenue: 4100, revGrowth: 0.06, revVol: 0.11, grossMargin: 0.55, opMargin: 0.24, netMargin: 0.19, fcfMargin: 0.2, marginDrift: -0.4, marginVol: 2.8, employeesPerRevM: 2.1, psRatio: 5, sharePrice: 96 },
  { ticker: "EBIS", name: "Ebisu Micro Devices", sector: "Technology", industry: "Semiconductors", country: "Japan", exchange: "TSE", currency: "JPY", description: "Image sensors and microcontrollers for autos and industry.", baseRevenue: 890000, revGrowth: 0.09, revVol: 0.08, grossMargin: 0.47, opMargin: 0.16, netMargin: 0.12, fcfMargin: 0.11, marginDrift: 0.4, marginVol: 1.9, employeesPerRevM: 0.025, psRatio: 3.2, sharePrice: 4210 },
  { ticker: "ARGN", name: "Argon Lithography AG", sector: "Technology", industry: "Semiconductors", country: "Germany", exchange: "XETRA", currency: "EUR", description: "Optics and lithography subsystems for chip fabrication.", baseRevenue: 2900, revGrowth: 0.18, revVol: 0.09, grossMargin: 0.51, opMargin: 0.28, netMargin: 0.23, fcfMargin: 0.21, marginDrift: 0.9, marginVol: 1.7, employeesPerRevM: 2.4, psRatio: 8.5, sharePrice: 640 },
  { ticker: "SILC", name: "Silicline Corp", sector: "Technology", industry: "Semiconductors", country: "United States", exchange: "NASDAQ", currency: "USD", description: "Legacy-node foundry; shrinking volumes and thin margins.", baseRevenue: 2600, revGrowth: -0.03, revVol: 0.09, grossMargin: 0.31, opMargin: 0.06, netMargin: 0.03, fcfMargin: 0.02, marginDrift: -0.9, marginVol: 2.4, employeesPerRevM: 3.4, psRatio: 1.4, sharePrice: 18 },

  // ---- Consumer Staples / Beverages ----
  { ticker: "CASC", name: "Cascadia Beverages", sector: "Consumer Staples", industry: "Beverages", country: "United States", exchange: "NYSE", currency: "USD", description: "Sparkling water and functional drinks; premium brands.", baseRevenue: 3800, revGrowth: 0.12, revVol: 0.03, grossMargin: 0.58, opMargin: 0.26, netMargin: 0.2, fcfMargin: 0.19, marginDrift: 0.5, marginVol: 0.9, employeesPerRevM: 1.9, psRatio: 6, sharePrice: 84 },
  { ticker: "TONI", name: "Tonica Group SA", sector: "Consumer Staples", industry: "Beverages", country: "France", exchange: "EPA", currency: "EUR", description: "Global spirits and mixers portfolio.", baseRevenue: 9200, revGrowth: 0.05, revVol: 0.03, grossMargin: 0.61, opMargin: 0.28, netMargin: 0.21, fcfMargin: 0.22, marginDrift: 0.2, marginVol: 0.7, employeesPerRevM: 2.2, psRatio: 4.5, sharePrice: 152 },
  { ticker: "BRWH", name: "Brewhaus AG", sector: "Consumer Staples", industry: "Beverages", country: "Germany", exchange: "XETRA", currency: "EUR", description: "Regional brewer facing volume declines and cost inflation.", baseRevenue: 4700, revGrowth: 0.01, revVol: 0.04, grossMargin: 0.44, opMargin: 0.09, netMargin: 0.05, fcfMargin: 0.06, marginDrift: -0.6, marginVol: 1.3, employeesPerRevM: 3.1, psRatio: 1.2, sharePrice: 46 },
  { ticker: "YUZU", name: "Yuzu Holdings", sector: "Consumer Staples", industry: "Beverages", country: "Japan", exchange: "TSE", currency: "JPY", description: "Tea, coffee and vending beverages across Asia.", baseRevenue: 1250000, revGrowth: 0.04, revVol: 0.02, grossMargin: 0.49, opMargin: 0.11, netMargin: 0.07, fcfMargin: 0.08, marginDrift: 0.3, marginVol: 0.8, employeesPerRevM: 0.02, psRatio: 1.6, sharePrice: 5100 },
  { ticker: "ANDE", name: "Andean Refrescos", sector: "Consumer Staples", industry: "Beverages", country: "United States", exchange: "NYSE", currency: "USD", description: "Latin-American soft-drink bottler and distributor.", baseRevenue: 6100, revGrowth: 0.09, revVol: 0.05, grossMargin: 0.46, opMargin: 0.14, netMargin: 0.09, fcfMargin: 0.1, marginDrift: 0.6, marginVol: 1.1, employeesPerRevM: 4.8, psRatio: 1.9, sharePrice: 63 },

  // ---- Health Care / Pharmaceuticals ----
  { ticker: "AXPH", name: "Axiom Pharma", sector: "Health Care", industry: "Pharmaceuticals", country: "United States", exchange: "NYSE", currency: "USD", description: "Specialty pharma with immunology and oncology franchises.", baseRevenue: 11800, revGrowth: 0.1, revVol: 0.04, grossMargin: 0.78, opMargin: 0.33, netMargin: 0.26, fcfMargin: 0.3, marginDrift: 0.3, marginVol: 1.4, employeesPerRevM: 1.6, psRatio: 5.5, sharePrice: 168 },
  { ticker: "HELV", name: "Helvetia Therapeutics", sector: "Health Care", industry: "Pharmaceuticals", country: "Switzerland", exchange: "SIX", currency: "CHF", description: "Diversified Swiss pharmaceutical and diagnostics group.", baseRevenue: 24500, revGrowth: 0.05, revVol: 0.02, grossMargin: 0.72, opMargin: 0.29, netMargin: 0.23, fcfMargin: 0.25, marginDrift: 0.1, marginVol: 0.9, employeesPerRevM: 2.0, psRatio: 4.2, sharePrice: 285 },
  { ticker: "NOVR", name: "Novara Biosciences", sector: "Health Care", industry: "Pharmaceuticals", country: "United States", exchange: "NASDAQ", currency: "USD", description: "Clinical-stage biotech; first product launched two years ago.", baseRevenue: 140, revGrowth: 0.85, revVol: 0.3, grossMargin: 0.81, opMargin: -0.6, netMargin: -0.62, fcfMargin: -0.45, marginDrift: 9, marginVol: 6, employeesPerRevM: 5.5, psRatio: 15, sharePrice: 44 },
  { ticker: "GENR", name: "Generix Labs", sector: "Health Care", industry: "Pharmaceuticals", country: "United States", exchange: "NYSE", currency: "USD", description: "High-volume generic drug maker; persistent price erosion.", baseRevenue: 7900, revGrowth: -0.01, revVol: 0.04, grossMargin: 0.41, opMargin: 0.1, netMargin: 0.04, fcfMargin: 0.07, marginDrift: -0.8, marginVol: 1.6, employeesPerRevM: 3.9, psRatio: 1.1, sharePrice: 21 },
  { ticker: "KYOP", name: "Kyowa Pharma KK", sector: "Health Care", industry: "Pharmaceuticals", country: "Japan", exchange: "TSE", currency: "JPY", description: "Japanese mid-cap pharma focused on CNS therapies.", baseRevenue: 380000, revGrowth: 0.06, revVol: 0.05, grossMargin: 0.69, opMargin: 0.18, netMargin: 0.13, fcfMargin: 0.14, marginDrift: 0.2, marginVol: 1.5, employeesPerRevM: 0.018, psRatio: 3, sharePrice: 3120 },

  // ---- Consumer Discretionary / Apparel Retail ----
  { ticker: "LOOM", name: "Loomcraft Retail", sector: "Consumer Discretionary", industry: "Apparel Retail", country: "United States", exchange: "NYSE", currency: "USD", description: "Athleisure brand with direct-to-consumer focus.", baseRevenue: 2900, revGrowth: 0.19, revVol: 0.06, grossMargin: 0.57, opMargin: 0.2, netMargin: 0.15, fcfMargin: 0.13, marginDrift: 0.4, marginVol: 1.2, employeesPerRevM: 9.5, psRatio: 4, sharePrice: 118 },
  { ticker: "MERC", name: "Mercado Modas", sector: "Consumer Discretionary", industry: "Apparel Retail", country: "United States", exchange: "NASDAQ", currency: "USD", description: "Fast-fashion e-commerce marketplace.", baseRevenue: 5100, revGrowth: 0.14, revVol: 0.09, grossMargin: 0.38, opMargin: 0.05, netMargin: 0.03, fcfMargin: 0.04, marginDrift: 0.2, marginVol: 1.8, employeesPerRevM: 6.2, psRatio: 1.3, sharePrice: 27 },
  { ticker: "SAVL", name: "Savile & Sons plc", sector: "Consumer Discretionary", industry: "Apparel Retail", country: "United Kingdom", exchange: "LSE", currency: "GBP", description: "Heritage menswear retailer; store closures weighing on sales.", baseRevenue: 1400, revGrowth: -0.04, revVol: 0.05, grossMargin: 0.52, opMargin: 0.04, netMargin: 0.01, fcfMargin: 0.03, marginDrift: -0.7, marginVol: 1.5, employeesPerRevM: 11, psRatio: 0.6, sharePrice: 2.1 },
  { ticker: "HANA", name: "Hanabi Apparel", sector: "Consumer Discretionary", industry: "Apparel Retail", country: "Japan", exchange: "TSE", currency: "JPY", description: "Global basics retailer expanding across Southeast Asia.", baseRevenue: 2100000, revGrowth: 0.11, revVol: 0.04, grossMargin: 0.5, opMargin: 0.13, netMargin: 0.09, fcfMargin: 0.1, marginDrift: 0.5, marginVol: 1.0, employeesPerRevM: 0.026, psRatio: 2.4, sharePrice: 8900 },

  // ---- Industrials / Airlines ----
  { ticker: "ZPHR", name: "Zephyr Airways", sector: "Industrials", industry: "Airlines", country: "United States", exchange: "NYSE", currency: "USD", description: "Low-cost carrier with point-to-point network.", baseRevenue: 8600, revGrowth: 0.13, revVol: 0.14, grossMargin: 0.27, opMargin: 0.11, netMargin: 0.07, fcfMargin: 0.05, marginDrift: 0.3, marginVol: 2.6, employeesPerRevM: 2.6, psRatio: 0.9, sharePrice: 39 },
  { ticker: "ALBT", name: "Albatros Air Group", sector: "Industrials", industry: "Airlines", country: "Germany", exchange: "XETRA", currency: "EUR", description: "European flag-carrier group with cargo and maintenance units.", baseRevenue: 21500, revGrowth: 0.07, revVol: 0.12, grossMargin: 0.22, opMargin: 0.06, netMargin: 0.03, fcfMargin: 0.02, marginDrift: -0.2, marginVol: 2.2, employeesPerRevM: 4.4, psRatio: 0.4, sharePrice: 9.8 },
  { ticker: "TSUB", name: "Tsubame Airlines", sector: "Industrials", industry: "Airlines", country: "Japan", exchange: "TSE", currency: "JPY", description: "Full-service Asian carrier rebuilding international routes.", baseRevenue: 1480000, revGrowth: 0.09, revVol: 0.1, grossMargin: 0.24, opMargin: 0.08, netMargin: 0.05, fcfMargin: 0.04, marginDrift: 0.4, marginVol: 1.9, employeesPerRevM: 0.024, psRatio: 0.7, sharePrice: 2980 },
  { ticker: "CNDR", name: "Condor Pacific", sector: "Industrials", industry: "Airlines", country: "United States", exchange: "NASDAQ", currency: "USD", description: "Regional carrier; heavy fuel exposure and volatile earnings.", baseRevenue: 3100, revGrowth: 0.03, revVol: 0.16, grossMargin: 0.21, opMargin: 0.02, netMargin: -0.01, fcfMargin: -0.02, marginDrift: -0.3, marginVol: 3.2, employeesPerRevM: 3.0, psRatio: 0.35, sharePrice: 11 },
];
