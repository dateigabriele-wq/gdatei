import type { CompanyScore } from "../types";

const pct = (v: number | null, dp = 1) => (v == null ? "n/a" : `${(v * 100).toFixed(dp)}%`);

/**
 * Builds strengths / weaknesses / risks / explanation strictly from the
 * computed scores and underlying metrics. No investment recommendations.
 */
export function buildNarrative(s: CompanyScore) {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const risks: string[] = [];

  const allMetrics = [...s.margins.metrics, ...s.growth.metrics, ...s.sales.metrics];
  const scored = allMetrics.filter((m) => m.score != null);
  const top = [...scored].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const bottom = [...scored].sort((a, b) => (a.score ?? 0) - (b.score ?? 0));

  for (const m of top.slice(0, 3)) {
    if ((m.score ?? 0) >= 70) {
      strengths.push(`${m.label} ranks in roughly the ${ord(m.percentile ?? Math.round(m.score!))} percentile of ${scopeText(m.peerScope, s)}.`);
    }
  }
  for (const m of bottom.slice(0, 3)) {
    if ((m.score ?? 100) <= 40) {
      weaknesses.push(`${m.label} sits near the ${ord(m.percentile ?? Math.round(m.score!))} percentile of ${scopeText(m.peerScope, s)}.`);
    }
  }

  // Risks from underlying data
  for (const d of s.marginDetails) {
    if (d.current != null && d.current < 0) risks.push(`Negative ${d.label.toLowerCase()} (${pct(d.current)}).`);
    else if (d.trend === "declining" && (d.change3y ?? 0) < -1.5)
      risks.push(`${d.label} has fallen ${Math.abs(d.change3y!).toFixed(1)}pp over three years.`);
    if ((d.volatility ?? 0) > 3) risks.push(`${d.label} has been volatile (±${d.volatility!.toFixed(1)}pp year to year).`);
  }
  if (s.growthVolatilityPenalty >= 5) risks.push(`Revenue growth is unusually volatile versus peers (−${s.growthVolatilityPenalty} pts applied to the Growth Score).`);
  if ((s.salesDetail.revYoY ?? 0) < 0) risks.push(`Revenue declined ${pct(Math.abs(s.salesDetail.revYoY!))} in the latest period.`);
  if (s.completeness < 85) risks.push(`Only ${s.completeness}% of scored metrics have data; scores rely on redistributed weights.`);

  // Explanation sentence
  const good = strengths.length ? strengths.slice(0, 2).map(shortClause).join(" and ") : null;
  const bad = weaknesses.length ? weaknesses.slice(0, 2).map(shortClause).join(" and ") : null;
  let explanation: string;
  const level =
    s.overall == null ? "cannot be fully scored" : s.overall >= 70 ? "scores highly" : s.overall >= 45 ? "earns a middling score" : "scores poorly";
  explanation = `${s.name} ${level}`;
  if (good) explanation += ` because ${good}`;
  if (bad) explanation += `${good ? ". Its score is held back by" : " mainly because of"} ${bad}`;
  explanation += `. Scores are percentile ranks versus ${s.peerScope === "market" ? "the whole market" : `${s.industry} peers`} and describe historical financial data only — they are not investment advice.`;

  if (strengths.length === 0) strengths.push("No metric ranks in the top third of its peer group.");
  if (weaknesses.length === 0) weaknesses.push("No metric ranks in the bottom third of its peer group.");
  if (risks.length === 0) risks.push("No notable financial red flags in the metrics tracked here.");

  return { strengths, weaknesses, risks: dedupe(risks).slice(0, 5), explanation };
}

function shortClause(sentence: string): string {
  return sentence.replace(/\.$/, "").replace(/^([A-Z])/, (m) => m.toLowerCase());
}
function scopeText(scope: string, s: CompanyScore) {
  return scope === "industry" ? `${s.industry} peers` : scope === "sector" ? `${s.sector} companies` : "the whole market";
}
function ord(n: number) {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? "th" : ["th", "st", "nd", "rd"][Math.min(n % 10, 4)] ?? "th";
  return `${n}${suffix}`;
}
function dedupe(xs: string[]) {
  return Array.from(new Set(xs));
}
