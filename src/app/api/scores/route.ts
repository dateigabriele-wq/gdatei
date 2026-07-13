import { NextRequest, NextResponse } from "next/server";
import { getProvider, cached } from "@/lib/data";
import { scoreUniverse } from "@/lib/scoring/engine";
import { DEFAULT_WEIGHTS, type CategoryWeights } from "@/lib/types";

// Allow more time than the 10s Hobby default for bulk live-provider fetches.
export const maxDuration = 60;

/**
 * GET /api/scores?weights=40,30,30&scope=auto|market&tickers=NMBS,HELX
 * Returns the scored universe (or the requested subset), always computed
 * against the full peer universe so percentiles stay meaningful.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const weights = parseWeights(sp.get("weights"));
    const scope = sp.get("scope") === "market" ? "market" : "auto";
    const tickers = sp
      .get("tickers")
      ?.split(",")
      .map((t) => t.trim().toUpperCase())
      .filter((t) => /^[A-Z0-9.\-]{1,10}$/.test(t)) // input validation
      .slice(0, 40);

    const provider = getProvider();
    const [all, fx] = await Promise.all([
      cached("all-records", 21600, () => provider.getAll()),
      cached("fx", 21600, () => provider.getFxRates()),
    ]);
    const scores = scoreUniverse(all, (r) => fx.rates[r.profile.currency], { weights, scope });
    const filtered = tickers?.length ? scores.filter((s) => tickers.includes(s.ticker)) : scores;

    return NextResponse.json({
      scores: filtered,
      weights,
      scope,
      source: provider.sourceName,
      fx,
      lastUpdated: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unexpected error" }, { status: 500 });
  }
}

function parseWeights(v: string | null): CategoryWeights {
  if (!v) return DEFAULT_WEIGHTS;
  const parts = v.split(",").map(Number);
  if (parts.length !== 3 || parts.some((p) => !isFinite(p) || p < 0 || p > 100)) return DEFAULT_WEIGHTS;
  const [m, g, s] = parts;
  if (m + g + s <= 0) return DEFAULT_WEIGHTS;
  return { margins: m, growth: g, sales: s };
}
