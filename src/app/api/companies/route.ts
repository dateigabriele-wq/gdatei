import { NextRequest, NextResponse } from "next/server";
import { getProvider, cached } from "@/lib/data";
import type { SearchFilters } from "@/lib/types";

// Allow more time than the 10s Hobby default for bulk live-provider fetches.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const filters: SearchFilters = {
      query: clean(sp.get("query")),
      sector: clean(sp.get("sector")),
      industry: clean(sp.get("industry")),
      country: clean(sp.get("country")),
      exchange: clean(sp.get("exchange")),
      capBucket: parseCap(sp.get("cap")),
    };
    const provider = getProvider();
    const [companies, all, fx] = await Promise.all([
      provider.listCompanies(filters),
      cached("all-profiles", 21600, () => provider.listCompanies()),
      cached("fx", 21600, () => provider.getFxRates()),
    ]);
    const options = {
      sectors: uniq(all.map((c) => c.sector)),
      industries: uniq(all.map((c) => c.industry)),
      countries: uniq(all.map((c) => c.country)),
      exchanges: uniq(all.map((c) => c.exchange)),
    };
    return NextResponse.json({
      companies: companies.map((c) => ({ ...c, marketCapUsd: c.marketCap * fx.rates[c.currency] })),
      options,
      source: provider.sourceName,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unexpected error" }, { status: 500 });
  }
}

function clean(v: string | null): string | undefined {
  if (!v) return undefined;
  const t = v.trim().slice(0, 80); // input validation: bounded length
  return t.length ? t : undefined;
}
function parseCap(v: string | null): SearchFilters["capBucket"] {
  return v === "large" || v === "mid" || v === "small" ? v : undefined;
}
function uniq(xs: string[]) {
  return Array.from(new Set(xs)).sort();
}
