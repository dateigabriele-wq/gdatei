import Link from "next/link";

export const metadata = { title: "Methodology — Quantile" };

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <pre className="num mt-3 overflow-x-auto rounded-lg border border-line bg-panel2 px-4 py-3 text-[13px] leading-relaxed">
      {children}
    </pre>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card mt-6 p-6">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="eyebrow">Methodology</p>
      <h1 className="font-display text-3xl font-semibold">How Quantile scores companies</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Every score is a transparent, rules-based percentile ranking — no black box. This page documents the exact
        formula, the same one implemented in the scoring engine and covered by automated tests. Scores describe
        historical financial characteristics only; they are not investment recommendations.
      </p>

      <Section title="The overall score">
        <p>
          Each company receives an overall score from 0 to 100, blending three category scores. Defaults are
          40 / 30 / 30, and you can adjust them on the comparison page — scores recalculate instantly.
        </p>
        <Formula>{`Overall Score = (Margin Score × 40%)
              + (Growth Score × 30%)
              + (Sales Performance Score × 30%)`}</Formula>
      </Section>

      <Section title="Percentile normalization">
        <p>
          Every raw metric (a margin, a growth rate, revenue per employee…) is converted to a 0–100 score by ranking
          it against a peer group:
        </p>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>
            <strong className="text-ink">Peer group.</strong> The company&apos;s industry by default. If fewer than 4
            industry peers report the metric, we widen to the sector, then to the whole market. You can also force
            market-wide ranking.
          </li>
          <li>
            <strong className="text-ink">Winsorization.</strong> Values are capped at the peer group&apos;s 5th and
            95th percentiles so a single extreme outlier cannot distort everyone else&apos;s rank.
          </li>
          <li>
            <strong className="text-ink">Percentile rank.</strong> A company at the 90th percentile for operating
            margin gets ≈90 points for that metric; the 25th percentile gets ≈25. Ties receive the midpoint rank.
          </li>
          <li>
            <strong className="text-ink">Negative-value floors.</strong> Negative margins are capped at 30 points and
            negative growth at 35, no matter how they rank — losing money should not score well just because peers
            lose more.
          </li>
        </ol>
      </Section>

      <Section title="Margin Score — 40% of overall">
        <p>Built from four margins using trailing-twelve-month data when available:</p>
        <Formula>{`Margin Score = Gross × 25% + Operating × 35% + Net × 25% + FCF × 15%

Each margin's score = Level (percentile of TTM margin)      × 60%
                    + Stability (inverse of 5y volatility)   × 20%
                    + Trend (3-year change in the margin)    × 20%`}</Formula>
        <p>
          High, stable, improving margins are rewarded. Negative margins, high volatility, and consistent declines are
          penalized. Company pages also display each margin&apos;s current value, 3- and 5-year averages, the 3- and
          5-year change in percentage points, and a trend indicator.
        </p>
      </Section>

      <Section title="Growth Score — 30% of overall">
        <Formula>{`Growth Score = Revenue × 35% + Operating income × 20%
             + EPS × 25% + Free cash flow × 20%

Each metric = Latest YoY × 20% + 3y CAGR × 40% + 5y CAGR × 40%

Volatility penalty: up to −10 points when year-to-year revenue
growth is highly erratic.`}</Formula>
        <p>
          Weighting the 3- and 5-year compound growth rates at 80% combined prevents one unusually strong year from
          dominating. The volatility penalty reduces scores driven by erratic, one-off jumps rather than consistent
          organic performance. (When acquisition-vs-organic breakdowns are available from a data provider, they can be
          incorporated at this step.)
        </p>
      </Section>

      <Section title="Sales Performance Score — 30% of overall">
        <Formula>{`Sales Score = Relative revenue size × 20%
            + Revenue per employee  × 25%
            + 3y revenue CAGR       × 25%
            + 5y revenue CAGR       × 20%
            + Revenue consistency   × 10%

Relative revenue size = ½ × percentile of revenue vs peers
                      + ½ × percentile of revenue ÷ market cap`}</Formula>
        <p>
          Companies are never ranked on raw revenue alone — that would simply reward being big. Size is judged
          relative to industry peers and to the company&apos;s own market capitalization, and productivity (revenue
          per employee) and consistency carry more than half the weight.
        </p>
      </Section>

      <Section title="Missing data & completeness">
        <p>
          A company is never given a zero just because a figure is unavailable. Missing metrics are clearly labeled
          &ldquo;no data&rdquo;, and:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            If at least 50% of a category&apos;s weight has data, the missing weight is redistributed across the
            available metrics in that category.
          </li>
          <li>
            If a whole category lacks sufficient data, it is left unscored and its weight is redistributed across the
            other categories.
          </li>
          <li>
            Every company displays a <strong className="text-ink">data-completeness score</strong> (0–100): the share
            of weighted scoring inputs that were available.
          </li>
        </ul>
      </Section>

      <Section title="Currencies & data provenance">
        <p>
          Companies reporting in different currencies are compared in USD using current exchange rates; company pages
          let you toggle back to as-reported figures. Every page shows the data source, last-updated time, reporting
          currency, fiscal period, and whether figures are annual or trailing twelve months. The data layer is
          provider-agnostic, so the underlying financial-data API can be swapped without changing any scoring logic.
        </p>
      </Section>

      <Section title="Worked example">
        <Formula>{`A company scores:  Margins 82 · Growth 64 · Sales 71

Overall = 82 × 0.40 + 64 × 0.30 + 71 × 0.30
        = 32.8 + 19.2 + 21.3
        = 73.3`}</Formula>
        <p>
          Every company page includes a &ldquo;Why this score&rdquo; table showing each metric&apos;s raw value,
          percentile, score, weight, and peer scope — so you can trace any score back to the underlying financials.
        </p>
      </Section>

      <p className="mt-8 text-sm text-muted">
        See it in action:{" "}
        <Link href="/rankings" className="text-accent hover:underline">
          Rankings
        </Link>{" "}
        ·{" "}
        <Link href="/" className="text-accent hover:underline">
          Screener
        </Link>
      </p>
    </div>
  );
}
