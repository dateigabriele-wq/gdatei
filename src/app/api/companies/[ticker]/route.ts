import { NextRequest, NextResponse } from "next/server";
import { getProvider, cached } from "@/lib/data";
import { scoreUniverse } from "@/lib/scoring/engine";

// Allow more time than the 10s Hobby default for bulk live-provider fetches.
export const maxDuration = 60;

export async function GET(_req: NextRequest, { params }: { params: { ticker: string } }) {
  try {
    const ticker = params.ticker?.toUpperCase();
    if (!ticker || !/^[A-Z0-9.\-]{1,10}$/.test(ticker)) {
      return NextResponse.json({ error: "Invalid ticker." }, { status: 400 });
    }
    const provider = getProvider();
    const [rec, all, fx] = await Promise.all([
      provider.getCompany(ticker),
      cached("all-records", 21600, () => provider.getAll()),
      cached("fx", 21600, () => provider.getFxRates()),
    ]);
    if (!rec) return NextResponse.json({ error: `No company found for ${ticker}.` }, { status: 404 });

    const scores = scoreUniverse(all, (r) => fx.rates[r.profile.currency]);
    const score = scores.find((s) => s.ticker === ticker) ?? null;

    return NextResponse.json({
      profile: rec.profile,
      financials: rec.financials,
      score,
      fx,
      source: provider.sourceName,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unexpected error" }, { status: 500 });
  }
}
