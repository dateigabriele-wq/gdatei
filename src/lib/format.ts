import type { Currency } from "./types";

export const CCY_SYMBOL: Record<Currency, string> = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", CHF: "CHF " };

export function fmtMoney(v: number | null | undefined, ccy: Currency = "USD"): string {
  if (v == null || !isFinite(v)) return "—";
  const abs = Math.abs(v);
  const sym = CCY_SYMBOL[ccy];
  const f = (n: number, u: string) => `${sym}${n.toFixed(n >= 100 ? 0 : 1)}${u}`;
  if (abs >= 1e12) return f(v / 1e12, "T");
  if (abs >= 1e9) return f(v / 1e9, "B");
  if (abs >= 1e6) return f(v / 1e6, "M");
  if (abs >= 1e3) return f(v / 1e3, "K");
  return `${sym}${v.toFixed(2)}`;
}

export function fmtPct(v: number | null | undefined, dp = 1): string {
  if (v == null || !isFinite(v)) return "—";
  return `${(v * 100).toFixed(dp)}%`;
}

export function fmtPp(v: number | null | undefined, dp = 1): string {
  if (v == null || !isFinite(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(dp)}pp`;
}

export function fmtScore(v: number | null | undefined): string {
  return v == null ? "—" : v.toFixed(0);
}

export function scoreTone(v: number | null | undefined): "good" | "mid" | "bad" | "na" {
  if (v == null) return "na";
  if (v >= 65) return "good";
  if (v >= 40) return "mid";
  return "bad";
}
