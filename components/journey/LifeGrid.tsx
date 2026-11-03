"use client";

import { useState } from "react";
import Link from "next/link";
import { colourLabel, monthName, type MonthCell } from "@/lib/life-months";
import type { MonthReflection } from "@/lib/actions/life";
import { YearStrip } from "./YearStrip";

// The optional 1,000 Months view. On a phone it opens on one year at a time
// (previous / next), with the full grid one tap away; on a wide screen the
// full grid shows straight away. Rows are labelled by calendar year, never by
// age, and there's no count of what's left.
export function LifeGrid({
  rows,
  reflections,
  currentYear,
}: {
  rows: { year: number; months: MonthCell[] }[];
  reflections: Record<string, MonthReflection>;
  currentYear: number;
}) {
  const first = rows[0].year;
  const last = rows[rows.length - 1].year;
  const [year, setYear] = useState(Math.min(last, Math.max(first, currentYear)));
  const [all, setAll] = useState(false);
  const row = rows.find((r) => r.year === year) ?? rows[0];

  return (
    <div className={all ? "lm-wrap show-all" : "lm-wrap"}>
      <div className="lm-yearview">
        <div className="lm-yearnav">
          <button type="button" className="btn btn-g" onClick={() => setYear(year - 1)} disabled={year <= first} aria-label={`Show ${year - 1}`}>←</button>
          <b>{year}</b>
          <button type="button" className="btn btn-g" onClick={() => setYear(year + 1)} disabled={year >= last} aria-label={`Show ${year + 1}`}>→</button>
        </div>
        <YearStrip months={row.months} reflections={reflections} />
        {year !== currentYear ? (
          <button type="button" className="au-text-link as-btn" onClick={() => setYear(currentYear)}>Back to this year</button>
        ) : null}
        <button type="button" className="au-text-link as-btn lm-toggle" onClick={() => setAll(true)}>See all 1,000 months</button>
      </div>

      <div className="lm-grid" role="list" aria-label="Your 1,000 months, a row per year">
        {rows.map((r, i) => (
          // The last few rows fade softly, so the edge of the grid doesn't read as an end point.
          <div key={r.year} role="listitem" className={`lm-row${r.year === currentYear ? " is-now" : ""}`} style={rows.length - i <= 6 ? { opacity: 0.2 + 0.13 * (rows.length - i - 1) } : undefined}>
            <span className="lm-rowyear">{r.year % 5 === 0 || r.year === currentYear || r.year === first ? r.year : ""}</span>
            <span className="lm-rowcells">
              {r.months.map((m) => {
                const c = reflections[m.ym]?.colour;
                const cls = `lm-cell is-${m.state}${c ? ` c-${c}` : ""}`;
                return m.state === "past" || m.state === "current" ? (
                  <Link key={m.ym} href={`/journey/months/${m.ym}`} className={cls} title={`${monthName(m.ym)}${c ? `: ${colourLabel(c)}` : ""}`} aria-label={`${monthName(m.ym)}${c ? `: ${colourLabel(c)}` : ""}`} />
                ) : (
                  <span key={m.ym} className={cls} aria-hidden="true" />
                );
              })}
            </span>
          </div>
        ))}
        <button type="button" className="au-text-link as-btn lm-toggle" onClick={() => setAll(false)}>Back to one year at a time</button>
      </div>
    </div>
  );
}
