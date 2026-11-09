import { formatDate } from "@/lib/audit-schedule";
import type { CalibratedArea } from "@/lib/calibration";

// The chart a member went through with their coach ("Take your chart
// further"): for each area, the score they gave alone, the score agreed
// together (their new starting point), what the scores mean for them, and the
// areas they chose to focus on.
export function CalibratedChart({ chart, coachName }: { chart: { sharedAt: string; areas: (CalibratedArea & { name: string })[] }; coachName: string | null }) {
  const focus = chart.areas.filter((a) => a.focus);
  return (
    <section className="pf-tile calc" aria-labelledby="calc-h">
      <h2 id="calc-h" className="pl-h">Your chart, taken further</h2>
      <p className="pf-sub">
        Agreed {coachName ? `with ${coachName} ` : ""}on {formatDate(chart.sharedAt)}. These scores are your starting point from here; the
        ones you gave on your own are kept too.
      </p>
      {focus.length ? <p className="calc-focus">Focusing on: {focus.map((a) => a.name).join(" · ")}</p> : null}
      <ul className="calc-list">
        {chart.areas.filter((a) => a.agreed !== null || a.definition).map((a) => (
          <li key={a.life_area_id} className={a.focus ? "is-focus" : undefined}>
            <div className="calc-row">
              <b>{a.name}</b>
              <span>
                {a.alone !== null && a.agreed !== null && a.alone !== a.agreed ? <span className="calc-alone">{a.alone} on your own → </span> : null}
                {a.agreed !== null ? <b className="calc-agreed">{a.agreed}/10</b> : null}
              </span>
            </div>
            {a.definition ? <p className="calc-def">{a.definition}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
