import Link from "next/link";
import { colourLabel, monthName, type MonthCell } from "@/lib/life-months";
import type { MonthReflection } from "@/lib/actions/life";

const INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

// One calendar year as twelve months: a month they've reflected on wears the
// colour they chose, this month is emphasised, the rest stay neutral. Months
// that have begun open their month page.
export function YearStrip({ months, reflections, label }: { months: MonthCell[]; reflections: Record<string, MonthReflection>; label?: string }) {
  return (
    <ol className="lm-year" aria-label={label ?? `${months[0].ym.slice(0, 4)}, month by month`}>
      {months.map((m, i) => {
        const r = reflections[m.ym];
        const name = monthName(m.ym);
        const words = `${name}${m.state === "current" ? ", this month" : ""}${r?.colour ? `: ${colourLabel(r.colour)}` : ""}`;
        const dot = <span className={`lm-dot is-${m.state}${r?.colour ? ` c-${r.colour}` : ""}`} aria-hidden="true" />;
        return (
          <li key={m.ym}>
            {m.state === "past" || m.state === "current" ? (
              <Link href={`/journey/months/${m.ym}`} aria-label={words}>{dot}<span className="lm-initial">{INITIALS[i]}</span></Link>
            ) : (
              <span aria-label={m.state === "before" ? undefined : words}>{dot}<span className="lm-initial">{INITIALS[i]}</span></span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function ColourKey() {
  return (
    <ul className="lm-key" aria-label="Month colours">
      {(["inspired", "aligned", "growing", "restoring", "navigating", "drifting"] as const).map((c) => (
        <li key={c}><span className={`lm-dot is-past c-${c}`} aria-hidden="true" />{colourLabel(c)}</li>
      ))}
    </ul>
  );
}
