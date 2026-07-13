"use client";
import { useState } from "react";
import type { CompanyScore } from "@/lib/types";
import { fmtScore, scoreTone } from "@/lib/format";

// ---------- Tooltip ----------
export function Tip({ text, children }: { text: string; children?: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center gap-1">
      {children}
      <button
        type="button"
        aria-label={text}
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-line text-[9px] leading-none text-muted hover:text-ink"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        onClick={() => setShow(!show)}
      >
        i
      </button>
      {show && (
        <span className="absolute bottom-full left-1/2 z-50 mb-1.5 w-56 -translate-x-1/2 rounded-lg border border-line bg-panel2 p-2 text-xs font-normal normal-case tracking-normal text-ink shadow-xl">
          {text}
        </span>
      )}
    </span>
  );
}

// ---------- Tone helpers ----------
const toneText = { good: "text-good", mid: "text-brass", bad: "text-bad", na: "text-muted" } as const;
const toneBg = { good: "bg-good", mid: "bg-brass", bad: "bg-bad", na: "bg-muted" } as const;

export function ScoreChip({ value, label, big }: { value: number | null; label?: string; big?: boolean }) {
  const tone = scoreTone(value);
  return (
    <div className="flex flex-col items-start">
      {label && <span className="eyebrow">{label}</span>}
      <span className={`num font-semibold ${big ? "text-4xl" : "text-xl"} ${toneText[tone]}`}>{fmtScore(value)}</span>
    </div>
  );
}

// ---------- Signature: weight bar (score decomposed into 40/30/30 contributions) ----------
export function WeightBar({
  score,
  weights,
  height = 8,
}: {
  score: Pick<CompanyScore, "margins" | "growth" | "sales" | "effectiveWeights" | "overall">;
  weights?: { margins: number; growth: number; sales: number };
  height?: number;
}) {
  const w = weights ?? score.effectiveWeights;
  const parts = [
    { label: "Margins", s: score.margins.score, w: w.margins, cls: "bg-accent" },
    { label: "Growth", s: score.growth.score, w: w.growth, cls: "bg-good" },
    { label: "Sales", s: score.sales.score, w: w.sales, cls: "bg-brass" },
  ];
  return (
    <div>
      <div
        className="flex w-full overflow-hidden rounded-full bg-panel2"
        style={{ height }}
        role="img"
        aria-label={`Score contribution — margins ${fmtScore(parts[0].s)}, growth ${fmtScore(parts[1].s)}, sales ${fmtScore(parts[2].s)}`}
      >
        {parts.map((p) => {
          return (
            <div key={p.label} className="flex" style={{ width: `${p.w * 100}%` }}>
              <div className={`${p.cls} opacity-90`} style={{ width: `${(p.s ?? 0)}%`, height }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        {parts.map((p) => (
          <span key={p.label}>
            <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle ${p.cls}`} />
            {p.label} {fmtScore(p.s)} · {Math.round(p.w * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- Completeness badge ----------
export function CompletenessBadge({ value }: { value: number }) {
  const tone = value >= 95 ? "good" : value >= 75 ? "mid" : "bad";
  return (
    <Tip text="Share of scored metric weight with underlying data. When a metric is missing, its weight is redistributed across available metrics instead of scoring it zero.">
      <span className={`num rounded-full border border-line px-2 py-0.5 text-[11px] ${toneText[tone]}`}>
        data {value}%
      </span>
    </Tip>
  );
}

// ---------- Trend arrow ----------
export function Trend({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted">—</span>;
  const up = value > 0;
  const flat = Math.abs(value) < 0.3;
  if (flat) return <span className="text-muted num">→ {value.toFixed(1)}pp</span>;
  return (
    <span className={`num ${up ? "text-good" : "text-bad"}`}>
      {up ? "▲" : "▼"} {Math.abs(value).toFixed(1)}pp
    </span>
  );
}

// ---------- Loading / empty / error states ----------
export function Loading({ label = "Loading data…" }: { label?: string }) {
  return (
    <div className="card flex items-center gap-3 p-6 text-sm text-muted" role="status">
      <span className="h-3 w-3 animate-pulse rounded-full bg-accent" />
      {label}
    </div>
  );
}
export function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="card border-bad/40 p-6 text-sm">
      <p className="font-medium text-bad">Something went wrong</p>
      <p className="mt-1 text-muted">{message}</p>
      {retry && (
        <button onClick={retry} className="mt-3 rounded-md border border-line px-3 py-1.5 text-sm hover:bg-panel2">
          Try again
        </button>
      )}
    </div>
  );
}
export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card p-8 text-center">
      <p className="font-display text-lg">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}

export { toneText, toneBg };
